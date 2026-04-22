---
title: "Task — appointment_slots & appointments Migration, FKs, CHECK Constraints & Composite UNIQUE"
task_id: task_002
story_id: us_008
epic: EP-DATA-I
layer: Database
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_008] — `appointment_slots` & `appointments` Entities
- Story Location: `.propel/context/tasks/EP-DATA-I/us_008/us_008.md`
- Acceptance Criteria:
  - AC-1: `appointment_slots` table — `slot_id` (UUID PK `gen_random_uuid()`), `slot_date` (DATE NOT NULL), `slot_time` (TIME NOT NULL), `duration_minutes` (INTEGER NOT NULL CHECK > 0), `is_available` (BOOLEAN NOT NULL default TRUE), `created_at` (TIMESTAMPTZ NOT NULL); composite UNIQUE on `(slot_date, slot_time)`
  - AC-2: `appointments` table — `appointment_id` (UUID PK), `patient_id` (UUID FK → `users.user_id` NOT NULL), `slot_id` (UUID FK → `appointment_slots.slot_id` NOT NULL), `status` (TEXT CHECK IN 'Confirmed','Arrived','Cancelled','NoShow' NOT NULL), `preferred_slot_id` (UUID FK → `appointment_slots.slot_id` nullable), `booking_type` (TEXT CHECK IN 'Online','WalkIn' NOT NULL), `created_by` (UUID FK → `users.user_id` NOT NULL), `created_at` (TIMESTAMPTZ NOT NULL), `updated_at` (TIMESTAMPTZ NOT NULL)
  - AC-3 (FK side): `preferred_slot_id` nullable FK enforced by PostgreSQL; NULL accepted; invalid UUID raises FK violation
  - AC-5: All FKs on `appointments` are `ON DELETE RESTRICT` — no cascade delete; historical appointment rows survive slot soft-disable

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
Generate the EF Core migration `AppointmentSlotAndAppointment` from the entity configuration created in task_001. Review and harden the generated migration `Up()` to add: CHECK constraint `chk_appointment_slots_duration` (`duration_minutes > 0`), CHECK constraints `chk_appointments_status` and `chk_appointments_booking_type` (string enum values), the composite UNIQUE constraint `uq_appointment_slots_date_time`, and confirm all four FK constraints use `ON DELETE RESTRICT`. Write the complete `Down()` rollback. Apply and verify the schema with `psql`. The `users` table (us_007 migration) must already be applied before this migration runs.

## Dependent Tasks
- `task_001_be_slot_appointment_entities.md` (same story) — entity classes and `OnModelCreating` configuration must be complete before the migration is generated.
- `us_007 task_002_db_users_migration_schema.md` — `users` table must be applied; `appointments.patient_id` and `appointments.created_by` FK target `users.user_id`.

## Impacted Components
- `/api/Data/Migrations/<timestamp>_AppointmentSlotAndAppointment.cs` — CREATE: EF Core migration with manual CHECK constraints
- `/api/Data/Migrations/<timestamp>_AppointmentSlotAndAppointment.Designer.cs` — CREATE: auto-generated companion
- `/api/Data/Migrations/ApplicationDbContextModelSnapshot.cs` — MODIFY: updated by EF Core to include both tables

## Implementation Plan

1. **Generate the migration**:
   ```bash
   DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
   PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
   JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
   dotnet ef migrations add AppointmentSlotAndAppointment --project api/Api.csproj
   ```
   Open the generated migration file and verify the `Up()` before applying.

2. **Verify `appointment_slots` DDL** in `Up()` — EF Core should generate:
   ```sql
   CREATE TABLE appointment_slots (
       slot_id          UUID         NOT NULL DEFAULT gen_random_uuid(),
       slot_date        DATE         NOT NULL,
       slot_time        TIME         NOT NULL,
       duration_minutes INTEGER      NOT NULL,
       is_available     BOOLEAN      NOT NULL DEFAULT TRUE,
       created_at       TIMESTAMPTZ  NOT NULL,
       CONSTRAINT pk_appointment_slots PRIMARY KEY (slot_id)
   );
   ```
   If Npgsql maps `DateOnly` → `date` and `TimeOnly` → `time`, confirm these types in the generated SQL. If EF Core uses `timestamp` instead of `timestamptz`, override via `.HasColumnType("timestamptz")` in `OnModelCreating`.

