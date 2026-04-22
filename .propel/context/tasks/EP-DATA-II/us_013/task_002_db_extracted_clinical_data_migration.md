---
title: "Task — extracted_clinical_data Migration: HNSW Index, CHECK Constraint, Composite Index, Partial Vector Index"
task_id: task_002
story_id: us_013
epic: EP-DATA-II
layer: Database
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_013] — `extracted_clinical_data` Entity with pgvector Embedding Column
- Story Location: `.propel/context/tasks/EP-DATA-II/us_013/us_013.md`
- Acceptance Criteria:
  - AC-1: `extracted_clinical_data` table with `extract_id` (UUID PK), `document_id` (UUID FK), `patient_id` (UUID FK), `field_type` (TEXT CHECK), `field_value` (TEXT NOT NULL), `source_text` (TEXT NOT NULL), `extracted_at` (TIMESTAMPTZ), `embedding` (vector(384), nullable)
  - AC-2: Named HNSW index on `embedding` using `vector_cosine_ops`, partial `WHERE embedding IS NOT NULL`, with reduced params `m=16, ef_construction=64`
  - AC-6: HNSW partial index excludes NULL embeddings from similarity searches without bloating index
  - AC-7: Composite index on `(patient_id, field_type)` supports field-type-filtered patient queries; `EXPLAIN ANALYZE` confirms Index Scan
- Edge Cases:
  - EC-3: HNSW index build failure on resource-constrained environments → migration catches error, logs warning, continues without index; table remains functional for non-similarity queries

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
| Database | PostgreSQL | 16.x |
| Vector Extension | pgvector | 0.7.x |
| ORM Migrations | EF Core | 9.x |
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
Generate the EF Core migration for `extracted_clinical_data`. All non-standard DDL must be added via `migrationBuilder.Sql()`: the `field_type` CHECK constraint, the partial HNSW index (`WHERE embedding IS NOT NULL`, `m=16`, `ef_construction=64`), and the composite index on `(patient_id, field_type)`. The HNSW index creation is wrapped in a try-catch `DO $$...END$$` PL/pgSQL block to handle resource-constrained Codespaces failures gracefully (EC-3). Verify all indexes via `EXPLAIN ANALYZE`.

## Dependent Tasks
- `us_013 task_001_be_extracted_clinical_data_entity.md` — `ExtractedClinicalData` entity and `ApplicationDbContext` configuration must exist before `dotnet ef migrations add` is run
- `us_012 task_002_db_clinical_documents_migration.md` — `clinical_documents` table must exist; `document_id` FK references it
- `us_007 task_002_db_users_migration_schema.md` — `users` table must exist; `patient_id` FK references it
- `us_003/us_004` — `pgvector` extension must be enabled in the database before `vector(384)` column can be created

## Impacted Components
- `/api/Migrations/<timestamp>_ExtractedClinicalData.cs` — CREATE: generated migration + manual DDL additions
- `/api/Migrations/ApplicationDbContextModelSnapshot.cs` — MODIFY: auto-updated by EF Core migration tool

## Implementation Plan

1. **Generate the migration** after task_001 entity and context changes are in place:
   ```bash
   cd api
   dotnet ef migrations add ExtractedClinicalData \
     --project Api.csproj \
     --startup-project Api.csproj \
     --output-dir Migrations
   ```
   Open the generated `<timestamp>_ExtractedClinicalData.cs`. EF Core will scaffold `CreateTable` with `document_id`, `patient_id`, `field_type`, `field_value`, `source_text`, `extracted_at`, and `embedding` columns with `HasColumnType("vector(384)")`. It will generate both `AddForeignKey` calls. It will NOT generate: the CHECK constraint, the HNSW index, or the composite `(patient_id, field_type)` index — all must be added manually.

2. **Add `field_type` CHECK constraint** (AC-1) — add after `CreateTable` in `Up()`:
   ```csharp
   migrationBuilder.Sql("""
       ALTER TABLE extracted_clinical_data
       ADD CONSTRAINT chk_extracted_clinical_data_field_type
       CHECK (field_type IN ('Vital', 'Medication', 'Allergy', 'Diagnosis', 'SurgicalHistory'));
   """);
   ```
   In `Down()`, drop before `DropTable`:
   ```csharp
   migrationBuilder.Sql("""
       ALTER TABLE extracted_clinical_data
       DROP CONSTRAINT IF EXISTS chk_extracted_clinical_data_field_type;
   """);
   ```

