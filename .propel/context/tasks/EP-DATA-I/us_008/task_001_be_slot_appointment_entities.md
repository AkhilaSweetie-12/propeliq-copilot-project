---
title: "Task — AppointmentSlot & Appointment EF Core Entities, Enums, DbSets & OnModelCreating Configuration"
task_id: task_001
story_id: us_008
epic: EP-DATA-I
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_008] — `appointment_slots` & `appointments` Entities
- Story Location: `.propel/context/tasks/EP-DATA-I/us_008/us_008.md`
- Acceptance Criteria:
  - AC-3: `preferred_slot_id` nullable FK — persists `NULL` when absent; enforced FK when present; invalid UUID raises `DbUpdateException`
  - AC-5: No cascade-delete on `appointments.slot_id`; soft-deleting a slot (setting `is_available = FALSE`) never deletes appointment rows; historical traceability preserved
  - AC-6: `AuditTimestampInterceptor` (us_007) sets `Appointment.UpdatedAt`; `AppointmentSlot` intentionally has NO `UpdatedAt` column
  - Edge Case 1: FK violation on `appointments.slot_id` → `DbUpdateException` → service catches and throws `SlotNotFoundException`
  - Edge Case 2: WalkIn guest bookings create a minimal `User` row first (role='Patient', status='Active') before the `Appointment` row — FK always satisfied before INSERT

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
| DB Driver | Npgsql | 9.x |
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
Create the `AppointmentSlot` and `Appointment` EF core entity classes. Define `AppointmentStatus` (Confirmed / Arrived / Cancelled / NoShow) and `BookingType` (Online / WalkIn) enums. Register `DbSet<AppointmentSlot>` and `DbSet<Appointment>` in `ApplicationDbContext`. Configure all relationships in `OnModelCreating`: two FKs on `appointments.patient_id` → `users.user_id`, `appointments.slot_id` → `appointment_slots.slot_id` (restrict — no cascade delete, AC-5), `appointments.preferred_slot_id` → `appointment_slots.slot_id` (nullable, restrict), `appointments.created_by` → `users.user_id`. Update `AuditTimestampInterceptor` to cover `Appointment` entity (AC-6). Create `SlotNotFoundException` and `IAppointmentRepository` / `IAppointmentSlotRepository` interfaces (stub). Note: `IAppointmentSlotRepository.TryAcquireSlotAsync` with `SELECT FOR UPDATE` is implemented in task_003.

## Dependent Tasks
- `us_007 task_001_be_user_entity_value_converters.md` — `User` entity and `DbSet<User>` must exist; `appointments.patient_id` and `appointments.created_by` FK to `users.user_id`.
- `task_002_db_appointment_migrations.md` (same story) — migration generates the DB schema; entity config here drives the migration scaffold.

## Impacted Components
- `/api/Features/Booking/Entities/AppointmentSlot.cs` — CREATE: entity class; no `UpdatedAt` property
- `/api/Features/Booking/Entities/Appointment.cs` — CREATE: entity class + `AppointmentStatus` enum + `BookingType` enum
- `/api/Features/Booking/Exceptions/SlotNotFoundException.cs` — CREATE: domain exception for FK violation on `slot_id`
- `/api/Features/Booking/Services/IAppointmentSlotRepository.cs` — CREATE: interface stub (full SELECT FOR UPDATE method in task_003)
- `/api/Features/Booking/Services/IAppointmentRepository.cs` — UPDATE: replace us_006 placeholder with full booking interface
- `/api/Data/ApplicationDbContext.cs` — MODIFY: add `DbSet<AppointmentSlot>`, `DbSet<Appointment>`, FK config in `OnModelCreating`
- `/api/Infrastructure/Interceptors/AuditTimestampInterceptor.cs` — MODIFY: extend `SetTimestamps` to cover `Appointment` entity

## Implementation Plan

1. **Create `AppointmentSlot.cs`** entity (AC-1 columns, no `UpdatedAt` — AC-6):
   ```csharp
   // /api/Features/Booking/Entities/AppointmentSlot.cs
   namespace Api.Features.Booking.Entities;

   /// <summary>
   /// Represents an available time block on the scheduling calendar.
   /// Immutable after creation except for is_available (soft-disable).
   /// No UpdatedAt column by design (AC-6) — only is_available changes post-creation.
   /// </summary>
   public sealed class AppointmentSlot
   {
       public Guid           SlotId          { get; set; }
       public DateOnly       SlotDate        { get; set; }
       public TimeOnly       SlotTime        { get; set; }
       public int            DurationMinutes { get; set; }
       public bool           IsAvailable     { get; set; } = true;
       public DateTimeOffset CreatedAt       { get; set; }

       // Navigation — appointments that booked this slot
       public ICollection<Appointment> Appointments         { get; set; } = [];
       // Navigation — appointments that prefer this slot (waitlist)
       public ICollection<Appointment> PreferredByAppointments { get; set; } = [];
   }
   ```

