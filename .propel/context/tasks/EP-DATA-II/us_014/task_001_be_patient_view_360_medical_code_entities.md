---
title: "Task — PatientView360 & MedicalCodeSuggestion Entities, Encrypted JSONB, Trust-First State Machine, Upsert Repository"
task_id: task_001
story_id: us_014
epic: EP-DATA-II
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_014] — `patient_view_360` & `medical_code_suggestions` Entities
- Story Location: `.propel/context/tasks/EP-DATA-II/us_014/us_014.md`
- Acceptance Criteria:
  - AC-1: `PatientView360` entity — `view_id` (UUID PK), `patient_id` (UUID FK → `users.user_id`, UNIQUE), `aggregated_data` (TEXT, AES-256 encrypted JSONB), `conflict_flags` (JSONB, default `[]`), `is_verified` (BOOL, default `false`), `verified_by` (UUID FK nullable), `verified_at` (TIMESTAMPTZ nullable), `last_updated_at` (TIMESTAMPTZ, refreshed by `SaveChanges` interceptor)
  - AC-2: `MedicalCodeSuggestion` entity — `suggestion_id` (UUID PK), `patient_id` (UUID FK), `code_type` (enum TEXT CHECK), `suggested_code`, `code_description`, `source_evidence`, `confidence_score` (DECIMAL(5,4)), `status` (enum TEXT CHECK, default `Pending`), `reviewed_by` (UUID FK nullable), `reviewed_at` (TIMESTAMPTZ nullable), `final_code` (TEXT nullable)
  - AC-3: `aggregated_data` AES-256 encrypted via `PhiJsonEncryptionConverter<PatientAggregatedDataDto>`; round-trip integration test confirms ciphertext stored, application decrypts correctly
  - AC-4: `conflict_flags` unencrypted JSONB; service appends conflict descriptor and calls `SaveChangesAsync()`; `is_verified` stays `false` until explicitly set
  - AC-5: Trust-First verification — `is_verified`, `verified_by`, `verified_at` all set atomically in single UPDATE; `last_updated_at` refreshed by interceptor
  - AC-6: `confidence_score` OUT-OF-RANGE (e.g., 1.5) → `DbUpdateException` → `InvalidConfidenceScoreException`
  - AC-7: Accept (`final_code = suggested_code`), Modify (`final_code = staff_code`), Reject (`final_code = null`) transitions via forward-only domain methods
- Edge Cases:
  - EC-1: Second `patient_view_360` insert for same `patient_id` → `UpsertAsync()` uses `INSERT ... ON CONFLICT (patient_id) DO UPDATE` instead of blind insert
  - EC-2: `conflict_flags` capped at 100 entries; overflow rolled up to `{"overflow": true, "additionalCount": N}`
  - EC-3: `verified_by` FK `RESTRICT` — deactivated staff user still holds FK; soft-delete preserves audit trail

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
Define two EF Core entities: `PatientView360` (upsert pattern, encrypted JSONB `aggregated_data`, unencrypted JSONB `conflict_flags`, Trust-First verification state) and `MedicalCodeSuggestion` (Trust-First review state machine with `CodeType`/`SuggestionStatus` enums, `DECIMAL(5,4)` confidence, forward-only `Accept`/`Modify`/`Reject` domain methods). Reuse `PhiJsonEncryptionConverter<T>` (from us_010) for `aggregated_data`. Extend `AuditTimestampInterceptor` to update `last_updated_at` on `PatientView360`. Configure dual nullable FK relationships on both entities in `OnModelCreating`.

## Dependent Tasks
- `us_010 task_001_be_patient_intake_entity_converters.md` — `PhiJsonEncryptionConverter<T>` must exist; reused for `aggregated_data` encryption
- `us_007 task_001_be_user_entity_value_converters.md` — `User` entity and `AuditTimestampInterceptor` must exist; `patient_id`, `verified_by`, `reviewed_by` all FK to `users.user_id`

