---
title: "Task — SELECT FOR UPDATE Row-Level Lock Repository Implementation (NFR-013 Slot Concurrency)"
task_id: task_003
story_id: us_008
epic: EP-DATA-I
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_003

## Requirement Reference
- User Story: [us_008] — `appointment_slots` & `appointments` Entities
- Story Location: `.propel/context/tasks/EP-DATA-I/us_008/us_008.md`
- Acceptance Criteria:
  - AC-4: `IAppointmentSlotRepository.TryAcquireSlotAsync` acquires a `SELECT ... FOR UPDATE` row lock; concurrent callers block until the first transaction commits; verified by the validation strategy below (NFR-013)
  - Edge Case 3: Two threads race to acquire the same slot — the `SELECT FOR UPDATE` lock serialises them; the second transaction reads the updated `is_available = FALSE` and does not double-assign

## Design References (Frontend Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No |
| **Figma URL** | N/A |
| **Wireframe Status** | N/A |
| **Wireframe Type** | N/A |
| **Wireframe Path/URL** | N/A |
| **Screen Spec** | N/A |
| **UXR Requirements** | N/A |
| **Design Tokens** | N/A |

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Backend | ASP.NET Core | 9.0 LTS |
| Language | C# | 13 |
| ORM | EF Core | 9.x |
| DB Driver | Npgsql | 9.x (supports `FOR UPDATE` via `FromSqlRaw`) |
| AI/ML | N/A | N/A |
| Mobile | N/A | N/A |

## AI References (AI Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |
| **AI Pattern** | N/A |
| **Prompt Template Path** | N/A |
| **Guardrails Config** | N/A |
| **Model Provider** | N/A |

## Mobile References (Mobile Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |
| **Platform Target** | N/A |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

## Task Overview
Add `TryAcquireSlotAsync` to `IAppointmentSlotRepository` — a method that opens a database transaction, issues `SELECT ... FOR UPDATE` on the target `appointment_slots` row, checks `is_available`, and if available sets `is_available = FALSE` within the same transaction before returning. If unavailable, the transaction rolls back and returns `false`. Implement `AppointmentSlotRepository` (concrete class) with this method and the stubs defined in task_001. Create the `SlotLockService` that composes the repository and transaction to provide a clean booking-layer contract. Validate the serialisation behaviour in the Implementation Validation Strategy.

## Dependent Tasks
- `task_001_be_slot_appointment_entities.md` (same story) — `IAppointmentSlotRepository` stub interface and `AppointmentSlot` entity must exist.
- `task_002_db_appointment_migrations.md` (same story) — `appointment_slots` table with `is_available` column and all constraints must be applied before testing.

## Impacted Components
- `/api/Features/Booking/Services/IAppointmentSlotRepository.cs` — MODIFY: add `TryAcquireSlotAsync` method signature
- `/api/Features/Booking/Services/AppointmentSlotRepository.cs` — CREATE: concrete implementation with `SELECT FOR UPDATE` in `TryAcquireSlotAsync`
- `/api/Features/Booking/Services/AppointmentRepository.cs` — CREATE: concrete implementation stub; catches FK violation → `SlotNotFoundException`
- `/api/Features/Booking/Services/SlotLockService.cs` — CREATE: booking-layer service composing `TryAcquireSlotAsync` with error handling

## Implementation Plan

1. **Add `TryAcquireSlotAsync` to `IAppointmentSlotRepository`** (AC-4):
   ```csharp
   // Add to /api/Features/Booking/Services/IAppointmentSlotRepository.cs
   /// <summary>
   /// Acquires a SELECT FOR UPDATE row lock on the slot within the provided transaction.
   /// Returns true and sets is_available = false if the slot was available.
   /// Returns false if the slot is already unavailable (does NOT throw — caller decides).
   /// The transaction must be committed by the caller after this method returns true.
   /// NFR-013: row-level lock ensures concurrent booking requests are serialised.
   /// </summary>
   Task<bool> TryAcquireSlotAsync(
       Guid slotId,
       IDbContextTransaction transaction,
       CancellationToken ct = default);
   ```