3. **Add CHECK and UNIQUE constraints manually to `Up()`** (EF Core does not generate these from enum converters or range annotations automatically):
   ```csharp
   // appointment_slots CHECK: duration_minutes > 0
   migrationBuilder.Sql(
       "ALTER TABLE appointment_slots ADD CONSTRAINT chk_appointment_slots_duration " +
       "CHECK (duration_minutes > 0);");

   // Composite UNIQUE on (slot_date, slot_time) — EF Core generates this from HasIndex config
   // Verify it is present; if not, add manually:
   // migrationBuilder.Sql(
   //     "CREATE UNIQUE INDEX uq_appointment_slots_date_time " +
   //     "ON appointment_slots (slot_date, slot_time);");

   // appointments CHECK: status enum values
   migrationBuilder.Sql(
       "ALTER TABLE appointments ADD CONSTRAINT chk_appointments_status " +
       "CHECK (status IN ('Confirmed', 'Arrived', 'Cancelled', 'NoShow'));");

   // appointments CHECK: booking_type enum values
   migrationBuilder.Sql(
       "ALTER TABLE appointments ADD CONSTRAINT chk_appointments_booking_type " +
       "CHECK (booking_type IN ('Online', 'WalkIn'));");
   ```

4. **Verify `appointments` DDL and FK constraints** in generated `Up()`:
   ```sql
   CREATE TABLE appointments (
       appointment_id   UUID         NOT NULL DEFAULT gen_random_uuid(),
       patient_id       UUID         NOT NULL,
       slot_id          UUID         NOT NULL,
       status           TEXT         NOT NULL,
       preferred_slot_id UUID,                       -- nullable (AC-3)
       booking_type     TEXT         NOT NULL,
       created_by       UUID         NOT NULL,
       created_at       TIMESTAMPTZ  NOT NULL,
       updated_at       TIMESTAMPTZ  NOT NULL,
       CONSTRAINT pk_appointments PRIMARY KEY (appointment_id)
   );
   ```
   All FK references must specify `ON DELETE RESTRICT` (AC-5). EF Core generates `RESTRICT` from `DeleteBehavior.Restrict`. Verify all 4 FK `ALTER TABLE` statements have `ON DELETE RESTRICT`:
   - `fk_appointments_patient_id` → `users(user_id) ON DELETE RESTRICT`
   - `fk_appointments_slot_id` → `appointment_slots(slot_id) ON DELETE RESTRICT`
   - `fk_appointments_preferred_slot_id` → `appointment_slots(slot_id) ON DELETE RESTRICT`
   - `fk_appointments_created_by` → `users(user_id) ON DELETE RESTRICT`
   If any FK is missing `RESTRICT`, patch the migration SQL manually.

5. **Write the complete `Down()` rollback**:
   ```csharp
   protected override void Down(MigrationBuilder migrationBuilder)
   {
       // Drop CHECK constraints first
       migrationBuilder.Sql("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS chk_appointments_status;");
       migrationBuilder.Sql("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS chk_appointments_booking_type;");
       migrationBuilder.Sql("ALTER TABLE appointment_slots DROP CONSTRAINT IF EXISTS chk_appointment_slots_duration;");

       // Drop appointments first (it references appointment_slots)
       migrationBuilder.DropTable(name: "appointments");
       migrationBuilder.DropTable(name: "appointment_slots");
   }
   ```
   `DropTable` also drops FKs, indexes, and PKs on those tables. The `users` table remains intact.

6. **Apply and verify**:
   ```bash
   dotnet ef database update --project api/Api.csproj
   ```
   Then verify via `psql`:
   ```sql
   -- Check columns
   \d appointment_slots
   \d appointments

   -- Check constraints
   SELECT constraint_name, constraint_type
   FROM information_schema.table_constraints
   WHERE table_name IN ('appointment_slots', 'appointments')
   ORDER BY table_name, constraint_type;

   -- Confirm FK ON DELETE RESTRICT
   SELECT tc.constraint_name, rc.delete_rule
   FROM information_schema.referential_constraints rc
   JOIN information_schema.table_constraints tc
     ON rc.constraint_name = tc.constraint_name
   WHERE tc.table_name = 'appointments';
   ```
   Expected: 4 FK constraints all with `DELETE_RULE = RESTRICT`, 3 CHECK constraints, 2 UNIQUE constraints (composite + `preferred_slot_id` FK index).

7. **Verify AC-5 — no cascade delete**:
   ```sql
   -- Insert test data
   INSERT INTO users (user_id, email, password_hash, role, status, created_at, updated_at)
   VALUES (gen_random_uuid(), 'enc_test@email', 'hash', 'Patient', 'Active', NOW(), NOW());

   INSERT INTO appointment_slots (slot_id, slot_date, slot_time, duration_minutes, is_available, created_at)
   VALUES ('a0000000-0000-0000-0000-000000000001', '2026-05-01', '09:00', 30, TRUE, NOW());

   -- Create appointment referencing the slot
   INSERT INTO appointments (appointment_id, patient_id, slot_id, status, booking_type, created_by, created_at, updated_at)
   VALUES (gen_random_uuid(), '<user_id>', 'a0000000-0000-0000-0000-000000000001', 'Confirmed', 'Online', '<user_id>', NOW(), NOW());

   -- Soft-disable the slot (AC-5 scenario)
   UPDATE appointment_slots SET is_available = FALSE WHERE slot_id = 'a0000000-0000-0000-0000-000000000001';

   -- Verify appointment row still exists
   SELECT appointment_id, slot_id, status FROM appointments;
   -- Must return the row — not deleted
   ```

