---
title: "Task — ExtractedClinicalData Entity, FieldType Enum, AES-256 field_value Converter, Patient-ACL Repository"
task_id: task_001
story_id: us_013
epic: EP-DATA-II
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_013] — `extracted_clinical_data` Entity with pgvector Embedding Column
- Story Location: `.propel/context/tasks/EP-DATA-II/us_013/us_013.md`
- Acceptance Criteria:
  - AC-1: `ExtractedClinicalData` entity with `extract_id` (UUID PK), `document_id` (UUID FK → `clinical_documents.document_id`), `patient_id` (UUID FK → `users.user_id`), `field_type` (enum → TEXT), `field_value` (TEXT, AES-256 encrypted), `source_text` (TEXT, plaintext), `extracted_at` (TIMESTAMPTZ), `embedding` (vector(384), nullable)
  - AC-3: Cosine similarity query `ORDER BY embedding <=> @queryVector LIMIT 5` always scoped with `WHERE patient_id = @patientId` (AIR-S04 ACL enforcement)
  - AC-4: `field_value` encrypted via AES-256 value converter before persistence; application layer decrypts transparently
  - AC-5: `source_text` stored as plaintext, NOT NULL, non-empty; no PII; PII redaction enforced at AI pipeline service layer
  - AC-6: `embedding` nullable; HNSW partial index `WHERE embedding IS NOT NULL` excludes null rows from similarity searches
- Edge Cases:
  - EC-1: `vector(384)` dimension mismatch → `EmbeddingDimensionMismatchException` raised by repository; mapped from `DbUpdateException` / `NpgsqlException`
  - EC-2: `document_id` FK always satisfiable — `clinical_documents` rows never physically deleted; no cascade needed

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
| Vector | pgvector (Pgvector.EntityFrameworkCore) | 0.7.x |
| AI/ML | N/A | N/A |
| Mobile | N/A | N/A |

## AI References (AI Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | AIR-S04 (patient-scoped ACL filter on similarity queries) |
| **AI Pattern** | N/A — schema enforcement only; RAG pipeline is a separate story |
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
Define the `ExtractedClinicalData` EF Core entity with a `ClinicalFieldType` enum, reuse `PhiTextEncryptionConverter` (from us_010) for AES-256 encryption on `field_value`, configure the nullable `Vector` property for the `embedding` column (Pgvector.EntityFrameworkCore), and implement `IExtractedClinicalDataRepository` with a patient-ACL-enforced cosine similarity query using `FromSqlRaw`. Configure dual FK relationships (`document_id` → `clinical_documents`, `patient_id` → `users`) with `DeleteBehavior.Restrict` in `OnModelCreating`.

## Dependent Tasks
- `us_010 task_001_be_patient_intake_entity_converters.md` — `PhiTextEncryptionConverter` (renamed from `PhiEmailEncryptionConverter`) must exist in `/api/Infrastructure/Security/`; reused for `field_value` encryption
- `us_012 task_001_be_clinical_document_entity.md` — `ClinicalDocument` entity must exist; `ExtractedClinicalData.document_id` FKs to it
- `us_007 task_001_be_user_entity_value_converters.md` — `User` entity must exist; `ExtractedClinicalData.patient_id` FKs to it

## Impacted Components
- `/api/Domain/Entities/ExtractedClinicalData.cs` — CREATE: entity + `ClinicalFieldType` enum
- `/api/Domain/Exceptions/EmbeddingDimensionMismatchException.cs` — CREATE: domain exception for vector dimension mismatch
- `/api/Domain/Repositories/IExtractedClinicalDataRepository.cs` — CREATE: repository interface with patient-ACL cosine similarity query signature
- `/api/Infrastructure/Persistence/Repositories/ExtractedClinicalDataRepository.cs` — CREATE: EF Core implementation with `FromSqlRaw` cosine similarity and `NpgsqlException` → `EmbeddingDimensionMismatchException` mapping
- `/api/Infrastructure/Persistence/ApplicationDbContext.cs` — MODIFY: add `DbSet<ExtractedClinicalData>` + `OnModelCreating` config (dual FK, `PhiTextEncryptionConverter` on `field_value`, `Vector` column type)

## Implementation Plan

