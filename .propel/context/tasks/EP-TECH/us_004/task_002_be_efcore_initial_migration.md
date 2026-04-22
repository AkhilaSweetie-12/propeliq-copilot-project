---
title: "Task — InitialCreate Migration with pgvector Extension + MigrateAsync() on API Startup"
task_id: task_002
story_id: us_004
epic: EP-TECH
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_004] — EF Core 9 Database Migration Framework Setup
- Story Location: `.propel/context/tasks/EP-TECH/us_004/us_004.md`
- Acceptance Criteria:
  - AC-2: `context.Database.MigrateAsync()` called at API startup applies all pending EF Core migrations before the first HTTP request is served; `__EFMigrationsHistory` confirms each applied migration by name and applied timestamp
  - AC-3: `InitialCreate` migration `Up()` executes `CREATE EXTENSION IF NOT EXISTS vector;` as the first SQL statement, enabling pgvector without a manual DBA step
  - Edge Case 2: Mid-migration `Up()` failure → EF Core transaction wraps the migration; on failure the transaction is rolled back and `__EFMigrationsHistory` row is NOT written, leaving the database in its pre-migration state
  - Edge Case 3: pgvector already installed → `CREATE EXTENSION IF NOT EXISTS vector;` is idempotent; migration completes without error

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
| ORM | Entity Framework Core | 9.x |
| DB Provider | Npgsql.EntityFrameworkCore.PostgreSQL | 9.x |
| EF Tools | dotnet-ef (local manifest) | 9.x |
| Database | PostgreSQL | 16 |
| Extension | pgvector | 0.7 |
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
Generate the `InitialCreate` EF Core migration and manually edit its `Up()` method to prepend `CREATE EXTENSION IF NOT EXISTS vector;` as the first SQL statement (satisfying AC-3 and EC-3). Configure the API startup pipeline to call `context.Database.MigrateAsync()` before `app.Run()` so all pending migrations are applied on every startup. Wrap the migration call in a scoped service resolve pattern to correctly obtain the `ApplicationDbContext` from the DI container. Verify transaction rollback behaviour for mid-migration failures (EC-2) by reviewing EF Core's default transaction wrapping for PostgreSQL.

## Dependent Tasks
- `task_001_be_efcore_dbcontext_factory.md` — `ApplicationDbContext`, design-time factory, and EF Core packages must exist before `dotnet ef migrations add` can be run.
- `us_003 task_001_infra_docker_compose_services.md` — PostgreSQL must be accessible at `DATABASE_URL` to apply the migration.

## Impacted Components
- `/api/Migrations/` — CREATE directory: contains the generated `InitialCreate` migration files
- `/api/Migrations/<timestamp>_InitialCreate.cs` — CREATE (via `dotnet ef migrations add`): migration class with `Up()` / `Down()` methods
- `/api/Migrations/<timestamp>_InitialCreate.Designer.cs` — CREATE (auto-generated): migration metadata snapshot
- `/api/Migrations/ApplicationDbContextModelSnapshot.cs` — CREATE (auto-generated): EF Core model snapshot
- `/api/Program.cs` — MODIFY: add `MigrateAsync()` call in startup using a scoped `ApplicationDbContext`

## Implementation Plan

1. **Generate the `InitialCreate` migration**:
   ```bash
   cd /  # repo root (dotnet-tools.json is here)
   DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
   dotnet ef migrations add InitialCreate \
     --project api/Api.csproj \
     --output-dir Migrations
   ```
   This creates three files in `/api/Migrations/`:
   - `<timestamp>_InitialCreate.cs`
   - `<timestamp>_InitialCreate.Designer.cs`
   - `ApplicationDbContextModelSnapshot.cs`

   At this point, because `ApplicationDbContext` has no `DbSet<T>` properties, `Up()` will be empty (no tables). That is expected — entity tables are added in feature epic migrations. The migration is generated now to:
   - Establish the `__EFMigrationsHistory` baseline
   - Host the `CREATE EXTENSION IF NOT EXISTS vector;` step

