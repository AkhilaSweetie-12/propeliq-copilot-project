---
title: "Task — waitlist_entries & notifications Migration, Partial UNIQUE, CHECK Constraints & FIFO Index"
task_id: task_002
story_id: us_009
epic: EP-DATA-I
layer: Database
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_009] — `waitlist_entries` & `notifications` Entities
- Story Location: `.propel/context/tasks/EP-DATA-I/us_009/us_009.md`
- Acceptance Criteria:
  - AC-1: `waitlist_entries` table — `entry_id` (UUID PK), `patient_id` (FK → `users.user_id` RESTRICT), `slot_id` (FK → `appointment_slots.slot_id` RESTRICT), `position` (INTEGER NOT NULL CHECK > 0), `requested_at` (TIMESTAMPTZ NOT NULL), `status` (TEXT CHECK IN 'Waiting','Fulfilled','Cancelled' NOT NULL default 'Waiting'); partial UNIQUE `(patient_id, slot_id) WHERE status = 'Waiting'`
  - AC-2: `notifications` table — `notification_id` (UUID PK), `appointment_id` (FK → `appointments.appointment_id` RESTRICT), `channel` (TEXT CHECK IN 'SMS','Email' NOT NULL), `status` (TEXT CHECK IN 'Pending','Sent','Failed' NOT NULL default 'Pending'), `attempt_count` (INTEGER NOT NULL default 0 CHECK >= 0), `scheduled_at` (TIMESTAMPTZ NOT NULL), `sent_at` (TIMESTAMPTZ nullable), `error_message` (TEXT nullable)
  - AC-3: Composite index `ix_waitlist_entries_slot_status_requested_at` on `(slot_id, status, requested_at)` enables Index Scan (not Seq Scan) on the FIFO queue query
  - Edge Case 1: Partial UNIQUE constraint `uq_waitlist_active_patient_slot` on `(patient_id, slot_id) WHERE status = 'Waiting'` prevents duplicate active waitlist entries

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
Generate the EF Core migration `WaitlistAndNotifications` from the entity configuration created in task_001. Review and harden the generated `Up()` to add: CHECK constraint `chk_waitlist_position` (`position > 0`), CHECK constraints on `status` for both tables, CHECK constraint on `attempt_count` (`>= 0`), the composite FIFO index `ix_waitlist_entries_slot_status_requested_at`, the partial UNIQUE index `uq_waitlist_active_patient_slot` (which EF Core cannot express in fluent API — must be added via raw SQL), and the retry index on `notifications (status, attempt_count)`. Confirm all FK constraints use `ON DELETE RESTRICT`. Write the complete `Down()` rollback. Apply, verify with `psql`, and run `EXPLAIN ANALYZE` on the FIFO query.

## Dependent Tasks
- `task_001_be_waitlist_notification_entities.md` (same story) — entity classes and `OnModelCreating` must be complete before migration is generated.
- `us_008 task_002_db_appointment_migrations.md` — `appointment_slots` and `appointments` tables must be applied; FKs target both.
- `us_007 task_002_db_users_migration_schema.md` — `users` table must be applied.

## Impacted Components
- `/api/Data/Migrations/<timestamp>_WaitlistAndNotifications.cs` — CREATE: EF Core migration with all constraints and indexes
- `/api/Data/Migrations/<timestamp>_WaitlistAndNotifications.Designer.cs` — CREATE: auto-generated companion
- `/api/Data/Migrations/ApplicationDbContextModelSnapshot.cs` — MODIFY: updated to include both new tables

## Implementation Plan

1. **Generate the migration**:
   ```bash
   DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
   PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
   JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
   dotnet ef migrations add WaitlistAndNotifications --project api/Api.csproj
   ```
   Open the generated migration file and review before applying.

2. **Verify `waitlist_entries` DDL** in `Up()` — EF Core should generate:
   ```sql
   CREATE TABLE waitlist_entries (
       entry_id     UUID         NOT NULL DEFAULT gen_random_uuid(),
       patient_id   UUID         NOT NULL,
       slot_id      UUID         NOT NULL,
       position     INTEGER      NOT NULL,
       requested_at TIMESTAMPTZ  NOT NULL,
       status       TEXT         NOT NULL DEFAULT 'Waiting',
       CONSTRAINT pk_waitlist_entries PRIMARY KEY (entry_id)
   );
   ```
   Confirm `status` column has the `DEFAULT 'Waiting'` value. If EF Core does not generate the default from `HasDefaultValue(WaitlistStatus.Waiting)` using the enum string, add it manually:
   ```csharp
   migrationBuilder.Sql("ALTER TABLE waitlist_entries ALTER COLUMN status SET DEFAULT 'Waiting';");
   ```

