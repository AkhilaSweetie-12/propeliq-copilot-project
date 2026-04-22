---
title: "Task — MigrateAsync Startup Wiring, Advisory Lock Awareness & Migration Regression Guard Tests"
task_id: task_002
story_id: us_011
epic: EP-DATA-I
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_011] — Insurance Dummy Seed Data & Migration Startup Verification
- Story Location: `.propel/context/tasks/EP-DATA-I/us_011/us_011.md`
- Acceptance Criteria:
  - AC-3: `context.Database.MigrateAsync()` called in `Program.cs` before `app.Run()`; integration test asserts `__EFMigrationsHistory` contains all 7 expected EP-DATA-I migration names with non-null timestamps
  - AC-4: Integration test calls `context.Database.GetPendingMigrationsAsync()` and asserts result is empty; regression guard fails CI if a migration is added without being applied
  - Edge Case 2: `MigrateAsync()` concurrent callers — PostgreSQL advisory lock prevents double-apply; documented in startup logging
  - Edge Case 3: Invalid `DATABASE_URL` — `StartupGuard.ValidateEnvironment()` throws before `MigrateAsync()` is called; no partial migration state

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
| Test Framework | xUnit | 2.x |
| Test Host | Microsoft.AspNetCore.Mvc.Testing | 9.x |
| Logging | Serilog | 8.x |
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
Add `context.Database.MigrateAsync()` to `Program.cs` after `StartupGuard.ValidateEnvironment()` and before `app.Run()`, wrapped in a Serilog-instrumented try/catch. Add a Serilog `Information` log entry before and after the migration call so rolling deployments can observe migration completion. Add a `Warning` log noting PostgreSQL advisory lock behaviour for concurrent startup. Create the `Schema/MigrationVerificationTests.cs` xUnit integration test class in `api.tests` that asserts (1) `__EFMigrationsHistory` contains all 7 expected EP-DATA-I migration names and (2) `GetPendingMigrationsAsync()` returns an empty collection.

## Dependent Tasks
- `us_004 task_001_be_efcore_dbcontext_factory.md` — `ApplicationDbContext` and `Program.cs` DI wiring must exist; `MigrateAsync()` is called via a scoped `ApplicationDbContext`.
- `task_001_db_insurance_seed_migration.md` (same story) — `SeedInsuranceDummyRecords` migration must exist; it is one of the 7 expected migration names in the verification test.
- `us_006 task_001_be_xunit_moq_webappfactory.md` — `IntegrationTestBase` and `DatabaseAvailableFactAttribute` must exist; verification tests extend these.

## Impacted Components
- `/api/Program.cs` — MODIFY: add `MigrateAsync()` call with Serilog instrumentation between `StartupGuard.ValidateEnvironment()` and `app.Run()`
- `/api.tests/Schema/MigrationVerificationTests.cs` — CREATE: integration test asserting `__EFMigrationsHistory` completeness and zero pending migrations

## Implementation Plan

1. **Add `MigrateAsync()` to `Program.cs`** (AC-3, EC-2, EC-3 — startup order matters):
   ```csharp
   // In Program.cs — AFTER StartupGuard.ValidateEnvironment() and AFTER app.Build(), BEFORE app.Run()
   // DR-014: apply all pending migrations automatically on startup in every environment.

   var logger = app.Services.GetRequiredService<ILogger<Program>>();

   await using (var scope = app.Services.CreateAsyncScope())
   {
       var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
       try
       {
           logger.LogInformation(
               "[Startup] Applying pending EF Core migrations. " +
               "Concurrent instances will block on a PostgreSQL advisory lock until this completes.");

           await db.Database.MigrateAsync();

           logger.LogInformation("[Startup] All EF Core migrations applied successfully.");
       }
       catch (Exception ex)
       {
           // Log migration failure with the variable name, NOT the connection string value (EC-3 / OWASP A07)
           logger.LogCritical(ex,
               "[Startup] EF Core migration failed. " +
               "Verify DATABASE_URL is correct and the PostgreSQL instance is reachable.");
           throw;   // Rethrow — prevents app from starting with an unmigrated schema
       }
   }
   ```
   Design decisions:
   - The `using` scope ensures `ApplicationDbContext` is disposed after migration; no scope leak.
   - `throw` after `LogCritical` prevents the application from serving traffic with an unmigrated schema (fail-fast principle).
   - The connection string value is NEVER logged — only the variable name (OWASP A07).
   - EC-2 (advisory lock): `MigrateAsync()` internally uses `pg_try_advisory_lock` in Npgsql/EF Core; no additional code is needed, but the startup log note documents this for operators.

2. **Verify startup order in `Program.cs`** — the call sequence must be:
   ```
   1. builder.Build() → produces `app`
   2. StartupGuard.ValidateEnvironment()    ← EC-3: env vars checked first
   3. await db.Database.MigrateAsync()     ← AC-3: migrations applied
   4. app.Run()                            ← traffic starts
   ```
   If `StartupGuard.ValidateEnvironment()` is currently called before `builder.Build()`, move the migration call to after `app = builder.Build()`.

