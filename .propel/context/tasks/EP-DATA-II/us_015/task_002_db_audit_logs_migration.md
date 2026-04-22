---
title: "Task — audit_logs Migration: Append-Only PostgreSQL RULEs, Composite Index, RULE Bypass Verification"
task_id: task_002
story_id: us_015
epic: EP-DATA-II
layer: Database
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_015] — `audit_logs` Append-Only Entity with Permission Guards
- Story Location: `.propel/context/tasks/EP-DATA-II/us_015/us_015.md`
- Acceptance Criteria:
  - AC-1: `audit_logs` table with `log_id` (UUID PK, default `gen_random_uuid()`), `actor_id` (UUID FK → `users.user_id`, NOT NULL), `actor_role` (TEXT NOT NULL), `action_type` (TEXT NOT NULL), `entity_type` (TEXT NOT NULL), `entity_id` (UUID NOT NULL), `change_summary` (TEXT NOT NULL), `ip_address` (TEXT NOT NULL), `occurred_at` (TIMESTAMPTZ NOT NULL, default `NOW()`)
  - AC-2: `CREATE RULE no_update_audit_logs AS ON UPDATE TO audit_logs DO INSTEAD NOTHING` and `CREATE RULE no_delete_audit_logs AS ON DELETE TO audit_logs DO INSTEAD NOTHING` executed in `Up()`; verified in integration test that UPDATE returns 0 rows affected
  - AC-3: `DELETE FROM audit_logs` silently returns 0 rows deleted (RULE suppresses it); count unchanged
  - AC-6: Composite index on `(entity_type, occurred_at DESC)` supports Admin query `ORDER BY occurred_at DESC WHERE entity_type = 'Appointment'`
- Edge Cases:
  - EC-2: PostgreSQL RULE with `DO INSTEAD NOTHING` applies to ALL roles including superuser; cannot be bypassed by privilege escalation; only DDL `DROP RULE` can remove the guard

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
Generate the `AuditLogs` EF Core migration. After `CreateTable`, add two PostgreSQL RULE definitions via `migrationBuilder.Sql()` to make the table append-only at the database engine level (AC-2). These RULEs use `DO INSTEAD NOTHING` to silently suppress UPDATE and DELETE operations for all roles, including superuser. Add a composite descending index `(entity_type, occurred_at DESC)` for the Admin query. Document the `Down()` counterpart — `DROP RULE IF EXISTS` on both rules before `DropTable`. The rules must be verified in integration tests per AC-2/AC-3.

## Dependent Tasks
- `us_015 task_001_be_audit_log_entity_repository.md` — `AuditLog` entity and `ApplicationDbContext` config must exist before `dotnet ef migrations add` is run
- `us_007 task_002_db_users_migration_schema.md` — `users` table must exist; `actor_id` FK references it

## Impacted Components
- `/api/Migrations/<timestamp>_AuditLogs.cs` — CREATE: migration with `CreateTable`, two RULE definitions, composite index
- `/api/Migrations/ApplicationDbContextModelSnapshot.cs` — MODIFY: auto-updated by EF Core

## Implementation Plan

1. **Generate the migration**:
   ```bash
   cd api
   dotnet ef migrations add AuditLogs \
     --project Api.csproj \
     --startup-project Api.csproj \
     --output-dir Migrations
   ```
   Open the generated file. EF Core will scaffold `CreateTable` with `occurred_at` having `defaultValueSql: "NOW()"` (from `HasDefaultValueSql("NOW()")` in `OnModelCreating`) and the FK `AddForeignKey` call. It will NOT generate the RULE definitions or the composite index — these must be added manually.

