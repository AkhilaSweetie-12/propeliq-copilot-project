---
title: "Task — data_retention_policy Table Migration with PHI Table Seed Rows"
task_id: task_001
story_id: us_016
epic: EP-DATA-II
layer: Database
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_016] — PHI 6-Year Data Retention Policy & Automated Backup with WAL PITR
- Story Location: `.propel/context/tasks/EP-DATA-II/us_016/us_016.md`
- Acceptance Criteria:
  - AC-1: `data_retention_policy` table created with `table_name` (TEXT PK), `retention_years` (INTEGER NOT NULL), `archival_policy` (TEXT NOT NULL), `last_reviewed_at` (DATE NOT NULL); seed rows inserted for 5 PHI tables with 6-year retention; `created_at` columns confirmed as TIMESTAMPTZ NOT NULL on all PHI tables (already present from prior migrations)

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
Create a `DataRetentionPolicy` EF Core entity (no FK references — a standalone metadata table) and its migration `AddRetentionMetadata`. The migration creates `data_retention_policy` and inserts idempotent seed rows for the 5 PHI tables (`patient_intakes`, `clinical_documents`, `extracted_clinical_data`, `patient_view_360`, `audit_logs`) using `INSERT ... ON CONFLICT (table_name) DO NOTHING`. Additionally verify via the migration's `Up()` that the `created_at` column exists and is TIMESTAMPTZ NOT NULL on all 5 PHI tables using a PostgreSQL assertion query.

## Dependent Tasks
- `us_015 task_002_db_audit_logs_migration.md` — All 5 PHI tables (`patient_intakes`, `clinical_documents`, `extracted_clinical_data`, `patient_view_360`, `audit_logs`) must exist before this seed migration runs

## Impacted Components
- `/api/Domain/Entities/DataRetentionPolicy.cs` — CREATE: simple entity, no navigation properties
- `/api/Infrastructure/Persistence/ApplicationDbContext.cs` — MODIFY: add `DbSet<DataRetentionPolicy>` + `OnModelCreating` config
- `/api/Migrations/<timestamp>_AddRetentionMetadata.cs` — CREATE: generated migration + seed rows + `created_at` assertion

## Implementation Plan

1. **Define `DataRetentionPolicy` entity** — standalone metadata table, no FKs:
   ```csharp
   // /api/Domain/Entities/DataRetentionPolicy.cs
   namespace Api.Domain.Entities;

   public sealed class DataRetentionPolicy
   {
       // PK is the table name — one row per PHI table
       public string TableName { get; private set; } = string.Empty;
       public int RetentionYears { get; private set; }
       public string ArchivalPolicy { get; private set; } = string.Empty;
       public DateOnly LastReviewedAt { get; private set; }

       private DataRetentionPolicy() { }

       public static DataRetentionPolicy Create(
           string tableName, int retentionYears, string archivalPolicy, DateOnly lastReviewedAt)
           => new()
           {
               TableName = tableName,
               RetentionYears = retentionYears,
               ArchivalPolicy = archivalPolicy,
               LastReviewedAt = lastReviewedAt
           };
   }
   ```

2. **Update `ApplicationDbContext.OnModelCreating`**:
   ```csharp
   modelBuilder.Entity<DataRetentionPolicy>(e =>
   {
       e.ToTable("data_retention_policy");
       e.HasKey(p => p.TableName);
       e.Property(p => p.TableName).HasColumnName("table_name").IsRequired();
       e.Property(p => p.RetentionYears).HasColumnName("retention_years").IsRequired();
       e.Property(p => p.ArchivalPolicy).HasColumnName("archival_policy").IsRequired();
       e.Property(p => p.LastReviewedAt).HasColumnName("last_reviewed_at").IsRequired();
   });
   ```

3. **Generate the migration**:
   ```bash
   cd api
   dotnet ef migrations add AddRetentionMetadata \
     --project Api.csproj --startup-project Api.csproj --output-dir Migrations
   ```

4. **Add seed rows in `Up()`** using `INSERT ... ON CONFLICT (table_name) DO NOTHING` (idempotent):
   ```csharp
   // In Up() after CreateTable:
   migrationBuilder.Sql("""
       INSERT INTO data_retention_policy (table_name, retention_years, archival_policy, last_reviewed_at)
       VALUES
           ('patient_intakes',          6, 'Retain 6 years from created_at; archive to cold storage after expiry', '2026-04-21'),
           ('clinical_documents',       6, 'Retain 6 years from uploaded_at; archive to cold storage after expiry', '2026-04-21'),
           ('extracted_clinical_data',  6, 'Retain 6 years from extracted_at; archive to cold storage after expiry', '2026-04-21'),
           ('patient_view_360',         6, 'Retain 6 years from last_updated_at; re-aggregate after expiry', '2026-04-21'),
           ('audit_logs',               6, 'Retain 6 years from occurred_at; append-only; no archival deletion', '2026-04-21')
       ON CONFLICT (table_name) DO NOTHING;
   """);
   ```
   In `Down()`, remove the seed rows then drop the table:
   ```csharp
   migrationBuilder.Sql("""
       DELETE FROM data_retention_policy
       WHERE table_name IN (
           'patient_intakes', 'clinical_documents', 'extracted_clinical_data',
           'patient_view_360', 'audit_logs'
       );
   """);
   ```