3. **Add composite index on `(patient_id, field_type)`** (AC-7) — via `migrationBuilder.CreateIndex`:
   ```csharp
   // In Up() after CHECK constraint:
   migrationBuilder.CreateIndex(
       name: "ix_extracted_clinical_data_patient_id_field_type",
       table: "extracted_clinical_data",
       columns: ["patient_id", "field_type"]);
   ```
   In `Down()`:
   ```csharp
   migrationBuilder.DropIndex(
       name: "ix_extracted_clinical_data_patient_id_field_type",
       table: "extracted_clinical_data");
   ```
   This index supports `GetByPatientAndFieldTypeAsync(patientId, fieldType)` and the ACL-scoped `FindSimilarAsync` `WHERE patient_id = @patientId` pre-filter.

4. **Add partial HNSW index on `embedding`** (AC-2, AC-6, EC-3) — via `migrationBuilder.Sql()` with try-catch PL/pgSQL block:
   ```csharp
   // In Up() — HNSW index with reduced params for Codespaces resource constraints
   migrationBuilder.Sql("""
       DO $$
       BEGIN
           CREATE INDEX ix_extracted_clinical_data_embedding_hnsw
           ON extracted_clinical_data
           USING hnsw (embedding vector_cosine_ops)
           WITH (m = 16, ef_construction = 64)
           WHERE embedding IS NOT NULL;
       EXCEPTION
           WHEN OTHERS THEN
               RAISE WARNING 'HNSW index creation failed: %. Table is functional without index. Rebuild when resources allow.',
                   SQLERRM;
       END;
       $$;
   """);
   ```
   In `Down()`:
   ```csharp
   migrationBuilder.Sql("""
       DROP INDEX IF EXISTS ix_extracted_clinical_data_embedding_hnsw;
   """);
   ```
   Design decisions:
   - `WHERE embedding IS NOT NULL` — partial index excludes rows without embeddings; keeps index size proportional to the number of rows that actually have embeddings (AC-6).
   - `m=16, ef_construction=64` — HNSW parameters reduced from PostgreSQL defaults (`m=16` is actually the default, but `ef_construction` default is 64; explicitly setting both communicates the intent and prevents regression if pgvector changes defaults). For the Codespaces environment (limited RAM), these values minimise index build memory.
   - `DO $$ ... EXCEPTION WHEN OTHERS THEN RAISE WARNING` — PostgreSQL PL/pgSQL anonymous block catches index build failures and degrades gracefully (EC-3): the migration succeeds, the table is usable, and similarity queries fall back to sequential scan until the index is rebuilt out-of-band.
   - `RAISE WARNING` ensures the failure is visible in the PostgreSQL log without aborting the migration transaction.

5. **Verify the full `Up()` DDL order** in the generated migration:
   ```
   1. CreateTable("extracted_clinical_data", ...)
      - extract_id UUID PK DEFAULT gen_random_uuid()
      - document_id UUID NOT NULL
      - patient_id UUID NOT NULL
      - field_type TEXT NOT NULL
      - field_value TEXT NOT NULL  (stored as ciphertext via PhiTextEncryptionConverter)
      - source_text TEXT NOT NULL
      - extracted_at TIMESTAMPTZ NOT NULL
      - embedding vector(384) NULL
   2. migrationBuilder.Sql() — ADD CONSTRAINT chk_extracted_clinical_data_field_type CHECK (...)
   3. AddForeignKey("fk_extracted_clinical_data_document_id") → clinical_documents ON DELETE RESTRICT
   4. AddForeignKey("fk_extracted_clinical_data_patient_id") → users ON DELETE RESTRICT
   5. CreateIndex("ix_extracted_clinical_data_patient_id_field_type", ["patient_id", "field_type"])
   6. migrationBuilder.Sql() — DO $$ BEGIN CREATE INDEX ... USING hnsw ... WITH (m=16, ef_construction=64) WHERE embedding IS NOT NULL; EXCEPTION WHEN OTHERS THEN RAISE WARNING; END $$
   ```
   And `Down()` in reverse:
   ```
   1. migrationBuilder.Sql() — DROP INDEX IF EXISTS ix_extracted_clinical_data_embedding_hnsw
   2. DropIndex("ix_extracted_clinical_data_patient_id_field_type")
   3. DropForeignKey("fk_extracted_clinical_data_patient_id")
   4. DropForeignKey("fk_extracted_clinical_data_document_id")
   5. migrationBuilder.Sql() — DROP CONSTRAINT IF EXISTS chk_extracted_clinical_data_field_type
   6. DropTable("extracted_clinical_data")
   ```

