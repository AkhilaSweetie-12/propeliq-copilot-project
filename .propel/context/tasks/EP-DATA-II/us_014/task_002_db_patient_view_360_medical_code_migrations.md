---
title: "Task — patient_view_360 & medical_code_suggestions Migrations: UNIQUE, CHECK, DECIMAL, JSONB Defaults"
task_id: task_002
story_id: us_014
epic: EP-DATA-II
layer: Database
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_014] — `patient_view_360` & `medical_code_suggestions` Entities
- Story Location: `.propel/context/tasks/EP-DATA-II/us_014/us_014.md`
- Acceptance Criteria:
  - AC-1: `patient_view_360` — UUID PK, `patient_id` UNIQUE FK, `aggregated_data` TEXT NOT NULL, `conflict_flags` JSONB default `'[]'::jsonb`, `is_verified` BOOL default FALSE, `verified_by` nullable FK, `verified_at` nullable TIMESTAMPTZ, `last_updated_at` TIMESTAMPTZ NOT NULL
  - AC-2: `medical_code_suggestions` — UUID PK, `patient_id` FK, `code_type` TEXT CHECK IN ('ICD10','CPT'), `confidence_score` DECIMAL(5,4) CHECK BETWEEN 0 AND 1, `status` TEXT CHECK IN ('Pending','Accepted','Modified','Rejected') default 'Pending', `reviewed_by`/`reviewed_at` nullable, `final_code` nullable
  - AC-6: `confidence_score` DECIMAL(5,4) CHECK(confidence_score >= 0 AND confidence_score <= 1); out-of-range INSERT rejected
- Edge Cases:
  - EC-1: UNIQUE constraint on `patient_view_360.patient_id` prevents duplicate rows; upsert at service layer uses `INSERT ... ON CONFLICT (patient_id) DO UPDATE`

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
Generate and verify two EF Core migrations: `PatientView360` and `MedicalCodeSuggestions`. EF Core will scaffold the basic `CreateTable` and `AddForeignKey` calls; all CHECK constraints (`code_type`, `status`, `confidence_score`), the `conflict_flags` JSONB default (`'[]'::jsonb`), and the `is_verified` default must be verified in the generated output and supplemented with `migrationBuilder.Sql()` for constraints that EF Core does not generate automatically. Verify UNIQUE constraint on `patient_view_360.patient_id`, all FK `ON DELETE RESTRICT`, and an index on `(patient_id, status)` on `medical_code_suggestions` for pending-code queries.

## Dependent Tasks
- `us_014 task_001_be_patient_view_360_medical_code_entities.md` — Both entities and `OnModelCreating` config must exist before `dotnet ef migrations add` is run
- `us_007 task_002_db_users_migration_schema.md` — `users` table must exist; all FKs reference `users.user_id`

## Impacted Components
- `/api/Migrations/<timestamp>_PatientView360.cs` — CREATE: migration for `patient_view_360` table
- `/api/Migrations/<timestamp>_MedicalCodeSuggestions.cs` — CREATE: migration for `medical_code_suggestions` table
- `/api/Migrations/ApplicationDbContextModelSnapshot.cs` — MODIFY: auto-updated by EF Core

## Implementation Plan

1. **Generate both migrations** — run separately to keep migrations granular:
   ```bash
   cd api
   dotnet ef migrations add PatientView360 \
     --project Api.csproj --startup-project Api.csproj --output-dir Migrations

   dotnet ef migrations add MedicalCodeSuggestions \
     --project Api.csproj --startup-project Api.csproj --output-dir Migrations
   ```

2. **`PatientView360` migration — manual additions to `Up()`**:

   After `CreateTable`, add:
   ```csharp
   // conflict_flags JSONB default '[]'::jsonb (EF Core HasDefaultValueSql may not emit this correctly)
   migrationBuilder.Sql("""
       ALTER TABLE patient_view_360
       ALTER COLUMN conflict_flags SET DEFAULT '[]'::jsonb;
   """);
   ```
   Note: EF Core generates `defaultValueSql: "'[]'::jsonb"` in `CreateTable` via `HasDefaultValueSql("'[]'::jsonb")` — verify the scaffold output includes this. If the scaffold omits it, add the `ALTER COLUMN ... SET DEFAULT` statement above.

   `Down()` for `PatientView360` — standard `DropTable`; UNIQUE index will be dropped automatically by EF Core `DropTable` (it is created via `HasIndex().IsUnique()` and tracked in the snapshot).

