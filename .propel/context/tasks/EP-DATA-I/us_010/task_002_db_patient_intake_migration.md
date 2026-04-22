---
title: "Task — patient_intakes Migration, CHECK Constraint, Composite DESC Index & FK RESTRICT"
task_id: task_002
story_id: us_010
epic: EP-DATA-I
layer: Database
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_010] — `patient_intakes` Entity with Encrypted JSONB PHI Fields
- Story Location: `.propel/context/tasks/EP-DATA-I/us_010/us_010.md`
- Acceptance Criteria:
  - AC-1: `patient_intakes` table — `intake_id` (UUID PK `gen_random_uuid()`), `patient_id` (UUID FK → `users.user_id` NOT NULL), `intake_method` (TEXT CHECK IN 'AI','Manual' NOT NULL), `demographics` / `medical_history` / `medications` / `allergies` / `chief_complaint` (TEXT NOT NULL — encrypted ciphertext), `submitted_at` / `updated_at` (TIMESTAMPTZ NOT NULL)
  - AC-4 (DB side): CHECK constraint `chk_patient_intakes_method` enforces `intake_method IN ('AI','Manual')`; invalid value raises FK/CHECK violation → `DbUpdateException`
  - AC-5: Composite index `ix_patient_intakes_patient_submitted` on `(patient_id, submitted_at DESC)` — `EXPLAIN ANALYZE` on latest-intake query shows Index Scan
  - Edge Case 3: `patient_id` FK `ON DELETE RESTRICT` — INSERT with non-existent patient raises FK violation

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
| Database | PostgreSQL | 16 (pgvector/pgvector:pg16) |
| ORM/Migration | EF Core + `dotnet-ef` | 9.x |
| DB Driver | Npgsql | 9.x |
| Language | C# (migration file) | 13 |
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
Generate the EF Core migration `PatientIntakes` from the entity configuration created in task_001. Review and harden the generated `Up()` to add: CHECK constraint `chk_patient_intakes_method` (`intake_method IN ('AI','Manual')`), and confirm the composite index `ix_patient_intakes_patient_submitted` on `(patient_id, submitted_at DESC)` with descending order on `submitted_at`. Confirm the FK `ON DELETE RESTRICT`. Write the complete `Down()` rollback. Apply, verify with `psql`, and run `EXPLAIN ANALYZE` on the latest-intake query to confirm Index Scan.

## Dependent Tasks
- `task_001_be_patient_intake_entity_converters.md` (same story) — `PatientIntake` entity and `OnModelCreating` configuration must be complete before migration is generated.
- `us_007 task_002_db_users_migration_schema.md` — `users` table must be applied; `patient_intakes.patient_id` FKs to `users.user_id`.

## Impacted Components
- `/api/Data/Migrations/<timestamp>_PatientIntakes.cs` — CREATE: EF Core migration with all constraints, composite DESC index, and complete `Down()`
- `/api/Data/Migrations/<timestamp>_PatientIntakes.Designer.cs` — CREATE: auto-generated companion
- `/api/Data/Migrations/ApplicationDbContextModelSnapshot.cs` — MODIFY: updated to include `patient_intakes` table

## Implementation Plan

1. **Generate the migration**:
   ```bash
   DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
   PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
   JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
   dotnet ef migrations add PatientIntakes --project api/Api.csproj
   ```
   Open the generated file and review before applying.

2. **Verify `patient_intakes` DDL** in `Up()` — EF Core should generate:
   ```sql
   CREATE TABLE patient_intakes (
       intake_id       UUID         NOT NULL DEFAULT gen_random_uuid(),
       patient_id      UUID         NOT NULL,
       intake_method   TEXT         NOT NULL,
       demographics    TEXT         NOT NULL,
       medical_history TEXT         NOT NULL,
       medications     TEXT         NOT NULL,
       allergies       TEXT         NOT NULL,
       chief_complaint TEXT         NOT NULL,
       submitted_at    TIMESTAMPTZ  NOT NULL,
       updated_at      TIMESTAMPTZ  NOT NULL,
       CONSTRAINT pk_patient_intakes PRIMARY KEY (intake_id)
   );
   ```
   Key checks:
   - All 5 PHI columns are `TEXT NOT NULL` — NOT `jsonb`. The value converters in task_001 use `HasColumnType("text")` to enforce this.
   - `submitted_at` and `updated_at` are `TIMESTAMPTZ` (not `timestamp` without timezone). If EF Core generates `timestamp`, add `.HasColumnType("timestamptz")` in `OnModelCreating` (task_001) and regenerate.
   - No default values on PHI columns — they are never `NULL` and never have a DB-level default.