2. **Create `Appointment.cs`** entity with enums (AC-2, AC-3):
   ```csharp
   // /api/Features/Booking/Entities/Appointment.cs
   namespace Api.Features.Booking.Entities;

   public enum AppointmentStatus { Confirmed, Arrived, Cancelled, NoShow }
   public enum BookingType        { Online, WalkIn }

   /// <summary>
   /// Booking record linking a patient to an appointment slot.
   /// preferred_slot_id is nullable — set when patient requests a swap to a preferred slot (AC-3).
   /// </summary>
   public sealed class Appointment
   {
       public Guid               AppointmentId     { get; set; }
       public Guid               PatientId         { get; set; }
       public Guid               SlotId            { get; set; }
       public AppointmentStatus  Status            { get; set; }
       public Guid?              PreferredSlotId   { get; set; }   // nullable FK (AC-3)
       public BookingType        BookingType       { get; set; }
       public Guid               CreatedBy         { get; set; }
       public DateTimeOffset     CreatedAt         { get; set; }
       public DateTimeOffset     UpdatedAt         { get; set; }

       // Navigation properties
       public AppointmentSlot    Slot              { get; set; } = null!;
       public AppointmentSlot?   PreferredSlot     { get; set; }
   }
   ```

3. **Create `SlotNotFoundException.cs`** (EC-1):
   ```csharp
   namespace Api.Features.Booking.Exceptions;

   /// <summary>
   /// Thrown when an appointment INSERT fails due to a missing slot_id FK reference.
   /// Wraps DbUpdateException to prevent leaking database internals (OWASP A05).
   /// </summary>
   public sealed class SlotNotFoundException : Exception
   {
       public SlotNotFoundException(Guid slotId)
           : base($"Appointment slot {slotId} was not found or is no longer available.")
       {
       }
   }
   ```

4. **Create `IAppointmentSlotRepository.cs`** stub (full SELECT FOR UPDATE method in task_003):
   ```csharp
   using Api.Features.Booking.Entities;

   namespace Api.Features.Booking.Services;

   /// <summary>
   /// Repository contract for appointment_slots.
   /// TryAcquireSlotAsync (SELECT FOR UPDATE locking) is defined in task_003.
   /// </summary>
   public interface IAppointmentSlotRepository
   {
       Task<AppointmentSlot?>          FindByIdAsync(Guid slotId, CancellationToken ct = default);
       Task<IReadOnlyList<AppointmentSlot>> GetAvailableAsync(DateOnly date, CancellationToken ct = default);
       Task<AppointmentSlot>           CreateAsync(AppointmentSlot slot, CancellationToken ct = default);

       /// <summary>
       /// Sets is_available = false (soft-disable). Does NOT delete associated appointment rows (AC-5).
       /// </summary>
       Task                            DisableAsync(Guid slotId, CancellationToken ct = default);

       // TryAcquireSlotAsync defined in task_003 (SELECT FOR UPDATE)
   }
   ```

5. **Update `IAppointmentRepository.cs`** — replace us_006 placeholder with full interface:
   ```csharp
   using Api.Features.Booking.Entities;

   namespace Api.Features.Booking.Services;

   /// <summary>
   /// Repository contract for appointments.
   /// Hard-delete is intentionally absent — status transitions (Cancelled/NoShow) are the only removal pattern.
   /// </summary>
   public interface IAppointmentRepository
   {
       Task<Appointment?>              FindByIdAsync(Guid appointmentId, CancellationToken ct = default);
       Task<IReadOnlyList<Appointment>> GetByPatientAsync(Guid patientId, CancellationToken ct = default);
       Task<Appointment>               CreateAsync(Appointment appointment, CancellationToken ct = default);
       Task                            UpdateStatusAsync(Guid appointmentId, AppointmentStatus status, CancellationToken ct = default);
       Task<IReadOnlyList<Appointment>> GetByPreferredSlotAsync(Guid preferredSlotId, CancellationToken ct = default);
   }
   ```

