---
title: "Task — ASP.NET Core Identity + BCrypt ApplicationUser Entity + EF Identity Migration"
task_id: task_001
story_id: us_005
epic: EP-TECH
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_005] — JWT Authentication Infrastructure (Identity + BCrypt + Redis Blocklist)
- Story Location: `.propel/context/tasks/EP-TECH/us_005/us_005.md`
- Acceptance Criteria:
  - AC-5: Registered user account persisted with `password_hash` column containing a BCrypt hash (work factor ≥ 12); plaintext password must not appear in any log, error message, database field, or HTTP response
  - Edge Case 2: JWT signing key missing from environment variables → `InvalidOperationException("JWT_SIGNING_KEY environment variable is required")` thrown during startup configuration validation; no default or hardcoded key used

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
| Identity | Microsoft.AspNetCore.Identity.EntityFrameworkCore | 9.x |
| Password Hashing | BCrypt.Net-Next | 4.x |
| ORM | Entity Framework Core | 9.x |
| DB Provider | Npgsql.EntityFrameworkCore.PostgreSQL | 9.x |
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
Install `Microsoft.AspNetCore.Identity.EntityFrameworkCore` and `BCrypt.Net-Next`. Create the `ApplicationUser` entity extending `IdentityUser`, add the three application roles (`Patient`, `Staff`, `Admin`) as seeded `IdentityRole` constants. Update `ApplicationDbContext` to extend `IdentityDbContext<ApplicationUser>` and generate the `AddIdentityTables` EF Core migration that creates the ASP.NET Identity schema tables in PostgreSQL. Configure Identity in `Program.cs` to use BCrypt as the password hasher (work factor ≥ 12) and replace the default `IPasswordHasher<ApplicationUser>` with a BCrypt implementation. Validate the startup `JWT_SIGNING_KEY` guard (EC-2) is present in `StartupGuard.ValidateEnvironment()`.

## Dependent Tasks
- `us_002 task_001_be_dotnet_api_scaffold.md` — `Program.cs`, `Api.csproj` must exist.
- `us_004 task_001_be_efcore_dbcontext_factory.md` — `ApplicationDbContext` must exist and be registered before Identity can extend it.
- `us_004 task_002_be_efcore_initial_migration.md` — `InitialCreate` migration must exist so `AddIdentityTables` has a known baseline.

## Impacted Components
- `/api/Api.csproj` — MODIFY: add `Microsoft.AspNetCore.Identity.EntityFrameworkCore 9.*`, `BCrypt.Net-Next 4.*`
- `/api/Data/ApplicationDbContext.cs` — MODIFY: change base class from `DbContext` to `IdentityDbContext<ApplicationUser>`
- `/api/Features/Auth/Models/ApplicationUser.cs` — CREATE: `ApplicationUser : IdentityUser` with application-specific properties
- `/api/Features/Auth/Models/AppRoles.cs` — CREATE: static constants for role names (`Patient`, `Staff`, `Admin`)
- `/api/Infrastructure/Identity/BcryptPasswordHasher.cs` — CREATE: `IPasswordHasher<ApplicationUser>` implementation using BCrypt work factor ≥ 12
- `/api/Program.cs` — MODIFY: register `AddIdentity<ApplicationUser, IdentityRole>()`, replace `IPasswordHasher` with BCrypt, add `JWT_SIGNING_KEY` guard to startup validation
- `/api/Infrastructure/StartupGuard.cs` — MODIFY: add `JWT_SIGNING_KEY` presence check

## Implementation Plan

1. **Add NuGet packages**:
   ```bash
   cd /api
   dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore --version 9.*
   dotnet add package BCrypt.Net-Next --version 4.*
   ```

2. **Create `Features/Auth/Models/ApplicationUser.cs`**:
   ```csharp
   using Microsoft.AspNetCore.Identity;

   namespace Api.Features.Auth.Models;

   public class ApplicationUser : IdentityUser
   {
       public string FirstName { get; set; } = string.Empty;
       public string LastName  { get; set; } = string.Empty;
       public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
       public DateTimeOffset? LastLoginAt { get; set; }
       // Note: No PHI fields on ApplicationUser — clinical/patient data lives in feature entities
   }
   ```

3. **Create `Features/Auth/Models/AppRoles.cs`** — role name constants:
   ```csharp
   namespace Api.Features.Auth.Models;

   public static class AppRoles
   {
       public const string Patient = "Patient";
       public const string Staff   = "Staff";
       public const string Admin   = "Admin";

       public static readonly IReadOnlyList<string> All = [Patient, Staff, Admin];
   }
   ```

