---
title: "Task — ClinicalDocument Entity, UploadStatus Enum, Dual-FK Config, Path Sanitisation & Repository"
task_id: task_001
story_id: us_012
epic: EP-DATA-II
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_012] — `clinical_documents` Entity
- Story Location: `.propel/context/tasks/EP-DATA-II/us_012/us_012.md`
- Acceptance Criteria:
  - AC-1: `ClinicalDocument` entity with `document_id` (UUID PK), `patient_id` (UUID FK → `users.user_id`), `file_name` (TEXT), `file_path` (TEXT), `upload_status` (TEXT/enum, default `Pending`), `uploaded_by` (UUID FK → `users.user_id`), `uploaded_at` (TIMESTAMPTZ)
  - AC-2: `upload_status` defaults to `Pending` on creation; AI extraction job transitions to `Extracted` or `Failed`; out-of-range value raises `DbUpdateException`
  - AC-3: `file_path` stores a server-side relative path; resolved against `UPLOADS_ROOT` env var at read time; no absolute paths or OS separators stored
  - AC-4: `patient_id` and `uploaded_by` are independently FK-enforced; inserting non-existent UUID in either raises `DbUpdateException`
- Edge Cases:
  - EC-1: File write failure before `SaveChangesAsync()` → no orphan row; error logged with attempted `file_path` value
  - EC-2: `file_name` path-traversal sanitisation via `Path.GetFileName()` before persistence (OWASP A03)
  - EC-3: Forward-only status transitions (`MarkExtractedAsync`/`MarkFailedAsync`); reverse transition raises `InvalidStatusTransitionException`

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
Define the `ClinicalDocument` EF Core entity with a tri-state `UploadStatus` enum, dual FK references to `users.user_id` (patient + uploader), and `uploaded_at` audit timestamp. Configure `OnModelCreating` with both FK relationships using `DeleteBehavior.Restrict`. Implement `IClinicalDocumentRepository` exposing forward-only status transitions (`MarkExtractedAsync`, `MarkFailedAsync`), path-traversal sanitisation via `Path.GetFileName()`, and `UPLOADS_ROOT`-relative path resolution. Add `StartupGuard` validation for the `UPLOADS_ROOT` environment variable.

## Dependent Tasks
- `us_007 task_001_be_user_entity_value_converters.md` — `User` entity and `ApplicationDbContext` must exist; `ClinicalDocument.patient_id` and `ClinicalDocument.uploaded_by` both FK to `User.user_id`
- `us_007 task_002_db_users_migration_schema.md` — `users` table must exist before the `clinical_documents` FK migration runs

## Impacted Components
- `/api/Domain/Entities/ClinicalDocument.cs` — CREATE: `ClinicalDocument` entity + `UploadStatus` enum
- `/api/Domain/Exceptions/InvalidStatusTransitionException.cs` — CREATE: domain exception for reverse status transitions
- `/api/Domain/Repositories/IClinicalDocumentRepository.cs` — CREATE: repository interface
- `/api/Infrastructure/Persistence/Repositories/ClinicalDocumentRepository.cs` — CREATE: EF Core implementation with path sanitisation
- `/api/Infrastructure/Persistence/ApplicationDbContext.cs` — MODIFY: add `DbSet<ClinicalDocument>` + FK configuration in `OnModelCreating`
- `/api/Infrastructure/Startup/StartupGuard.cs` — MODIFY: add `UPLOADS_ROOT` to required environment variables list
- `/api/Application/Services/ClinicalDocumentService.cs` — CREATE: service with `UploadDocumentAsync` (file-write guard, `Path.GetFileName` sanitisation, `UPLOADS_ROOT` resolution)

## Implementation Plan

