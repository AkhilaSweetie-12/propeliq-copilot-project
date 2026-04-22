---
title: "Task — WaitlistEntry & Notification EF Core Entities, Enums, DbSets, Repositories & Domain Exceptions"
task_id: task_001
story_id: us_009
epic: EP-DATA-I
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_009] — `waitlist_entries` & `notifications` Entities
- Story Location: `.propel/context/tasks/EP-DATA-I/us_009/us_009.md`
- Acceptance Criteria:
  - AC-3: FIFO query `OrderBy(e => e.RequestedAt).Where(e => e.SlotId == targetSlotId && e.Status == WaitlistStatus.Waiting).FirstOrDefaultAsync()` returns the entry with the earliest `requested_at`; relies on index from task_002
  - AC-4: `attempt_count` incremented and `error_message` populated on failure; subsequent query `status = 'Failed' AND attempt_count < 2` surfaces the notification for retry (NFR-012)
  - AC-5: `entry.Status = WaitlistStatus.Fulfilled` persists row; `position` unchanged; `status='Waiting'` filter excludes it — no hard-delete
  - AC-6: `sent_at` nullable — `NULL` when Pending; set to `DateTimeOffset.UtcNow` on successful delivery
  - Edge Case 1: Duplicate active waitlist entry → `DbUpdateException` on partial UNIQUE → `AlreadyOnWaitlistException`
  - Edge Case 2: `notifications.appointment_id` FK is `RESTRICT` — appointment cancellation (status change only) preserves notification rows for audit
  - Edge Case 3: Non-contiguous `position` after cancellation — FIFO ordering uses `requested_at`; `position` is display-only and never recalculated

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
Create the `WaitlistEntry` and `Notification` EF Core entity classes. Define `WaitlistStatus` (Waiting / Fulfilled / Cancelled), `NotificationChannel` (SMS / Email), and `NotificationStatus` (Pending / Sent / Failed) enums. Register `DbSet<WaitlistEntry>` and `DbSet<Notification>` in `ApplicationDbContext` with full `OnModelCreating` FK and constraint configuration. Create `IWaitlistRepository` (FIFO query, add, cancel, fulfill — no hard-delete) and `INotificationRepository` (create, mark-sent, increment-attempt, get-pending-retry). Create `AlreadyOnWaitlistException` domain exception. Note: `AuditTimestampInterceptor` is NOT extended here — neither entity has `UpdatedAt`; `WaitlistEntry` uses `requested_at` (insert-only) and `Notification` uses `scheduled_at`/`sent_at`; both are set explicitly by the service layer.

## Dependent Tasks
- `us_007 task_001_be_user_entity_value_converters.md` — `User` entity must exist; `WaitlistEntry.PatientId` FKs to `users.user_id`.
- `us_008 task_001_be_slot_appointment_entities.md` — `AppointmentSlot` and `Appointment` entities must exist; FKs target both tables.
- `task_002_db_waitlist_notification_migration.md` (same story) — the partial UNIQUE index that enforces EC-1 is created in the migration.

## Impacted Components
- `/api/Features/Waitlist/Entities/WaitlistEntry.cs` — CREATE: entity + `WaitlistStatus` enum
- `/api/Features/Notifications/Entities/Notification.cs` — CREATE: entity + `NotificationChannel` enum + `NotificationStatus` enum
- `/api/Features/Waitlist/Exceptions/AlreadyOnWaitlistException.cs` — CREATE: domain exception for duplicate active waitlist entry
- `/api/Features/Waitlist/Services/IWaitlistRepository.cs` — CREATE: FIFO queue interface; no hard-delete
- `/api/Features/Notifications/Services/INotificationRepository.cs` — CREATE: delivery-tracking interface
- `/api/Data/ApplicationDbContext.cs` — MODIFY: add `DbSet<WaitlistEntry>`, `DbSet<Notification>`, FK config in `OnModelCreating`

## Implementation Plan