2. **Add append-only RULE definitions** (AC-2) — add immediately after `CreateTable` in `Up()`:
   ```csharp
   // Append-only RULE: suppress UPDATE on audit_logs for all roles (including superuser)
   // EC-2: DO INSTEAD NOTHING applies at the query rewrite level — cannot be bypassed by privileges
   migrationBuilder.Sql("""
       CREATE RULE no_update_audit_logs
       AS ON UPDATE TO audit_logs
       DO INSTEAD NOTHING;
   """);

   // Append-only RULE: suppress DELETE on audit_logs for all roles
   migrationBuilder.Sql("""
       CREATE RULE no_delete_audit_logs
       AS ON DELETE TO audit_logs
       DO INSTEAD NOTHING;
   """);
   ```
   In `Down()`, drop both rules BEFORE `DropTable` (rules must be removed before the table can be dropped):
   ```csharp
   migrationBuilder.Sql("DROP RULE IF EXISTS no_update_audit_logs ON audit_logs;");
   migrationBuilder.Sql("DROP RULE IF EXISTS no_delete_audit_logs ON audit_logs;");
   ```
   Design decisions:
   - `DO INSTEAD NOTHING` — PostgreSQL `INSTEAD` rule rewrites the UPDATE/DELETE command to nothing before the executor sees it; it returns no error and affects 0 rows (AC-3 silent suppression).
   - `DO INSTEAD NOTHING` applies universally: the rule fires for the database owner, `postgres` superuser, and all application roles — privilege escalation cannot bypass it (EC-2). Only `DROP RULE` (a DDL operation requiring `RULE` privilege or table ownership) removes the protection.
   - Alternative: triggers (`BEFORE UPDATE/DELETE RAISE EXCEPTION`) would raise an error rather than silent no-op. The story specifies silent suppression (`UPDATE 0`, `DELETE 0`) per AC-2/AC-3, so the RULE approach is correct.

3. **Add composite descending index on `(entity_type, occurred_at DESC)`** (AC-6):
   ```csharp
   // In Up() after RULE definitions:
   migrationBuilder.CreateIndex(
       name: "ix_audit_logs_entity_type_occurred_at",
       table: "audit_logs",
       columns: ["entity_type", "occurred_at"],
       descending: [false, true]);   // entity_type ASC, occurred_at DESC
   ```
   In `Down()` (before `DropTable`):
   ```csharp
   migrationBuilder.DropIndex(
       name: "ix_audit_logs_entity_type_occurred_at",
       table: "audit_logs");
   ```
   This index supports:
   ```sql
   SELECT * FROM audit_logs
   WHERE entity_type = 'Appointment'
   ORDER BY occurred_at DESC
   LIMIT 100;
   ```

4. **Verify full `Up()` DDL order**:
   ```
   1. CreateTable("audit_logs", ...)
      - log_id UUID PK DEFAULT gen_random_uuid()
      - actor_id UUID NOT NULL
      - actor_role TEXT NOT NULL
      - action_type TEXT NOT NULL
      - entity_type TEXT NOT NULL
      - entity_id UUID NOT NULL
      - change_summary TEXT NOT NULL
      - ip_address TEXT NOT NULL
      - occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   2. migrationBuilder.Sql() — CREATE RULE no_update_audit_logs ... DO INSTEAD NOTHING
   3. migrationBuilder.Sql() — CREATE RULE no_delete_audit_logs ... DO INSTEAD NOTHING
   4. AddForeignKey("fk_audit_logs_actor_id") → users.user_id ON DELETE RESTRICT
   5. CreateIndex("ix_audit_logs_entity_type_occurred_at", descending: [false, true])
   ```
   `Down()` in reverse:
   ```
   1. DropIndex("ix_audit_logs_entity_type_occurred_at")
   2. DropForeignKey("fk_audit_logs_actor_id")
   3. migrationBuilder.Sql() — DROP RULE IF EXISTS no_delete_audit_logs ON audit_logs
   4. migrationBuilder.Sql() — DROP RULE IF EXISTS no_update_audit_logs ON audit_logs
   5. DropTable("audit_logs")
   ```