1. **Define `ClinicalFieldType` enum and `ExtractedClinicalData` entity** (AC-1, AC-4, AC-5, AC-6):
   ```csharp
   // /api/Domain/Entities/ExtractedClinicalData.cs
   using Pgvector;

   namespace Api.Domain.Entities;

   public enum ClinicalFieldType
   {
       Vital,
       Medication,
       Allergy,
       Diagnosis,
       SurgicalHistory
   }

   public sealed class ExtractedClinicalData
   {
       public Guid ExtractId { get; private set; }
       public Guid DocumentId { get; private set; }
       public ClinicalDocument Document { get; private set; } = null!;
       public Guid PatientId { get; private set; }
       public User Patient { get; private set; } = null!;
       public ClinicalFieldType FieldType { get; private set; }
       // field_value: AES-256 encrypted via PhiTextEncryptionConverter in OnModelCreating (AC-4)
       public string FieldValue { get; private set; } = string.Empty;
       // source_text: plaintext, no PII (AC-5; PII redaction enforced at AI service layer)
       public string SourceText { get; private set; } = string.Empty;
       public DateTime ExtractedAt { get; private set; }
       // AC-6: nullable — row can exist before embedding job runs
       public Vector? Embedding { get; private set; }

       // EF Core constructor
       private ExtractedClinicalData() { }

       public static ExtractedClinicalData Create(
           Guid documentId,
           Guid patientId,
           ClinicalFieldType fieldType,
           string fieldValue,
           string sourceText)
       {
           if (string.IsNullOrWhiteSpace(fieldValue))
               throw new ArgumentException("field_value must not be empty.", nameof(fieldValue));
           if (string.IsNullOrWhiteSpace(sourceText))
               throw new ArgumentException("source_text must not be empty.", nameof(sourceText));

           return new ExtractedClinicalData
           {
               ExtractId = Guid.NewGuid(),
               DocumentId = documentId,
               PatientId = patientId,
               FieldType = fieldType,
               FieldValue = fieldValue,
               SourceText = sourceText,
               ExtractedAt = DateTime.UtcNow,
               Embedding = null   // AC-6: null until embedding job runs
           };
       }

       public void SetEmbedding(Vector embedding)
       {
           // EC-1: dimension guard at domain level (pgvector also enforces at DB level)
           if (embedding.ToArray().Length != 384)
               throw new EmbeddingDimensionMismatchException(embedding.ToArray().Length, 384);
           Embedding = embedding;
       }
   }
   ```
   Design decisions:
   - Private setters throughout: callers cannot mutate properties directly.
   - `Embedding` starts as `null` (AC-6 — embedding job may be queued after initial insert).
   - `SetEmbedding()` enforces the 384-dimension constraint at the domain level before a DB round-trip (EC-1 pre-validation); pgvector also enforces this at the column definition level as a second layer.
   - `FieldValue` and `SourceText` are guarded against empty strings in `Create()` — AC-5 non-empty constraint enforced at application boundary.

2. **Define `EmbeddingDimensionMismatchException`** (EC-1):
   ```csharp
   // /api/Domain/Exceptions/EmbeddingDimensionMismatchException.cs
   namespace Api.Domain.Exceptions;

   public sealed class EmbeddingDimensionMismatchException : Exception
   {
       public int ActualDimensions { get; }
       public int ExpectedDimensions { get; }

       public EmbeddingDimensionMismatchException(int actual, int expected)
           : base($"Embedding has {actual} dimensions; expected {expected}.")
       {
           ActualDimensions = actual;
           ExpectedDimensions = expected;
       }
   }
   ```

3. **Define `IExtractedClinicalDataRepository`** (AC-3, AC-4, AC-6, AC-7):
   ```csharp
   // /api/Domain/Repositories/IExtractedClinicalDataRepository.cs
   using Pgvector;

   namespace Api.Domain.Repositories;

   public interface IExtractedClinicalDataRepository
   {
       Task<ExtractedClinicalData> CreateAsync(ExtractedClinicalData extract, CancellationToken ct = default);
       Task<ExtractedClinicalData?> GetByIdAsync(Guid extractId, CancellationToken ct = default);
       Task<IReadOnlyList<ExtractedClinicalData>> GetByPatientAndFieldTypeAsync(
           Guid patientId, ClinicalFieldType fieldType, CancellationToken ct = default);
       // AC-3: patient-ACL cosine similarity — always scoped by patientId (AIR-S04)
       Task<IReadOnlyList<ExtractedClinicalData>> FindSimilarAsync(
           Guid patientId, Vector queryVector, int topK = 5, CancellationToken ct = default);
       Task SetEmbeddingAsync(Guid extractId, Vector embedding, CancellationToken ct = default);
       // No hard-delete
   }
   ```