1. **Create `WaitlistEntry.cs`** entity with `WaitlistStatus` enum (AC-1 columns):
   ```csharp
   // /api/Features/Waitlist/Entities/WaitlistEntry.cs
   namespace Api.Features.Waitlist.Entities;

   public enum WaitlistStatus { Waiting, Fulfilled, Cancelled }

   /// <summary>
   /// Represents a patient's position in the FIFO waitlist for a specific appointment slot.
   /// FIFO order is determined by requested_at — position is display-only and never recalculated (EC-3).
   /// No UpdatedAt column — the row is effectively append-only; status transitions are the only mutations.
   /// </summary>
   public sealed class WaitlistEntry
   {
       public Guid            EntryId     { get; set; }
       public Guid            PatientId   { get; set; }
       public Guid            SlotId      { get; set; }
       public int             Position    { get; set; }                   // display-only; not recalculated on cancel
       public DateTimeOffset  RequestedAt { get; set; }
       public WaitlistStatus  Status      { get; set; } = WaitlistStatus.Waiting;
   }
   ```
   Design decisions:
   - No `UpdatedAt` — only `Status` can change post-insert; no audit interceptor coverage needed.
   - `Position` is set at insert time (next available integer) and never recalculated; FIFO queries use `RequestedAt` (EC-3).
   - No hard-delete property or method — `Status = WaitlistStatus.Cancelled` is the removal path (AC-5).

2. **Create `Notification.cs`** entity with enums (AC-2, AC-4, AC-6):
   ```csharp
   // /api/Features/Notifications/Entities/Notification.cs
   namespace Api.Features.Notifications.Entities;

   public enum NotificationChannel { SMS, Email }
   public enum NotificationStatus  { Pending, Sent, Failed }

   /// <summary>
   /// Tracks a single notification delivery attempt for an appointment.
   /// attempt_count and error_message are updated on failure for NFR-012 retry logic.
   /// sent_at is NULL until delivery succeeds (AC-6).
   /// </summary>
   public sealed class Notification
   {
       public Guid                NotificationId { get; set; }
       public Guid                AppointmentId  { get; set; }
       public NotificationChannel Channel        { get; set; }
       public NotificationStatus  Status         { get; set; } = NotificationStatus.Pending;
       public int                 AttemptCount   { get; set; } = 0;
       public DateTimeOffset      ScheduledAt    { get; set; }
       public DateTimeOffset?     SentAt         { get; set; }           // nullable — NULL until delivered (AC-6)
       public string?             ErrorMessage   { get; set; }           // nullable — populated on failure (AC-4)
   }
   ```

3. **Create `AlreadyOnWaitlistException.cs`** (EC-1):
   ```csharp
   namespace Api.Features.Waitlist.Exceptions;

   /// <summary>
   /// Thrown when a patient attempts to join a waitlist for a slot they are already actively waiting for.
   /// The partial UNIQUE constraint (patient_id, slot_id) WHERE status = 'Waiting' enforces this at DB level.
   /// Wraps DbUpdateException to prevent leaking database internals (OWASP A05).
   /// </summary>
   public sealed class AlreadyOnWaitlistException : Exception
   {
       public AlreadyOnWaitlistException(Guid patientId, Guid slotId)
           : base($"Patient {patientId} is already on the waitlist for slot {slotId}.")
       {
       }
   }
   ```