6. **Modify `ApplicationDbContext.cs`** — add DbSets and FK configuration:
   ```csharp
   // DbSets (add to class body):
   public DbSet<AppointmentSlot> AppointmentSlots => Set<AppointmentSlot>();
   public DbSet<Appointment>     Appointments      => Set<Appointment>();

   // In OnModelCreating — AppointmentSlot:
   modelBuilder.Entity<AppointmentSlot>(entity =>
   {
       entity.ToTable("appointment_slots");
       entity.HasKey(s => s.SlotId);
       entity.Property(s => s.SlotId).HasColumnName("slot_id").HasDefaultValueSql("gen_random_uuid()");
       entity.Property(s => s.SlotDate).HasColumnName("slot_date").IsRequired();
       entity.Property(s => s.SlotTime).HasColumnName("slot_time").IsRequired();
       entity.Property(s => s.DurationMinutes).HasColumnName("duration_minutes").IsRequired();
       entity.Property(s => s.IsAvailable).HasColumnName("is_available").IsRequired().HasDefaultValue(true);
       entity.Property(s => s.CreatedAt).HasColumnName("created_at").IsRequired();
       entity.HasIndex(s => new { s.SlotDate, s.SlotTime })
             .IsUnique().HasDatabaseName("uq_appointment_slots_date_time");
   });

   // In OnModelCreating — Appointment:
   modelBuilder.Entity<Appointment>(entity =>
   {
       entity.ToTable("appointments");
       entity.HasKey(a => a.AppointmentId);
       entity.Property(a => a.AppointmentId).HasColumnName("appointment_id").HasDefaultValueSql("gen_random_uuid()");
       entity.Property(a => a.PatientId).HasColumnName("patient_id").IsRequired();
       entity.Property(a => a.SlotId).HasColumnName("slot_id").IsRequired();
       entity.Property(a => a.Status).HasColumnName("status").IsRequired()
             .HasConversion(v => v.ToString(), v => Enum.Parse<AppointmentStatus>(v));
       entity.Property(a => a.PreferredSlotId).HasColumnName("preferred_slot_id");  // nullable
       entity.Property(a => a.BookingType).HasColumnName("booking_type").IsRequired()
             .HasConversion(v => v.ToString(), v => Enum.Parse<BookingType>(v));
       entity.Property(a => a.CreatedBy).HasColumnName("created_by").IsRequired();
       entity.Property(a => a.CreatedAt).HasColumnName("created_at").IsRequired();
       entity.Property(a => a.UpdatedAt).HasColumnName("updated_at").IsRequired();

       // FK: patient_id → users.user_id (RESTRICT — no cascade)
       entity.HasOne<User>().WithMany().HasForeignKey(a => a.PatientId)
             .OnDelete(DeleteBehavior.Restrict);

       // FK: slot_id → appointment_slots.slot_id (RESTRICT — AC-5: no cascade delete)
       entity.HasOne(a => a.Slot).WithMany(s => s.Appointments).HasForeignKey(a => a.SlotId)
             .OnDelete(DeleteBehavior.Restrict);

       // FK: preferred_slot_id → appointment_slots.slot_id (nullable, RESTRICT — AC-3)
       entity.HasOne(a => a.PreferredSlot).WithMany(s => s.PreferredByAppointments)
             .HasForeignKey(a => a.PreferredSlotId).IsRequired(false)
             .OnDelete(DeleteBehavior.Restrict);

       // FK: created_by → users.user_id (RESTRICT)
       entity.HasOne<User>().WithMany().HasForeignKey(a => a.CreatedBy)
             .OnDelete(DeleteBehavior.Restrict);
   });
   ```

7. **Modify `AuditTimestampInterceptor.cs`** — extend `SetTimestamps` to cover `Appointment` (AC-6):
   ```csharp
   // Replace the foreach block to also cover Appointment:
   foreach (var entry in context.ChangeTracker.Entries())
   {
       if (entry.Entity is User user)
       {
           if (entry.State == EntityState.Modified) user.UpdatedAt = now;
           if (entry.State == EntityState.Added)  { user.CreatedAt = now; user.UpdatedAt = now; }
       }
       else if (entry.Entity is Appointment appt)
       {
           if (entry.State == EntityState.Modified) appt.UpdatedAt = now;
           if (entry.State == EntityState.Added)  { appt.CreatedAt = now; appt.UpdatedAt = now; }
       }
       else if (entry.Entity is AppointmentSlot slot && entry.State == EntityState.Added)
       {
           // AppointmentSlot has only CreatedAt — no UpdatedAt by design (AC-6)
           slot.CreatedAt = now;
       }
   }
   ```

8. **Register repositories in DI** (add to `Program.cs` service registration):
   ```csharp
   services.AddScoped<IAppointmentSlotRepository, AppointmentSlotRepository>();
   services.AddScoped<IAppointmentRepository, AppointmentRepository>();
   ```
   The concrete implementations (`AppointmentSlotRepository`, `AppointmentRepository`) are created here as stubs; the SELECT FOR UPDATE method is added in task_003.