3. **`MedicalCodeSuggestions` migration — manual CHECK constraints**:

   After `CreateTable`, add:
   ```csharp
   // CHECK on code_type
   migrationBuilder.Sql("""
       ALTER TABLE medical_code_suggestions
       ADD CONSTRAINT chk_medical_code_suggestions_code_type
       CHECK (code_type IN ('ICD10', 'CPT'));
   """);

   // CHECK on status
   migrationBuilder.Sql("""
       ALTER TABLE medical_code_suggestions
       ADD CONSTRAINT chk_medical_code_suggestions_status
       CHECK (status IN ('Pending', 'Accepted', 'Modified', 'Rejected'));
   """);

   // AC-6: CHECK on confidence_score DECIMAL(5,4) [0, 1]
   migrationBuilder.Sql("""
       ALTER TABLE medical_code_suggestions
       ADD CONSTRAINT chk_medical_code_suggestions_confidence_score
       CHECK (confidence_score >= 0 AND confidence_score <= 1);
   """);
   ```
   In `Down()`, drop all three before `DropTable`:
   ```csharp
   migrationBuilder.Sql("""
       ALTER TABLE medical_code_suggestions
       DROP CONSTRAINT IF EXISTS chk_medical_code_suggestions_confidence_score;
   """);
   migrationBuilder.Sql("""
       ALTER TABLE medical_code_suggestions
       DROP CONSTRAINT IF EXISTS chk_medical_code_suggestions_status;
   """);
   migrationBuilder.Sql("""
       ALTER TABLE medical_code_suggestions
       DROP CONSTRAINT IF EXISTS chk_medical_code_suggestions_code_type;
   """);
   ```

4. **Add composite index on `(patient_id, status)` for `medical_code_suggestions`** — supports `GetPendingByPatientAsync`:
   ```csharp
   // In MedicalCodeSuggestions Up() after CHECK constraints:
   migrationBuilder.CreateIndex(
       name: "ix_medical_code_suggestions_patient_id_status",
       table: "medical_code_suggestions",
       columns: ["patient_id", "status"]);
   ```
   In `Down()`:
   ```csharp
   migrationBuilder.DropIndex(
       name: "ix_medical_code_suggestions_patient_id_status",
       table: "medical_code_suggestions");
   ```

5. **Verify the `PatientView360` DDL order**:
   ```
   1. CreateTable("patient_view_360", ...)
      - view_id UUID PK DEFAULT gen_random_uuid()
      - patient_id UUID NOT NULL
      - aggregated_data TEXT NOT NULL
      - conflict_flags JSONB DEFAULT '[]'::jsonb
      - is_verified BOOL NOT NULL DEFAULT false
      - verified_by UUID NULL
      - verified_at TIMESTAMPTZ NULL
      - last_updated_at TIMESTAMPTZ NOT NULL
   2. migrationBuilder.Sql() — ALTER COLUMN conflict_flags SET DEFAULT '[]'::jsonb (if scaffold omitted)
   3. CreateIndex("uq_patient_view_360_patient_id", unique: true)   ← EF Core generates this from HasIndex().IsUnique()
   4. AddForeignKey("fk_patient_view_360_patient_id") → users ON DELETE RESTRICT
   5. AddForeignKey("fk_patient_view_360_verified_by") → users ON DELETE RESTRICT
   ```
   `Down()`:
   ```
   1. DropForeignKey("fk_patient_view_360_verified_by")
   2. DropForeignKey("fk_patient_view_360_patient_id")
   3. DropIndex("uq_patient_view_360_patient_id")
   4. DropTable("patient_view_360")
   ```