4. **Create `IWaitlistRepository.cs`** — FIFO queue interface (AC-3, AC-5, EC-3):
   ```csharp
   using Api.Features.Waitlist.Entities;

   namespace Api.Features.Waitlist.Services;

   /// <summary>
   /// Repository contract for waitlist_entries.
   /// Hard-delete is absent — status transitions (Fulfilled/Cancelled) are the only removal paths.
   /// FIFO ordering is by requested_at, not position (EC-3).
   /// </summary>
   public interface IWaitlistRepository
   {
       /// <summary>
       /// Returns the next patient in queue for the slot (earliest requested_at with status=Waiting).
       /// Returns null if no active waitlist entries exist for the slot (AC-3).
       /// </summary>
       Task<WaitlistEntry?>              GetNextInQueueAsync(Guid slotId, CancellationToken ct = default);

       Task<IReadOnlyList<WaitlistEntry>> GetBySlotAsync(Guid slotId, WaitlistStatus status, CancellationToken ct = default);

       /// <summary>
       /// Adds a new entry to the waitlist. position = current max position + 1 for the slot.
       /// Throws AlreadyOnWaitlistException if a Waiting entry already exists for this (patient, slot) pair.
       /// </summary>
       Task<WaitlistEntry>               AddAsync(Guid patientId, Guid slotId, CancellationToken ct = default);

       /// <summary>
       /// Sets status = Cancelled. Row is retained; position is unchanged (AC-5).
       /// </summary>
       Task                              CancelAsync(Guid entryId, CancellationToken ct = default);

       /// <summary>
       /// Sets status = Fulfilled. Row is retained; position is unchanged (AC-5).
       /// </summary>
       Task                              FulfillAsync(Guid entryId, CancellationToken ct = default);
   }
   ```

5. **Create `INotificationRepository.cs`** — delivery tracking interface (AC-4, AC-6):
   ```csharp
   using Api.Features.Notifications.Entities;

   namespace Api.Features.Notifications.Services;

   /// <summary>
   /// Repository contract for notifications.
   /// Rows are never deleted — delivery history is retained for audit (EC-2).
   /// </summary>
   public interface INotificationRepository
   {
       Task<Notification>               CreateAsync(Notification notification, CancellationToken ct = default);

       /// <summary>
       /// Sets status = Sent, populates sent_at = DateTimeOffset.UtcNow (AC-6).
       /// </summary>
       Task                             MarkSentAsync(Guid notificationId, CancellationToken ct = default);

       /// <summary>
       /// Increments attempt_count, sets status = Failed, populates error_message (AC-4).
       /// </summary>
       Task                             RecordFailureAsync(Guid notificationId, string errorMessage, CancellationToken ct = default);

       /// <summary>
       /// Returns notifications eligible for retry: status = Failed AND attempt_count &lt; maxAttempts (AC-4 / NFR-012).
       /// </summary>
       Task<IReadOnlyList<Notification>> GetPendingRetryAsync(int maxAttempts, CancellationToken ct = default);

       Task<IReadOnlyList<Notification>> GetByAppointmentAsync(Guid appointmentId, CancellationToken ct = default);
   }
   ```