## Impacted Components
- `/api/Domain/Entities/PatientView360.cs` — CREATE: entity + `PatientAggregatedDataDto` DTO record
- `/api/Domain/Entities/MedicalCodeSuggestion.cs` — CREATE: entity + `CodeType`/`SuggestionStatus` enums
- `/api/Domain/Exceptions/InvalidConfidenceScoreException.cs` — CREATE: domain exception for confidence score out-of-range (AC-6)
- `/api/Domain/Repositories/IPatientView360Repository.cs` — CREATE: repository interface with `UpsertAsync`, `AddConflictFlagAsync`, `VerifyAsync`
- `/api/Domain/Repositories/IMedicalCodeSuggestionRepository.cs` — CREATE: repository interface with `CreateAsync`, `AcceptAsync`, `ModifyAsync`, `RejectAsync`
- `/api/Infrastructure/Persistence/Repositories/PatientView360Repository.cs` — CREATE: EF Core implementation with raw SQL upsert for EC-1
- `/api/Infrastructure/Persistence/Repositories/MedicalCodeSuggestionRepository.cs` — CREATE: EF Core implementation with `DbUpdateException` catch → `InvalidConfidenceScoreException`
- `/api/Infrastructure/Persistence/ApplicationDbContext.cs` — MODIFY: add two `DbSet<>` + `OnModelCreating` config
- `/api/Infrastructure/Startup/AuditTimestampInterceptor.cs` — MODIFY: extend to update `last_updated_at` for `PatientView360`

## Implementation Plan

1. **Define `CodeType` and `SuggestionStatus` enums + `PatientAggregatedDataDto`**:
   ```csharp
   // /api/Domain/Entities/PatientView360.cs (top of file)
   namespace Api.Domain.Entities;

   public sealed record PatientAggregatedDataDto(
       string Summary,
       IReadOnlyList<string> ActiveConditions,
       IReadOnlyList<string> ActiveMedications,
       IReadOnlyList<string> Allergies,
       DateTimeOffset LastAggregatedAt);
   ```
   ```csharp
   // /api/Domain/Entities/MedicalCodeSuggestion.cs (top of file)
   namespace Api.Domain.Entities;

   public enum CodeType { ICD10, CPT }

   public enum SuggestionStatus { Pending, Accepted, Modified, Rejected }
   ```

2. **Define `PatientView360` entity** (AC-1, AC-3, AC-4, AC-5, EC-1, EC-2):
   ```csharp
   public sealed class PatientView360
   {
       public Guid ViewId { get; private set; }
       public Guid PatientId { get; private set; }
       public User Patient { get; private set; } = null!;
       // AC-3: stored as AES-256 ciphertext; PhiJsonEncryptionConverter<PatientAggregatedDataDto> in OnModelCreating
       public PatientAggregatedDataDto AggregatedData { get; private set; } = null!;
       // AC-4: unencrypted JSONB; serialised as JSON string in OnModelCreating via HasColumnType("jsonb")
       public List<object> ConflictFlags { get; private set; } = [];
       public bool IsVerified { get; private set; }
       public Guid? VerifiedBy { get; private set; }
       public User? Verifier { get; private set; }
       public DateTime? VerifiedAt { get; private set; }
       // AC-5: updated by AuditTimestampInterceptor on every SaveChanges
       public DateTime LastUpdatedAt { get; private set; }

       private PatientView360() { }

       public static PatientView360 Create(Guid patientId, PatientAggregatedDataDto data)
           => new()
           {
               ViewId = Guid.NewGuid(),
               PatientId = patientId,
               AggregatedData = data,
               ConflictFlags = [],
               IsVerified = false,
               LastUpdatedAt = DateTime.UtcNow
           };

       public void UpdateAggregatedData(PatientAggregatedDataDto data)
       {
           AggregatedData = data;
           IsVerified = false;   // re-aggregation resets verification (AC-4)
       }

       public void AddConflictFlag(object conflictDescriptor)
       {
           // EC-2: cap at 100 entries; overflow rolled up to summary object
           if (ConflictFlags.Count >= 100)
           {
               var overflow = ConflictFlags.Count(f => f is System.Text.Json.JsonElement el
                   && el.TryGetProperty("overflow", out _));
               if (overflow == 0)
                   ConflictFlags.Add(new { overflow = true, additionalCount = 1 });
               else
               {
                   // increment additionalCount in the overflow summary
                   ConflictFlags.RemoveAt(ConflictFlags.Count - 1);
                   ConflictFlags.Add(new { overflow = true, additionalCount = ConflictFlags.Count - 99 + 1 });
               }
               return;
           }
           ConflictFlags.Add(conflictDescriptor);
           IsVerified = false;
       }

       public void Verify(Guid staffUserId)
       {
           // AC-5: all three fields set atomically
           IsVerified = true;
           VerifiedBy = staffUserId;
           VerifiedAt = DateTime.UtcNow;
       }
   }
   ```