5. **Apply migration and verify via psql**:
   ```bash
   DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
   PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
   JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
   UPLOADS_ROOT="/tmp/uploads" \
   dotnet ef database update \
     --project api/Api.csproj \
     --startup-project api/Api.csproj
   ```

6. **Verify RULE definitions and behaviour via psql** (AC-2, AC-3):
   ```sql
   -- Confirm both rules exist
   SELECT rulename, event, instead
   FROM pg_rules
   WHERE tablename = 'audit_logs';
   -- Expected: no_update_audit_logs (UPDATE, true), no_delete_audit_logs (DELETE, true)

   -- AC-1: insert a test row to confirm basic INSERT works
   INSERT INTO audit_logs
     (actor_id, actor_role, action_type, entity_type, entity_id, change_summary, ip_address)
   VALUES
     (gen_random_uuid(), 'Staff', 'VIEW', 'Appointment', gen_random_uuid(), 'Viewed appointment', '127.0.0.1');
   -- Expected: INSERT 0 1  (occurred_at set by DB DEFAULT NOW())

   -- AC-2: UPDATE returns 0 rows affected — no error raised (RULE suppresses silently)
   UPDATE audit_logs SET actor_role = 'Hacked' WHERE 1=1;
   -- Expected: UPDATE 0

   -- AC-3: DELETE returns 0 rows affected — no error raised
   SELECT COUNT(*) FROM audit_logs;   -- note count before
   DELETE FROM audit_logs;
   -- Expected: DELETE 0
   SELECT COUNT(*) FROM audit_logs;   -- count unchanged

   -- AC-6: EXPLAIN ANALYZE — Admin query for entity_type ordered by occurred_at DESC
   EXPLAIN ANALYZE
   SELECT * FROM audit_logs
   WHERE entity_type = 'Appointment'
   ORDER BY occurred_at DESC
   LIMIT 100;
   -- Expected: "Index Scan using ix_audit_logs_entity_type_occurred_at"

   -- Confirm occurred_at was set by DB DEFAULT (no application-supplied value)
   SELECT occurred_at FROM audit_logs LIMIT 1;
   -- Expected: timestamp value (non-null, close to NOW())
   ```

7. **Generate idempotent deployment script**:
   ```bash
   dotnet ef migrations script --idempotent \
     --project api/Api.csproj \
     --startup-project api/Api.csproj \
     --output audit_logs_idempotent.sql
   ```
   Note: The RULE `CREATE RULE` statements appear verbatim in the idempotent script. If re-run, PostgreSQL will raise `ERROR: rule "no_update_audit_logs" for relation "audit_logs" already exists` unless guarded with `CREATE OR REPLACE RULE`. Consider replacing `CREATE RULE` with `CREATE OR REPLACE RULE` in the migration SQL to make the script rerunnable:
   ```sql
   CREATE OR REPLACE RULE no_update_audit_logs
   AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;

   CREATE OR REPLACE RULE no_delete_audit_logs
   AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
   ```
   `CREATE OR REPLACE RULE` is idempotent and preferred for deployment safety.

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
├── <timestamp>_PatientView360.cs                    # us_014: exists
├── <timestamp>_MedicalCodeSuggestions.cs            # us_014: exists
└── <timestamp>_AuditLogs.cs                         # NOT YET GENERATED — this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Migrations/<timestamp>_AuditLogs.cs` | `CreateTable` with `occurred_at DEFAULT NOW()`; `CREATE OR REPLACE RULE no_update_audit_logs ... DO INSTEAD NOTHING`; `CREATE OR REPLACE RULE no_delete_audit_logs ... DO INSTEAD NOTHING`; FK `fk_audit_logs_actor_id ON DELETE RESTRICT`; composite index `ix_audit_logs_entity_type_occurred_at` descending on `occurred_at`; `Down()` drops rules before `DropTable` |
| MODIFY | `/api/Migrations/ApplicationDbContextModelSnapshot.cs` | Auto-updated to include `audit_logs` configuration |

