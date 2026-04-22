---
title: "Task — xUnit Test Project Scaffold, Moq Integration, WebApplicationFactory Harness & IAsyncLifetime Rollback"
task_id: task_001
story_id: us_006
epic: EP-TECH
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_006] — Test Framework Scaffolding (xUnit + Moq + Playwright)
- Story Location: `.propel/context/tasks/EP-TECH/us_006/us_006.md`
- Acceptance Criteria:
  - AC-1: `/api.tests` xUnit project references `/api`; `dotnet test` discovers all test classes, runs the smoke test suite against an in-memory or Testcontainers PostgreSQL instance, reports all tests passed, outputs JUnit XML at `/test-results/api-tests.xml`
  - AC-2: Moq installed; `new Mock<IAppointmentRepository>()` with `.Setup()` returns configured value in isolation; `mockRepo.Verify()` confirms expected call; no real database connection required
  - AC-6: Integration test `IAsyncLifetime.DisposeAsync()` rolls back the wrapping transaction; database is in pre-test state for next test (pass or fail)
  - Edge Case 2: `DATABASE_URL` absent or unreachable → integration test base class skips with `Skip("Database unavailable — run inside devcontainer")` — no misleading failure
  - Edge Case 3: `WebApplicationFactory` disposed in `IAsyncLifetime.DisposeAsync()` via `using` block — prevents port exhaustion on test failure

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
| Test Framework | xUnit | 2.x |
| Mocking | Moq | 4.x |
| Test Host | Microsoft.AspNetCore.Mvc.Testing | 9.x |
| Test DB | Microsoft.EntityFrameworkCore.InMemory | 9.x |
| Test Logger | xunit.runner.visualstudio | 3.x |
| JUnit Reporter | JunitXml.TestLogger | 3.x |
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
Scaffold the `/api.tests` xUnit project, add a project reference to `/api`, and install Moq, `Microsoft.AspNetCore.Mvc.Testing`, and the JUnit XML test logger. Create the `IntegrationTestBase` class implementing `IAsyncLifetime` with `WebApplicationFactory<Program>` and a per-test transaction rollback pattern. Create a `DatabaseSkipAttribute` helper that skips integration tests when `DATABASE_URL` is absent or unreachable (EC-2). Add one unit smoke test class using Moq, and one integration smoke test that resolves `GET /api/health` against the test factory. Expose `IAppointmentRepository` as a placeholder interface in `/api` (stub — real implementation in feature epics) to demonstrate Moq isolation (AC-2).

## Dependent Tasks
- `us_002 task_001_be_dotnet_api_scaffold.md` — `/api/Api.csproj` and `Program.cs` must exist; `WebApplicationFactory<Program>` targets `Program`.
- `us_004 task_001_be_efcore_dbcontext_factory.md` — `ApplicationDbContext` must be registered in DI for transaction rollback pattern.

## Impacted Components
- `/api.tests/Api.Tests.csproj` — CREATE: xUnit test project referencing `/api`
- `/api.tests/Infrastructure/IntegrationTestBase.cs` — CREATE: `WebApplicationFactory<Program>` + `IAsyncLifetime` + transaction rollback + skip guard
- `/api.tests/Infrastructure/DatabaseSkipAttribute.cs` — CREATE: `[DatabaseSkip]` xUnit attribute skipping tests when DB unavailable
- `/api.tests/Smoke/HealthEndpointTests.cs` — CREATE: smoke integration test for `GET /api/health`
- `/api.tests/Unit/AppointmentRepositoryMockTests.cs` — CREATE: Moq unit test demonstrating `Setup()` + `Verify()`
- `/api/Features/Booking/Services/IAppointmentRepository.cs` — CREATE: placeholder interface for Moq demonstration (stub only)
- `/api.sln` (or root solution file) — MODIFY: add `/api.tests` project to solution

## Implementation Plan