4. **Update `Data/ApplicationDbContext.cs`** — change base class:
   ```csharp
   using Api.Features.Auth.Models;
   using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
   using Microsoft.EntityFrameworkCore;

   namespace Api.Data;

   public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
       : IdentityDbContext<ApplicationUser>(options)
   {
       protected override void OnModelCreating(ModelBuilder modelBuilder)
       {
           base.OnModelCreating(modelBuilder);   // must call base — registers Identity tables
           modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
       }
   }
   ```
   `IdentityDbContext<ApplicationUser>` registers all ASP.NET Identity tables (`AspNetUsers`, `AspNetRoles`, `AspNetUserRoles`, etc.) via EF Core conventions.

5. **Create `Infrastructure/Identity/BcryptPasswordHasher.cs`** — replaces the default PBKDF2 hasher:
   ```csharp
   using BCrypt.Net;
   using Microsoft.AspNetCore.Identity;
   using Api.Features.Auth.Models;

   namespace Api.Infrastructure.Identity;

   public class BcryptPasswordHasher : IPasswordHasher<ApplicationUser>
   {
       private const int WorkFactor = 12;  // ≥ 12 per AC-5

       public string HashPassword(ApplicationUser user, string password)
       {
           // Validate at boundary — plaintext password must not be logged or stored
           ArgumentException.ThrowIfNullOrWhiteSpace(password);
           return BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);
       }

       public PasswordVerificationResult VerifyHashedPassword(
           ApplicationUser user, string hashedPassword, string providedPassword)
       {
           ArgumentException.ThrowIfNullOrWhiteSpace(providedPassword);
           return BCrypt.Net.BCrypt.Verify(providedPassword, hashedPassword)
               ? PasswordVerificationResult.Success
               : PasswordVerificationResult.Failed;
       }
   }
   ```
   Note: `ArgumentException.ThrowIfNullOrWhiteSpace` is called before any logging code path — the plaintext `password` value never reaches Serilog (AC-5 compliance).

6. **Register Identity in `Program.cs`**:
   ```csharp
   builder.Services
       .AddIdentity<ApplicationUser, IdentityRole>(opts =>
       {
           opts.Password.RequiredLength         = 12;
           opts.Password.RequireDigit            = true;
           opts.Password.RequireUppercase        = true;
           opts.Password.RequireNonAlphanumeric  = true;
           opts.Lockout.MaxFailedAccessAttempts  = 5;
           opts.Lockout.DefaultLockoutTimeSpan   = TimeSpan.FromMinutes(15);
           opts.User.RequireUniqueEmail           = true;
       })
       .AddEntityFrameworkStores<ApplicationDbContext>()
       .AddDefaultTokenProviders();

   // Replace default PBKDF2 hasher with BCrypt (work factor ≥ 12 per AC-5)
   builder.Services.AddScoped<IPasswordHasher<ApplicationUser>, BcryptPasswordHasher>();
   ```
   `AddIdentity` must be called before `AddAuthentication().AddJwtBearer()` (configured in task_002) to prevent cookie auth defaults from overriding JWT defaults.

7. **Update `Infrastructure/StartupGuard.cs`** — add `JWT_SIGNING_KEY` validation (EC-2):
   ```csharp
   public static void ValidateEnvironment()
   {
       var dbUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
       if (string.IsNullOrWhiteSpace(dbUrl))
           throw new InvalidOperationException(
               "DATABASE_URL environment variable is required");

       var jwtKey = Environment.GetEnvironmentVariable("JWT_SIGNING_KEY");
       if (string.IsNullOrWhiteSpace(jwtKey))
           throw new InvalidOperationException(
               "JWT_SIGNING_KEY environment variable is required");
   }
   ```

8. **Generate the `AddIdentityTables` EF Core migration**:
   ```bash
   DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
   dotnet ef migrations add AddIdentityTables \
     --project api/Api.csproj --output-dir Migrations
   ```
   This generates the DDL for all 7 ASP.NET Identity tables.