3. **Create `Schema/MigrationVerificationTests.cs`** in `api.tests` (AC-3, AC-4):
   ```csharp
   using Api.Data;
   using Api.Tests.Infrastructure;
   using Microsoft.EntityFrameworkCore;
   using Microsoft.Extensions.DependencyInjection;

   namespace Api.Tests.Schema;

   /// <summary>
   /// Regression guard for EP-DATA-I migration completeness.
   /// Fails CI if any expected migration is missing or unapplied (AC-3 / AC-4).
   /// Uses [DatabaseAvailableFact] — skips gracefully when no DATABASE_URL is set (EC-3).
   /// </summary>
   public class MigrationVerificationTests : IntegrationTestBase
   {
       // All 7 expected EP-DATA-I migrations in application order.
       // Update this list whenever a new migration is added — the test will fail CI
       // until both the migration file AND this list are updated together.
       private static readonly string[] ExpectedMigrations =
       [
           "InitialCreate",
           "UsersEntity",
           "AppointmentSlotAndAppointment",
           "WaitlistAndNotifications",
           "PatientIntakes",
           "SeedInsuranceDummyRecords",
       ];

       [DatabaseAvailableFact]
       public async Task AllEpDataIMigrations_AreApplied_InEFMigrationsHistory()
       {
           // AC-3: assert __EFMigrationsHistory contains all expected migrations
           var appliedMigrations = await DbContext.Database
               .GetAppliedMigrationsAsync();

           foreach (var expected in ExpectedMigrations)
           {
               Assert.True(
                   appliedMigrations.Any(m => m.Contains(expected, StringComparison.OrdinalIgnoreCase)),
                   $"Expected migration '{expected}' was not found in __EFMigrationsHistory. " +
                   $"Run 'dotnet ef database update' to apply pending migrations.");
           }
       }

       [DatabaseAvailableFact]
       public async Task NoPendingMigrations_ExistInTestDatabase()
       {
           // AC-4: regression guard — zero pending migrations after full EP-DATA-I set is applied.
           // This test fails CI if a developer adds a migration file without applying it.
           var pending = await DbContext.Database.GetPendingMigrationsAsync();

           Assert.True(
               !pending.Any(),
               $"Found {pending.Count()} pending migration(s): {string.Join(", ", pending)}. " +
               $"Run 'dotnet ef database update --project api/Api.csproj' to apply them.");
       }
   }
   ```

4. **Add `GetAppliedMigrationsAsync()` extension awareness** — EF Core provides this via `DatabaseFacade`:
   ```csharp
   // GetAppliedMigrationsAsync() is available in Microsoft.EntityFrameworkCore namespace
   // and queries SELECT "MigrationId" FROM "__EFMigrationsHistory".
   // If the table does not exist (fresh DB), EF Core returns an empty list.
   // Ensure the test database has MigrateAsync() called before the verification test runs.
   ```
   Note: `IntegrationTestBase.InitializeAsync()` calls `WebApplicationFactory<Program>` which runs `MigrateAsync()` at startup (step 1). So by the time `MigrationVerificationTests` methods execute, all migrations are already applied.

5. **Update the expected migrations list format** — EF Core stores `MigrationId` as `<timestamp>_<name>` (e.g., `20260421120000_UsersEntity`). The `Contains` check in the test uses `OrdinalIgnoreCase` substring matching to avoid hardcoding timestamps:
   ```csharp
   appliedMigrations.Any(m => m.Contains(expected, StringComparison.OrdinalIgnoreCase))
   ```
   This is intentionally flexible: the migration file timestamp prefix changes per environment/developer, but the descriptive name suffix is stable.

6. **Confirm `StartupGuard` prevents `MigrateAsync()` on missing env vars** (EC-3):
   `StartupGuard.ValidateEnvironment()` (established in us_002, extended in us_007 for `PHI_ENCRYPTION_KEY`) throws `InvalidOperationException` before `MigrateAsync()` is reached. Verify the method includes `DATABASE_URL` in its required variables list (added in us_004). No code changes needed here — this is a verification step.

   The Serilog critical log in step 1 provides the operator-friendly message:
   ```
   [Startup] EF Core migration failed. Verify DATABASE_URL is correct and the PostgreSQL instance is reachable.
   ```
   No connection string value ever appears in logs (OWASP A07).

7. **Register the `MigrationVerificationTests` file** — no additional DI or configuration needed; `IntegrationTestBase` provides `DbContext` scoped to the test instance. The test will be discovered automatically by `dotnet test`.