## Current Project State
```
/api/
├── Data/ApplicationDbContext.cs          # us_007: WILL BE MODIFIED
├── Features/
│   ├── Users/Entities/User.cs            # us_007: must exist (FK target)
│   └── Booking/                          # NOT YET CREATED — created by this task
│       └── Services/
│           └── IAppointmentRepository.cs # us_006 placeholder — WILL BE REPLACED
└── Infrastructure/Interceptors/
    └── AuditTimestampInterceptor.cs      # us_007: WILL BE MODIFIED
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Features/Booking/Entities/AppointmentSlot.cs` | Entity with 6 columns; no `UpdatedAt`; navigation collections for Appointments and PreferredByAppointments |
| CREATE | `/api/Features/Booking/Entities/Appointment.cs` | Entity + `AppointmentStatus` enum + `BookingType` enum; nullable `PreferredSlotId` FK (AC-3) |
| CREATE | `/api/Features/Booking/Exceptions/SlotNotFoundException.cs` | Domain exception; safe message; no DB internals |
| CREATE | `/api/Features/Booking/Services/IAppointmentSlotRepository.cs` | `FindByIdAsync`, `GetAvailableAsync`, `CreateAsync`, `DisableAsync`; `TryAcquireSlotAsync` stub comment pointing to task_003 |
| UPDATE | `/api/Features/Booking/Services/IAppointmentRepository.cs` | Replace us_006 stub with full interface: `FindByIdAsync`, `GetByPatientAsync`, `CreateAsync`, `UpdateStatusAsync`, `GetByPreferredSlotAsync` |
| MODIFY | `/api/Data/ApplicationDbContext.cs` | Add `DbSet<AppointmentSlot>`, `DbSet<Appointment>`; full FK config with `DeleteBehavior.Restrict` on all FKs; composite unique index |
| MODIFY | `/api/Infrastructure/Interceptors/AuditTimestampInterceptor.cs` | Extend `SetTimestamps` to cover `Appointment`; `AppointmentSlot` sets only `CreatedAt` |

## External References
- EF Core relationships — configure foreign keys: https://learn.microsoft.com/en-us/ef/core/modeling/relationships
- EF Core `DeleteBehavior.Restrict`: https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete
- Npgsql `DateOnly`/`TimeOnly` EF Core mapping: https://www.npgsql.org/efcore/mapping/datetime.html
- DR-002 / DR-003 source: `.propel/context/docs/design.md`
- NFR-013 (SELECT FOR UPDATE locking): covered in task_003

## Build Commands
```bash
# Build to verify entity/context config compiles
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet build api/Api.csproj --configuration Debug

# Verify EF Core can scaffold the migration (review before applying — task_002 applies it)
dotnet ef migrations add AppointmentSlotAndAppointment --project api/Api.csproj --no-build
```

## Implementation Validation Strategy
- [ ] `dotnet build api/Api.csproj` succeeds with no errors after all entity and context changes
- [ ] EF Core migration scaffold (`dotnet ef migrations add`) reflects all 9 columns for `appointments` and 6 for `appointment_slots`
- [ ] `AppointmentStatus.NoShow.ToString()` = `"NoShow"`; `BookingType.WalkIn.ToString()` = `"WalkIn"` — enum string conversion verified
- [ ] `DeleteBehavior.Restrict` confirmed on all 4 FKs via EF Core model metadata inspection
- [ ] `AuditTimestampInterceptor` sets `Appointment.UpdatedAt` without service caller involvement; `AppointmentSlot.CreatedAt` set on add; no `AppointmentSlot.UpdatedAt` property exists

## Implementation Checklist
- [ ] Create `AppointmentSlot.cs`: 6 columns, `IsAvailable = true` default, navigation collections; no `UpdatedAt`
- [ ] Create `Appointment.cs`: 10 columns, `AppointmentStatus` enum, `BookingType` enum, nullable `PreferredSlotId`, navigation properties
- [ ] Create `SlotNotFoundException.cs`: safe message with slot ID, no DB internals
- [ ] Create `IAppointmentSlotRepository.cs`: `FindByIdAsync`, `GetAvailableAsync`, `CreateAsync`, `DisableAsync`
- [ ] Update `IAppointmentRepository.cs`: replace placeholder with 5-method full interface
- [ ] Modify `ApplicationDbContext.cs`: `DbSet<AppointmentSlot>`, `DbSet<Appointment>`, FK config `DeleteBehavior.Restrict` on all 4 FKs, composite unique index
- [ ] Modify `AuditTimestampInterceptor.cs`: cover `Appointment` (Updated + CreatedAt) and `AppointmentSlot` (CreatedAt only)
- [ ] Add `services.AddScoped<IAppointmentSlotRepository, AppointmentSlotRepository>()` + `IAppointmentRepository` to `Program.cs`