2. **Edit `Up()` in `<timestamp>_InitialCreate.cs`** to add the pgvector extension as the first statement (AC-3):
   ```csharp
   protected override void Up(MigrationBuilder migrationBuilder)
   {
       // Enable pgvector extension — idempotent (IF NOT EXISTS) so safe on pre-existing databases (EC-3)
       migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS vector;");
   
       // Future entity table DDL will be added here by subsequent dotnet ef migrations add commands
   }
   
   protected override void Down(MigrationBuilder migrationBuilder)
   {
       // Note: pgvector extension is NOT dropped in Down() to avoid
       // breaking any pre-existing databases that had the extension before this migration
   }
   ```
   Design decision: `Down()` intentionally does NOT drop the `vector` extension because:
   - Dropping it would fail if any column in the database uses the `vector` type
   - Feature migrations that add `vector` columns will handle the cascade ordering
   - EC-3 (idempotent install) does not require an idempotent uninstall

3. **Add `MigrateAsync()` to `Program.cs`** — using a scoped DI resolution to correctly obtain the registered `ApplicationDbContext`:
   ```csharp
   // After app.Build() and before app.Run():
   using (var scope = app.Services.CreateScope())
   {
       var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
       await db.Database.MigrateAsync();
   }
   ```
   Place this block after all middleware registrations (`UseAuthentication`, `UseAuthorization`, `MapControllers`) but before `app.Run()`. This ensures:
   - All DI services (including `ApplicationDbContext`) are fully registered before the scope is created
   - Migrations run synchronously with respect to startup — `app.Run()` is not called until migrations complete (AC-2)
   - The scoped context is disposed immediately after migration (no leaked DB connection)

4. **Validate transaction rollback behaviour (EC-2)**:
   EF Core wraps each migration in a transaction by default for databases that support transactional DDL. PostgreSQL supports transactional DDL (unlike MySQL), so:
   - If `Up()` fails after some DDL statements execute, PostgreSQL rolls back the entire migration transaction
   - The `__EFMigrationsHistory` INSERT is part of the same transaction — if the migration fails, the history row is not written
   - This is EF Core's built-in behaviour; no custom code is required to satisfy EC-2
   
   Document this in code comments in `Program.cs` next to the `MigrateAsync()` call:
   ```csharp
   // EF Core wraps each migration in a transaction (PostgreSQL supports transactional DDL).
   // On migration failure the transaction is rolled back; __EFMigrationsHistory is not updated.
   // This satisfies NFR-018 — no partial migration state can reach production.
   await db.Database.MigrateAsync();
   ```

5. **Verify end-to-end migration execution**:
   ```bash
   # Apply migrations (first run creates __EFMigrationsHistory + runs InitialCreate)
   DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
   dotnet ef database update --project api/Api.csproj
   
   # List applied migrations (AC-5)
   DATABASE_URL="..." dotnet ef migrations list --project api/Api.csproj
   # Expected: 20260421XXXXXXXX_InitialCreate  (Applied)
   
   # Verify pgvector extension is installed
   docker compose exec postgres psql -U devuser -d patientaccess \
     -c "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"
   # Expected: vector | 0.7.x
   
   # Verify __EFMigrationsHistory
   docker compose exec postgres psql -U devuser -d patientaccess \
     -c "SELECT * FROM \"__EFMigrationsHistory\";"
   # Expected: row with MigrationId containing 'InitialCreate' and non-null AppliedAt
   ```

6. **Generate idempotent SQL script for CI** (EC-1 — migration lint):
   ```bash
   DATABASE_URL="..." dotnet ef migrations script --idempotent \
     --project api/Api.csproj \
     --output /tmp/migrations-idempotent.sql
   ```
   The CI pipeline should run this command and fail the build if it exits non-zero (which happens on merge conflicts in the model snapshot).

## Current Project State
```
/api/
├── Api.csproj                      # task_001: EF Core 9 + Npgsql packages added
├── Program.cs                      # us_002: DI pipeline; task_001: AddDbContext — WILL BE MODIFIED
├── Data/
│   ├── ApplicationDbContext.cs     # task_001 (no DbSets yet)
│   └── ApplicationDbContextFactory.cs  # task_001 (reads DATABASE_URL)
├── Migrations/                     # NOT YET CREATED — created by dotnet ef migrations add
└── Infrastructure/
    ├── StartupGuard.cs
    ├── Health/
    ├── Middleware/
    └── OpenApi/
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Migrations/<timestamp>_InitialCreate.cs` | Generated migration; manually edited to add `CREATE EXTENSION IF NOT EXISTS vector;` as first statement in `Up()` |
| CREATE | `/api/Migrations/<timestamp>_InitialCreate.Designer.cs` | Auto-generated migration metadata (do not edit manually) |
| CREATE | `/api/Migrations/ApplicationDbContextModelSnapshot.cs` | Auto-generated EF model snapshot (do not edit manually) |
| MODIFY | `/api/Program.cs` | Add scoped `MigrateAsync()` call after `app.Build()` and before `app.Run()` |