4. **Implement `ExtractedClinicalDataRepository`** with patient-ACL cosine similarity and dimension-mismatch mapping (AC-3, EC-1):
   ```csharp
   // /api/Infrastructure/Persistence/Repositories/ExtractedClinicalDataRepository.cs
   using Npgsql;
   using Pgvector;
   using Pgvector.EntityFrameworkCore;

   namespace Api.Infrastructure.Persistence.Repositories;

   public sealed class ExtractedClinicalDataRepository : IExtractedClinicalDataRepository
   {
       private readonly ApplicationDbContext _db;

       public ExtractedClinicalDataRepository(ApplicationDbContext db) => _db = db;

       public async Task<ExtractedClinicalData> CreateAsync(
           ExtractedClinicalData extract, CancellationToken ct = default)
       {
           _db.ExtractedClinicalData.Add(extract);
           try
           {
               await _db.SaveChangesAsync(ct);
           }
           catch (DbUpdateException ex)
               when (ex.InnerException is PostgresException pg && pg.SqlState == "22000")
           {
               // EC-1: pgvector dimension mismatch PostgreSQL error code 22000 (data_exception)
               throw new EmbeddingDimensionMismatchException(0, 384);
           }
           return extract;
       }

       public async Task<IReadOnlyList<ExtractedClinicalData>> GetByPatientAndFieldTypeAsync(
           Guid patientId, ClinicalFieldType fieldType, CancellationToken ct = default)
       {
           // AC-7: composite index (patient_id, field_type) used by this query
           return await _db.ExtractedClinicalData
               .Where(e => e.PatientId == patientId && e.FieldType == fieldType)
               .AsNoTracking()
               .ToListAsync(ct);
       }

       public async Task<IReadOnlyList<ExtractedClinicalData>> FindSimilarAsync(
           Guid patientId, Vector queryVector, int topK = 5, CancellationToken ct = default)
       {
           // AC-3 / AIR-S04: patient_id filter MUST precede ORDER BY embedding <=> @queryVector
           // This prevents cross-patient data leakage regardless of vector proximity.
           // Uses Pgvector.EntityFrameworkCore CosineDistance() operator translation.
           return await _db.ExtractedClinicalData
               .Where(e => e.PatientId == patientId && e.Embedding != null)
               .OrderBy(e => e.Embedding!.CosineDistance(queryVector))
               .Take(topK)
               .AsNoTracking()
               .ToListAsync(ct);
       }

       public async Task SetEmbeddingAsync(Guid extractId, Vector embedding, CancellationToken ct = default)
       {
           var extract = await _db.ExtractedClinicalData.FindAsync([extractId], ct)
               ?? throw new KeyNotFoundException($"ExtractedClinicalData '{extractId}' not found.");
           extract.SetEmbedding(embedding);   // EC-1: 384-dim guard in domain entity
           try
           {
               await _db.SaveChangesAsync(ct);
           }
           catch (DbUpdateException ex)
               when (ex.InnerException is PostgresException pg && pg.SqlState == "22000")
           {
               throw new EmbeddingDimensionMismatchException(embedding.ToArray().Length, 384);
           }
       }

       public async Task<ExtractedClinicalData?> GetByIdAsync(Guid extractId, CancellationToken ct = default)
           => await _db.ExtractedClinicalData
               .AsNoTracking()
               .FirstOrDefaultAsync(e => e.ExtractId == extractId, ct);
   }
   ```
   Design decisions:
   - `CosineDistance()` is the Pgvector.EntityFrameworkCore LINQ operator that translates to `<=>` in the generated SQL — no raw SQL needed; the EF Core query still applies the `WHERE patient_id = @patientId` ACL filter automatically.
   - `PostgresException.SqlState == "22000"` catches pgvector dimension mismatch errors; the EF Core `DbUpdateException` wraps `NpgsqlException` which wraps `PostgresException`.
   - `Where(e => e.Embedding != null)` pre-filters in LINQ so the HNSW partial index is used and null rows are excluded from vector comparison (AC-6).

