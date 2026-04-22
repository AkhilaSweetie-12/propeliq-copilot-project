---
title: "Task — AuditLog Entity, Application-Layer Immutability Guard, Append-Only Repository"
task_id: task_001
story_id: us_015
epic: EP-DATA-II
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_015] — `audit_logs` Append-Only Entity with Permission Guards
- Story Location: `.propel/context/tasks/EP-DATA-II/us_015/us_015.md`
- Acceptance Criteria:
  - AC-1: `AuditLog` entity — `log_id` (UUID PK), `actor_id` (UUID FK → `users.user_id`), `actor_role` (TEXT), `action_type` (TEXT), `entity_type` (TEXT), `entity_id` (UUID), `change_summary` (TEXT), `ip_address` (TEXT), `occurred_at` (TIMESTAMPTZ, DB default `NOW()`)
  - AC-4: `IAuditLogRepository.AddAsync()` inserts via `context.AuditLogs.Add()` + `SaveChangesAsync()`; middleware does NOT need to supply `occurred_at`
  - AC-5: `IAuditLogRepository.Update()` and `IAuditLogRepository.Remove()` raise `InvalidOperationException("Audit log entries are immutable")` before reaching the DB (application-layer guard); database RULE is defence-in-depth (task_002)
  - AC-6: `change_summary` truncated to 4,000 characters with `"...[truncated]"` suffix by repository before persistence