3. **Add CHECK constraint on `intake_method`** (AC-4):
   ```csharp
   migrationBuilder.Sql(
       "ALTER TABLE patient_intakes ADD CONSTRAINT chk_patient_intakes_method " +
       "CHECK (intake_method IN ('AI', 'Manual'));");
   ```

4. **Verify composite index with DESC ordering** (AC-5):
   EF Core generates the index from `HasIndex(i => new { i.PatientId, i.SubmittedAt })` but does NOT generate a `DESC` ordering on `submitted_at` via the fluent API (EF Core 9 supports `IsDescending()` on individual index columns). Check if EF Core generated the index in the migration:
   - If present: verify the SQL contains `DESC` on `submitted_at`. If EF Core generated `ASC` (default), patch manually.
   - If absent: add via raw SQL.

   The correct index definition:
   ```csharp
   // Option A: EF Core 9 fluent API (preferred — keeps snapshot in sync)
   entity.HasIndex(i => new { i.PatientId, i.SubmittedAt })
         .IsDescending(false, true)   // patient_id ASC, submitted_at DESC
         .HasDatabaseName("ix_patient_intakes_patient_submitted");

   // Option B: raw SQL in migration if fluent API did not generate DESC correctly
   migrationBuilder.Sql(
       "CREATE INDEX ix_patient_intakes_patient_submitted " +
       "ON patient_intakes (patient_id ASC, submitted_at DESC);");
   ```
   Update `OnModelCreating` in task_001 to use `IsDescending(false, true)` if not already present, then regenerate the migration.

   The `DESC` ordering on `submitted_at` is critical for AC-5: without it, PostgreSQL must reverse-scan the index for `ORDER BY submitted_at DESC LIMIT 1`, which is inefficient. With `DESC` defined, the planner uses a forward index scan.

5. **Verify FK constraint** — EF Core generates from `DeleteBehavior.Restrict`:
   Confirm the migration contains:
   ```sql
   ALTER TABLE patient_intakes
       ADD CONSTRAINT fk_patient_intakes_patient_id
       FOREIGN KEY (patient_id) REFERENCES users (user_id)
       ON DELETE RESTRICT;
   ```
   The FK constraint name `patient_intakes_patient_id_fkey` (PostgreSQL auto-name) or the EF Core generated name must match the string checked in `PatientIntakeRepository.CreateAsync` catch filter (task_001 step 6). Use the actual generated constraint name.

6. **Write the complete `Down()` rollback**:
   ```csharp
   protected override void Down(MigrationBuilder migrationBuilder)
   {
       migrationBuilder.Sql(
           "ALTER TABLE patient_intakes DROP CONSTRAINT IF EXISTS chk_patient_intakes_method;");

       // Drop composite index (raw SQL if it was added via raw SQL in Up())
       migrationBuilder.Sql(
           "DROP INDEX IF EXISTS ix_patient_intakes_patient_submitted;");

       migrationBuilder.DropTable(name: "patient_intakes");
   }
   ```
   If the index was generated by EF Core (not raw SQL), EF Core's `Down()` will include a `DropIndex` call — remove the raw `DROP INDEX` to avoid double-drop errors.

7. **Apply and verify**:
   ```bash
   dotnet ef database update --project api/Api.csproj
   ```
   Verify via `psql`:
   ```sql
   \d patient_intakes

   SELECT constraint_name, constraint_type
   FROM information_schema.table_constraints
   WHERE table_name = 'patient_intakes'
   ORDER BY constraint_type;

   -- Confirm composite index with DESC
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'patient_intakes';
   -- Expected: ix_patient_intakes_patient_submitted with (patient_id, submitted_at DESC)
   ```

8. **Verify CHECK constraint** (AC-4):
   ```sql
   -- Must fail:
   INSERT INTO patient_intakes
     (patient_id, intake_method, demographics, medical_history, medications, allergies, chief_complaint, submitted_at, updated_at)
   VALUES
     ('<valid_user_uuid>', 'Voice', 'enc', 'enc', 'enc', 'enc', 'enc', NOW(), NOW());
   -- Expected: ERROR: new row for relation "patient_intakes" violates check constraint "chk_patient_intakes_method"

   -- Must succeed:
   INSERT INTO patient_intakes
     (patient_id, intake_method, demographics, medical_history, medications, allergies, chief_complaint, submitted_at, updated_at)
   VALUES
     ('<valid_user_uuid>', 'Manual', 'enc_demo', 'enc_hist', 'enc_meds', 'enc_allg', 'enc_cc', NOW(), NOW());
   ```