2. **Create `AppointmentSlotRepository.cs`** — concrete implementation (AC-4, EC-3):
   ```csharp
   using Api.Data;
   using Api.Features.Booking.Entities;
   using Microsoft.EntityFrameworkCore;
   using Microsoft.EntityFrameworkCore.Storage;

   namespace Api.Features.Booking.Services;

   public sealed class AppointmentSlotRepository : IAppointmentSlotRepository
   {
       private readonly ApplicationDbContext _db;

       public AppointmentSlotRepository(ApplicationDbContext db) => _db = db;

       public Task<AppointmentSlot?> FindByIdAsync(Guid slotId, CancellationToken ct = default)
           => _db.AppointmentSlots.FirstOrDefaultAsync(s => s.SlotId == slotId, ct);

       public Task<IReadOnlyList<AppointmentSlot>> GetAvailableAsync(DateOnly date, CancellationToken ct = default)
           => _db.AppointmentSlots
                 .Where(s => s.SlotDate == date && s.IsAvailable)
                 .OrderBy(s => s.SlotTime)
                 .ToListAsync(ct)
                 .ContinueWith<IReadOnlyList<AppointmentSlot>>(t => t.Result, ct);

       public async Task<AppointmentSlot> CreateAsync(AppointmentSlot slot, CancellationToken ct = default)
       {
           _db.AppointmentSlots.Add(slot);
           await _db.SaveChangesAsync(ct);
           return slot;
       }

       public async Task DisableAsync(Guid slotId, CancellationToken ct = default)
       {
           var slot = await FindByIdAsync(slotId, ct)
               ?? throw new KeyNotFoundException($"Appointment slot {slotId} not found.");
           slot.IsAvailable = false;
           await _db.SaveChangesAsync(ct);
       }

       /// <summary>
       /// Acquires a PostgreSQL row-level lock via SELECT ... FOR UPDATE, then atomically
       /// marks the slot as unavailable within the caller-provided transaction (AC-4 / NFR-013).
       ///
       /// Concurrency contract:
       /// - Caller MUST open a transaction before calling this method.
       /// - Caller MUST commit the transaction after this method returns true.
       /// - If is_available is already false, returns false; caller should NOT commit.
       /// - The FOR UPDATE lock is held until the transaction commits or rolls back.
       /// </summary>
       public async Task<bool> TryAcquireSlotAsync(
           Guid slotId,
           IDbContextTransaction transaction,
           CancellationToken ct = default)
       {
           // SELECT ... FOR UPDATE acquires a row-level exclusive lock (NFR-013 / AC-4).
           // Concurrent callers block here until the first transaction releases the lock.
           // Parameterised query — slotId is passed as a typed parameter to prevent SQL injection.
           var slot = await _db.AppointmentSlots
               .FromSqlRaw(
                   "SELECT * FROM appointment_slots WHERE slot_id = {0} FOR UPDATE",
                   slotId)
               .FirstOrDefaultAsync(ct);

           if (slot is null || !slot.IsAvailable)
               return false;   // EC-3: second thread reads is_available = false and returns

           // Atomically mark unavailable within the same transaction
           slot.IsAvailable = false;
           await _db.SaveChangesAsync(ct);
           return true;
       }
   }
   ```
   Security note: `FromSqlRaw` with `{0}` parameter placeholder is parameterised — Npgsql sends the `slotId` as a `$1` bind parameter, not string-interpolated into SQL. This prevents SQL injection (OWASP A03).