3. **Add CHECK constraints on `waitlist_entries`** (AC-1):
   ```csharp
   migrationBuilder.Sql(
       "ALTER TABLE waitlist_entries ADD CONSTRAINT chk_waitlist_position " +
       "CHECK (position > 0);");

   migrationBuilder.Sql(
       "ALTER TABLE waitlist_entries ADD CONSTRAINT chk_waitlist_status " +
       "CHECK (status IN ('Waiting', 'Fulfilled', 'Cancelled'));");
   ```

4. **Add partial UNIQUE index `uq_waitlist_active_patient_slot`** (EC-1 — EF Core fluent API cannot express `WHERE` clause on indexes; raw SQL required):
   ```csharp
   // Partial UNIQUE index: prevents a patient from having more than one ACTIVE waitlist
   // entry per slot. Fulfilled and Cancelled entries are excluded from the constraint,
   // allowing a patient to re-join the waitlist after their original entry is resolved.
   migrationBuilder.Sql(
       "CREATE UNIQUE INDEX uq_waitlist_active_patient_slot " +
       "ON waitlist_entries (patient_id, slot_id) " +
       "WHERE status = 'Waiting';");
   ```
   This partial UNIQUE index is the enforcement mechanism for EC-1. The constraint name `uq_waitlist_active_patient_slot` must match the string checked in `WaitlistRepository.AddAsync` catch filter (task_001 step 7).

5. **Add composite FIFO index** on `waitlist_entries` (AC-3):
   ```csharp
   // Composite index for FIFO query: WHERE slot_id = ? AND status = 'Waiting' ORDER BY requested_at
   // Column order: slot_id (equality filter) → status (equality filter) → requested_at (ORDER BY)
   // PostgreSQL will use an Index Scan (not Seq Scan) for this query pattern (AC-3).
   migrationBuilder.Sql(
       "CREATE INDEX ix_waitlist_entries_slot_status_requested_at " +
       "ON waitlist_entries (slot_id, status, requested_at);");
   ```
   Note: EF Core `HasIndex` in task_001 generates this index from fluent API. Verify the generated migration already contains it; if the name differs, rename via raw SQL or update `HasDatabaseName` in task_001.

6. **Verify `notifications` DDL** in `Up()`:
   ```sql
   CREATE TABLE notifications (
       notification_id UUID         NOT NULL DEFAULT gen_random_uuid(),
       appointment_id  UUID         NOT NULL,
       channel         TEXT         NOT NULL,
       status          TEXT         NOT NULL DEFAULT 'Pending',
       attempt_count   INTEGER      NOT NULL DEFAULT 0,
       scheduled_at    TIMESTAMPTZ  NOT NULL,
       sent_at         TIMESTAMPTZ,           -- nullable (AC-6)
       error_message   TEXT,                  -- nullable (AC-4)
       CONSTRAINT pk_notifications PRIMARY KEY (notification_id)
   );
   ```
   Confirm `sent_at` and `error_message` are nullable (no `NOT NULL`). Confirm `attempt_count DEFAULT 0`.

7. **Add CHECK constraints on `notifications`** (AC-2):
   ```csharp
   migrationBuilder.Sql(
       "ALTER TABLE notifications ADD CONSTRAINT chk_notifications_channel " +
       "CHECK (channel IN ('SMS', 'Email'));");

   migrationBuilder.Sql(
       "ALTER TABLE notifications ADD CONSTRAINT chk_notifications_status " +
       "CHECK (status IN ('Pending', 'Sent', 'Failed'));");

   migrationBuilder.Sql(
       "ALTER TABLE notifications ADD CONSTRAINT chk_notifications_attempt_count " +
       "CHECK (attempt_count >= 0);");
   ```

8. **Verify FK constraints** — all must be `ON DELETE RESTRICT`:
   EF Core generates FK `ALTER TABLE` statements from `DeleteBehavior.Restrict`. Confirm 3 FK constraints:
   - `fk_waitlist_entries_patient_id` → `users(user_id) ON DELETE RESTRICT`
   - `fk_waitlist_entries_slot_id` → `appointment_slots(slot_id) ON DELETE RESTRICT`
   - `fk_notifications_appointment_id` → `appointments(appointment_id) ON DELETE RESTRICT`
   Patch any missing `RESTRICT` clauses manually in the migration if EF Core defaulted to `NO ACTION`.