6. **Verify the `MedicalCodeSuggestions` DDL order**:
   ```
   1. CreateTable("medical_code_suggestions", ...)
      - suggestion_id UUID PK DEFAULT gen_random_uuid()
      - patient_id UUID NOT NULL
      - code_type TEXT NOT NULL
      - suggested_code TEXT NOT NULL
      - code_description TEXT NOT NULL
      - source_evidence TEXT NOT NULL
      - confidence_score DECIMAL(5,4) NOT NULL
      - status TEXT NOT NULL DEFAULT 'Pending'
      - reviewed_by UUID NULL
      - reviewed_at TIMESTAMPTZ NULL
      - final_code TEXT NULL
   2. migrationBuilder.Sql() — ADD CONSTRAINT chk_..._code_type CHECK (...)
   3. migrationBuilder.Sql() — ADD CONSTRAINT chk_..._status CHECK (...)
   4. migrationBuilder.Sql() — ADD CONSTRAINT chk_..._confidence_score CHECK (...)
   5. AddForeignKey("fk_medical_code_suggestions_patient_id") → users ON DELETE RESTRICT
   6. AddForeignKey("fk_medical_code_suggestions_reviewed_by") → users ON DELETE RESTRICT
   7. CreateIndex("ix_medical_code_suggestions_patient_id_status", ["patient_id", "status"])
   ```
   `Down()` (reverse):
   ```
   1. DropIndex("ix_medical_code_suggestions_patient_id_status")
   2. DropForeignKey("fk_medical_code_suggestions_reviewed_by")
   3. DropForeignKey("fk_medical_code_suggestions_patient_id")
   4. migrationBuilder.Sql() — DROP CONSTRAINT IF EXISTS chk_..._confidence_score
   5. migrationBuilder.Sql() — DROP CONSTRAINT IF EXISTS chk_..._status
   6. migrationBuilder.Sql() — DROP CONSTRAINT IF EXISTS chk_..._code_type
   7. DropTable("medical_code_suggestions")
   ```

7. **Apply migrations and verify**:
   ```bash
   DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
   PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
   JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
   UPLOADS_ROOT="/tmp/uploads" \
   dotnet ef database update \
     --project api/Api.csproj --startup-project api/Api.csproj
   ```

8. **Verify via psql**:
   ```sql
   -- AC-1: confirm patient_view_360 UNIQUE constraint
   SELECT constraint_name, constraint_type
   FROM information_schema.table_constraints
   WHERE table_name = 'patient_view_360';
   -- Expected: uq_patient_view_360_patient_id (UNIQUE), fk_* (FOREIGN KEY x2)

   -- EC-1: confirm duplicate patient_id is rejected
   INSERT INTO patient_view_360 (view_id, patient_id, aggregated_data, last_updated_at)
   VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'cipher', now());
   INSERT INTO patient_view_360 (view_id, patient_id, aggregated_data, last_updated_at)
   VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'cipher2', now());
   -- Expected: ERROR: duplicate key value violates unique constraint "uq_patient_view_360_patient_id"

   -- AC-6: confirm confidence_score CHECK
   INSERT INTO medical_code_suggestions
     (suggestion_id, patient_id, code_type, suggested_code, code_description, source_evidence, confidence_score, status)
   VALUES
     (gen_random_uuid(), gen_random_uuid(), 'ICD10', 'Z00.00', 'Routine exam', 'source', 1.5, 'Pending');
   -- Expected: ERROR: violates check constraint "chk_medical_code_suggestions_confidence_score"

   -- CHECK on code_type
   INSERT INTO medical_code_suggestions
     (suggestion_id, patient_id, code_type, suggested_code, code_description, source_evidence, confidence_score, status)
   VALUES
     (gen_random_uuid(), gen_random_uuid(), 'InvalidType', 'Z00.00', 'desc', 'src', 0.95, 'Pending');
   -- Expected: ERROR: violates check constraint "chk_medical_code_suggestions_code_type"

   -- EXPLAIN ANALYZE — pending code suggestions by patient
   EXPLAIN ANALYZE
   SELECT * FROM medical_code_suggestions
   WHERE patient_id = '00000000-0000-0000-0000-000000000001'
     AND status = 'Pending';
   -- Expected: "Index Scan using ix_medical_code_suggestions_patient_id_status"
   ```

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
├── <timestamp>_ExtractedClinicalData.cs             # us_013: exists
├── <timestamp>_PatientView360.cs                    # NOT YET GENERATED — this task
└── <timestamp>_MedicalCodeSuggestions.cs            # NOT YET GENERATED — this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Migrations/<timestamp>_PatientView360.cs` | `CreateTable` with `aggregated_data TEXT`, `conflict_flags JSONB DEFAULT '[]'::jsonb`, `is_verified BOOL DEFAULT false`; UNIQUE index `uq_patient_view_360_patient_id`; dual FK `ON DELETE RESTRICT`; `ALTER COLUMN ... SET DEFAULT '[]'::jsonb` via `migrationBuilder.Sql()` if scaffold omits |
| CREATE | `/api/Migrations/<timestamp>_MedicalCodeSuggestions.cs` | `CreateTable` with `confidence_score decimal(5,4)`; three CHECK constraints via `migrationBuilder.Sql()`; dual FK `ON DELETE RESTRICT`; composite index `ix_medical_code_suggestions_patient_id_status` |
| MODIFY | `/api/Migrations/ApplicationDbContextModelSnapshot.cs` | Auto-updated to include both table configurations |