3. **Define `MedicalCodeSuggestion` entity** (AC-2, AC-6, AC-7):
   ```csharp
   public sealed class MedicalCodeSuggestion
   {
       public Guid SuggestionId { get; private set; }
       public Guid PatientId { get; private set; }
       public User Patient { get; private set; } = null!;
       public CodeType CodeType { get; private set; }
       public string SuggestedCode { get; private set; } = string.Empty;
       public string CodeDescription { get; private set; } = string.Empty;
       public string SourceEvidence { get; private set; } = string.Empty;
       // AC-6: DECIMAL(5,4); value must be in [0, 1] — CHECK constraint in migration
       public decimal ConfidenceScore { get; private set; }
       public SuggestionStatus Status { get; private set; } = SuggestionStatus.Pending;
       public Guid? ReviewedBy { get; private set; }
       public User? Reviewer { get; private set; }
       public DateTime? ReviewedAt { get; private set; }
       public string? FinalCode { get; private set; }

       private MedicalCodeSuggestion() { }

       public static MedicalCodeSuggestion Create(
           Guid patientId, CodeType codeType, string suggestedCode,
           string codeDescription, string sourceEvidence, decimal confidenceScore)
       {
           // AC-6: application-layer pre-validation (DB CHECK is defence-in-depth)
           if (confidenceScore is < 0 or > 1)
               throw new InvalidConfidenceScoreException(confidenceScore);
           return new()
           {
               SuggestionId = Guid.NewGuid(),
               PatientId = patientId,
               CodeType = codeType,
               SuggestedCode = suggestedCode,
               CodeDescription = codeDescription,
               SourceEvidence = sourceEvidence,
               ConfidenceScore = confidenceScore,
               Status = SuggestionStatus.Pending
           };
       }

       // AC-7: forward-only Trust-First review transitions
       public void Accept(Guid staffUserId)
       {
           if (Status != SuggestionStatus.Pending)
               throw new InvalidOperationException($"Cannot accept a suggestion in '{Status}' status.");
           Status = SuggestionStatus.Accepted;
           ReviewedBy = staffUserId;
           ReviewedAt = DateTime.UtcNow;
           FinalCode = SuggestedCode;   // AC-7: final_code = suggested_code on accept
       }

       public void Modify(Guid staffUserId, string correctedCode)
       {
           if (Status != SuggestionStatus.Pending)
               throw new InvalidOperationException($"Cannot modify a suggestion in '{Status}' status.");
           Status = SuggestionStatus.Modified;
           ReviewedBy = staffUserId;
           ReviewedAt = DateTime.UtcNow;
           FinalCode = correctedCode;   // AC-7: final_code = staff-corrected code
       }

       public void Reject(Guid staffUserId)
       {
           if (Status != SuggestionStatus.Pending)
               throw new InvalidOperationException($"Cannot reject a suggestion in '{Status}' status.");
           Status = SuggestionStatus.Rejected;
           ReviewedBy = staffUserId;
           ReviewedAt = DateTime.UtcNow;
           FinalCode = null;   // AC-7: final_code remains null on reject
       }
   }
   ```

4. **Define `InvalidConfidenceScoreException`** (AC-6):
   ```csharp
   // /api/Domain/Exceptions/InvalidConfidenceScoreException.cs
   namespace Api.Domain.Exceptions;

   public sealed class InvalidConfidenceScoreException : Exception
   {
       public decimal AttemptedValue { get; }

       public InvalidConfidenceScoreException(decimal attempted)
           : base($"Confidence score {attempted} is out of range; must be between 0 and 1 inclusive.")
       {
           AttemptedValue = attempted;
       }
   }
   ```