9. **Write the complete `Down()` rollback**:
   ```csharp
   protected override void Down(MigrationBuilder migrationBuilder)
   {
       // Drop partial UNIQUE and composite indexes (not dropped by DropTable automatically for raw SQL indexes)
       migrationBuilder.Sql("DROP INDEX IF EXISTS uq_waitlist_active_patient_slot;");
       migrationBuilder.Sql("DROP INDEX IF EXISTS ix_waitlist_entries_slot_status_requested_at;");
       migrationBuilder.Sql("DROP INDEX IF EXISTS ix_notifications_status_attempt_count;");

       // Drop CHECK constraints
       migrationBuilder.Sql("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_channel;");
       migrationBuilder.Sql("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_status;");
       migrationBuilder.Sql("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_attempt_count;");
       migrationBuilder.Sql("ALTER TABLE waitlist_entries DROP CONSTRAINT IF EXISTS chk_waitlist_position;");
       migrationBuilder.Sql("ALTER TABLE waitlist_entries DROP CONSTRAINT IF EXISTS chk_waitlist_status;");

       migrationBuilder.DropTable(name: "notifications");
       migrationBuilder.DropTable(name: "waitlist_entries");
   }
   ```

10. **Apply and verify schema**:
    ```bash
    dotnet ef database update --project api/Api.csproj
    ```
    Then verify via `psql`:
    ```sql
    \d waitlist_entries
    \d notifications

    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name IN ('waitlist_entries', 'notifications')
    ORDER BY table_name, constraint_type;

    -- Confirm partial UNIQUE index (AC-1, EC-1)
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'waitlist_entries';
    -- Expected: uq_waitlist_active_patient_slot with WHERE status = 'Waiting' predicate
    ```

11. **Verify FIFO index scan** (AC-3) — confirm Index Scan with `EXPLAIN ANALYZE`:
    ```sql
    -- Insert test data first (minimal rows to demonstrate plan):
    EXPLAIN ANALYZE
    SELECT *
    FROM waitlist_entries
    WHERE slot_id = 'a0000000-0000-0000-0000-000000000001'
      AND status = 'Waiting'
    ORDER BY requested_at
    LIMIT 1;
    ```
    Expected query plan output: `Index Scan using ix_waitlist_entries_slot_status_requested_at` — NOT `Seq Scan`. With fewer than ~100 rows PostgreSQL may still choose a Seq Scan; set `enable_seqscan = off` in the session to force plan verification during dev:
    ```sql
    SET enable_seqscan = off;
    EXPLAIN ANALYZE SELECT * FROM waitlist_entries WHERE slot_id = '...' AND status = 'Waiting' ORDER BY requested_at LIMIT 1;
    SET enable_seqscan = on;
    ```

12. **Verify partial UNIQUE constraint** (EC-1):
    ```sql
    -- Insert two rows for the same (patient_id, slot_id) with status = 'Waiting' — second must fail
    INSERT INTO waitlist_entries (patient_id, slot_id, position, requested_at, status)
    VALUES ('<patient_uuid>', '<slot_uuid>', 1, NOW(), 'Waiting');

    INSERT INTO waitlist_entries (patient_id, slot_id, position, requested_at, status)
    VALUES ('<patient_uuid>', '<slot_uuid>', 2, NOW(), 'Waiting');
    -- Expected: ERROR: duplicate key value violates unique constraint "uq_waitlist_active_patient_slot"

    -- But a third row with status = 'Fulfilled' must succeed (partial index excludes non-Waiting rows):
    INSERT INTO waitlist_entries (patient_id, slot_id, position, requested_at, status)
    VALUES ('<patient_uuid>', '<slot_uuid>', 3, NOW(), 'Fulfilled');
    -- Expected: INSERT 0 1 (success)
    ```

## Current Project State
```
/api/Data/Migrations/
├── <InitialCreate>/                    # us_004: base schema
├── <UsersEntity>/                      # us_007: users table
└── <AppointmentSlotAndAppointment>/    # us_008: appointment_slots + appointments
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Data/Migrations/<ts>_WaitlistAndNotifications.cs` | `CreateTable` for `waitlist_entries` and `notifications`; `ALTER TABLE` CHECK constraints (5 total); partial UNIQUE index `uq_waitlist_active_patient_slot`; composite FIFO index; retry index; all FK constraints `ON DELETE RESTRICT`; complete `Down()` |
| CREATE | `/api/Data/Migrations/<ts>_WaitlistAndNotifications.Designer.cs` | Auto-generated EF Core companion |
| MODIFY | `/api/Data/Migrations/ApplicationDbContextModelSnapshot.cs` | Updated to include both new tables |