- Edge Cases:
  - EC-1: `actor_id` FK remains valid after user soft-delete (`status = 'Inactive'`); no cascade; audit trail preserved for HIPAA 6-year retention
  - EC-2: `change_summary` TEXT with no size limit in DB; 4,000-char service-layer cap enforced in `IAuditLogRepository` implementation

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
Define the `AuditLog` EF Core entity with a private constructor and no public setters (making it structurally immutable from C#). Implement `IAuditLogRepository` where `AddAsync` is the only mutating method — `Update()` and `Remove()` throw `InvalidOperationException` unconditionally (application-layer immutability guard, AC-5). Enforce a 4,000-character cap with `"...[truncated]"` suffix on `change_summary` inside `AddAsync`. Configure `occurred_at` as a server-side default (`NOW()`) so the middleware need not supply it. Configure `ApplicationDbContext` with `actor_id` FK `DeleteBehavior.Restrict` and no `ValueGeneratedNever()` override on `occurred_at` (the DB default generates it).

## Dependent Tasks
- `us_007 task_001_be_user_entity_value_converters.md` — `User` entity must exist; `actor_id` FKs to `users.user_id`

## Impacted Components
- `/api/Domain/Entities/AuditLog.cs` — CREATE: entity with private constructor; all properties set via `Create()` factory only
- `/api/Domain/Repositories/IAuditLogRepository.cs` — CREATE: interface with `AddAsync`, query methods, and explicit guard methods
- `/api/Infrastructure/Persistence/Repositories/AuditLogRepository.cs` — CREATE: EF Core implementation; `AddAsync` with `change_summary` truncation; `Update()`/`Remove()` throw `InvalidOperationException`
- `/api/Infrastructure/Persistence/ApplicationDbContext.cs` — MODIFY: add `DbSet<AuditLog>` + `OnModelCreating` config
- `/api/Program.cs` — MODIFY: DI registration

## Implementation Plan

1. **Define `AuditLog` entity** (AC-1, AC-4) — fully immutable from C#:
   ```csharp
   // /api/Domain/Entities/AuditLog.cs
   namespace Api.Domain.Entities;

   public sealed class AuditLog
   {
       public Guid LogId { get; private set; }
       public Guid ActorId { get; private set; }
       public User Actor { get; private set; } = null!;
       public string ActorRole { get; private set; } = string.Empty;
       public string ActionType { get; private set; } = string.Empty;
       public string EntityType { get; private set; } = string.Empty;
       public Guid EntityId { get; private set; }
       public string ChangeSummary { get; private set; } = string.Empty;
       public string IpAddress { get; private set; } = string.Empty;
       // AC-4: occurred_at has DB-level default NOW(); not set by application
       public DateTime OccurredAt { get; private set; }

       // EF Core constructor — private; no public constructor
       private AuditLog() { }

       public static AuditLog Create(
           Guid actorId,
           string actorRole,
           string actionType,
           string entityType,
           Guid entityId,
           string changeSummary,
           string ipAddress)
       {
           return new AuditLog
           {
               LogId = Guid.NewGuid(),
               ActorId = actorId,
               ActorRole = actorRole,
               ActionType = actionType,
               EntityType = entityType,
               EntityId = entityId,
               // EC-2: 4,000-char cap applied here; repository also enforces this as defence-in-depth
               ChangeSummary = Truncate(changeSummary, 4000),
               IpAddress = ipAddress
               // OccurredAt not set — DB DEFAULT NOW() generates it
           };
       }

       private static string Truncate(string value, int maxLength)
       {
           const string suffix = "...[truncated]";
           if (value.Length <= maxLength) return value;
           return string.Concat(value.AsSpan(0, maxLength - suffix.Length), suffix);
       }
   }
   ```
   Design decisions:
   - `OccurredAt` is NOT set in `Create()` — the DB default `NOW()` sets it at INSERT time; EF Core must NOT set `ValueGeneratedNever()` on this property.
   - `Truncate()` is a private static helper on the entity itself; the repository also enforces the cap for defence-in-depth (calls `Create()` which enforces it).
   - No `UpdatedAt` — this entity is append-only; `AuditTimestampInterceptor` must NOT be extended to cover `AuditLog`.

2. **Define `IAuditLogRepository`** with explicit guard methods (AC-5):
   ```csharp
   // /api/Domain/Repositories/IAuditLogRepository.cs
   namespace Api.Domain.Repositories;

   public interface IAuditLogRepository
   {
       Task<AuditLog> AddAsync(AuditLog entry, CancellationToken ct = default);
       Task<IReadOnlyList<AuditLog>> GetByEntityAsync(string entityType, Guid entityId, CancellationToken ct = default);
       Task<IReadOnlyList<AuditLog>> GetRecentByTypeAsync(string entityType, int take = 100, CancellationToken ct = default);

       // AC-5: explicitly present in interface to document the guard — implementations MUST throw
       void Update(AuditLog entry);
       void Remove(AuditLog entry);
   }
   ```
   Design decision: exposing `Update()` and `Remove()` explicitly on the interface (rather than omitting them) makes the immutability contract visible at the abstraction boundary. Any caller attempting to compile `_auditLogRepo.Update(entry)` will succeed at compile time but receive a clear runtime exception — the interface documents the prohibition.

3. **Implement `AuditLogRepository`** (AC-4, AC-5, EC-2):
   ```csharp
   // /api/Infrastructure/Persistence/Repositories/AuditLogRepository.cs
   namespace Api.Infrastructure.Persistence.Repositories;

   public sealed class AuditLogRepository : IAuditLogRepository
   {
       private readonly ApplicationDbContext _db;

       public AuditLogRepository(ApplicationDbContext db) => _db = db;

       public async Task<AuditLog> AddAsync(AuditLog entry, CancellationToken ct = default)
       {
           // AC-4: insert and let DB DEFAULT NOW() set occurred_at
           _db.AuditLogs.Add(entry);
           await _db.SaveChangesAsync(ct);
           return entry;
       }

       public async Task<IReadOnlyList<AuditLog>> GetByEntityAsync(
           string entityType, Guid entityId, CancellationToken ct = default)
           => await _db.AuditLogs
               .Where(l => l.EntityType == entityType && l.EntityId == entityId)
               .OrderByDescending(l => l.OccurredAt)
               .AsNoTracking()
               .ToListAsync(ct);

       public async Task<IReadOnlyList<AuditLog>> GetRecentByTypeAsync(
           string entityType, int take = 100, CancellationToken ct = default)
           // AC-6: ordered by occurred_at DESC; index on (entity_type, occurred_at DESC) in migration
           => await _db.AuditLogs
               .Where(l => l.EntityType == entityType)
               .OrderByDescending(l => l.OccurredAt)
               .Take(take)
               .AsNoTracking()
               .ToListAsync(ct);

       // AC-5: application-layer immutability guard — throw before any DB call
       public void Update(AuditLog entry)
           => throw new InvalidOperationException(
               "Audit log entries are immutable — update and delete are prohibited.");

       public void Remove(AuditLog entry)
           => throw new InvalidOperationException(
               "Audit log entries are immutable — update and delete are prohibited.");
   }
   ```

4. **Update `ApplicationDbContext.OnModelCreating`** (AC-1, AC-4, EC-1):
   ```csharp
   modelBuilder.Entity<AuditLog>(e =>
   {
       e.ToTable("audit_logs");
       e.HasKey(l => l.LogId);
       e.Property(l => l.LogId).HasColumnName("log_id").HasDefaultValueSql("gen_random_uuid()");
       e.Property(l => l.ActorId).HasColumnName("actor_id").IsRequired();
       e.Property(l => l.ActorRole).HasColumnName("actor_role").IsRequired();
       e.Property(l => l.ActionType).HasColumnName("action_type").IsRequired();
       e.Property(l => l.EntityType).HasColumnName("entity_type").IsRequired();
       e.Property(l => l.EntityId).HasColumnName("entity_id").IsRequired();
       e.Property(l => l.ChangeSummary).HasColumnName("change_summary").IsRequired();
       e.Property(l => l.IpAddress).HasColumnName("ip_address").IsRequired();
       // AC-4: DB DEFAULT NOW(); ValueGeneratedOnAdd() tells EF Core to let the DB set it
       e.Property(l => l.OccurredAt)
           .HasColumnName("occurred_at")
           .HasDefaultValueSql("NOW()")
           .ValueGeneratedOnAdd()
           .IsRequired();
       // EC-1: actor_id FK RESTRICT — soft-deleted users still hold the FK
       e.HasOne(l => l.Actor)
           .WithMany()
           .HasForeignKey(l => l.ActorId)
           .OnDelete(DeleteBehavior.Restrict)
           .HasConstraintName("fk_audit_logs_actor_id");
   });
   ```

5. **Register `AuditLogRepository` in DI** (`Program.cs`):
   ```csharp
   builder.Services.AddScoped<IAuditLogRepository, AuditLogRepository>();
   ```

6. **Verify `AuditTimestampInterceptor` does NOT cover `AuditLog`** — `AuditLog` has no `UpdatedAt` or `LastUpdatedAt` column; the interceptor must not attempt to set a timestamp on `AuditLog` entries. Add an explicit exclusion comment in the interceptor's entity type dispatch if needed.

## Current Project State
```
/api/
├── Domain/
│   ├── Entities/
│   │   ├── User.cs                # us_007: exists
│   │   ├── PatientView360.cs      # us_014: exists
│   │   └── AuditLog.cs            # NOT YET CREATED — this task
│   └── Repositories/
│       ├── IPatientView360Repository.cs  # us_014: exists
│       └── IAuditLogRepository.cs        # NOT YET CREATED — this task
├── Infrastructure/
│   ├── Persistence/
│   │   ├── ApplicationDbContext.cs      # WILL BE MODIFIED
│   │   └── Repositories/
│   │       ├── PatientView360Repository.cs  # us_014: exists
│   │       └── AuditLogRepository.cs        # NOT YET CREATED — this task
│   └── Startup/
│       └── AuditTimestampInterceptor.cs     # NOT MODIFIED — AuditLog has no timestamp to intercept
└── Program.cs                              # WILL BE MODIFIED — DI registration
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Domain/Entities/AuditLog.cs` | Entity with private constructor; `Create()` factory with `Truncate()` helper (4,000-char cap); `OccurredAt` not set in application code — DB DEFAULT |
| CREATE | `/api/Domain/Repositories/IAuditLogRepository.cs` | `AddAsync`, `GetByEntityAsync`, `GetRecentByTypeAsync`; explicit `Update()` and `Remove()` guard methods |
| CREATE | `/api/Infrastructure/Persistence/Repositories/AuditLogRepository.cs` | `AddAsync` with `SaveChangesAsync`; `Update()`/`Remove()` throw `InvalidOperationException`; `AsNoTracking()` on reads; `OrderByDescending(OccurredAt)` |
| MODIFY | `/api/Infrastructure/Persistence/ApplicationDbContext.cs` | Add `DbSet<AuditLog>`; `OnModelCreating` with `HasDefaultValueSql("NOW()")` + `ValueGeneratedOnAdd()` on `occurred_at`; FK `DeleteBehavior.Restrict` |
| MODIFY | `/api/Program.cs` | Register `IAuditLogRepository` → `AuditLogRepository` |

## External References
- `ValueGeneratedOnAdd()` with `HasDefaultValueSql` for server-generated timestamps: https://learn.microsoft.com/en-us/ef/core/modeling/generated-properties#default-values
- HIPAA audit log retention (6 years): https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html
- DR-010: `audit_logs` entity — `.propel/context/docs/design.md#DR-010`
- OWASP A09 (Security Logging and Monitoring Failures): https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/

## Build Commands
```bash
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
UPLOADS_ROOT="/tmp/uploads" \
dotnet build api/Api.csproj --configuration Debug
```

## Implementation Validation Strategy
- [ ] `AuditLog.Create(...)` produces entity with `OccurredAt == default(DateTime)` (not set by application)
- [ ] `AuditLog.Create(... changeSummary: new string('x', 5000))` → `ChangeSummary.Length == 4000`; ends with `"...[truncated]"`
- [ ] `_auditLogRepo.Update(entry)` throws `InvalidOperationException` with message `"Audit log entries are immutable"` (AC-5)
- [ ] `_auditLogRepo.Remove(entry)` throws `InvalidOperationException` with message `"Audit log entries are immutable"` (AC-5)
- [ ] `AddAsync()` round-trip: insert entry, read back, confirm `OccurredAt` is non-default (set by DB NOW()) (AC-4)
- [ ] `AuditTimestampInterceptor` does NOT mutate `AuditLog.OccurredAt` on `SaveChanges` — verify by checking interceptor's entity type dispatch
- [ ] `dotnet build` passes without FK navigation ambiguity

## Implementation Checklist
- [ ] Create `AuditLog.cs` with private constructor; `Create()` factory; `Truncate()` private static helper; `OccurredAt` NOT set in `Create()`
- [ ] Create `IAuditLogRepository.cs` with `AddAsync`, two read methods, and explicit `Update()`/`Remove()` guard declarations
- [ ] Create `AuditLogRepository.cs`: `AddAsync` calls `SaveChangesAsync`; `Update()`/`Remove()` throw `InvalidOperationException`; all reads use `AsNoTracking()` + `OrderByDescending(OccurredAt)`
- [ ] Modify `ApplicationDbContext.cs`: add `DbSet<AuditLog>`; `OnModelCreating` with `HasDefaultValueSql("NOW()")` + `ValueGeneratedOnAdd()` on `occurred_at`; FK `fk_audit_logs_actor_id` with `DeleteBehavior.Restrict`
- [ ] Verify `AuditTimestampInterceptor` does not include `AuditLog` in its entity type dispatch
- [ ] Modify `Program.cs`: register `IAuditLogRepository` → `AuditLogRepository`
- [ ] Confirm `dotnet build` passes