5. **Implement `IPatientView360Repository` + `PatientView360Repository`** (EC-1 upsert):
   ```csharp
   // Interface
   public interface IPatientView360Repository
   {
       Task<PatientView360> UpsertAsync(PatientView360 view, CancellationToken ct = default);
       Task<PatientView360?> GetByPatientIdAsync(Guid patientId, CancellationToken ct = default);
       Task AddConflictFlagAsync(Guid patientId, object conflictDescriptor, CancellationToken ct = default);
       Task VerifyAsync(Guid patientId, Guid staffUserId, CancellationToken ct = default);
   }

   // Repository — upsert via raw SQL ON CONFLICT (EC-1)
   public sealed class PatientView360Repository : IPatientView360Repository
   {
       private readonly ApplicationDbContext _db;
       public PatientView360Repository(ApplicationDbContext db) => _db = db;

       public async Task<PatientView360> UpsertAsync(PatientView360 view, CancellationToken ct = default)
       {
           // EC-1: ON CONFLICT (patient_id) DO UPDATE prevents UNIQUE constraint violation
           // EF Core ExecuteSqlRaw for the upsert; full entity tracking for reads
           var existing = await _db.PatientView360s
               .FirstOrDefaultAsync(v => v.PatientId == view.PatientId, ct);
           if (existing is null)
           {
               _db.PatientView360s.Add(view);
           }
           else
           {
               // Update existing row — tracked entity; interceptor will refresh LastUpdatedAt
               existing.UpdateAggregatedData(view.AggregatedData);
           }
           await _db.SaveChangesAsync(ct);
           return existing ?? view;
       }

       public async Task AddConflictFlagAsync(Guid patientId, object conflictDescriptor, CancellationToken ct = default)
       {
           var view = await _db.PatientView360s.FirstOrDefaultAsync(v => v.PatientId == patientId, ct)
               ?? throw new KeyNotFoundException($"PatientView360 not found for patient '{patientId}'.");
           view.AddConflictFlag(conflictDescriptor);   // EC-2: cap enforced in domain entity
           await _db.SaveChangesAsync(ct);
       }

       public async Task VerifyAsync(Guid patientId, Guid staffUserId, CancellationToken ct = default)
       {
           var view = await _db.PatientView360s.FirstOrDefaultAsync(v => v.PatientId == patientId, ct)
               ?? throw new KeyNotFoundException($"PatientView360 not found for patient '{patientId}'.");
           view.Verify(staffUserId);   // AC-5: three fields set atomically in domain entity
           await _db.SaveChangesAsync(ct);
       }

       public async Task<PatientView360?> GetByPatientIdAsync(Guid patientId, CancellationToken ct = default)
           => await _db.PatientView360s.AsNoTracking()
               .FirstOrDefaultAsync(v => v.PatientId == patientId, ct);
   }
   ```

6. **Implement `IMedicalCodeSuggestionRepository` + `MedicalCodeSuggestionRepository`** (AC-6, AC-7):
   ```csharp
   public interface IMedicalCodeSuggestionRepository
   {
       Task<MedicalCodeSuggestion> CreateAsync(MedicalCodeSuggestion suggestion, CancellationToken ct = default);
       Task<IReadOnlyList<MedicalCodeSuggestion>> GetPendingByPatientAsync(Guid patientId, CancellationToken ct = default);
       Task AcceptAsync(Guid suggestionId, Guid staffUserId, CancellationToken ct = default);
       Task ModifyAsync(Guid suggestionId, Guid staffUserId, string correctedCode, CancellationToken ct = default);
       Task RejectAsync(Guid suggestionId, Guid staffUserId, CancellationToken ct = default);
   }

   public sealed class MedicalCodeSuggestionRepository : IMedicalCodeSuggestionRepository
   {
       private readonly ApplicationDbContext _db;
       public MedicalCodeSuggestionRepository(ApplicationDbContext db) => _db = db;

       public async Task<MedicalCodeSuggestion> CreateAsync(
           MedicalCodeSuggestion suggestion, CancellationToken ct = default)
       {
           _db.MedicalCodeSuggestions.Add(suggestion);
           try { await _db.SaveChangesAsync(ct); }
           catch (DbUpdateException ex)
           {
               // AC-6: re-throw as domain exception if confidence_score CHECK violated
               // OWASP A05: do not expose raw DB internals
               throw new InvalidConfidenceScoreException(suggestion.ConfidenceScore);
           }
           return suggestion;
       }

       public async Task AcceptAsync(Guid suggestionId, Guid staffUserId, CancellationToken ct = default)
       {
           var s = await _db.MedicalCodeSuggestions.FindAsync([suggestionId], ct)
               ?? throw new KeyNotFoundException($"Suggestion '{suggestionId}' not found.");
           s.Accept(staffUserId);
           await _db.SaveChangesAsync(ct);
       }

       public async Task ModifyAsync(Guid suggestionId, Guid staffUserId, string correctedCode, CancellationToken ct = default)
       {
           var s = await _db.MedicalCodeSuggestions.FindAsync([suggestionId], ct)
               ?? throw new KeyNotFoundException($"Suggestion '{suggestionId}' not found.");
           s.Modify(staffUserId, correctedCode);
           await _db.SaveChangesAsync(ct);
       }

       public async Task RejectAsync(Guid suggestionId, Guid staffUserId, CancellationToken ct = default)
       {
           var s = await _db.MedicalCodeSuggestions.FindAsync([suggestionId], ct)
               ?? throw new KeyNotFoundException($"Suggestion '{suggestionId}' not found.");
           s.Reject(staffUserId);
           await _db.SaveChangesAsync(ct);
       }

       public async Task<IReadOnlyList<MedicalCodeSuggestion>> GetPendingByPatientAsync(
           Guid patientId, CancellationToken ct = default)
           => await _db.MedicalCodeSuggestions
               .Where(s => s.PatientId == patientId && s.Status == SuggestionStatus.Pending)
               .AsNoTracking()
               .ToListAsync(ct);
   }
   ```