6. **Apply and verify the migration**:
   ```bash
   DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
   PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
   JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
   UPLOADS_ROOT="/tmp/uploads" \
   dotnet ef database update \
     --project api/Api.csproj \
     --startup-project api/Api.csproj
   ```

7. **Verify schema and index correctness via psql**:
   ```sql
   -- AC-1: confirm all columns and types
   SELECT column_name, data_type, udt_name, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'extracted_clinical_data'
   ORDER BY ordinal_position;
   -- embedding column should show udt_name = 'vector'

   -- AC-2: confirm HNSW index exists with correct settings
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'extracted_clinical_data'
     AND indexname = 'ix_extracted_clinical_data_embedding_hnsw';
   -- Expected: USING hnsw ... vector_cosine_ops ... WHERE embedding IS NOT NULL

   -- Confirm HNSW parameters
   SELECT amname, reloptions
   FROM pg_class c
   JOIN pg_am am ON c.relam = am.oid
   WHERE c.relname = 'ix_extracted_clinical_data_embedding_hnsw';
   -- Expected: {m=16,ef_construction=64}

   -- AC-7: EXPLAIN ANALYZE — composite index for patient+field_type query
   EXPLAIN ANALYZE
   SELECT * FROM extracted_clinical_data
   WHERE patient_id = '00000000-0000-0000-0000-000000000001'
     AND field_type = 'Medication';
   -- Expected: "Index Scan using ix_extracted_clinical_data_patient_id_field_type"

   -- AC-3/AC-6: EXPLAIN ANALYZE — cosine similarity with ACL filter
   -- (requires at least one row with non-null embedding)
   EXPLAIN ANALYZE
   SELECT * FROM extracted_clinical_data
   WHERE patient_id = '00000000-0000-0000-0000-000000000001'
     AND embedding IS NOT NULL
   ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector(384)
   LIMIT 5;
   -- Expected: "Index Scan using ix_extracted_clinical_data_embedding_hnsw"

   -- CHECK constraint test — should raise violation
   INSERT INTO extracted_clinical_data
     (extract_id, document_id, patient_id, field_type, field_value, source_text, extracted_at)
   VALUES
     (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'InvalidType', 'cipher', 'source', now());
   -- Expected: ERROR: new row violates check constraint "chk_extracted_clinical_data_field_type"
   ```

8. **Generate idempotent deployment script**:
   ```bash
   dotnet ef migrations script --idempotent \
     --project api/Api.csproj \
     --startup-project api/Api.csproj \
     --output extracted_clinical_data_idempotent.sql
   ```
   Note: The `DO $$ ... END $$` PL/pgSQL block is included verbatim in the idempotent script; it is self-guarding via `DROP INDEX IF EXISTS` in the subsequent `Down()` equivalent and the `EXCEPTION WHEN OTHERS` block in `Up()`.

## Current Project State
```
/api/Migrations/
├── <timestamp>_InitialCreate.cs                     # us_004: exists
├── <timestamp>_UsersEntity.cs                       # us_007: exists
├── <timestamp>_AppointmentSlotAndAppointment.cs     # us_008: exists
├── <timestamp>_WaitlistAndNotifications.cs          # us_009: exists
├── <timestamp>_PatientIntakes.cs                    # us_010: exists
├── <timestamp>_SeedInsuranceDummyRecords.cs         # us_011: exists
├── <timestamp>_ClinicalDocuments.cs                 # us_012: exists
└── <timestamp>_ExtractedClinicalData.cs             # NOT YET GENERATED — this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Migrations/<timestamp>_ExtractedClinicalData.cs` | EF Core migration: `CreateTable` with `vector(384)` nullable `embedding` column; `chk_extracted_clinical_data_field_type` CHECK via `migrationBuilder.Sql()`; dual FK `fk_extracted_clinical_data_document_id` + `fk_extracted_clinical_data_patient_id` both `ON DELETE RESTRICT`; composite index `ix_extracted_clinical_data_patient_id_field_type`; partial HNSW index via `migrationBuilder.Sql()` with `DO $$...EXCEPTION...END$$` wrapper |
| MODIFY | `/api/Migrations/ApplicationDbContextModelSnapshot.cs` | Auto-updated to include `extracted_clinical_data` configuration |