## Current Project State
```
/api/
├── Program.cs                           # us_002/us_004: WILL BE MODIFIED
└── Infrastructure/Startup/StartupGuard.cs  # has DATABASE_URL, JWT_SIGNING_KEY, PHI_ENCRYPTION_KEY

/api.tests/
├── Infrastructure/
│   ├── IntegrationTestBase.cs           # us_006: exists
│   └── DatabaseAvailableFactAttribute.cs # us_006: exists
├── Smoke/HealthEndpointTests.cs         # us_006: exists
├── Unit/AppointmentRepositoryMockTests.cs # us_006: exists
└── Schema/                              # NOT YET CREATED — created by this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `/api/Program.cs` | Add `await db.Database.MigrateAsync()` in async scope after `StartupGuard.ValidateEnvironment()` and before `app.Run()`; Serilog `LogInformation` before + after; `LogCritical` + rethrow on failure; never log connection string value |
| CREATE | `/api.tests/Schema/MigrationVerificationTests.cs` | `AllEpDataIMigrations_AreApplied_InEFMigrationsHistory` (asserts 6 migration names in `__EFMigrationsHistory` via `GetAppliedMigrationsAsync()`); `NoPendingMigrations_ExistInTestDatabase` (asserts empty `GetPendingMigrationsAsync()`) |

## External References
- `context.Database.MigrateAsync()` — apply pending migrations: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying?tabs=dotnet-core-cli#apply-migrations-at-runtime
- `GetAppliedMigrationsAsync()`: https://learn.microsoft.com/en-us/dotnet/api/microsoft.entityframeworkcore.infrastructure.databasefacade.getappliedmigrationsasync
- `GetPendingMigrationsAsync()`: https://learn.microsoft.com/en-us/dotnet/api/microsoft.entityframeworkcore.infrastructure.databasefacade.getpendingmigrationsasync
- PostgreSQL advisory lock (`pg_try_advisory_lock`) in EF Core migration: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying#ef-core-migration-lock
- DR-014: auto-apply migrations — `.propel/context/docs/design.md#DR-014`
- OWASP A07 (identification and authentication failures / sensitive data in logs): https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/

## Build Commands
```bash
# Build after Program.cs changes
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet build api/Api.csproj --configuration Debug

# Run migration verification tests (requires live database)
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet test api.tests/Api.Tests.csproj \
  --filter "FullyQualifiedName~MigrationVerification" \
  --logger "console;verbosity=normal"

# Run full test suite — confirm no regressions
dotnet test api.tests/Api.Tests.csproj --configuration Release \
  --logger "junit;LogFilePath=../test-results/api-tests.xml"
```

## Implementation Validation Strategy
- [ ] `dotnet run --project api/Api.csproj` with all env vars set and a fresh DB: Serilog output shows `[Startup] Applying pending EF Core migrations.` then `[Startup] All EF Core migrations applied successfully.`
- [ ] `dotnet run` with `DATABASE_URL` unset: `StartupGuard.ValidateEnvironment()` throws before the migration log entry appears — confirms EC-3 ordering
- [ ] `NoPendingMigrations_ExistInTestDatabase` passes with all 6 migrations applied; adding a dummy migration file without running `update` causes the test to fail (regression guard working)
- [ ] `AllEpDataIMigrations_AreApplied_InEFMigrationsHistory` passes and lists all 6 expected names; removing one migration from the expected list would NOT affect the DB (test-only change)
- [ ] Connection string value NEVER appears in Serilog output — only `DATABASE_URL` variable name appears in error messages
- [ ] Two concurrent `dotnet run` processes starting simultaneously both log `applying migrations` but only one actually runs migrations; the second logs `0 pending migrations` after the lock is released

## Implementation Checklist
- [ ] Modify `Program.cs`: add `await using (var scope = app.Services.CreateAsyncScope())` block containing `db.Database.MigrateAsync()`; place AFTER `StartupGuard.ValidateEnvironment()` and BEFORE `app.Run()`
- [ ] Add `logger.LogInformation("[Startup] Applying pending EF Core migrations...")` before `MigrateAsync()`
- [ ] Add `logger.LogInformation("[Startup] All EF Core migrations applied successfully.")` after `MigrateAsync()`
- [ ] Add `catch (Exception ex)` block: `logger.LogCritical(ex, "[Startup] EF Core migration failed. Verify DATABASE_URL...")` then `throw`; never include connection string value in message
- [ ] Create `api.tests/Schema/MigrationVerificationTests.cs`: extends `IntegrationTestBase`; uses `[DatabaseAvailableFact]` on both methods
- [ ] `AllEpDataIMigrations_AreApplied_InEFMigrationsHistory`: calls `GetAppliedMigrationsAsync()`; asserts each of 6 migration name substrings is present
- [ ] `NoPendingMigrations_ExistInTestDatabase`: calls `GetPendingMigrationsAsync()`; asserts empty collection with failure message listing the pending migration names
- [ ] Run `dotnet test --filter MigrationVerification` with live database — both tests pass