5. **Update `ApplicationDbContext.OnModelCreating`** — add `DbSet<ExtractedClinicalData>` + full property configuration (AC-1, AC-4):
   ```csharp
   // In ApplicationDbContext.OnModelCreating:

   modelBuilder.Entity<ExtractedClinicalData>(e =>
   {
       e.ToTable("extracted_clinical_data");
       e.HasKey(x => x.ExtractId);
       e.Property(x => x.ExtractId).HasColumnName("extract_id").HasDefaultValueSql("gen_random_uuid()");
       e.Property(x => x.DocumentId).HasColumnName("document_id").IsRequired();
       e.Property(x => x.PatientId).HasColumnName("patient_id").IsRequired();
       e.Property(x => x.FieldType)
           .HasColumnName("field_type")
           .HasConversion<string>()   // stores enum as TEXT — CHECK constraint added in migration
           .IsRequired();
       e.Property(x => x.FieldValue)
           .HasColumnName("field_value")
           .HasConversion(new PhiTextEncryptionConverter(encryptionKey))   // AC-4: AES-256
           .IsRequired();
       e.Property(x => x.SourceText).HasColumnName("source_text").IsRequired();
       e.Property(x => x.ExtractedAt).HasColumnName("extracted_at").IsRequired();
       e.Property(x => x.Embedding)
           .HasColumnName("embedding")
           .HasColumnType("vector(384)")   // AC-6: nullable vector(384)
           .IsRequired(false);

       // document_id FK → clinical_documents.document_id (ON DELETE RESTRICT)
       e.HasOne(x => x.Document)
           .WithMany()
           .HasForeignKey(x => x.DocumentId)
           .OnDelete(DeleteBehavior.Restrict)
           .HasConstraintName("fk_extracted_clinical_data_document_id");

       // patient_id FK → users.user_id (ON DELETE RESTRICT)
       e.HasOne(x => x.Patient)
           .WithMany()
           .HasForeignKey(x => x.PatientId)
           .OnDelete(DeleteBehavior.Restrict)
           .HasConstraintName("fk_extracted_clinical_data_patient_id");
   });
   ```
   Note: `PhiTextEncryptionConverter` requires the encryption key from `IConfiguration["PHI_ENCRYPTION_KEY"]`; ensure `ApplicationDbContext` accepts `IConfiguration` in its constructor (established in us_007/us_010). `FieldType` enum CHECK constraint is NOT auto-generated by EF Core from `HasConversion<string>()` — added manually via `migrationBuilder.Sql()` in task_002.

6. **Register `ExtractedClinicalDataRepository` in DI** — add to `Program.cs` service registrations:
   ```csharp
   // In Program.cs service registration section (after other repositories):
   builder.Services.AddScoped<IExtractedClinicalDataRepository, ExtractedClinicalDataRepository>();
   ```

## Current Project State
```
/api/
├── Domain/
│   ├── Entities/
│   │   ├── User.cs                        # us_007: exists
│   │   ├── ClinicalDocument.cs            # us_012: exists
│   │   └── ExtractedClinicalData.cs       # NOT YET CREATED — this task
│   ├── Exceptions/
│   │   ├── InvalidStatusTransitionException.cs  # us_012: exists
│   │   ├── DocumentNotFoundException.cs         # us_012: exists
│   │   └── EmbeddingDimensionMismatchException.cs # NOT YET CREATED — this task
│   └── Repositories/
│       ├── IUserRepository.cs             # us_007: exists
│       ├── IClinicalDocumentRepository.cs # us_012: exists
│       └── IExtractedClinicalDataRepository.cs  # NOT YET CREATED — this task
├── Infrastructure/
│   ├── Persistence/
│   │   ├── ApplicationDbContext.cs        # WILL BE MODIFIED
│   │   └── Repositories/
│   │       ├── ClinicalDocumentRepository.cs    # us_012: exists
│   │       └── ExtractedClinicalDataRepository.cs # NOT YET CREATED — this task
│   └── Security/
│       ├── PhiTextEncryptionConverter.cs  # us_010: REUSED for field_value encryption
│       └── PhiJsonEncryptionConverter.cs  # us_010: exists
└── Program.cs                             # WILL BE MODIFIED — DI registration
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Domain/Entities/ExtractedClinicalData.cs` | `ExtractedClinicalData` entity + `ClinicalFieldType` enum; private setters; `Create()` factory; `SetEmbedding()` with 384-dim guard |
| CREATE | `/api/Domain/Exceptions/EmbeddingDimensionMismatchException.cs` | Domain exception with `ActualDimensions` and `ExpectedDimensions` properties (EC-1) |
| CREATE | `/api/Domain/Repositories/IExtractedClinicalDataRepository.cs` | `CreateAsync`, `GetByIdAsync`, `GetByPatientAndFieldTypeAsync`, `FindSimilarAsync` (patient-ACL + cosine), `SetEmbeddingAsync` |
| CREATE | `/api/Infrastructure/Persistence/Repositories/ExtractedClinicalDataRepository.cs` | EF Core implementation; `CosineDistance()` LINQ operator for `<=>` translation; `PostgresException` catch for dimension mismatch; `AsNoTracking()` on reads |
| MODIFY | `/api/Infrastructure/Persistence/ApplicationDbContext.cs` | Add `DbSet<ExtractedClinicalData>`; `OnModelCreating` config with `PhiTextEncryptionConverter` on `field_value`, `HasColumnType("vector(384)")` on `embedding`, dual FK with `DeleteBehavior.Restrict` and named constraint names |
| MODIFY | `/api/Program.cs` | Register `IExtractedClinicalDataRepository` → `ExtractedClinicalDataRepository` in DI |