8. **Verify composite UNIQUE constraint** (AC-1):
   ```sql
   -- First insert succeeds
   INSERT INTO appointment_slots (slot_date, slot_time, duration_minutes, is_available, created_at)
   VALUES ('2026-05-02', '10:00', 30, TRUE, NOW());

   -- Second insert with same date+time must fail:
   INSERT INTO appointment_slots (slot_date, slot_time, duration_minutes, is_available, created_at)
   VALUES ('2026-05-02', '10:00', 45, TRUE, NOW());
   -- Expected: ERROR: duplicate key value violates unique constraint "uq_appointment_slots_date_time"
   ```

## Current Project State
```
/api/Data/Migrations/
├── <InitialCreate>/           # us_004: base schema
└── <UsersEntity>/             # us_007: users table — MUST be applied before this migration
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Data/Migrations/<ts>_AppointmentSlotAndAppointment.cs` | Two `CreateTable` calls + manual `ALTER TABLE` for 3 CHECK constraints; all 4 FK constraints verified as `RESTRICT`; complete `Down()` |
| CREATE | `/api/Data/Migrations/<ts>_AppointmentSlotAndAppointment.Designer.cs` | Auto-generated EF Core snapshot companion |
| MODIFY | `/api/Data/Migrations/ApplicationDbContextModelSnapshot.cs` | Updated to include both new tables |

## External References
- EF Core migrations raw SQL: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/managing?tabs=dotnet-core-cli#raw-sql
- PostgreSQL `ON DELETE RESTRICT` vs `NO ACTION`: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK
- PostgreSQL composite UNIQUE constraint: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS
- Npgsql `DateOnly` / `TimeOnly` EF Core mapping: https://www.npgsql.org/efcore/mapping/datetime.html
- DR-002, DR-003: `.propel/context/docs/design.md`

## Build Commands
```bash
# Generate migration (run from repo root)
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet ef migrations add AppointmentSlotAndAppointment --project api/Api.csproj

# After reviewing and hardening the migration file:
dotnet ef database update --project api/Api.csproj

# Verify schema
psql "postgresql://devuser:devpassword@localhost:5433/patientaccess" \
  -c "\d appointment_slots" \
  -c "\d appointments" \
  -c "SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name IN ('appointment_slots','appointments') ORDER BY table_name, constraint_name;"

# Rollback test
dotnet ef database update UsersEntity --project api/Api.csproj
```

## Implementation Validation Strategy
- [ ] `dotnet ef database update` completes exit 0; no SQL errors
- [ ] `\d appointment_slots` shows 6 columns: UUID, DATE, TIME, INTEGER, BOOLEAN, TIMESTAMPTZ; no `updated_at`
- [ ] `\d appointments` shows 9 columns with correct types; `preferred_slot_id` is nullable
- [ ] `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='appointment_slots'` returns `pk_appointment_slots`, `uq_appointment_slots_date_time`, `chk_appointment_slots_duration`
- [ ] `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='appointments'` returns 4 FK constraints + 2 CHECK constraints (`chk_appointments_status`, `chk_appointments_booking_type`)
- [ ] All FK `DELETE_RULE` = `RESTRICT` (verified via `information_schema.referential_constraints`)
- [ ] Duplicate `(slot_date, slot_time)` INSERT fails with unique constraint error
- [ ] `duration_minutes = 0` INSERT fails with CHECK constraint error
- [ ] `status = 'Pending'` INSERT on appointments fails with CHECK constraint error
- [ ] Soft-disabling a slot leaves appointment rows intact (AC-5 manual test)

## Implementation Checklist
- [ ] Run `dotnet ef migrations add AppointmentSlotAndAppointment --project api/Api.csproj`
- [ ] Review generated `Up()` — verify `appointment_slots` DDL has 6 correct columns and Npgsql types
- [ ] Review generated `Up()` — verify `appointments` DDL has 9 correct columns; `preferred_slot_id` nullable
- [ ] Add `ALTER TABLE appointment_slots ADD CONSTRAINT chk_appointment_slots_duration CHECK (duration_minutes > 0)` to `Up()`
- [ ] Add `ALTER TABLE appointments ADD CONSTRAINT chk_appointments_status CHECK (status IN ('Confirmed','Arrived','Cancelled','NoShow'))` to `Up()`
- [ ] Add `ALTER TABLE appointments ADD CONSTRAINT chk_appointments_booking_type CHECK (booking_type IN ('Online','WalkIn'))` to `Up()`
- [ ] Confirm composite UNIQUE index `uq_appointment_slots_date_time` on `(slot_date, slot_time)` is in migration
- [ ] Confirm all 4 FK constraints are `ON DELETE RESTRICT`; patch if any differ
- [ ] Write complete `Down()` with CHECK constraint drops before `DropTable` calls
- [ ] Apply `dotnet ef database update`; verify schema with `psql` checks listed above