## External References
- pgvector HNSW index syntax + parameters: https://github.com/pgvector/pgvector?tab=readme-ov-file#hnsw
- pgvector HNSW `m` and `ef_construction` parameters: https://github.com/pgvector/pgvector?tab=readme-ov-file#index-options
- `vector_cosine_ops` distance operator (`<=>`): https://github.com/pgvector/pgvector?tab=readme-ov-file#distance-functions
- PostgreSQL partial indexes (`WHERE` clause): https://www.postgresql.org/docs/current/indexes-partial.html
- PostgreSQL PL/pgSQL `DO` block with `EXCEPTION`: https://www.postgresql.org/docs/current/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING
- `RAISE WARNING` in PostgreSQL: https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html
- DR-007: `extracted_clinical_data` entity — `.propel/context/docs/design.md#DR-007`
- AIR-S04: patient-scoped ACL for similarity queries — `.propel/context/docs/design.md#AIR-S04`

## Build Commands
```bash
# Generate migration after task_001 entity and context changes
cd api
dotnet ef migrations add ExtractedClinicalData \
  --project Api.csproj \
  --startup-project Api.csproj \
  --output-dir Migrations

# Apply to local dev database
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
UPLOADS_ROOT="/tmp/uploads" \
dotnet ef database update \
  --project api/Api.csproj \
  --startup-project api/Api.csproj

# Generate idempotent script for deployment review
dotnet ef migrations script --idempotent \
  --project api/Api.csproj \
  --startup-project api/Api.csproj \
  --output extracted_clinical_data_idempotent.sql
```

## Implementation Validation Strategy
- [ ] `dotnet ef migrations add ExtractedClinicalData` succeeds; generated `Up()` includes `CreateTable` with `embedding` typed as `vector(384)` and `IsNullable: true`
- [ ] `chk_extracted_clinical_data_field_type` CHECK exists in `pg_constraint` after `database update`; INSERT with `field_type = 'InvalidType'` raises CHECK violation
- [ ] `\d extracted_clinical_data` in psql shows `embedding` column type as `vector(384)` and `ix_extracted_clinical_data_embedding_hnsw` listed as an `hnsw` index with `WHERE (embedding IS NOT NULL)`
- [ ] `EXPLAIN ANALYZE SELECT ... WHERE patient_id = $1 AND field_type = $2` shows `Index Scan using ix_extracted_clinical_data_patient_id_field_type` (AC-7)
- [ ] HNSW index parameters confirmed: `reloptions = {m=16,ef_construction=64}` via `pg_class`
- [ ] `Down()` migration reverts cleanly — HNSW index, composite index, CHECK constraint, and both FKs all dropped before `DropTable`
- [ ] On a resource-constrained environment (low memory): `DO $$ BEGIN CREATE INDEX ... EXCEPTION WHEN OTHERS THEN RAISE WARNING END $$` completes without error; PostgreSQL log shows `WARNING: HNSW index creation failed`; table remains queryable

## Implementation Checklist
- [ ] Run `dotnet ef migrations add ExtractedClinicalData` to generate scaffold migration
- [ ] Verify EF Core generated `embedding` column with `vector(384)` type and `isNullable: true` in scaffold
- [ ] Add `migrationBuilder.Sql()` for `chk_extracted_clinical_data_field_type` CHECK after `CreateTable`; add `DROP CONSTRAINT IF EXISTS` in `Down()` before `DropTable`
- [ ] Confirm both FK constraints use named constraint names (`fk_extracted_clinical_data_document_id`, `fk_extracted_clinical_data_patient_id`) with `onDelete: ReferentialAction.Restrict`
- [ ] Add `CreateIndex("ix_extracted_clinical_data_patient_id_field_type", ["patient_id", "field_type"])` in `Up()`; add `DropIndex` in `Down()`
- [ ] Add `migrationBuilder.Sql()` for HNSW index creation inside `DO $$ BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING ... END $$` block with `m=16, ef_construction=64, WHERE embedding IS NOT NULL`; add `DROP INDEX IF EXISTS` in `Down()`
- [ ] Apply migration and run all `EXPLAIN ANALYZE` queries — confirm Index Scan on composite index (AC-7) and HNSW index (AC-2/AC-6)
- [ ] Run `dotnet ef migrations script --idempotent` and confirm `extracted_clinical_data` DDL is present