## External References
- `Pgvector.EntityFrameworkCore` NuGet + `CosineDistance()` LINQ operator: https://github.com/pgvector/pgvector-dotnet
- `HasColumnType("vector(384)")` in EF Core: https://learn.microsoft.com/en-us/ef/core/modeling/entity-properties#column-data-types
- `PostgresException.SqlState` values (22000 = data_exception): https://www.postgresql.org/docs/current/errcodes-appendix.html
- AIR-S04 patient-scoped ACL pattern — `.propel/context/docs/design.md#AIR-S04`
- DR-007: `extracted_clinical_data` entity — `.propel/context/docs/design.md#DR-007`
- OWASP A01 (Broken Access Control — cross-patient data leakage): https://owasp.org/Top10/A01_2021-Broken_Access_Control/

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
- [ ] `dotnet build` passes — no ambiguous FK navigation issues from dual User references
- [ ] `ExtractedClinicalData.Create()` produces entity with `Embedding = null`, `FieldType` from enum, non-empty `FieldValue` and `SourceText`
- [ ] `SetEmbedding(new Vector(new float[768]))` throws `EmbeddingDimensionMismatchException` (actual=768, expected=384) before any DB call
- [ ] `SetEmbedding(new Vector(new float[384]))` succeeds and sets the `Embedding` property
- [ ] `FindSimilarAsync(patientId, queryVector)` LINQ query includes `WHERE patient_id = @patientId` in generated SQL — verify via `_db.ExtractedClinicalData.Where(...).ToQueryString()` in a unit test
- [ ] `FindSimilarAsync` with a different `patientId` returns zero results even if that patient's embeddings are closer to the query vector (AIR-S04 ACL isolation)
- [ ] Round-trip test: insert entity with known `FieldValue`, read back via `GetByIdAsync`, assert decrypted value matches original (AC-4)
- [ ] `DbUpdateException` wrapping `PostgresException` with SqlState `"22000"` is caught and re-thrown as `EmbeddingDimensionMismatchException`

## Implementation Checklist
- [ ] Create `ExtractedClinicalData.cs` with `ClinicalFieldType` enum, private setters, `Create()` factory with non-empty guards on `fieldValue`/`sourceText`, `SetEmbedding()` with 384-dim pre-validation
- [ ] Create `EmbeddingDimensionMismatchException.cs` with `ActualDimensions` and `ExpectedDimensions` properties
- [ ] Create `IExtractedClinicalDataRepository.cs` with `FindSimilarAsync(patientId, queryVector, topK)` — ACL-first signature enforces patient scope at compile time
- [ ] Create `ExtractedClinicalDataRepository.cs` — use `CosineDistance()` LINQ operator (Pgvector.EntityFrameworkCore); apply `Where(patient_id).Where(embedding != null).OrderBy(CosineDistance).Take(topK)`; catch `PostgresException` SqlState `"22000"` in `CreateAsync` and `SetEmbeddingAsync`
- [ ] Modify `ApplicationDbContext.cs`: add `DbSet<ExtractedClinicalData>`, `OnModelCreating` with `PhiTextEncryptionConverter` on `field_value`, `HasColumnType("vector(384)")` on `embedding`, `HasConversion<string>()` on `field_type`, named dual FK constraints with `DeleteBehavior.Restrict`
- [ ] Modify `Program.cs`: register `IExtractedClinicalDataRepository` → `ExtractedClinicalDataRepository`
- [ ] Verify `dotnet build` passes with no FK navigation ambiguity errors