9. **Verify EXPLAIN ANALYZE for latest-intake query** (AC-5):
   ```sql
   -- Insert at least 2 rows for the same patient_id with different submitted_at values first.
   EXPLAIN ANALYZE
   SELECT *
   FROM patient_intakes
   WHERE patient_id = '<patient_uuid>'
   ORDER BY submitted_at DESC
   LIMIT 1;
   ```
   Expected plan: `Index Scan Backward using ix_patient_intakes_patient_submitted` (or forward scan if index is defined DESC). The planner should NOT use a Seq Scan for a patient with multiple records. With few rows, use `SET enable_seqscan = off` to force plan verification during development:
   ```sql
   SET enable_seqscan = off;
   EXPLAIN ANALYZE SELECT * FROM patient_intakes WHERE patient_id = '...' ORDER BY submitted_at DESC LIMIT 1;
   SET enable_seqscan = on;
   ```

## Current Project State
```
/api/Data/Migrations/
├── <InitialCreate>/                    # us_004
├── <UsersEntity>/                      # us_007
├── <AppointmentSlotAndAppointment>/    # us_008
└── <WaitlistAndNotifications>/         # us_009: must be applied before this migration
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Data/Migrations/<ts>_PatientIntakes.cs` | `CreateTable` for `patient_intakes`: 10 columns (5 PHI as TEXT NOT NULL, 2 TIMESTAMPTZ); `ALTER TABLE` CHECK constraint on `intake_method`; composite index `(patient_id ASC, submitted_at DESC)`; FK `ON DELETE RESTRICT`; complete `Down()` |
| CREATE | `/api/Data/Migrations/<ts>_PatientIntakes.Designer.cs` | Auto-generated companion |
| MODIFY | `/api/Data/Migrations/ApplicationDbContextModelSnapshot.cs` | Updated to include `patient_intakes` |

## External References
- EF Core `IsDescending()` on index columns (.NET 8+): https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-8.0/whatsnew#multi-column-descending-indexes
- PostgreSQL index ordering (`ASC`/`DESC`): https://www.postgresql.org/docs/current/indexes-ordering.html
- `EXPLAIN ANALYZE` for query plan verification: https://www.postgresql.org/docs/current/sql-explain.html
- DR-005: `.propel/context/docs/design.md#DR-005`

## Build Commands
```bash
# Generate migration
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet ef migrations add PatientIntakes --project api/Api.csproj

# After reviewing and hardening the migration file:
dotnet ef database update --project api/Api.csproj

# Verify schema
psql "postgresql://devuser:devpassword@localhost:5433/patientaccess" \
  -c "\d patient_intakes" \
  -c "SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name='patient_intakes';" \
  -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='patient_intakes';"

# Rollback
dotnet ef database update WaitlistAndNotifications --project api/Api.csproj
```

## Implementation Validation Strategy
- [ ] `dotnet ef database update` completes exit 0; no SQL errors
- [ ] `\d patient_intakes` shows 10 columns: `intake_id` UUID, `patient_id` UUID, `intake_method` TEXT, 5 PHI TEXT NOT NULL columns, `submitted_at` TIMESTAMPTZ, `updated_at` TIMESTAMPTZ
- [ ] `SELECT indexdef FROM pg_indexes WHERE indexname='ix_patient_intakes_patient_submitted'` shows `(patient_id, submitted_at DESC)` ordering
- [ ] `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='patient_intakes'` returns: `pk_patient_intakes`, `chk_patient_intakes_method`, FK constraint on `patient_id`
- [ ] INSERT with `intake_method='Voice'` fails with `chk_patient_intakes_method` CHECK violation
- [ ] INSERT with `intake_method='AI'` succeeds (all other required fields provided)
- [ ] `EXPLAIN ANALYZE` with `enable_seqscan=off` shows Index Scan on `ix_patient_intakes_patient_submitted` for `ORDER BY submitted_at DESC LIMIT 1` query
- [ ] `Down()` migration: `dotnet ef database update WaitlistAndNotifications` drops `patient_intakes` cleanly

## Implementation Checklist
- [ ] Run `dotnet ef migrations add PatientIntakes --project api/Api.csproj`
- [ ] Verify `patient_intakes` DDL: 10 columns; PHI columns are `text NOT NULL` (not `jsonb`); `submitted_at`/`updated_at` are `timestamptz`
- [ ] Add `chk_patient_intakes_method CHECK (intake_method IN ('AI', 'Manual'))` to `Up()`
- [ ] Verify composite index `(patient_id ASC, submitted_at DESC)` is present; patch via raw SQL or update `OnModelCreating` with `IsDescending(false, true)` and regenerate if `DESC` ordering is missing
- [ ] Confirm FK `ON DELETE RESTRICT` on `patient_id`; record actual PostgreSQL constraint name for task_001 catch filter
- [ ] Write complete `Down()`: drop CHECK constraint, drop index (if raw SQL), `DropTable`
- [ ] Apply `dotnet ef database update`; verify schema with `psql` commands above
- [ ] Run `EXPLAIN ANALYZE` on latest-intake query; confirm Index Scan (not Seq Scan) with `enable_seqscan=off`