## External References
- `HasDefaultValueSql("'[]'::jsonb")` in EF Core + Npgsql JSONB: https://www.npgsql.org/efcore/mapping/json.html
- `HasIndex().IsUnique()` for UNIQUE constraint in EF Core: https://learn.microsoft.com/en-us/ef/core/modeling/indexes
- DECIMAL precision/scale in EF Core: https://learn.microsoft.com/en-us/ef/core/modeling/entity-properties#column-data-types
- DR-008, DR-009 — `.propel/context/docs/design.md`

## Build Commands
```bash
# Generate migrations (run separately to keep granular)
cd api
dotnet ef migrations add PatientView360 \
  --project Api.csproj --startup-project Api.csproj --output-dir Migrations

dotnet ef migrations add MedicalCodeSuggestions \
  --project Api.csproj --startup-project Api.csproj --output-dir Migrations

# Apply to local dev database
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
UPLOADS_ROOT="/tmp/uploads" \
dotnet ef database update \
  --project api/Api.csproj --startup-project api/Api.csproj

# Idempotent scripts
dotnet ef migrations script --idempotent \
  --project api/Api.csproj --startup-project api/Api.csproj \
  --output patient_view_360_medical_code_idempotent.sql
```

## Implementation Validation Strategy
- [ ] `patient_view_360.patient_id` UNIQUE constraint present; second INSERT with same `patient_id` raises unique violation (EC-1)
- [ ] `patient_view_360.conflict_flags` defaults to `'[]'::jsonb` on INSERT without explicit value
- [ ] `patient_view_360.is_verified` defaults to `false`; `verified_by` and `verified_at` accept NULL
- [ ] `chk_medical_code_suggestions_confidence_score` present; INSERT with `confidence_score = 1.5` raises CHECK violation (AC-6)
- [ ] `chk_medical_code_suggestions_code_type` present; INSERT with `code_type = 'SNOMED'` raises CHECK violation
- [ ] `chk_medical_code_suggestions_status` present; INSERT with `status = 'Cancelled'` raises CHECK violation
- [ ] `EXPLAIN ANALYZE WHERE patient_id = $1 AND status = 'Pending'` shows Index Scan on `ix_medical_code_suggestions_patient_id_status`
- [ ] Both `Down()` migrations revert cleanly — all indexes, FKs, CHECK constraints dropped before `DropTable`

## Implementation Checklist
- [ ] Run `dotnet ef migrations add PatientView360` — verify scaffold includes UNIQUE index on `patient_id` and `conflict_flags` JSONB default
- [ ] Add `migrationBuilder.Sql()` for `conflict_flags SET DEFAULT '[]'::jsonb` in PatientView360 `Up()` if scaffold omitted; corresponding removal in `Down()` is handled by `DropTable`
- [ ] Run `dotnet ef migrations add MedicalCodeSuggestions` — verify scaffold includes `decimal(5,4)` for `confidence_score`
- [ ] Add three `migrationBuilder.Sql()` CHECK constraints (`code_type`, `status`, `confidence_score`) in MedicalCodeSuggestions `Up()` after `CreateTable`
- [ ] Add corresponding `DROP CONSTRAINT IF EXISTS` for all three CHECKs in `Down()` before `DropTable`
- [ ] Add `CreateIndex("ix_medical_code_suggestions_patient_id_status", ["patient_id", "status"])` in MedicalCodeSuggestions `Up()`; `DropIndex` in `Down()`
- [ ] Apply both migrations and run all psql verification queries confirming constraints and index usage
- [ ] Run `dotnet ef migrations script --idempotent` — verify both tables present in output