## External References
- EF Core migrations — adding and applying: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/?tabs=dotnet-core-cli
- EF Core `MigrateAsync()` — applying pending migrations at startup: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying?tabs=dotnet-core-cli#apply-migrations-at-runtime
- EF Core `MigrationBuilder.Sql()` for raw SQL in migrations: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/operations#arbitrary-changes-via-sql
- pgvector `CREATE EXTENSION IF NOT EXISTS vector;` idempotency: https://github.com/pgvector/pgvector#installation
- PostgreSQL transactional DDL (supports transaction rollback for DDL): https://www.postgresql.org/docs/16/ddl-alter.html
- EF Core migration transactions (EC-2): https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying?tabs=dotnet-core-cli#transactions
- `dotnet ef migrations script --idempotent` reference: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying?tabs=dotnet-core-cli#sql-scripts

## Build Commands
```bash
# Generate InitialCreate migration (requires DATABASE_URL + PostgreSQL running)
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
dotnet ef migrations add InitialCreate --project api/Api.csproj --output-dir Migrations

# Apply migration to database
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
dotnet ef database update --project api/Api.csproj

# List migrations (AC-5 — must show InitialCreate as Applied, zero Pending)
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
dotnet ef migrations list --project api/Api.csproj

# Start API (MigrateAsync runs automatically before first request)
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet run --project api/Api.csproj

# Verify pgvector extension
docker compose exec postgres psql -U devuser -d patientaccess \
  -c "SELECT extname FROM pg_extension WHERE extname='vector';"

# Generate idempotent SQL script (CI lint)
DATABASE_URL="..." dotnet ef migrations script --idempotent --project api/Api.csproj \
  --output /tmp/migrations.sql
```

## Implementation Validation Strategy
- [ ] `dotnet ef migrations add InitialCreate` generates files in `/api/Migrations/` with zero compilation errors
- [ ] After manual edit, `InitialCreate.Up()` begins with `migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS vector;")` as first line
- [ ] `dotnet ef database update` applies `InitialCreate`; `__EFMigrationsHistory` table contains one row with `InitialCreate` migration ID
- [ ] `dotnet ef migrations list` shows `InitialCreate` as `Applied` with a timestamp; zero `Pending` migrations
- [ ] `dotnet run` (API startup) with a fresh database applies the migration automatically via `MigrateAsync()`; API starts and `/api/health` returns HTTP 200
- [ ] Re-running `dotnet run` against a database where `InitialCreate` is already applied: `MigrateAsync()` is a no-op (idempotent); API starts normally
- [ ] Running `dotnet ef migrations add InitialCreate` when pgvector is already installed on the target DB: `CREATE EXTENSION IF NOT EXISTS vector` completes without error (EC-3 idempotency)
- [ ] `dotnet build api/Api.csproj --configuration Release` exits 0

## Implementation Checklist
- [ ] Run `dotnet ef migrations add InitialCreate --project api/Api.csproj --output-dir Migrations`
- [ ] Edit generated `Up()` in `<timestamp>_InitialCreate.cs` to add `migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS vector;")` as first statement
- [ ] Leave `Down()` without a `DROP EXTENSION` call (intentional — see design note in Step 2)
- [ ] Add comment block in `Program.cs` explaining EF Core transaction wrapping for EC-2 compliance
- [ ] Add scoped `MigrateAsync()` call in `Program.cs` after `app.Build()` inside `using (var scope = app.Services.CreateScope())`
- [ ] Run `dotnet ef database update` — confirm `InitialCreate` applied
- [ ] Run `dotnet ef migrations list` — confirm `Applied` status, zero `Pending`
- [ ] Verify `SELECT extname FROM pg_extension WHERE extname='vector'` returns a row
- [ ] Run `dotnet run` with API — confirm startup completes and `/api/health` returns 200
