---
title: "Task — InsuranceRecord Entity, SeedInsuranceDummyRecords Migration, ON CONFLICT Idempotency & Idempotent SQL Script"
task_id: task_001
story_id: us_011
epic: EP-DATA-I
layer: Database
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_011] — Insurance Dummy Seed Data & Migration Startup Verification
- Story Location: `.propel/context/tasks/EP-DATA-I/us_011/us_011.md`
- Acceptance Criteria:
  - AC-1: `SeedInsuranceDummyRecords` migration creates `insurance_records` table with `record_id` (UUID PK), `provider_name` (TEXT NOT NULL), `insurance_id_prefix` (TEXT NOT NULL), `created_at` (TIMESTAMPTZ NOT NULL); 10 seed rows inserted in `Up()` for: BlueCross Shield, Aetna, UnitedHealth, Cigna, Humana, Medicare, Medicaid, Kaiser Permanente, Anthem, Centene
  - AC-2: `INSERT ... ON CONFLICT (record_id) DO NOTHING` ensures `dotnet ef database update` re-runs do not duplicate rows; `COUNT(*) FROM insurance_records` = exactly 10
  - AC-5: Seed data includes `provider_name = 'BlueCross Shield'` and `insurance_id_prefix = 'BC'`; `ILIKE '%BlueCross%' OR insurance_id_prefix = 'BC'` returns ≥ 1 row
  - AC-6: `dotnet ef migrations script --idempotent` generates SQL with `IF NOT EXISTS` guards safe for re-application
  - Edge Case 1: `Down()` deletes 10 seed rows via `DELETE WHERE insurance_id_prefix IN (...)` then drops `insurance_records` table

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
| Language | C# (migration file + entity) | 13 |
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
Create the `InsuranceRecord` EF Core entity class and register `DbSet<InsuranceRecord>` in `ApplicationDbContext`. Generate the `SeedInsuranceDummyRecords` EF Core migration, which creates the `insurance_records` table and populates it with 10 pre-defined dummy insurance records using `INSERT ... ON CONFLICT (record_id) DO NOTHING` for idempotency. Write the complete `Down()` rollback. Verify `dotnet ef migrations script --idempotent` produces a script with `IF NOT EXISTS` guards. Confirm the lookup pattern required by FR-024 works against the seed data.

## Dependent Tasks
- `us_010 task_002_db_patient_intake_migration.md` — `patient_intakes` migration must be the previous migration in sequence; `SeedInsuranceDummyRecords` is authored after it.
- `task_002_be_migrate_async_startup_tests.md` (same story) — startup verification test lists `SeedInsuranceDummyRecords` among expected migrations; table and seed must exist.

## Impacted Components
- `/api/Features/Insurance/Entities/InsuranceRecord.cs` — CREATE: `InsuranceRecord` entity class
- `/api/Data/ApplicationDbContext.cs` — MODIFY: add `DbSet<InsuranceRecord>` and `OnModelCreating` config
- `/api/Data/Migrations/<timestamp>_SeedInsuranceDummyRecords.cs` — CREATE: EF Core migration with `CreateTable` + `INSERT ON CONFLICT` seed rows + complete `Down()`
- `/api/Data/Migrations/<timestamp>_SeedInsuranceDummyRecords.Designer.cs` — CREATE: auto-generated companion
- `/api/Data/Migrations/ApplicationDbContextModelSnapshot.cs` — MODIFY: updated to include `insurance_records`

## Implementation Plan

1. **Create `InsuranceRecord.cs`** entity:
   ```csharp
   // /api/Features/Insurance/Entities/InsuranceRecord.cs
   namespace Api.Features.Insurance.Entities;

   /// <summary>
   /// Read-only dummy insurance reference record.
   /// No UpdatedAt column — these rows are seed data; no application layer mutation is expected.
   /// No FK references from other entities — safe to drop the table in Down() without cascade concerns.
   /// </summary>
   public sealed class InsuranceRecord
   {
       public Guid           RecordId          { get; set; }
       public string         ProviderName      { get; set; } = string.Empty;
       public string         InsuranceIdPrefix { get; set; } = string.Empty;
       public DateTimeOffset CreatedAt         { get; set; }
   }
   ```

2. **Register in `ApplicationDbContext.OnModelCreating`**:
   ```csharp
   // DbSet:
   public DbSet<InsuranceRecord> InsuranceRecords => Set<InsuranceRecord>();

   // OnModelCreating:
   modelBuilder.Entity<InsuranceRecord>(entity =>
   {
       entity.ToTable("insurance_records");
       entity.HasKey(r => r.RecordId);
       entity.Property(r => r.RecordId).HasColumnName("record_id").HasDefaultValueSql("gen_random_uuid()");
       entity.Property(r => r.ProviderName).HasColumnName("provider_name").IsRequired();
       entity.Property(r => r.InsuranceIdPrefix).HasColumnName("insurance_id_prefix").IsRequired();
       entity.Property(r => r.CreatedAt).HasColumnName("created_at").IsRequired();
   });
   ```