6. **Modify `ApplicationDbContext.cs`** — add DbSets and FK configuration:
   ```csharp
   // DbSets (add to class body):
   public DbSet<WaitlistEntry> WaitlistEntries => Set<WaitlistEntry>();
   public DbSet<Notification>  Notifications   => Set<Notification>();

   // In OnModelCreating — WaitlistEntry:
   modelBuilder.Entity<WaitlistEntry>(entity =>
   {
       entity.ToTable("waitlist_entries");
       entity.HasKey(e => e.EntryId);
       entity.Property(e => e.EntryId).HasColumnName("entry_id").HasDefaultValueSql("gen_random_uuid()");
       entity.Property(e => e.PatientId).HasColumnName("patient_id").IsRequired();
       entity.Property(e => e.SlotId).HasColumnName("slot_id").IsRequired();
       entity.Property(e => e.Position).HasColumnName("position").IsRequired();
       entity.Property(e => e.RequestedAt).HasColumnName("requested_at").IsRequired();
       entity.Property(e => e.Status)
             .HasColumnName("status")
             .IsRequired()
             .HasDefaultValue(WaitlistStatus.Waiting)
             .HasConversion(v => v.ToString(), v => Enum.Parse<WaitlistStatus>(v));

       // FK: patient_id → users.user_id (RESTRICT)
       entity.HasOne<User>().WithMany().HasForeignKey(e => e.PatientId)
             .OnDelete(DeleteBehavior.Restrict);

       // FK: slot_id → appointment_slots.slot_id (RESTRICT)
       entity.HasOne<AppointmentSlot>().WithMany().HasForeignKey(e => e.SlotId)
             .OnDelete(DeleteBehavior.Restrict);

       // Composite index for FIFO query efficiency (AC-3)
       entity.HasIndex(e => new { e.SlotId, e.Status, e.RequestedAt })
             .HasDatabaseName("ix_waitlist_entries_slot_status_requested_at");

       // Note: partial UNIQUE on (patient_id, slot_id) WHERE status='Waiting' cannot be expressed
       // directly in EF Core fluent API — added via migrationBuilder.Sql() in task_002.
   });

   // In OnModelCreating — Notification:
   modelBuilder.Entity<Notification>(entity =>
   {
       entity.ToTable("notifications");
       entity.HasKey(n => n.NotificationId);
       entity.Property(n => n.NotificationId).HasColumnName("notification_id").HasDefaultValueSql("gen_random_uuid()");
       entity.Property(n => n.AppointmentId).HasColumnName("appointment_id").IsRequired();
       entity.Property(n => n.Channel)
             .HasColumnName("channel")
             .IsRequired()
             .HasConversion(v => v.ToString(), v => Enum.Parse<NotificationChannel>(v));
       entity.Property(n => n.Status)
             .HasColumnName("status")
             .IsRequired()
             .HasDefaultValue(NotificationStatus.Pending)
             .HasConversion(v => v.ToString(), v => Enum.Parse<NotificationStatus>(v));
       entity.Property(n => n.AttemptCount).HasColumnName("attempt_count").IsRequired().HasDefaultValue(0);
       entity.Property(n => n.ScheduledAt).HasColumnName("scheduled_at").IsRequired();
       entity.Property(n => n.SentAt).HasColumnName("sent_at");          // nullable — AC-6
       entity.Property(n => n.ErrorMessage).HasColumnName("error_message");  // nullable — AC-4

       // FK: appointment_id → appointments.appointment_id (RESTRICT — EC-2)
       entity.HasOne<Appointment>().WithMany().HasForeignKey(n => n.AppointmentId)
             .OnDelete(DeleteBehavior.Restrict);

       // Index for retry query: status + attempt_count (AC-4)
       entity.HasIndex(n => new { n.Status, n.AttemptCount })
             .HasDatabaseName("ix_notifications_status_attempt_count");
   });
   ```