5. **Add `created_at` assertion** in `Up()` after the seed — verifies all 5 PHI tables have the required TIMESTAMPTZ NOT NULL column per AC-1:
   ```csharp
   migrationBuilder.Sql("""
       DO $$
       DECLARE
           phi_tables TEXT[] := ARRAY[
               'patient_intakes', 'clinical_documents', 'extracted_clinical_data',
               'patient_view_360', 'audit_logs'
           ];
           tbl TEXT;
           col_count INT;
       BEGIN
           FOREACH tbl IN ARRAY phi_tables LOOP
               SELECT COUNT(*) INTO col_count
               FROM information_schema.columns
               WHERE table_name = tbl
                 AND column_name IN ('created_at', 'uploaded_at', 'extracted_at', 'last_updated_at', 'occurred_at')
                 AND is_nullable = 'NO'
                 AND data_type = 'timestamp with time zone';
               IF col_count = 0 THEN
                   RAISE EXCEPTION 'PHI table "%" has no TIMESTAMPTZ NOT NULL timestamp column — retention policy cannot be enforced', tbl;
               END IF;
           END LOOP;
       END;
       $$;
   """);
   ```
   This PL/pgSQL block acts as a migration-time assertion: if any PHI table is missing its timestamp column (e.g., because a prior migration was rolled back), the `AddRetentionMetadata` migration fails loudly rather than silently creating metadata for tables that cannot enforce retention.

6. **Verify via psql**:
   ```sql
   -- Confirm data_retention_policy table and seed rows
   SELECT * FROM data_retention_policy ORDER BY table_name;
   -- Expected: 5 rows, all with retention_years = 6

   -- Confirm idempotency — re-running the INSERT ON CONFLICT adds nothing
   SELECT COUNT(*) FROM data_retention_policy;
   -- Expected: 5 (not 10 after two runs)
   ```

## Current Project State
```
/api/
├── Domain/Entities/
│   ├── AuditLog.cs               # us_015: exists
│   ├── PatientView360.cs         # us_014: exists
│   └── DataRetentionPolicy.cs    # NOT YET CREATED — this task
├── Infrastructure/Persistence/
│   └── ApplicationDbContext.cs   # WILL BE MODIFIED
/api/Migrations/
├── <timestamp>_AuditLogs.cs      # us_015: exists (last migration)
└── <timestamp>_AddRetentionMetadata.cs  # NOT YET GENERATED — this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Domain/Entities/DataRetentionPolicy.cs` | Standalone metadata entity; TEXT PK (`table_name`), `retention_years` INT, `archival_policy` TEXT, `last_reviewed_at` DATE |
| MODIFY | `/api/Infrastructure/Persistence/ApplicationDbContext.cs` | Add `DbSet<DataRetentionPolicy>`; `OnModelCreating` with TEXT PK config |
| CREATE | `/api/Migrations/<timestamp>_AddRetentionMetadata.cs` | `CreateTable("data_retention_policy")`; `INSERT ON CONFLICT DO NOTHING` seed for 5 PHI tables; PL/pgSQL assertion block for TIMESTAMPTZ NOT NULL columns |

## External References
- `DateOnly` type in EF Core 9 (maps to PostgreSQL `date`): https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-6.0/whatsnew#dateonly-and-timeonly
- `INSERT ... ON CONFLICT DO NOTHING` (idempotent seed): https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT
- DR-012: PHI 6-year retention — `.propel/context/docs/design.md#DR-012`

## Build Commands
```bash
cd api
dotnet ef migrations add AddRetentionMetadata \
  --project Api.csproj --startup-project Api.csproj --output-dir Migrations

DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
UPLOADS_ROOT="/tmp/uploads" \
dotnet ef database update \
  --project api/Api.csproj --startup-project api/Api.csproj
```

## Implementation Validation Strategy
- [ ] `SELECT * FROM data_retention_policy ORDER BY table_name` returns exactly 5 rows after migration
- [ ] All 5 rows have `retention_years = 6`
- [ ] Re-running `INSERT ON CONFLICT DO NOTHING` does not duplicate rows
- [ ] PL/pgSQL assertion block completes without `RAISE EXCEPTION` (all 5 PHI tables have their timestamp columns)
- [ ] `Down()` removes all 5 seed rows, then `DropTable` succeeds

## Implementation Checklist
- [ ] Create `DataRetentionPolicy.cs` entity with TEXT PK, private constructor, `Create()` factory
- [ ] Modify `ApplicationDbContext.cs`: add `DbSet<DataRetentionPolicy>`, `OnModelCreating` with `e.HasKey(p => p.TableName)`
- [ ] Run `dotnet ef migrations add AddRetentionMetadata`
- [ ] Add `INSERT INTO data_retention_policy ... ON CONFLICT (table_name) DO NOTHING` seed for all 5 PHI tables in `Up()`
- [ ] Add PL/pgSQL assertion block verifying TIMESTAMPTZ NOT NULL columns exist on each PHI table
- [ ] Add `DELETE FROM data_retention_policy WHERE table_name IN (...)` in `Down()` before `DropTable`
- [ ] Apply migration and verify 5 seed rows present; confirm idempotency on re-run