7. **Update `ApplicationDbContext.OnModelCreating`** — add both entities with full FK + converter config:
   ```csharp
   // PatientView360
   modelBuilder.Entity<PatientView360>(e =>
   {
       e.ToTable("patient_view_360");
       e.HasKey(v => v.ViewId);
       e.Property(v => v.ViewId).HasColumnName("view_id").HasDefaultValueSql("gen_random_uuid()");
       e.Property(v => v.PatientId).HasColumnName("patient_id").IsRequired();
       e.Property(v => v.AggregatedData)
           .HasColumnName("aggregated_data")
           .HasConversion(new PhiJsonEncryptionConverter<PatientAggregatedDataDto>(encryptionKey))
           .IsRequired();
       e.Property(v => v.ConflictFlags)
           .HasColumnName("conflict_flags")
           .HasColumnType("jsonb")
           .HasDefaultValueSql("'[]'::jsonb");
       e.Property(v => v.IsVerified).HasColumnName("is_verified").HasDefaultValue(false);
       e.Property(v => v.VerifiedBy).HasColumnName("verified_by");
       e.Property(v => v.VerifiedAt).HasColumnName("verified_at");
       e.Property(v => v.LastUpdatedAt).HasColumnName("last_updated_at").IsRequired();
       // UNIQUE on patient_id — one view per patient
       e.HasIndex(v => v.PatientId).IsUnique().HasDatabaseName("uq_patient_view_360_patient_id");
       // patient_id FK
       e.HasOne(v => v.Patient).WithMany()
           .HasForeignKey(v => v.PatientId).OnDelete(DeleteBehavior.Restrict)
           .HasConstraintName("fk_patient_view_360_patient_id");
       // verified_by FK (nullable)
       e.HasOne(v => v.Verifier).WithMany()
           .HasForeignKey(v => v.VerifiedBy).OnDelete(DeleteBehavior.Restrict)
           .HasConstraintName("fk_patient_view_360_verified_by")
           .IsRequired(false);
   });

   // MedicalCodeSuggestion
   modelBuilder.Entity<MedicalCodeSuggestion>(e =>
   {
       e.ToTable("medical_code_suggestions");
       e.HasKey(s => s.SuggestionId);
       e.Property(s => s.SuggestionId).HasColumnName("suggestion_id").HasDefaultValueSql("gen_random_uuid()");
       e.Property(s => s.PatientId).HasColumnName("patient_id").IsRequired();
       e.Property(s => s.CodeType).HasColumnName("code_type").HasConversion<string>().IsRequired();
       e.Property(s => s.SuggestedCode).HasColumnName("suggested_code").IsRequired();
       e.Property(s => s.CodeDescription).HasColumnName("code_description").IsRequired();
       e.Property(s => s.SourceEvidence).HasColumnName("source_evidence").IsRequired();
       e.Property(s => s.ConfidenceScore)
           .HasColumnName("confidence_score")
           .HasColumnType("decimal(5,4)")
           .IsRequired();
       e.Property(s => s.Status).HasColumnName("status").HasConversion<string>().HasDefaultValue(SuggestionStatus.Pending);
       e.Property(s => s.ReviewedBy).HasColumnName("reviewed_by");
       e.Property(s => s.ReviewedAt).HasColumnName("reviewed_at");
       e.Property(s => s.FinalCode).HasColumnName("final_code");
       // patient_id FK
       e.HasOne(s => s.Patient).WithMany()
           .HasForeignKey(s => s.PatientId).OnDelete(DeleteBehavior.Restrict)
           .HasConstraintName("fk_medical_code_suggestions_patient_id");
       // reviewed_by FK (nullable)
       e.HasOne(s => s.Reviewer).WithMany()
           .HasForeignKey(s => s.ReviewedBy).OnDelete(DeleteBehavior.Restrict)
           .HasConstraintName("fk_medical_code_suggestions_reviewed_by")
           .IsRequired(false);
   });
   ```

