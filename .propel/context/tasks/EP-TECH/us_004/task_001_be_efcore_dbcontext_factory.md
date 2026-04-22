---
title: "Task — EF Core 9 + Npgsql Provider Install, ApplicationDbContext, Design-Time Factory & dotnet-ef CLI"
task_id: task_001
story_id: us_004
epic: EP-TECH
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_004] — EF Core 9 Database Migration Framework Setup
- Story Location: `.propel/context/tasks/EP-TECH/us_004/us_004.md`
- Acceptance Criteria:
  - AC-1: EF Core 9 + Npgsql added to `/api`; `dotnet ef migrations add InitialCreate` generates a timestamped migration in `/api/Migrations/` with valid `Up()` and `Down()` methods, zero compilation errors
  - AC-4: After a manual `ALTER TABLE` on the live database, `dotnet ef migrations add CheckDrift` detects schema divergence and generates a capturing migration
  - AC-5: `dotnet ef migrations list` lists all applied migrations with timestamps; zero pending after `dotnet ef database update`
  - AC-6: EF design-time factory reads the connection string exclusively from `DATABASE_URL`; throws `InvalidOperationException("DATABASE_URL environment variable is required for migrations")` when not set — no hardcoded fallback
  - Edge Case 1: Concurrent migration conflict → CI `dotnet ef migrations script --idempotent` fails on merge conflict; developers must merge the first migration and re-generate before proceeding

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
| EF Tools | dotnet-ef (global tool) | 9.x |
| Design-Time | Microsoft.EntityFrameworkCore.Design | 9.x |
| Database | PostgreSQL | 16 |
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
Install EF Core 9 with the Npgsql provider and design-time tools into the `/api` project. Create `ApplicationDbContext` as the single root `DbContext` (no entity sets yet — added in feature epics). Implement `ApplicationDbContextFactory` (implementing `IDesignTimeDbContextFactory<ApplicationDbContext>`) so that `dotnet ef` commands read the connection string exclusively from the `DATABASE_URL` environment variable and throw a descriptive `InvalidOperationException` if it is absent. Register the `DbContext` in `Program.cs` via `AddDbContext<ApplicationDbContext>()`. Install `dotnet-ef` as a global tool pinned to the EF Core 9 version and document the setup in a `tools/dotnet-tools.json` local manifest.

## Dependent Tasks
- `us_002 task_001_be_dotnet_api_scaffold.md` — `/api/Api.csproj` and `Program.cs` must exist.
- `us_003 task_001_infra_docker_compose_services.md` — PostgreSQL must be accessible at the `DATABASE_URL` for command validation.

## Impacted Components
- `/api/Api.csproj` — MODIFY: add EF Core + Npgsql + Design NuGet packages
- `/api/Program.cs` — MODIFY: register `AddDbContext<ApplicationDbContext>()`
- `/api/Data/ApplicationDbContext.cs` — CREATE: root `DbContext` with Npgsql and pgvector configuration
- `/api/Data/ApplicationDbContextFactory.cs` — CREATE: `IDesignTimeDbContextFactory<ApplicationDbContext>` reading `DATABASE_URL`
- `/.config/dotnet-tools.json` — CREATE (or MODIFY if exists): local tool manifest pinning `dotnet-ef@9.*`
- `/api/dotnet-ef.version` — CREATE: documents the EF tools version for CI alignment

## Implementation Plan

1. **Add NuGet packages**:
   ```bash
   cd /api
   dotnet add package Microsoft.EntityFrameworkCore --version 9.*
   dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL --version 9.*
   dotnet add package Microsoft.EntityFrameworkCore.Design --version 9.*
   ```
   `Microsoft.EntityFrameworkCore.Design` is a build-time dependency only — mark it with `<PrivateAssets>all</PrivateAssets>` and `<IncludeAssets>runtime; build; native; contentfiles; analyzers</IncludeAssets>` in `Api.csproj` to prevent it from flowing into the published output.

2. **Install `dotnet-ef` global/local tool**:
   ```bash
   # Local tool manifest (preferred for reproducible CI)
   dotnet new tool-manifest --output .   # creates /.config/dotnet-tools.json at repo root
   dotnet tool install dotnet-ef --version 9.*
   ```
   After this, any developer or CI agent can restore tools with `dotnet tool restore` from the repo root.