1. **Define `UploadStatus` enum and `ClinicalDocument` entity** (AC-1, AC-2):
   ```csharp
   // /api/Domain/Entities/ClinicalDocument.cs
   namespace Api.Domain.Entities;

   public enum UploadStatus
   {
       Pending,
       Extracted,
       Failed
   }

   public sealed class ClinicalDocument
   {
       public Guid DocumentId { get; private set; } = Guid.NewGuid();
       public Guid PatientId { get; private set; }
       public User Patient { get; private set; } = null!;
       public string FileName { get; private set; } = string.Empty;
       public string FilePath { get; private set; } = string.Empty;
       public UploadStatus UploadStatus { get; private set; } = UploadStatus.Pending;
       public Guid UploadedBy { get; private set; }
       public User Uploader { get; private set; } = null!;
       public DateTime UploadedAt { get; private set; } = DateTime.UtcNow;

       // EF Core constructor
       private ClinicalDocument() { }

       public static ClinicalDocument Create(Guid patientId, string sanitisedFileName, string relativePath, Guid uploadedBy)
       {
           return new ClinicalDocument
           {
               DocumentId = Guid.NewGuid(),
               PatientId = patientId,
               FileName = sanitisedFileName,
               FilePath = relativePath,
               UploadStatus = UploadStatus.Pending,
               UploadedBy = uploadedBy,
               UploadedAt = DateTime.UtcNow
           };
       }

       public void MarkExtracted()
       {
           if (UploadStatus != UploadStatus.Pending)
               throw new InvalidStatusTransitionException(
                   $"Cannot transition from {UploadStatus} to {nameof(UploadStatus.Extracted)}.");
           UploadStatus = UploadStatus.Extracted;
       }

       public void MarkFailed()
       {
           if (UploadStatus != UploadStatus.Pending)
               throw new InvalidStatusTransitionException(
                   $"Cannot transition from {UploadStatus} to {nameof(UploadStatus.Failed)}.");
           UploadStatus = UploadStatus.Failed;
       }
   }
   ```
   Design decisions:
   - Private setters + `Create()` factory: callers cannot mutate properties directly (EC-3 enforcement at entity level).
   - `UploadStatus` defaults to `Pending` in both the `Create()` factory and the property initialiser — redundant by design for clarity.
   - `UploadedAt` is set once in `Create()`; no `UpdatedAt` on this entity (no `AuditTimestampInterceptor` extension needed — clinical documents are not updated, only status-transitioned).
   - Navigation properties (`Patient`, `Uploader`) are shadow-loaded; never accessed from repository output to avoid N+1 queries.

2. **Define `InvalidStatusTransitionException`** (EC-3):
   ```csharp
   // /api/Domain/Exceptions/InvalidStatusTransitionException.cs
   namespace Api.Domain.Exceptions;

   public sealed class InvalidStatusTransitionException : Exception
   {
       public InvalidStatusTransitionException(string message) : base(message) { }
   }
   ```

3. **Define `IClinicalDocumentRepository`** (AC-2, AC-3, AC-4, EC-3):
   ```csharp
   // /api/Domain/Repositories/IClinicalDocumentRepository.cs
   namespace Api.Domain.Repositories;

   public interface IClinicalDocumentRepository
   {
       Task<ClinicalDocument> CreateAsync(ClinicalDocument document, CancellationToken ct = default);
       Task<ClinicalDocument?> GetByIdAsync(Guid documentId, CancellationToken ct = default);
       Task<IReadOnlyList<ClinicalDocument>> GetByPatientIdAsync(Guid patientId, CancellationToken ct = default);
       // Hangfire job query (AC-6)
       Task<IReadOnlyList<ClinicalDocument>> GetPendingAsync(CancellationToken ct = default);
       Task MarkExtractedAsync(Guid documentId, CancellationToken ct = default);
       Task MarkFailedAsync(Guid documentId, CancellationToken ct = default);
       // No hard-delete — status transitions only
   }
   ```