1. **Create the `/api.tests` xUnit project**:
   ```bash
   dotnet new xunit --framework net9.0 --name Api.Tests --output api.tests
   cd api.tests
   dotnet add reference ../api/Api.csproj
   dotnet add package Moq --version 4.*
   dotnet add package Microsoft.AspNetCore.Mvc.Testing --version 9.*
   dotnet add package Microsoft.EntityFrameworkCore.InMemory --version 9.*
   dotnet add package JunitXml.TestLogger --version 3.*
   dotnet add package xunit.runner.visualstudio --version 3.*
   dotnet add package Microsoft.NET.Test.Sdk --version 17.*
   ```

2. **Create stub `IAppointmentRepository` in `/api`** to support the Moq demo (AC-2):
   ```csharp
   // /api/Features/Booking/Services/IAppointmentRepository.cs
   namespace Api.Features.Booking.Services;

   public interface IAppointmentRepository
   {
       Task<IReadOnlyList<string>> GetUpcomingAppointmentIdsAsync(
           string patientId, CancellationToken ct = default);
   }
   ```
   This is a placeholder stub. The real implementation is added in EP-001 (Booking epic).

3. **Create `Infrastructure/DatabaseSkipAttribute.cs`** — xUnit skip helper:
   ```csharp
   using Npgsql;

   namespace Api.Tests.Infrastructure;

   /// <summary>
   /// Skips the test with a friendly message when DATABASE_URL is absent or the database is unreachable.
   /// Prevents CI from failing with a misleading connection error in environments without PostgreSQL.
   /// </summary>
   public class DatabaseAvailableFactAttribute : FactAttribute
   {
       public DatabaseAvailableFactAttribute()
       {
           var url = Environment.GetEnvironmentVariable("DATABASE_URL");
           if (string.IsNullOrWhiteSpace(url))
           {
               Skip = "Database unavailable — run inside devcontainer";
               return;
           }
           try
           {
               using var conn = new NpgsqlConnection(url);
               conn.Open();
           }
           catch
           {
               Skip = "Database unavailable — run inside devcontainer";
           }
       }
   }
   ```
   Usage: replace `[Fact]` with `[DatabaseAvailableFact]` on any test that requires a live database.

4. **Create `Infrastructure/IntegrationTestBase.cs`** — `WebApplicationFactory` + transaction rollback (AC-6):
   ```csharp
   using Api.Data;
   using Microsoft.AspNetCore.Mvc.Testing;
   using Microsoft.EntityFrameworkCore;
   using Microsoft.EntityFrameworkCore.Storage;
   using Microsoft.Extensions.DependencyInjection;

   namespace Api.Tests.Infrastructure;

   /// <summary>
   /// Base class for integration tests. Wraps each test in a transaction rolled back on dispose (AC-6).
   /// WebApplicationFactory is disposed in DisposeAsync — prevents port exhaustion on failure (EC-3).
   /// </summary>
   public abstract class IntegrationTestBase : IAsyncLifetime
   {
       private WebApplicationFactory<Program>? _factory;
       private IServiceScope?                  _scope;
       private IDbContextTransaction?          _transaction;

       protected HttpClient Client { get; private set; } = null!;
       protected ApplicationDbContext DbContext { get; private set; } = null!;

       public async Task InitializeAsync()
       {
           var dbUrl = Environment.GetEnvironmentVariable("DATABASE_URL");

           _factory = new WebApplicationFactory<Program>()
               .WithWebHostBuilder(host =>
               {
                   host.ConfigureServices(services =>
                   {
                       if (string.IsNullOrWhiteSpace(dbUrl))
                       {
                           // Use in-memory database when no DATABASE_URL is set (EC-2)
                           var descriptor = services.SingleOrDefault(
                               d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
                           if (descriptor != null) services.Remove(descriptor);
                           services.AddDbContext<ApplicationDbContext>(opts =>
                               opts.UseInMemoryDatabase($"TestDb_{Guid.NewGuid()}"));
                       }
                   });
               });

           Client  = _factory.CreateClient();
           _scope  = _factory.Services.CreateScope();
           DbContext = _scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

           if (!string.IsNullOrWhiteSpace(dbUrl))
           {
               // Begin wrapping transaction for rollback on dispose (AC-6)
               _transaction = await DbContext.Database.BeginTransactionAsync();
           }
       }

       public async Task DisposeAsync()
       {
           // Roll back transaction — database is in pre-test state for next test (AC-6)
           if (_transaction is not null)
               await _transaction.RollbackAsync();

           _transaction?.Dispose();
           _scope?.Dispose();

           // Dispose WebApplicationFactory — frees ports even on test failure (EC-3)
           if (_factory is not null)
               await _factory.DisposeAsync();
       }
   }
   ```