## Current Project State
```
/api/
├── Api.csproj                       # us_002 + us_004 packages; EF Core 9, Npgsql
├── Program.cs                       # us_002: JWT stub, Serilog; us_004: AddDbContext — WILL BE MODIFIED
├── Data/
│   ├── ApplicationDbContext.cs      # us_004: extends DbContext — WILL BE MODIFIED
│   └── ApplicationDbContextFactory.cs
├── Migrations/
│   ├── <ts>_InitialCreate.cs        # us_004
│   └── ApplicationDbContextModelSnapshot.cs
└── Infrastructure/
    └── StartupGuard.cs              # us_002: DATABASE_URL guard — WILL BE MODIFIED
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `/api/Api.csproj` | Add `Microsoft.AspNetCore.Identity.EntityFrameworkCore 9.*`, `BCrypt.Net-Next 4.*` |
| CREATE | `/api/Features/Auth/Models/ApplicationUser.cs` | `ApplicationUser : IdentityUser` with `FirstName`, `LastName`, `CreatedAt`, `LastLoginAt`; no PHI |
| CREATE | `/api/Features/Auth/Models/AppRoles.cs` | Static role name constants: `Patient`, `Staff`, `Admin` |
| MODIFY | `/api/Data/ApplicationDbContext.cs` | Change base class to `IdentityDbContext<ApplicationUser>`; keep `ApplyConfigurationsFromAssembly()` |
| CREATE | `/api/Infrastructure/Identity/BcryptPasswordHasher.cs` | `IPasswordHasher<ApplicationUser>` with BCrypt work factor 12; plaintext never logged |
| MODIFY | `/api/Program.cs` | Register `AddIdentity<ApplicationUser, IdentityRole>()` + `IPasswordHasher` override |
| MODIFY | `/api/Infrastructure/StartupGuard.cs` | Add `JWT_SIGNING_KEY` null/empty check (EC-2) |
| CREATE | `/api/Migrations/<ts>_AddIdentityTables.cs` | EF migration creating 7 ASP.NET Identity schema tables |

## External References
- ASP.NET Core Identity with EF Core: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity?view=aspnetcore-9.0
- `IdentityDbContext<TUser>` — custom user entity: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/customize-identity-model?view=aspnetcore-9.0
- BCrypt.Net-Next NuGet (work factor documentation): https://www.nuget.org/packages/BCrypt.Net-Next
- `IPasswordHasher<TUser>` — replacing the default hasher: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-custom-storage-providers?view=aspnetcore-9.0#the-password-hasher
- OWASP Password Storage Cheat Sheet (bcrypt work factor ≥ 10 recommendation): https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

## Build Commands
```bash
# Add packages
cd api
dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore --version 9.*
dotnet add package BCrypt.Net-Next --version 4.*

# Build (must exit 0)
dotnet build --configuration Release

# Generate Identity tables migration
cd ..
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
dotnet ef migrations add AddIdentityTables --project api/Api.csproj --output-dir Migrations

# Apply migrations
DATABASE_URL="..." dotnet ef database update --project api/Api.csproj

# Verify Identity tables created
docker compose exec postgres psql -U devuser -d patientaccess \
  -c "\dt AspNet*"
# Expected: AspNetUsers, AspNetRoles, AspNetUserRoles, AspNetUserClaims, AspNetUserLogins, AspNetUserTokens, AspNetRoleClaims

# Test startup JWT_SIGNING_KEY guard
dotnet run --project api/Api.csproj
# Expected: InvalidOperationException: JWT_SIGNING_KEY environment variable is required
```

## Implementation Validation Strategy
- [ ] `dotnet build --configuration Release` exits 0 with zero warnings
- [ ] `dotnet run` without `JWT_SIGNING_KEY` throws `InvalidOperationException: JWT_SIGNING_KEY environment variable is required` before `app.Run()`
- [ ] `dotnet ef migrations add AddIdentityTables` generates migration with DDL for all 7 Identity tables
- [ ] `dotnet ef database update` applies `AddIdentityTables`; `\dt AspNet*` in psql lists all 7 tables
- [ ] `ApplicationDbContext` resolves from DI with no errors when `DATABASE_URL` is set
- [ ] `BcryptPasswordHasher.HashPassword()` returns a BCrypt hash string starting with `$2b$12$` (work factor 12)

## Implementation Checklist
- [ ] Add `Microsoft.AspNetCore.Identity.EntityFrameworkCore 9.*` and `BCrypt.Net-Next 4.*` to `Api.csproj`
- [ ] Create `Features/Auth/Models/ApplicationUser.cs`: `ApplicationUser : IdentityUser` with non-PHI fields only
- [ ] Create `Features/Auth/Models/AppRoles.cs`: static constants `Patient`, `Staff`, `Admin`
- [ ] Update `Data/ApplicationDbContext.cs`: change base class to `IdentityDbContext<ApplicationUser>`
- [ ] Create `Infrastructure/Identity/BcryptPasswordHasher.cs`: `IPasswordHasher<ApplicationUser>` with `WorkFactor = 12`; `ArgumentException.ThrowIfNullOrWhiteSpace` before any processing
- [ ] Register `AddIdentity<ApplicationUser, IdentityRole>()` in `Program.cs` with password/lockout policy
- [ ] Replace `IPasswordHasher` with `BcryptPasswordHasher` via `AddScoped` in `Program.cs`
- [ ] Update `StartupGuard.ValidateEnvironment()` to check `JWT_SIGNING_KEY` (EC-2)
- [ ] Run `dotnet ef migrations add AddIdentityTables` — confirm migration generated
- [ ] Run `dotnet build` — confirm zero errors