4. **Implement `ClinicalDocumentRepository`** with FK exception handling and `DbUpdateException` catch:
   ```csharp
   // /api/Infrastructure/Persistence/Repositories/ClinicalDocumentRepository.cs
   namespace Api.Infrastructure.Persistence.Repositories;

   public sealed class ClinicalDocumentRepository : IClinicalDocumentRepository
   {
       private readonly ApplicationDbContext _db;

       public ClinicalDocumentRepository(ApplicationDbContext db) => _db = db;

       public async Task<ClinicalDocument> CreateAsync(ClinicalDocument document, CancellationToken ct = default)
       {
           _db.ClinicalDocuments.Add(document);
           try
           {
               await _db.SaveChangesAsync(ct);
           }
           catch (DbUpdateException ex)
           {
               // AC-4: FK violation (non-existent patient_id or uploaded_by) propagates as-is
               // OWASP A05: do not leak raw DB error details — let middleware handle translation
               throw new DbUpdateException(
                   "Failed to persist clinical document. Verify patient_id and uploaded_by exist.", ex);
           }
           return document;
       }

       public async Task<IReadOnlyList<ClinicalDocument>> GetByPatientIdAsync(Guid patientId, CancellationToken ct = default)
       {
           // AC-5: ordered by uploaded_at DESC; index on (patient_id, uploaded_at DESC) in migration
           return await _db.ClinicalDocuments
               .Where(d => d.PatientId == patientId)
               .OrderByDescending(d => d.UploadedAt)
               .AsNoTracking()
               .ToListAsync(ct);
       }

       public async Task<IReadOnlyList<ClinicalDocument>> GetPendingAsync(CancellationToken ct = default)
       {
           // AC-6: Hangfire job query — index on upload_status in migration
           return await _db.ClinicalDocuments
               .Where(d => d.UploadStatus == UploadStatus.Pending)
               .AsNoTracking()
               .ToListAsync(ct);
       }

       public async Task MarkExtractedAsync(Guid documentId, CancellationToken ct = default)
       {
           var doc = await _db.ClinicalDocuments.FindAsync([documentId], ct)
               ?? throw new DocumentNotFoundException(documentId);
           doc.MarkExtracted();   // EC-3: domain entity guards forward-only transition
           await _db.SaveChangesAsync(ct);
       }

       public async Task MarkFailedAsync(Guid documentId, CancellationToken ct = default)
       {
           var doc = await _db.ClinicalDocuments.FindAsync([documentId], ct)
               ?? throw new DocumentNotFoundException(documentId);
           doc.MarkFailed();
           await _db.SaveChangesAsync(ct);
       }

       public async Task<ClinicalDocument?> GetByIdAsync(Guid documentId, CancellationToken ct = default)
           => await _db.ClinicalDocuments.AsNoTracking().FirstOrDefaultAsync(d => d.DocumentId == documentId, ct);
   }
   ```

5. **Add `DocumentNotFoundException` domain exception**:
   ```csharp
   // /api/Domain/Exceptions/DocumentNotFoundException.cs
   namespace Api.Domain.Exceptions;

   public sealed class DocumentNotFoundException : Exception
   {
       public DocumentNotFoundException(Guid documentId)
           : base($"Clinical document '{documentId}' was not found.") { }
   }
   ```