5. **Create `Smoke/HealthEndpointTests.cs`**:
   ```csharp
   using Api.Tests.Infrastructure;

   namespace Api.Tests.Smoke;

   public class HealthEndpointTests : IntegrationTestBase
   {
       [Fact]
       public async Task GetHealth_ReturnsOk()
       {
           var response = await Client.GetAsync("/api/health");
           Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
       }
   }
   ```

6. **Create `Unit/AppointmentRepositoryMockTests.cs`** — Moq demo (AC-2):
   ```csharp
   using Api.Features.Booking.Services;
   using Moq;

   namespace Api.Tests.Unit;

   public class AppointmentRepositoryMockTests
   {
       [Fact]
       public async Task GetUpcomingAppointmentIds_ReturnsMockedValue()
       {
           // Arrange
           var mockRepo = new Mock<IAppointmentRepository>();
           mockRepo.Setup(r => r.GetUpcomingAppointmentIdsAsync("patient-1", It.IsAny<CancellationToken>()))
                   .ReturnsAsync(["appt-001", "appt-002"]);

           // Act
           var result = await mockRepo.Object.GetUpcomingAppointmentIdsAsync("patient-1");

           // Assert — no real database connection used
           Assert.Equal(2, result.Count);
           Assert.Contains("appt-001", result);
           mockRepo.Verify(r => r.GetUpcomingAppointmentIdsAsync("patient-1", It.IsAny<CancellationToken>()), Times.Once);
       }
   }
   ```

7. **Configure JUnit XML output** via `dotnet test` CLI arguments (no config file changes needed):
   The test logger is invoked via: `dotnet test --logger "junit;LogFilePath=../test-results/api-tests.xml"`
   This is documented in the CI stub (task_003) and the `Build Commands` below.

8. **Create `/api.sln`** (if not already present) and add both projects:
   ```bash
   dotnet new sln --name PatientAccess --output .
   dotnet sln add api/Api.csproj
   dotnet sln add api.tests/Api.Tests.csproj
   ```

## Current Project State
```
/
├── api/                         # us_002–us_005: ASP.NET Core 9 API
├── client/                      # us_001: React SPA
├── docker-compose.yml           # us_003
├── .devcontainer/               # us_003
└── api.tests/                   # NOT YET CREATED — created by this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api.tests/Api.Tests.csproj` | xUnit project; references `../api/Api.csproj`; adds Moq 4, AspNetCore.Mvc.Testing 9, InMemory EF, JunitXml.TestLogger 3 |
| CREATE | `/api.tests/Infrastructure/IntegrationTestBase.cs` | `WebApplicationFactory<Program>` + `IAsyncLifetime`; scoped `ApplicationDbContext`; transaction rollback on dispose; in-memory DB fallback when no `DATABASE_URL` |
| CREATE | `/api.tests/Infrastructure/DatabaseAvailableFactAttribute.cs` | Custom `FactAttribute` that sets `Skip` when `DATABASE_URL` absent or DB unreachable |
| CREATE | `/api.tests/Smoke/HealthEndpointTests.cs` | Integration smoke test: `GET /api/health` → HTTP 200 |
| CREATE | `/api.tests/Unit/AppointmentRepositoryMockTests.cs` | Moq unit test: `Mock<IAppointmentRepository>` + `Setup()` + `Verify()` — no DB |
| CREATE | `/api/Features/Booking/Services/IAppointmentRepository.cs` | Placeholder interface for Moq demo (stub only — implementation in EP-001) |
| CREATE | `/api.sln` | Solution file adding `/api` and `/api.tests` projects |