3. **Create `AppointmentRepository.cs`** concrete stub (EC-1 — FK violation → `SlotNotFoundException`):
   ```csharp
   using Api.Data;
   using Api.Features.Booking.Entities;
   using Api.Features.Booking.Exceptions;
   using Microsoft.EntityFrameworkCore;

   namespace Api.Features.Booking.Services;

   public sealed class AppointmentRepository : IAppointmentRepository
   {
       private readonly ApplicationDbContext _db;

       public AppointmentRepository(ApplicationDbContext db) => _db = db;

       public Task<Appointment?> FindByIdAsync(Guid id, CancellationToken ct = default)
           => _db.Appointments.FirstOrDefaultAsync(a => a.AppointmentId == id, ct);

       public Task<IReadOnlyList<Appointment>> GetByPatientAsync(Guid patientId, CancellationToken ct = default)
           => _db.Appointments.Where(a => a.PatientId == patientId)
                 .ToListAsync(ct)
                 .ContinueWith<IReadOnlyList<Appointment>>(t => t.Result, ct);

       public async Task<Appointment> CreateAsync(Appointment appointment, CancellationToken ct = default)
       {
           try
           {
               _db.Appointments.Add(appointment);
               await _db.SaveChangesAsync(ct);
               return appointment;
           }
           catch (DbUpdateException ex)
               when (ex.InnerException?.Message.Contains("appointments_slot_id_fkey",
                         StringComparison.Ordinal) == true)
           {
               throw new SlotNotFoundException(appointment.SlotId);
           }
       }

       public async Task UpdateStatusAsync(Guid id, AppointmentStatus status, CancellationToken ct = default)
       {
           var appt = await FindByIdAsync(id, ct)
               ?? throw new KeyNotFoundException($"Appointment {id} not found.");
           appt.Status = status;
           await _db.SaveChangesAsync(ct);
       }

       public Task<IReadOnlyList<Appointment>> GetByPreferredSlotAsync(
           Guid preferredSlotId, CancellationToken ct = default)
           => _db.Appointments.Where(a => a.PreferredSlotId == preferredSlotId)
                 .ToListAsync(ct)
                 .ContinueWith<IReadOnlyList<Appointment>>(t => t.Result, ct);
   }
   ```

4. **Create `SlotLockService.cs`** — booking-layer orchestration of the lock + appointment creation:
   ```csharp
   using Api.Data;
   using Api.Features.Booking.Entities;

   namespace Api.Features.Booking.Services;

   /// <summary>
   /// Orchestrates the SELECT FOR UPDATE slot acquisition and appointment creation
   /// within a single database transaction (NFR-013 / AC-4).
   /// </summary>
   public sealed class SlotLockService
   {
       private readonly ApplicationDbContext       _db;
       private readonly IAppointmentSlotRepository _slots;
       private readonly IAppointmentRepository     _appointments;

       public SlotLockService(
           ApplicationDbContext db,
           IAppointmentSlotRepository slots,
           IAppointmentRepository appointments)
       {
           _db           = db;
           _slots        = slots;
           _appointments = appointments;
       }

       /// <summary>
       /// Atomically acquires the slot and creates the appointment within one transaction.
       /// Returns null if the slot is already taken (caller shows "slot unavailable" to user).
       /// </summary>
       public async Task<Appointment?> BookSlotAsync(
           Guid patientId,
           Guid slotId,
           BookingType bookingType,
           Guid createdBy,
           Guid? preferredSlotId = null,
           CancellationToken ct = default)
       {
           await using var tx = await _db.Database.BeginTransactionAsync(ct);

           var acquired = await _slots.TryAcquireSlotAsync(slotId, tx, ct);
           if (!acquired)
           {
               await tx.RollbackAsync(ct);
               return null;   // slot already taken — no appointment created
           }

           var appointment = new Appointment
           {
               PatientId       = patientId,
               SlotId          = slotId,
               Status          = AppointmentStatus.Confirmed,
               PreferredSlotId = preferredSlotId,
               BookingType     = bookingType,
               CreatedBy       = createdBy,
           };

           await _appointments.CreateAsync(appointment, ct);
           await tx.CommitAsync(ct);
           return appointment;
       }
   }
   ```

5. **Update `Program.cs`** DI registrations for the concrete implementations:
   ```csharp
   services.AddScoped<IAppointmentSlotRepository, AppointmentSlotRepository>();
   services.AddScoped<IAppointmentRepository, AppointmentRepository>();
   services.AddScoped<SlotLockService>();
   ```