6. **Update `ApplicationDbContext`** — add `DbSet<ClinicalDocument>` and configure dual FK + string enum converter (AC-1, AC-4):
   ```csharp
   // In ApplicationDbContext.OnModelCreating:

   modelBuilder.Entity<ClinicalDocument>(e =>
   {
       e.ToTable("clinical_documents");
       e.HasKey(d => d.DocumentId);
       e.Property(d => d.DocumentId).HasColumnName("document_id").HasDefaultValueSql("gen_random_uuid()");
       e.Property(d => d.PatientId).HasColumnName("patient_id").IsRequired();
       e.Property(d => d.FileName).HasColumnName("file_name").IsRequired();
       e.Property(d => d.FilePath).HasColumnName("file_path").IsRequired();
       e.Property(d => d.UploadStatus)
           .HasColumnName("upload_status")
           .HasConversion<string>()   // stores "Pending"/"Extracted"/"Failed" as TEXT
           .HasDefaultValue(UploadStatus.Pending)
           .IsRequired();
       e.Property(d => d.UploadedBy).HasColumnName("uploaded_by").IsRequired();
       e.Property(d => d.UploadedAt).HasColumnName("uploaded_at").IsRequired();

       // AC-4: patient_id FK → users.user_id (independently enforced)
       e.HasOne(d => d.Patient)
           .WithMany()
           .HasForeignKey(d => d.PatientId)
           .OnDelete(DeleteBehavior.Restrict)
           .HasConstraintName("fk_clinical_documents_patient_id");

       // AC-4: uploaded_by FK → users.user_id (independently enforced)
       e.HasOne(d => d.Uploader)
           .WithMany()
           .HasForeignKey(d => d.UploadedBy)
           .OnDelete(DeleteBehavior.Restrict)
           .HasConstraintName("fk_clinical_documents_uploaded_by");
   });
   ```
   Note: EF Core will NOT auto-generate the CHECK constraint on `upload_status` from the enum converter — the CHECK must be added manually via `migrationBuilder.Sql()` in task_002.

7. **Implement `ClinicalDocumentService.UploadDocumentAsync`** (AC-3, EC-1, EC-2):
   ```csharp
   // /api/Application/Services/ClinicalDocumentService.cs
   namespace Api.Application.Services;

   public sealed class ClinicalDocumentService
   {
       private readonly IClinicalDocumentRepository _repo;
       private readonly ILogger<ClinicalDocumentService> _logger;
       private readonly string _uploadsRoot;

       public ClinicalDocumentService(
           IClinicalDocumentRepository repo,
           ILogger<ClinicalDocumentService> logger,
           IConfiguration configuration)
       {
           _repo = repo;
           _logger = logger;
           // UPLOADS_ROOT validated by StartupGuard — guaranteed non-null here
           _uploadsRoot = configuration["UPLOADS_ROOT"]!;
       }

       public async Task<ClinicalDocument> UploadDocumentAsync(
           Guid patientId,
           Guid uploadedBy,
           string rawFileName,
           Stream fileStream,
           CancellationToken ct = default)
       {
           // EC-2: sanitise file_name — strip all directory components (OWASP A03)
           var sanitisedFileName = Path.GetFileName(rawFileName);

           // AC-3: construct relative path — no OS separators, no absolute path
           var documentId = Guid.NewGuid();
           var relativePath = $"uploads/patients/{patientId}/{documentId}.pdf";
           var absolutePath = Path.Combine(_uploadsRoot, relativePath);

           // EC-1: attempt file write BEFORE SaveChangesAsync; abort on failure to prevent orphan row
           try
           {
               Directory.CreateDirectory(Path.GetDirectoryName(absolutePath)!);
               await using var fileOut = File.Create(absolutePath);
               await fileStream.CopyToAsync(fileOut, ct);
           }
           catch (Exception ex)
           {
               // EC-1: log attempted path value — not a PHI field, safe to log
               _logger.LogError(ex,
                   "File write failed for clinical document. Attempted path: {FilePath}. " +
                   "SaveChangesAsync will not be called — no orphan DB row created.", relativePath);
               throw;
           }

           // Only reached if file write succeeds (EC-1)
           var document = ClinicalDocument.Create(patientId, sanitisedFileName, relativePath, uploadedBy);
           return await _repo.CreateAsync(document, ct);
       }

       public string ResolveAbsolutePath(string relativePath)
       {
           // AC-3: resolve relative path against UPLOADS_ROOT at read time
           return Path.Combine(_uploadsRoot, relativePath);
       }
   }
   ```

8. **Extend `StartupGuard.ValidateEnvironment()`** — add `UPLOADS_ROOT` to required variable list:
   ```csharp
   // In /api/Infrastructure/Startup/StartupGuard.cs
   // Add "UPLOADS_ROOT" to the existing required variables array:
   private static readonly string[] RequiredVariables =
   [
       "DATABASE_URL",
       "JWT_SIGNING_KEY",
       "PHI_ENCRYPTION_KEY",
       "UPLOADS_ROOT"     // ← add this line
   ];
   ```