7. **Create concrete stubs** `WaitlistRepository.cs` and `NotificationRepository.cs` — implements interfaces, catches `DbUpdateException` for partial UNIQUE → `AlreadyOnWaitlistException` (EC-1):

   `WaitlistRepository.cs` key methods:
   ```csharp
   public Task<WaitlistEntry?> GetNextInQueueAsync(Guid slotId, CancellationToken ct = default)
       => _db.WaitlistEntries
             .Where(e => e.SlotId == slotId && e.Status == WaitlistStatus.Waiting)
             .OrderBy(e => e.RequestedAt)   // AC-3: FIFO by requested_at
             .FirstOrDefaultAsync(ct);

   public async Task<WaitlistEntry> AddAsync(Guid patientId, Guid slotId, CancellationToken ct = default)
   {
       var position = await _db.WaitlistEntries
           .Where(e => e.SlotId == slotId)
           .MaxAsync(e => (int?)e.Position, ct) ?? 0;

       var entry = new WaitlistEntry
       {
           PatientId   = patientId,
           SlotId      = slotId,
           Position    = position + 1,
           RequestedAt = DateTimeOffset.UtcNow,
           Status      = WaitlistStatus.Waiting,
       };
       try
       {
           _db.WaitlistEntries.Add(entry);
           await _db.SaveChangesAsync(ct);
           return entry;
       }
       catch (DbUpdateException ex)
           when (ex.InnerException?.Message.Contains("uq_waitlist_active_patient_slot",
                     StringComparison.Ordinal) == true)
       {
           throw new AlreadyOnWaitlistException(patientId, slotId);  // EC-1
       }
   }
   ```

   `NotificationRepository.cs` key methods:
   ```csharp
   public async Task MarkSentAsync(Guid notificationId, CancellationToken ct = default)
   {
       var n = await _db.Notifications.FirstOrDefaultAsync(x => x.NotificationId == notificationId, ct)
           ?? throw new KeyNotFoundException($"Notification {notificationId} not found.");
       n.Status = NotificationStatus.Sent;
       n.SentAt = DateTimeOffset.UtcNow;   // AC-6: set on successful delivery
       await _db.SaveChangesAsync(ct);
   }

   public async Task RecordFailureAsync(Guid notificationId, string errorMessage, CancellationToken ct = default)
   {
       var n = await _db.Notifications.FirstOrDefaultAsync(x => x.NotificationId == notificationId, ct)
           ?? throw new KeyNotFoundException($"Notification {notificationId} not found.");
       n.AttemptCount++;                           // AC-4: increment
       n.Status       = NotificationStatus.Failed;
       n.ErrorMessage = errorMessage;              // AC-4: never log PHI — callers must sanitise the message
       await _db.SaveChangesAsync(ct);
   }

   public Task<IReadOnlyList<Notification>> GetPendingRetryAsync(int maxAttempts, CancellationToken ct = default)
       => _db.Notifications
             .Where(n => n.Status == NotificationStatus.Failed && n.AttemptCount < maxAttempts)
             .ToListAsync(ct)
             .ContinueWith<IReadOnlyList<Notification>>(t => t.Result, ct);  // AC-4: NFR-012
   ```
   Security note: `errorMessage` must never contain PHI. Callers are responsible for sanitising the error string before passing it to `RecordFailureAsync`.

8. **Register repositories in DI** (add to `Program.cs`):
   ```csharp
   services.AddScoped<IWaitlistRepository, WaitlistRepository>();
   services.AddScoped<INotificationRepository, NotificationRepository>();
   ```

## Current Project State
```
/api/
├── Data/ApplicationDbContext.cs          # us_007/us_008: WILL BE MODIFIED
├── Features/
│   ├── Users/Entities/User.cs            # us_007: FK target
│   └── Booking/Entities/
│       ├── AppointmentSlot.cs            # us_008: FK target
│       └── Appointment.cs               # us_008: FK target
└── Features/
    ├── Waitlist/                         # NOT YET CREATED — created by this task
    └── Notifications/                    # NOT YET CREATED — created by this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Features/Waitlist/Entities/WaitlistEntry.cs` | Entity + `WaitlistStatus` enum; no `UpdatedAt`; no hard-delete property |
| CREATE | `/api/Features/Notifications/Entities/Notification.cs` | Entity + `NotificationChannel` enum + `NotificationStatus` enum; nullable `SentAt` and `ErrorMessage` |
| CREATE | `/api/Features/Waitlist/Exceptions/AlreadyOnWaitlistException.cs` | Domain exception; safe message with patientId + slotId; no DB internals |
| CREATE | `/api/Features/Waitlist/Services/IWaitlistRepository.cs` | `GetNextInQueueAsync`, `GetBySlotAsync`, `AddAsync`, `CancelAsync`, `FulfillAsync`; no hard-delete |
| CREATE | `/api/Features/Waitlist/Services/WaitlistRepository.cs` | FIFO `OrderBy(RequestedAt)` query; `AddAsync` catches `DbUpdateException` for `uq_waitlist_active_patient_slot` → `AlreadyOnWaitlistException` |
| CREATE | `/api/Features/Notifications/Services/INotificationRepository.cs` | `CreateAsync`, `MarkSentAsync`, `RecordFailureAsync`, `GetPendingRetryAsync`, `GetByAppointmentAsync` |
| CREATE | `/api/Features/Notifications/Services/NotificationRepository.cs` | `RecordFailureAsync` increments `AttemptCount`; `MarkSentAsync` sets `SentAt = UtcNow`; `GetPendingRetryAsync` filters `Failed AND AttemptCount < maxAttempts` |
| MODIFY | `/api/Data/ApplicationDbContext.cs` | Add `DbSet<WaitlistEntry>`, `DbSet<Notification>`, FK config (all `DeleteBehavior.Restrict`), composite index on `(slot_id, status, requested_at)`, retry index on `(status, attempt_count)` |
| MODIFY | `/api/Program.cs` | Register `IWaitlistRepository`, `INotificationRepository` as `AddScoped` |