## External References
- PostgreSQL `CREATE RULE` with `DO INSTEAD NOTHING`: https://www.postgresql.org/docs/current/sql-createrule.html
- `CREATE OR REPLACE RULE` idempotent form: https://www.postgresql.org/docs/current/sql-createrule.html
- PostgreSQL RULEs vs triggers (superuser bypass behaviour): https://www.postgresql.org/docs/current/rules-privileges.html
- `migrationBuilder.Sql()` for raw DDL: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/operations
- HIPAA 45 CFR § 164.312(b) — audit controls: https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html
- DR-010 — `.propel/context/docs/design.md#DR-010`
- OWASP A09 (Security Logging and Monitoring Failures): https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/

## Build Commands
```bash
# Generate migration
cd api
dotnet ef migrations add AuditLogs \
  --project Api.csproj \
  --startup-project Api.csproj \
  --output-dir Migrations

# Apply
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
UPLOADS_ROOT="/tmp/uploads" \
dotnet ef database update \
  --project api/Api.csproj --startup-project api/Api.csproj

# Idempotent script
dotnet ef migrations script --idempotent \
  --project api/Api.csproj --startup-project api/Api.csproj \
  --output audit_logs_idempotent.sql
```

## Implementation Validation Strategy
- [ ] `dotnet ef migrations add AuditLogs` succeeds; scaffold includes `occurred_at` with `defaultValueSql: "NOW()"`
- [ ] `pg_rules` query confirms `no_update_audit_logs` (event=UPDATE, instead=true) and `no_delete_audit_logs` (event=DELETE, instead=true) after migration
- [ ] `UPDATE audit_logs SET actor_role = 'Hacked' WHERE 1=1` → `UPDATE 0`; no rows modified; no exception (AC-2)
- [ ] `DELETE FROM audit_logs` → `DELETE 0`; row count unchanged (AC-3)
- [ ] `INSERT INTO audit_logs (...)` succeeds; `occurred_at` populated by DB `NOW()` without application supplying it (AC-4)
- [ ] `EXPLAIN ANALYZE WHERE entity_type = 'Appointment' ORDER BY occurred_at DESC LIMIT 100` → Index Scan on `ix_audit_logs_entity_type_occurred_at` (AC-6)
- [ ] `Down()` migration reverts cleanly — both rules dropped before `DropTable`; no "table has dependent rules" error
- [ ] Idempotent SQL script uses `CREATE OR REPLACE RULE` (safe for re-execution)

## Implementation Checklist
- [ ] Run `dotnet ef migrations add AuditLogs` — verify scaffold includes `occurred_at` with `defaultValueSql: "NOW()"` and FK `fk_audit_logs_actor_id`
- [ ] Replace `CREATE RULE` with `CREATE OR REPLACE RULE` in both `migrationBuilder.Sql()` calls for idempotent deployment safety
- [ ] Add `CREATE OR REPLACE RULE no_update_audit_logs ... DO INSTEAD NOTHING` in `Up()` after `CreateTable`
- [ ] Add `CREATE OR REPLACE RULE no_delete_audit_logs ... DO INSTEAD NOTHING` in `Up()` after update rule
- [ ] Add composite index `ix_audit_logs_entity_type_occurred_at` with `descending: [false, true]` in `Up()`
- [ ] Add `DROP RULE IF EXISTS no_delete_audit_logs ON audit_logs` and `DROP RULE IF EXISTS no_update_audit_logs ON audit_logs` in `Down()` BEFORE `DropIndex` and `DropTable`
- [ ] Apply migration and run all psql verification queries confirming RULE suppression behaviour (AC-2/AC-3)
- [ ] Confirm index used for `WHERE entity_type = $1 ORDER BY occurred_at DESC LIMIT 100` via `EXPLAIN ANALYZE`