3. **Generate the migration**:
   ```bash
   DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
   PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
   JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
   dotnet ef migrations add SeedInsuranceDummyRecords --project api/Api.csproj
   ```
   Open the generated migration file. The `Up()` will contain the `CreateTable` call generated by EF Core.

4. **Add idempotent seed `INSERT` statements after `CreateTable` in `Up()`** (AC-1, AC-2):
   ```csharp
   // Seed 10 dummy insurance records using fixed UUIDs for reproducibility.
   // ON CONFLICT (record_id) DO NOTHING ensures idempotency — re-running the migration
   // after the rows already exist does NOT duplicate them (AC-2).
   migrationBuilder.Sql(@"
       INSERT INTO insurance_records (record_id, provider_name, insurance_id_prefix, created_at)
       VALUES
           ('10000000-0000-0000-0000-000000000001', 'BlueCross Shield',    'BC',  NOW()),
           ('10000000-0000-0000-0000-000000000002', 'Aetna',               'AET', NOW()),
           ('10000000-0000-0000-0000-000000000003', 'UnitedHealth',        'UH',  NOW()),
           ('10000000-0000-0000-0000-000000000004', 'Cigna',               'CIG', NOW()),
           ('10000000-0000-0000-0000-000000000005', 'Humana',              'HUM', NOW()),
           ('10000000-0000-0000-0000-000000000006', 'Medicare',            'MCR', NOW()),
           ('10000000-0000-0000-0000-000000000007', 'Medicaid',            'MCD', NOW()),
           ('10000000-0000-0000-0000-000000000008', 'Kaiser Permanente',   'KP',  NOW()),
           ('10000000-0000-0000-0000-000000000009', 'Anthem',              'ANT', NOW()),
           ('10000000-0000-0000-0000-000000000010', 'Centene',             'CTN', NOW())
       ON CONFLICT (record_id) DO NOTHING;
   ");
   ```
   Fixed UUIDs are intentional: the `ON CONFLICT (record_id)` clause requires a deterministic PK to detect existing rows. Using `gen_random_uuid()` in the INSERT would always generate new UUIDs, making duplicate detection impossible.

5. **Write the complete `Down()` rollback** (EC-1):
   ```csharp
   protected override void Down(MigrationBuilder migrationBuilder)
   {
       // Delete the 10 seed rows first — identified by their fixed insurance_id_prefix values.
       // Deleting by prefix rather than UUID is safer if the UUIDs were changed in a patch.
       migrationBuilder.Sql(@"
           DELETE FROM insurance_records
           WHERE insurance_id_prefix IN ('BC','AET','UH','CIG','HUM','MCR','MCD','KP','ANT','CTN');
       ");

       migrationBuilder.DropTable(name: "insurance_records");
   }
   ```
   The table has no FK references from other entities (no other table points to `insurance_records`), so `DropTable` is safe without CASCADE.

6. **Apply and verify**:
   ```bash
   dotnet ef database update --project api/Api.csproj
   ```
   Verify via `psql`:
   ```sql
   \d insurance_records

   SELECT COUNT(*) FROM insurance_records;
   -- Expected: 10

   -- AC-5: FR-024 lookup pattern
   SELECT provider_name, insurance_id_prefix
   FROM insurance_records
   WHERE provider_name ILIKE '%BlueCross%' OR insurance_id_prefix = 'BC';
   -- Expected: 1 row — 'BlueCross Shield', 'BC'

   -- AC-2: idempotency — re-run the migration (or just the INSERT) and recount
   -- dotnet ef database update SeedInsuranceDummyRecords (already applied — no-op)
   SELECT COUNT(*) FROM insurance_records;
   -- Must still be 10
   ```

7. **Verify idempotent migration script** (AC-6):
   ```bash
   DATABASE_URL="..." dotnet ef migrations script --idempotent --project api/Api.csproj \
     -o /tmp/idempotent-migration.sql
   ```
   Open the script and confirm:
   - Each `CREATE TABLE` block is wrapped in `IF NOT EXISTS` or preceded by `IF NOT EXISTS` on the `__EFMigrationsHistory` check
   - The seed `INSERT ... ON CONFLICT DO NOTHING` is present for `SeedInsuranceDummyRecords`
   - The script can be re-executed against a fully migrated database without error

   The `--idempotent` flag causes EF Core to wrap each migration's SQL in:
   ```sql
   IF NOT EXISTS (SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '..._SeedInsuranceDummyRecords')
   BEGIN ... END
   ```
   Combined with `ON CONFLICT DO NOTHING` on the seed INSERTs, the full script is safe to re-run.

8. **Verify idempotency manually**:
   ```sql
   -- Manually re-run the seed INSERT after the migration has been applied:
   INSERT INTO insurance_records (record_id, provider_name, insurance_id_prefix, created_at)
   VALUES ('10000000-0000-0000-0000-000000000001', 'BlueCross Shield', 'BC', NOW())
   ON CONFLICT (record_id) DO NOTHING;
   -- Expected: INSERT 0 0 (zero rows inserted — no duplicate)

   SELECT COUNT(*) FROM insurance_records;
   -- Must still be 10
   ```