## Current Project State
```
/api/
├── Domain/
│   ├── Entities/
│   │   ├── User.cs                        # us_007: exists
│   │   ├── AppointmentSlot.cs             # us_008: exists
│   │   ├── Appointment.cs                 # us_008: exists
│   │   ├── WaitlistEntry.cs               # us_009: exists
│   │   ├── Notification.cs                # us_009: exists
│   │   ├── PatientIntake.cs               # us_010: exists
│   │   ├── InsuranceRecord.cs             # us_011: exists
│   │   └── ClinicalDocument.cs            # NOT YET CREATED — this task
│   ├── Exceptions/
│   │   ├── EmailAlreadyRegisteredException.cs  # us_007
│   │   ├── SlotNotFoundException.cs            # us_008
│   │   ├── AlreadyOnWaitlistException.cs       # us_009
│   │   ├── PayloadTooLargeException.cs         # us_010
│   │   ├── InvalidStatusTransitionException.cs # NOT YET CREATED — this task
│   │   └── DocumentNotFoundException.cs        # NOT YET CREATED — this task
│   └── Repositories/
│       ├── IUserRepository.cs             # us_007: exists
│       ├── IAppointmentSlotRepository.cs  # us_008: exists
│       ├── IWaitlistRepository.cs         # us_009: exists
│       ├── INotificationRepository.cs     # us_009: exists
│       ├── IPatientIntakeRepository.cs    # us_010: exists
│       └── IClinicalDocumentRepository.cs # NOT YET CREATED — this task
├── Infrastructure/
│   ├── Persistence/
│   │   ├── ApplicationDbContext.cs        # WILL BE MODIFIED — add DbSet + FK config
│   │   └── Repositories/
│   │       ├── UserRepository.cs          # us_007: exists
│   │       ├── AppointmentSlotRepository.cs # us_008: exists
│   │       ├── WaitlistRepository.cs      # us_009: exists
│   │       ├── NotificationRepository.cs  # us_009: exists
│   │       ├── PatientIntakeRepository.cs # us_010: exists
│   │       └── ClinicalDocumentRepository.cs # NOT YET CREATED — this task
│   ├── Security/
│   │   ├── PhiTextEncryptionConverter.cs  # us_010: exists
│   │   └── PhiJsonEncryptionConverter.cs  # us_010: exists
│   └── Startup/
│       ├── StartupGuard.cs                # WILL BE MODIFIED — add UPLOADS_ROOT
│       └── AuditTimestampInterceptor.cs   # us_007: exists
└── Application/Services/
    └── ClinicalDocumentService.cs         # NOT YET CREATED — this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Domain/Entities/ClinicalDocument.cs` | `ClinicalDocument` entity with `UploadStatus` enum, private setters, `Create()` factory, `MarkExtracted()`, `MarkFailed()` forward-transition methods |
| CREATE | `/api/Domain/Exceptions/InvalidStatusTransitionException.cs` | Domain exception for reverse `upload_status` transitions (EC-3) |
| CREATE | `/api/Domain/Exceptions/DocumentNotFoundException.cs` | Domain exception for missing document by ID |
| CREATE | `/api/Domain/Repositories/IClinicalDocumentRepository.cs` | Repository interface with `CreateAsync`, `GetByIdAsync`, `GetByPatientIdAsync`, `GetPendingAsync`, `MarkExtractedAsync`, `MarkFailedAsync` |
| CREATE | `/api/Infrastructure/Persistence/Repositories/ClinicalDocumentRepository.cs` | EF Core repository implementation with `DbUpdateException` catch and `AsNoTracking` read queries |
| CREATE | `/api/Application/Services/ClinicalDocumentService.cs` | Service with `UploadDocumentAsync` (file-write guard, `Path.GetFileName` sanitisation, `UPLOADS_ROOT` resolution) and `ResolveAbsolutePath()` |
| MODIFY | `/api/Infrastructure/Persistence/ApplicationDbContext.cs` | Add `DbSet<ClinicalDocument> ClinicalDocuments`; add `OnModelCreating` config with dual FK (`fk_clinical_documents_patient_id`, `fk_clinical_documents_uploaded_by`), `HasConversion<string>()` for `UploadStatus`, `HasDefaultValue(UploadStatus.Pending)` |
| MODIFY | `/api/Infrastructure/Startup/StartupGuard.cs` | Add `"UPLOADS_ROOT"` to `RequiredVariables` array |