## External References
- PostgreSQL partial indexes: https://www.postgresql.org/docs/current/indexes-partial.html
- EF Core partial indexes (not natively supported — raw SQL workaround): https://github.com/dotnet/efcore/issues/1814
- `EXPLAIN ANALYZE` for query plan verification: https://www.postgresql.org/docs/current/sql-explain.html
- PostgreSQL `CHECK` constraint with `IN`: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS
- DR-004 / DR-011: `.propel/context/docs/design.md`
- NFR-012 (at-least-one-retry): `.propel/context/docs/design.md#NFR-012`

## Build Commands
```bash
# Generate migration
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet ef migrations add WaitlistAndNotifications --project api/Api.csproj

# Review and harden migration file (steps 3–8 above), then apply:
dotnet ef database update --project api/Api.csproj

# Verify schema
psql "postgresql://devuser:devpassword@localhost:5433/patientaccess" \
  -c "\d waitlist_entries" \
  -c "\d notifications" \
  -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'waitlist_entries';" \
  -c "SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name IN ('waitlist_entries','notifications') ORDER BY table_name, constraint_name;"

# Rollback
dotnet ef database update AppointmentSlotAndAppointment --project api/Api.csproj
```

## Implementation Validation Strategy
- [ ] `dotnet ef database update` completes exit 0; no SQL errors
- [ ] `\d waitlist_entries` shows 6 columns: UUID, UUID, UUID, INTEGER, TIMESTAMPTZ, TEXT; `status` has default `'Waiting'`
- [ ] `\d notifications` shows 8 columns: 4 NOT NULL non-nullable + `sent_at` and `error_message` nullable
- [ ] `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='waitlist_entries'` shows `uq_waitlist_active_patient_slot` with `WHERE ((status)::text = 'Waiting'::text)` predicate
- [ ] `SELECT indexname FROM pg_indexes WHERE tablename='waitlist_entries'` shows `ix_waitlist_entries_slot_status_requested_at`
- [ ] Duplicate `(patient_id, slot_id)` with `status='Waiting'` INSERT fails with unique constraint error naming `uq_waitlist_active_patient_slot`
- [ ] Same `(patient_id, slot_id)` with `status='Fulfilled'` INSERT succeeds (partial index only covers `'Waiting'`)
- [ ] `position = 0` INSERT fails with CHECK constraint error `chk_waitlist_position`
- [ ] `attempt_count = -1` INSERT on notifications fails with `chk_notifications_attempt_count`
- [ ] `channel = 'Push'` INSERT fails with `chk_notifications_channel`
- [ ] `EXPLAIN ANALYZE` on FIFO query with `enable_seqscan=off` shows `Index Scan using ix_waitlist_entries_slot_status_requested_at`

## Implementation Checklist
- [ ] Run `dotnet ef migrations add WaitlistAndNotifications --project api/Api.csproj`
- [ ] Verify `waitlist_entries` DDL: 6 columns, correct types, `status DEFAULT 'Waiting'`; add if missing
- [ ] Add `chk_waitlist_position CHECK (position > 0)` and `chk_waitlist_status CHECK (status IN (...))` to `Up()`
- [ ] Add partial UNIQUE index `uq_waitlist_active_patient_slot ON waitlist_entries (patient_id, slot_id) WHERE status = 'Waiting'` via `migrationBuilder.Sql()`
- [ ] Verify composite FIFO index `ix_waitlist_entries_slot_status_requested_at` on `(slot_id, status, requested_at)` is in migration; add via raw SQL if EF Core omitted it
- [ ] Verify `notifications` DDL: 8 columns; `sent_at` and `error_message` nullable; `attempt_count DEFAULT 0`
- [ ] Add `chk_notifications_channel`, `chk_notifications_status`, `chk_notifications_attempt_count` CHECK constraints
- [ ] Add retry index `ix_notifications_status_attempt_count ON notifications (status, attempt_count)`
- [ ] Confirm all 3 FK constraints are `ON DELETE RESTRICT`; patch if any differ
- [ ] Write complete `Down()`: drop raw-SQL indexes with `IF EXISTS`, drop CHECK constraints, `DropTable` in FK-safe order
- [ ] Apply migration; verify schema with `psql` checks; run partial UNIQUE and EXPLAIN ANALYZE validations