## External References
- EF Core LINQ `OrderBy` + `FirstOrDefaultAsync`: https://learn.microsoft.com/en-us/ef/core/querying/related-data
- EF Core partial UNIQUE index — raw SQL workaround: https://github.com/dotnet/efcore/issues/1814 (partial indexes not natively supported in EF Core fluent API; use `migrationBuilder.Sql()` in task_002)
- NFR-012 (at-least-one-retry): `.propel/context/docs/design.md#NFR-012`
- DR-004 / DR-011: `.propel/context/docs/design.md`

## Build Commands
```bash
# Verify build after entity and context changes
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet build api/Api.csproj --configuration Debug

# Scaffold migration to verify EF Core picks up both entities correctly (task_002 applies it)
dotnet ef migrations add WaitlistAndNotifications --project api/Api.csproj --no-build
```

## Implementation Validation Strategy
- [ ] `dotnet build api/Api.csproj` succeeds after all entity and context changes
- [ ] `GetNextInQueueAsync` returns the entry with the smallest `RequestedAt` among `Status=Waiting` entries for the slot — confirmed via LINQ unit test
- [ ] `WaitlistRepository.AddAsync` with same `(patientId, slotId)` when one `Waiting` entry exists throws `AlreadyOnWaitlistException` (not `DbUpdateException`)
- [ ] `RecordFailureAsync` increments `AttemptCount` from 0 to 1; `ErrorMessage` populated; `Status = Failed`
- [ ] `GetPendingRetryAsync(maxAttempts: 2)` returns notifications with `AttemptCount = 0` or `1` and `Status = Failed`; excludes `AttemptCount = 2`
- [ ] `MarkSentAsync` sets `SentAt` to non-null `DateTimeOffset`; `Status = Sent`
- [ ] `AppointmentSlot` soft-disable does not affect `WaitlistEntry` rows (FK is `RESTRICT`)

## Implementation Checklist
- [ ] Create `WaitlistEntry.cs`: 6 columns, `WaitlistStatus` enum, no `UpdatedAt`, no hard-delete
- [ ] Create `Notification.cs`: 8 columns, `NotificationChannel` + `NotificationStatus` enums, nullable `SentAt` and `ErrorMessage`
- [ ] Create `AlreadyOnWaitlistException.cs`: safe message with patientId + slotId; no DB internals
- [ ] Create `IWaitlistRepository.cs`: 5 methods; `GetNextInQueueAsync` doc comment specifies `OrderBy(RequestedAt)` FIFO
- [ ] Create `WaitlistRepository.cs`: FIFO query; `AddAsync` catches `DbUpdateException` → `AlreadyOnWaitlistException`; `FulfillAsync`/`CancelAsync` only change status
- [ ] Create `INotificationRepository.cs`: 5 methods; `GetPendingRetryAsync(int maxAttempts)` for NFR-012
- [ ] Create `NotificationRepository.cs`: `RecordFailureAsync` increments `AttemptCount`; `MarkSentAsync` sets `SentAt = UtcNow`; `ErrorMessage` sanitisation note in comments
- [ ] Modify `ApplicationDbContext.cs`: DbSets, FK config (all RESTRICT), composite index on waitlist, retry index on notifications
- [ ] Register repositories in `Program.cs` with `AddScoped`