3. **Create `Data/ApplicationDbContext.cs`**:
   ```csharp
   using Microsoft.EntityFrameworkCore;
   
   namespace Api.Data;
   
   public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
       : DbContext(options)
   {
       // Entity DbSet<T> properties are added in feature epics
       // Example (placeholder comment only — do not add entities here):
       // public DbSet<Patient> Patients => Set<Patient>();
   
       protected override void OnModelCreating(ModelBuilder modelBuilder)
       {
           base.OnModelCreating(modelBuilder);
           // pgvector extension: handled in the InitialCreate migration (not here)
           // Per-entity configuration registered via IEntityTypeConfiguration<T> pattern
           modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
       }
   }
   ```
   Using the primary constructor (`DbContextOptions` parameter) — idiomatic EF Core 9 pattern.

4. **Create `Data/ApplicationDbContextFactory.cs`** — design-time factory:
   ```csharp
   using Microsoft.EntityFrameworkCore;
   using Microsoft.EntityFrameworkCore.Design;
   using Npgsql.EntityFrameworkCore.PostgreSQL;
   
   namespace Api.Data;
   
   /// <summary>
   /// IDesignTimeDbContextFactory used exclusively by dotnet-ef CLI commands.
   /// Reads the connection string from DATABASE_URL environment variable.
   /// Never falls back to a hardcoded connection string (NFR-018 / AC-6).
   /// </summary>
   public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
   {
       public ApplicationDbContext CreateDbContext(string[] args)
       {
           var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL");
           if (string.IsNullOrWhiteSpace(connectionString))
               throw new InvalidOperationException(
                   "DATABASE_URL environment variable is required for migrations");
   
           var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
           optionsBuilder.UseNpgsql(connectionString, npgsqlOpts =>
               npgsqlOpts.UseVector());           // enable pgvector extension support in provider
   
           return new ApplicationDbContext(optionsBuilder.Options);
       }
   }
   ```

5. **Register `DbContext` in `Program.cs`**:
   ```csharp
   var connectionString = builder.Configuration["DATABASE_URL"]
       ?? Environment.GetEnvironmentVariable("DATABASE_URL")
       ?? throw new InvalidOperationException("DATABASE_URL environment variable is required");
   
   builder.Services.AddDbContext<ApplicationDbContext>(opts =>
       opts.UseNpgsql(connectionString, npgsqlOpts =>
           npgsqlOpts.UseVector()));
   ```
   Note: `StartupGuard.ValidateEnvironment()` (us_002 task_001) already validates `DATABASE_URL` presence at the top of `Program.cs` — this registration can rely on that pre-validated value.

6. **Verify design-time factory works** by running:
   ```bash
   DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
   dotnet ef dbcontext info --project api/Api.csproj
   ```
   Expected: outputs `Provider name: Npgsql.EntityFrameworkCore.PostgreSQL` and `Database name: patientaccess` without errors.

7. **Document the CI idempotent script convention** for EC-1:
   Add a comment in `/.config/dotnet-tools.json` (or a `CONTRIBUTING.md` section) noting that the CI migration lint command is:
   ```bash
   dotnet ef migrations script --idempotent --output /tmp/migration-lint.sql
   ```
   This command fails if there are merge conflicts in the migration snapshot file, enforcing the rule that concurrent migrations must be resolved before merge.