## Current Project State
```
/api/Data/Migrations/
├── <InitialCreate>/                    # us_004
├── <UsersEntity>/                      # us_007
├── <AppointmentSlotAndAppointment>/    # us_008
├── <WaitlistAndNotifications>/         # us_009
└── <PatientIntakes>/                   # us_010 — last migration before this one
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Features/Insurance/Entities/InsuranceRecord.cs` | Entity with 4 columns; no `UpdatedAt`; no FK references from other tables |
| MODIFY | `/api/Data/ApplicationDbContext.cs` | Add `DbSet<InsuranceRecord>`; `OnModelCreating` config: `record_id` UUID PK, `provider_name` TEXT NOT NULL, `insurance_id_prefix` TEXT NOT NULL, `created_at` TIMESTAMPTZ NOT NULL |
| CREATE | `/api/Data/Migrations/<ts>_SeedInsuranceDummyRecords.cs` | `CreateTable` for `insurance_records`; `INSERT 10 rows ON CONFLICT (record_id) DO NOTHING`; `Down()` deletes seed rows by `insurance_id_prefix` then drops table |
| CREATE | `/api/Data/Migrations/<ts>_SeedInsuranceDummyRecords.Designer.cs` | Auto-generated companion |
| MODIFY | `/api/Data/Migrations/ApplicationDbContextModelSnapshot.cs` | Updated to include `insurance_records` |

## External References
- PostgreSQL `INSERT ... ON CONFLICT DO NOTHING`: https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT
- `dotnet ef migrations script --idempotent`: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying?tabs=dotnet-core-cli#idempotent-sql-scripts
- DR-014 (auto-apply migrations on startup): `.propel/context/docs/design.md#DR-014`
- FR-024 (insurance pre-check lookup): `.propel/context/docs/spec.md#FR-024`

## Build Commands
```bash
# Generate migration
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet ef migrations add SeedInsuranceDummyRecords --project api/Api.csproj

# Apply migration
dotnet ef database update --project api/Api.csproj

# Verify schema and seed count
psql "postgresql://devuser:devpassword@localhost:5433/patientaccess" \
  -c "\d insurance_records" \
  -c "SELECT COUNT(*) FROM insurance_records;" \
  -c "SELECT provider_name, insurance_id_prefix FROM insurance_records WHERE provider_name ILIKE '%BlueCross%' OR insurance_id_prefix = 'BC';"

# Generate idempotent SQL script
dotnet ef migrations script --idempotent --project api/Api.csproj -o /tmp/idempotent-migration.sql
cat /tmp/idempotent-migration.sql | grep -A5 "SeedInsuranceDummyRecords"

# Rollback test
dotnet ef database update PatientIntakes --project api/Api.csproj
```

## Implementation Validation Strategy
- [ ] `dotnet ef database update` completes exit 0; `insurance_records` table exists with 4 columns
- [ ] `SELECT COUNT(*) FROM insurance_records` = 10 immediately after migration
- [ ] Re-running `dotnet ef database update` (already applied) does not duplicate rows; COUNT still = 10
- [ ] Manually re-running seed INSERT returns `INSERT 0 0` (zero rows affected) — confirms `ON CONFLICT DO NOTHING`
- [ ] `SELECT * FROM insurance_records WHERE provider_name ILIKE '%BlueCross%' OR insurance_id_prefix = 'BC'` returns 1 row
- [ ] `dotnet ef migrations script --idempotent` generates valid SQL containing `ON CONFLICT DO NOTHING` for seed rows
- [ ] `Down()` migration: `dotnet ef database update PatientIntakes` drops `insurance_records` and all 10 seed rows

## Implementation Checklist
- [ ] Create `InsuranceRecord.cs`: 4 columns, no `UpdatedAt`, no FK refs from other tables
- [ ] Modify `ApplicationDbContext.cs`: `DbSet<InsuranceRecord>`, `OnModelCreating` config (4 columns, no FKs to this table)
- [ ] Run `dotnet ef migrations add SeedInsuranceDummyRecords --project api/Api.csproj`
- [ ] Verify generated `CreateTable` DDL has correct column types; add `.HasColumnType("timestamptz")` to `created_at` if EF Core generated plain `timestamp`
- [ ] Add `INSERT 10 rows ON CONFLICT (record_id) DO NOTHING` to `Up()` after `CreateTable`; use fixed deterministic UUIDs `10000000-0000-0000-0000-00000000000X`
- [ ] Write `Down()`: `DELETE WHERE insurance_id_prefix IN (...)` then `DropTable("insurance_records")`
- [ ] Apply `dotnet ef database update`; verify COUNT = 10 and BlueCross lookup returns 1 row
- [ ] Run `dotnet ef migrations script --idempotent` and confirm script is safe to re-execute