## External References
- `HasConversion<string>()` for enum-as-text: https://learn.microsoft.com/en-us/ef/core/modeling/value-conversions
- `HasDefaultValue()` on EF Core property: https://learn.microsoft.com/en-us/ef/core/modeling/generated-properties?tabs=data-annotations#default-values
- `DeleteBehavior.Restrict` for FK: https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete
- `Path.GetFileName()` — path traversal prevention (OWASP A03): https://owasp.org/www-community/attacks/Path_Traversal
- DR-006: `clinical_documents` entity definition — `.propel/context/docs/design.md#DR-006`
- OWASP A03 (Injection / path traversal): https://owasp.org/Top10/A03_2021-Injection/
- OWASP A05 (Security Misconfiguration / raw DB error exposure): https://owasp.org/Top10/A05_2021-Security_Misconfiguration/

## Build Commands
```bash
# Build after entity + context changes
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
UPLOADS_ROOT="/tmp/uploads" \
dotnet build api/Api.csproj --configuration Debug
```

## Implementation Validation Strategy
- [ ] `dotnet build` passes — no FK ambiguity errors from dual user navigation properties
- [ ] `ClinicalDocument.Create()` returns entity with `UploadStatus.Pending`
- [ ] `MarkExtracted()` on a `Pending` document succeeds; `MarkExtracted()` on an `Extracted` document throws `InvalidStatusTransitionException`
- [ ] `MarkFailed()` on a `Pending` document succeeds; `MarkFailed()` on a `Failed` document throws `InvalidStatusTransitionException`
- [ ] `Path.GetFileName("../../etc/passwd")` → `"passwd"` (sanitisation confirmed)
- [ ] `ClinicalDocumentService.UploadDocumentAsync` with a simulated file-write exception does NOT call `SaveChangesAsync` — no orphan row (EC-1)
- [ ] `StartupGuard.ValidateEnvironment()` throws `InvalidOperationException` when `UPLOADS_ROOT` is absent
- [ ] `dotnet run` without `UPLOADS_ROOT` set fails at startup with `[Startup] Missing required environment variable: UPLOADS_ROOT`

## Implementation Checklist
- [ ] Create `ClinicalDocument.cs` with `UploadStatus` enum, private setters, `Create()` factory, `MarkExtracted()`, `MarkFailed()` with forward-only guard
- [ ] Create `InvalidStatusTransitionException.cs` domain exception
- [ ] Create `DocumentNotFoundException.cs` domain exception
- [ ] Create `IClinicalDocumentRepository.cs` with all 6 method signatures (including `GetPendingAsync` for Hangfire AC-6)
- [ ] Create `ClinicalDocumentRepository.cs` with `DbUpdateException` catch on `CreateAsync`; `AsNoTracking` on all reads; `OrderByDescending(d => d.UploadedAt)` in `GetByPatientIdAsync`
- [ ] Modify `ApplicationDbContext.cs`: add `DbSet<ClinicalDocument>`, column mappings, dual FK config with named constraint names and `DeleteBehavior.Restrict`, `HasConversion<string>()` + `HasDefaultValue(UploadStatus.Pending)` for `upload_status`
- [ ] Create `ClinicalDocumentService.cs` with `Path.GetFileName()` sanitisation, file-write-before-SaveChanges guard (EC-1), `UPLOADS_ROOT`-relative path construction
- [ ] Modify `StartupGuard.cs`: add `"UPLOADS_ROOT"` to required variables array