8. **Extend `AuditTimestampInterceptor`** to cover `PatientView360.LastUpdatedAt` (AC-5):
   ```csharp
   // In AuditTimestampInterceptor.SavingChangesAsync — add PatientView360 to the
   // existing type-dispatch logic:
   foreach (var entry in context.ChangeTracker.Entries()
       .Where(e => e.State is EntityState.Modified or EntityState.Added))
   {
       if (entry.Entity is User or Appointment or PatientIntake or PatientView360)
           entry.Property("LastUpdatedAt").CurrentValue = DateTime.UtcNow;
       // ... existing UpdatedAt logic
   }
   ```
   Note: `PatientView360` uses `LastUpdatedAt` (not `UpdatedAt`) — the interceptor extension must target the correct property name.

## Current Project State
```
/api/
├── Domain/
│   ├── Entities/
│   │   ├── User.cs                       # us_007: exists
│   │   ├── ClinicalDocument.cs           # us_012: exists
│   │   ├── ExtractedClinicalData.cs      # us_013: exists
│   │   ├── PatientView360.cs             # NOT YET CREATED — this task
│   │   └── MedicalCodeSuggestion.cs      # NOT YET CREATED — this task
│   ├── Exceptions/
│   │   └── InvalidConfidenceScoreException.cs  # NOT YET CREATED — this task
│   └── Repositories/
│       ├── IPatientView360Repository.cs  # NOT YET CREATED — this task
│       └── IMedicalCodeSuggestionRepository.cs # NOT YET CREATED — this task
├── Infrastructure/
│   ├── Persistence/
│   │   ├── ApplicationDbContext.cs       # WILL BE MODIFIED
│   │   └── Repositories/
│   │       ├── PatientView360Repository.cs          # NOT YET CREATED — this task
│   │       └── MedicalCodeSuggestionRepository.cs   # NOT YET CREATED — this task
│   ├── Security/
│   │   └── PhiJsonEncryptionConverter.cs # us_010: REUSED for aggregated_data
│   └── Startup/
│       └── AuditTimestampInterceptor.cs  # WILL BE MODIFIED — extend for PatientView360
└── Program.cs                            # WILL BE MODIFIED — DI registrations
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Domain/Entities/PatientView360.cs` | Entity + `PatientAggregatedDataDto` record; `Create()`, `UpdateAggregatedData()`, `AddConflictFlag()` (100-entry cap, EC-2), `Verify()` (three-field atomic AC-5) |
| CREATE | `/api/Domain/Entities/MedicalCodeSuggestion.cs` | Entity + `CodeType`/`SuggestionStatus` enums; `Create()` with confidence pre-validation; `Accept()`, `Modify()`, `Reject()` forward-only transitions (AC-7) |
| CREATE | `/api/Domain/Exceptions/InvalidConfidenceScoreException.cs` | Domain exception with `AttemptedValue` property |
| CREATE | `/api/Domain/Repositories/IPatientView360Repository.cs` | `UpsertAsync`, `GetByPatientIdAsync`, `AddConflictFlagAsync`, `VerifyAsync` |
| CREATE | `/api/Domain/Repositories/IMedicalCodeSuggestionRepository.cs` | `CreateAsync`, `GetPendingByPatientAsync`, `AcceptAsync`, `ModifyAsync`, `RejectAsync` |
| CREATE | `/api/Infrastructure/Persistence/Repositories/PatientView360Repository.cs` | Upsert via tracked-entity check-then-add/update; `AsNoTracking()` on reads |
| CREATE | `/api/Infrastructure/Persistence/Repositories/MedicalCodeSuggestionRepository.cs` | `DbUpdateException` catch → `InvalidConfidenceScoreException` in `CreateAsync`; `FindAsync` + domain method on review transitions |
| MODIFY | `/api/Infrastructure/Persistence/ApplicationDbContext.cs` | Add `DbSet<PatientView360>` + `DbSet<MedicalCodeSuggestion>`; `OnModelCreating` with `PhiJsonEncryptionConverter<PatientAggregatedDataDto>`, JSONB column types, UNIQUE index, decimal(5,4), all FK `DeleteBehavior.Restrict` |
| MODIFY | `/api/Infrastructure/Startup/AuditTimestampInterceptor.cs` | Add `PatientView360` to the entity type dispatch for `LastUpdatedAt` refresh |
| MODIFY | `/api/Program.cs` | Register `IPatientView360Repository` → `PatientView360Repository`; `IMedicalCodeSuggestionRepository` → `MedicalCodeSuggestionRepository` |