## External References
- xUnit 2.x — getting started with .NET: https://xunit.net/docs/getting-started/netcore/cmdline
- Moq 4 — Quick Start: https://github.com/devlooped/moq/wiki/Quickstart
- `WebApplicationFactory<TEntryPoint>` — integration test harness: https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-9.0
- `IAsyncLifetime` — xUnit async setup/teardown: https://xunit.net/docs/shared-context#async-lifetime
- JunitXml.TestLogger — NuGet: https://www.nuget.org/packages/JunitXml.TestLogger
- `Microsoft.EntityFrameworkCore.InMemory` — in-memory database for tests: https://learn.microsoft.com/en-us/ef/core/providers/in-memory/?tabs=dotnet-core-cli

## Build Commands
```bash
# Scaffold test project
dotnet new xunit --framework net9.0 --name Api.Tests --output api.tests
cd api.tests
dotnet add reference ../api/Api.csproj
dotnet add package Moq --version 4.*
dotnet add package Microsoft.AspNetCore.Mvc.Testing --version 9.*
dotnet add package Microsoft.EntityFrameworkCore.InMemory --version 9.*
dotnet add package JunitXml.TestLogger --version 3.*
cd ..

# Create solution
dotnet new sln --name PatientAccess --output . --force
dotnet sln add api/Api.csproj
dotnet sln add api.tests/Api.Tests.csproj

# Run all tests (unit + smoke, no DATABASE_URL required for unit tests)
dotnet test api.tests/Api.Tests.csproj --configuration Release

# Run tests with JUnit XML output (AC-1)
mkdir -p test-results
dotnet test api.tests/Api.Tests.csproj \
  --logger "junit;LogFilePath=../test-results/api-tests.xml" \
  --configuration Release

# Run integration tests with live database
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet test api.tests/Api.Tests.csproj \
  --logger "junit;LogFilePath=../test-results/api-tests.xml"
```

## Implementation Validation Strategy
- [ ] `dotnet test api.tests/Api.Tests.csproj` with no env vars: Moq unit test passes; `HealthEndpointTests` passes using in-memory DB; zero test failures
- [ ] `dotnet test` with `--logger "junit;LogFilePath=../test-results/api-tests.xml"` creates `/test-results/api-tests.xml` with valid JUnit XML
- [ ] `AppointmentRepositoryMockTests` passes: `mockRepo.Verify()` confirms `GetUpcomingAppointmentIdsAsync` was called exactly once with `"patient-1"`
- [ ] `IntegrationTestBase.DisposeAsync()` rolls back the transaction; a row written in `InitializeAsync` is absent after dispose (confirmed by querying `DbContext` in a second scope)
- [ ] Without `DATABASE_URL`: `[DatabaseAvailableFact]` tests are skipped with message `"Database unavailable — run inside devcontainer"` — suite exits 0

## Implementation Checklist
- [ ] Scaffold `api.tests` with `dotnet new xunit --framework net9.0`
- [ ] Add project reference to `../api/Api.csproj`
- [ ] Install Moq 4, AspNetCore.Mvc.Testing 9, EF InMemory 9, JunitXml.TestLogger 3, xunit.runner.visualstudio 3
- [ ] Create `IAppointmentRepository` placeholder interface in `/api/Features/Booking/Services/`
- [ ] Create `Infrastructure/DatabaseAvailableFactAttribute.cs` with `Skip` on absent/unreachable DB
- [ ] Create `Infrastructure/IntegrationTestBase.cs`: `WebApplicationFactory<Program>`, transaction wrap, in-memory DB fallback, `DisposeAsync` rollback + factory dispose
- [ ] Create `Smoke/HealthEndpointTests.cs`: `GET /api/health` → HTTP 200
- [ ] Create `Unit/AppointmentRepositoryMockTests.cs`: `Mock<IAppointmentRepository>`, `Setup()`, `Verify()`
- [ ] Create `/api.sln` and add both projects
- [ ] Run `dotnet test` — confirm all tests pass, JUnit XML generated