## Current Project State
```
/api/Features/Booking/
├── Entities/
│   ├── AppointmentSlot.cs           # task_001: created
│   └── Appointment.cs               # task_001: created
├── Exceptions/
│   └── SlotNotFoundException.cs     # task_001: created
└── Services/
    ├── IAppointmentSlotRepository.cs  # task_001: stub — WILL BE MODIFIED
    └── IAppointmentRepository.cs      # task_001: full interface
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `/api/Features/Booking/Services/IAppointmentSlotRepository.cs` | Add `TryAcquireSlotAsync(Guid, IDbContextTransaction, CancellationToken)` method signature |
| CREATE | `/api/Features/Booking/Services/AppointmentSlotRepository.cs` | Concrete impl with `SELECT * FROM appointment_slots WHERE slot_id = {0} FOR UPDATE` parameterised query; returns `false` if slot unavailable; marks `IsAvailable = false` within transaction |
| CREATE | `/api/Features/Booking/Services/AppointmentRepository.cs` | Concrete impl; `CreateAsync` catches FK violation → `SlotNotFoundException`; `UpdateStatusAsync` for status transitions |
| CREATE | `/api/Features/Booking/Services/SlotLockService.cs` | Transaction orchestration: `BeginTransactionAsync` → `TryAcquireSlotAsync` → `CreateAsync` → `CommitAsync`; rollback on slot unavailable |
| MODIFY | `/api/Program.cs` | Add `AddScoped` registrations for `AppointmentSlotRepository`, `AppointmentRepository`, `SlotLockService` |

## External References
- EF Core `FromSqlRaw` parameterised queries: https://learn.microsoft.com/en-us/ef/core/querying/sql-queries#passing-parameters
- PostgreSQL `SELECT FOR UPDATE`: https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE
- EF Core transactions: https://learn.microsoft.com/en-us/ef/core/saving/transactions
- NFR-013 concurrency requirement: `.propel/context/docs/design.md#NFR-013`
- OWASP A03 (SQL Injection) — parameterised query pattern: https://owasp.org/Top10/A03_2021-Injection/

## Build Commands
```bash
# Build
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet build api/Api.csproj --configuration Debug

# Run full test suite (confirms no regressions from DI changes)
dotnet test api.tests/Api.Tests.csproj --configuration Release
```

## Implementation Validation Strategy
- [ ] `TryAcquireSlotAsync` called with an available slot: `is_available` column transitions `TRUE → FALSE` within the transaction; returns `true`
- [ ] `TryAcquireSlotAsync` called a second time on the same (now unavailable) slot: returns `false` without modifying the row
- [ ] `SlotLockService.BookSlotAsync` for an available slot creates an `Appointment` row and sets `is_available = FALSE` atomically; no orphaned state if `CreateAsync` throws
- [ ] `FromSqlRaw` query uses parameterised `{0}` placeholder — confirmed via Npgsql query log showing `$1` bind parameter, not literal UUID (OWASP A03)
- [ ] `AppointmentRepository.CreateAsync` with a non-existent `slot_id` raises `SlotNotFoundException` (no `DbUpdateException` leaks to callers)
- [ ] `dotnet build` succeeds; all DI registrations resolve without `InvalidOperationException` at startup

## Implementation Checklist
- [ ] Add `TryAcquireSlotAsync(Guid, IDbContextTransaction, CancellationToken)` to `IAppointmentSlotRepository`
- [ ] Create `AppointmentSlotRepository.cs`: all 5 interface methods; `TryAcquireSlotAsync` uses `FromSqlRaw("SELECT * FROM appointment_slots WHERE slot_id = {0} FOR UPDATE", slotId)` with typed parameter
- [ ] Create `AppointmentRepository.cs`: all 5 interface methods; `CreateAsync` catches `DbUpdateException` with `appointments_slot_id_fkey` → `SlotNotFoundException`
- [ ] Create `SlotLockService.cs`: `BeginTransactionAsync` → `TryAcquireSlotAsync` → `CreateAsync` → `CommitAsync`; `RollbackAsync` on slot unavailable
- [ ] Register `AppointmentSlotRepository`, `AppointmentRepository`, `SlotLockService` as `AddScoped` in `Program.cs`
- [ ] Run `dotnet build` — confirms no compile errors or DI registration failures