## External References
- `PhiJsonEncryptionConverter<T>` (us_010): `/api/Infrastructure/Security/PhiJsonEncryptionConverter.cs`
- EF Core JSONB column type with Npgsql: https://www.npgsql.org/efcore/mapping/json.html
- `HasDefaultValueSql("'[]'::jsonb")` for JSONB default: https://learn.microsoft.com/en-us/ef/core/modeling/generated-properties
- `decimal(5,4)` column type in EF Core: https://learn.microsoft.com/en-us/ef/core/modeling/entity-properties#column-data-types
- DR-008, DR-009: `patient_view_360` and `medical_code_suggestions` entities — `.propel/context/docs/design.md`
- OWASP A05 (raw DB error exposure in catch blocks): https://owasp.org/Top10/A05_2021-Security_Misconfiguration/

## Build Commands
```bash
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
UPLOADS_ROOT="/tmp/uploads" \
dotnet build api/Api.csproj --configuration Debug
```

## Implementation Validation Strategy
- [ ] `dotnet build` passes with no FK navigation ambiguity from multiple `User` references
- [ ] `PatientView360.AddConflictFlag()` called 101 times — `ConflictFlags.Count` stays at 100; last entry is `{overflow: true, additionalCount: 1}` (EC-2)
- [ ] `PatientView360.Verify(staffId)` sets `IsVerified = true`, `VerifiedBy = staffId`, `VerifiedAt != null` atomically (AC-5)
- [ ] `MedicalCodeSuggestion.Create(... confidenceScore: 1.5)` throws `InvalidConfidenceScoreException` before any DB call (AC-6)
- [ ] `MedicalCodeSuggestion.Accept()` on `Pending` → `Status = Accepted`, `FinalCode = SuggestedCode`; `Accept()` on `Accepted` → `InvalidOperationException` (forward-only AC-7)
- [ ] `MedicalCodeSuggestion.Reject()` → `FinalCode = null` (AC-7)
- [ ] `AuditTimestampInterceptor` updates `LastUpdatedAt` on `PatientView360` modified entity during `SaveChanges`
- [ ] Round-trip: insert `PatientView360` with known DTO, read back, assert decrypted `AggregatedData` matches original (AC-3)

## Implementation Checklist
- [ ] Create `PatientView360.cs` with `PatientAggregatedDataDto` record; `Create()` factory; `AddConflictFlag()` with 100-entry cap + overflow rollup; `Verify()` setting three fields atomically
- [ ] Create `MedicalCodeSuggestion.cs` with `CodeType`/`SuggestionStatus` enums; `Create()` with confidence pre-validation; `Accept()`, `Modify()`, `Reject()` forward-only guards
- [ ] Create `InvalidConfidenceScoreException.cs` with `AttemptedValue` property
- [ ] Create `IPatientView360Repository.cs` and `PatientView360Repository.cs` (upsert via check-then-add/update; `AsNoTracking` reads)
- [ ] Create `IMedicalCodeSuggestionRepository.cs` and `MedicalCodeSuggestionRepository.cs` (`DbUpdateException` → `InvalidConfidenceScoreException`; domain method calls for review transitions)
- [ ] Modify `ApplicationDbContext.cs`: both `DbSet<>` + full `OnModelCreating` config (UNIQUE on `patient_id`, JSONB types, `decimal(5,4)`, named FK constraints with `DeleteBehavior.Restrict`)
- [ ] Modify `AuditTimestampInterceptor.cs`: add `PatientView360` to `LastUpdatedAt` refresh dispatch
- [ ] Modify `Program.cs`: register both repository pairs in DI