## Current Project State
```
/api/
├── Api.csproj                  # us_002 task_001: net9.0 webapi; us_002 task_002: Serilog/Scalar; us_002 task_003: JwtBearer
├── Program.cs                  # us_002: DI, Serilog, JWT, StartupGuard, port 5000
├── Data/                       # NOT YET CREATED — created by this task
├── Infrastructure/
│   ├── StartupGuard.cs
│   ├── Middleware/
│   └── OpenApi/
└── Features/
    └── Shared/
        └── Controllers/HealthController.cs
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `/api/Api.csproj` | Add `Microsoft.EntityFrameworkCore 9.*`, `Npgsql.EntityFrameworkCore.PostgreSQL 9.*`, `Microsoft.EntityFrameworkCore.Design 9.*` (Design marked `PrivateAssets=all`) |
| MODIFY | `/api/Program.cs` | Register `AddDbContext<ApplicationDbContext>()` with `UseNpgsql().UseVector()` using `DATABASE_URL` |
| CREATE | `/api/Data/ApplicationDbContext.cs` | Root `DbContext`; `ApplyConfigurationsFromAssembly()` for future entity configs; no entity sets yet |
| CREATE | `/api/Data/ApplicationDbContextFactory.cs` | `IDesignTimeDbContextFactory<ApplicationDbContext>`; reads `DATABASE_URL`; throws `InvalidOperationException` if absent |
| CREATE | `/.config/dotnet-tools.json` | Local tool manifest: `dotnet-ef@9.*` pinned for reproducible CI |

## External References
- EF Core 9 getting started with ASP.NET Core: https://learn.microsoft.com/en-us/ef/core/get-started/aspnetcore/new-db?tabs=netcore-cli
- `IDesignTimeDbContextFactory<TContext>` — design-time factory pattern: https://learn.microsoft.com/en-us/ef/core/cli/dbcontext-creation?tabs=dotnet-core-cli#from-a-design-time-factory
- Npgsql EF Core provider (v9) — UseNpgsql + UseVector: https://www.npgsql.org/efcore/
- pgvector support in Npgsql EF Core: https://github.com/pgvector/pgvector-dotnet
- dotnet local tool manifest: https://learn.microsoft.com/en-us/dotnet/core/tools/local-tools-how-to-use
- `dotnet ef migrations script --idempotent`: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying?tabs=dotnet-core-cli#sql-scripts

## Build Commands
```bash
# Add NuGet packages
cd api
dotnet add package Microsoft.EntityFrameworkCore --version 9.*
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL --version 9.*
dotnet add package Microsoft.EntityFrameworkCore.Design --version 9.*

# Install dotnet-ef local tool
cd ..
dotnet new tool-manifest --output .
dotnet tool install dotnet-ef --version 9.*

# Restore tools (CI command)
dotnet tool restore

# Verify design-time factory
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
dotnet ef dbcontext info --project api/Api.csproj

# Build (must exit 0)
dotnet build api/Api.csproj --configuration Release

# Verify DATABASE_URL guard: run without env var — must throw InvalidOperationException
dotnet ef dbcontext info --project api/Api.csproj
# Expected: InvalidOperationException: DATABASE_URL environment variable is required for migrations
```

## Implementation Validation Strategy
- [ ] `dotnet build api/Api.csproj --configuration Release` exits 0 with zero warnings
- [ ] `dotnet ef dbcontext info` with `DATABASE_URL` set outputs `Provider name: Npgsql.EntityFrameworkCore.PostgreSQL`
- [ ] `dotnet ef dbcontext info` without `DATABASE_URL` throws `InvalidOperationException: DATABASE_URL environment variable is required for migrations`
- [ ] `dotnet tool restore` restores `dotnet-ef@9.*` from `/.config/dotnet-tools.json` on a clean machine
- [ ] `dotnet ef migrations script --idempotent` executes without error against the configured database

## Implementation Checklist
- [ ] Add `Microsoft.EntityFrameworkCore 9.*`, `Npgsql.EntityFrameworkCore.PostgreSQL 9.*`, `Microsoft.EntityFrameworkCore.Design 9.*` to `Api.csproj`
- [ ] Mark `Microsoft.EntityFrameworkCore.Design` with `PrivateAssets=all` in `Api.csproj`
- [ ] Create `/.config/dotnet-tools.json` local manifest with `dotnet-ef@9.*`
- [ ] Create `Data/ApplicationDbContext.cs`: primary constructor, `ApplyConfigurationsFromAssembly()`, no entity sets
- [ ] Create `Data/ApplicationDbContextFactory.cs`: `IDesignTimeDbContextFactory<ApplicationDbContext>`, reads `DATABASE_URL`, throws `InvalidOperationException` with exact message if absent, calls `UseNpgsql().UseVector()`
- [ ] Register `AddDbContext<ApplicationDbContext>()` with `UseNpgsql().UseVector()` in `Program.cs`
- [ ] Run `dotnet ef dbcontext info` — confirm provider = Npgsql without errors
- [ ] Run `dotnet build` — confirm zero errors
