---
title: "Task — GitHub Actions CI Stub + p95 Load Baseline Integration Test (NFR-001 / NFR-015)"
task_id: task_003
story_id: us_006
epic: EP-TECH
layer: Infrastructure
status: Not Started
date: 2026-04-21
---

# Task - task_003

## Requirement Reference
- User Story: [us_006] — Test Framework Scaffolding (xUnit + Moq + Playwright)
- Story Location: `.propel/context/tasks/EP-TECH/us_006/us_006.md`
- Acceptance Criteria:
  - AC-4: 100 sequential `GET /api/health` requests via `WebApplicationFactory` test client; all complete HTTP 200; p95 response time < 2 seconds (NFR-001 / NFR-015 baselines)
  - AC-5: CI stub `/.github/workflows/ci.yml`; on PR to `main` runs `dotnet test` + `npx playwright test` (smoke); exits 0 on pass, non-zero on any failure — blocks merge
  - Edge Case 2: Integration test base class skips gracefully when DB unavailable (covered in task_001; CI yaml must pass `DATABASE_URL` secret to test job)

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
| CI Platform | GitHub Actions | — |
| Runtime | ubuntu-latest (GitHub hosted runner) | — |
| .NET SDK | .NET SDK | 9.0 LTS |
| Node.js | Node.js | 20 LTS |
| Test Framework | xUnit | 2.x |
| E2E | Playwright | 1.x |
| Service | PostgreSQL (GitHub Actions service container) | 16 |
| Service | Redis (GitHub Actions service container) | 7 |
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
Create the `/.github/workflows/ci.yml` GitHub Actions workflow that triggers on pull requests targeting `main`. The workflow has two jobs: `api-tests` (runs `dotnet test` with JUnit XML output, using PostgreSQL + Redis service containers) and `e2e-tests` (starts the Vite SPA dev server as a background process, then runs Playwright smoke tests). Create the `Performance/LoadBaselineTests.cs` xUnit integration test class that makes 100 sequential `GET /api/health` requests via `WebApplicationFactory.CreateClient()`, records individual response times, and asserts p95 < 2000ms.

## Dependent Tasks
- `task_001_be_xunit_moq_webappfactory.md` — `IntegrationTestBase` and xUnit project must exist; `LoadBaselineTests` extends it.
- `task_002_fe_playwright_e2e_scaffold.md` — `/e2e` project and smoke test must exist; CI yaml invokes them.

## Impacted Components
- `/.github/workflows/ci.yml` — CREATE: GitHub Actions CI workflow (PR trigger, 2 jobs: api-tests + e2e-tests)
- `/api.tests/Performance/LoadBaselineTests.cs` — CREATE: 100-request p95 baseline test (NFR-001 / NFR-015)

## Implementation Plan

1. **Create `/.github/workflows/ci.yml`**:
   ```yaml
   name: CI

   on:
     pull_request:
       branches: [main]

   jobs:
     api-tests:
       name: API Tests (xUnit)
       runs-on: ubuntu-latest

       services:
         postgres:
           image: pgvector/pgvector:pg16
           env:
             POSTGRES_USER: testuser
             POSTGRES_PASSWORD: testpassword
             POSTGRES_DB: testdb
           ports:
             - 5433:5432
           options: >-
             --health-cmd "pg_isready -U testuser -d testdb"
             --health-interval 10s
             --health-timeout 5s
             --health-retries 10

         redis:
           image: redis:7-alpine
           ports:
             - 6379:6379
           options: >-
             --health-cmd "redis-cli ping"
             --health-interval 10s
             --health-timeout 5s
             --health-retries 5

       env:
         DATABASE_URL: Host=localhost;Port=5433;Database=testdb;Username=testuser;Password=testpassword
         REDIS_URL: redis://localhost:6379
         JWT_SIGNING_KEY: ${{ secrets.CI_JWT_SIGNING_KEY }}   # set in repo secrets

       steps:
         - uses: actions/checkout@v4

         - name: Setup .NET 9
           uses: actions/setup-dotnet@v4
           with:
             dotnet-version: '9.0.x'

         - name: Restore tools
           run: dotnet tool restore

         - name: Restore packages
           run: dotnet restore PatientAccess.sln

         - name: Build
           run: dotnet build PatientAccess.sln --configuration Release --no-restore

         - name: Run migrations
           run: dotnet ef database update --project api/Api.csproj

         - name: Run tests
           run: |
             mkdir -p test-results
             dotnet test api.tests/Api.Tests.csproj \
               --configuration Release \
               --no-build \
               --logger "junit;LogFilePath=../test-results/api-tests.xml" \
               --results-directory test-results

         - name: Upload test results
           if: always()
           uses: actions/upload-artifact@v4
           with:
             name: api-test-results
             path: test-results/api-tests.xml

     e2e-tests:
       name: E2E Tests (Playwright Smoke)
       runs-on: ubuntu-latest
       needs: api-tests    # only run E2E if API tests pass

       steps:
         - uses: actions/checkout@v4

         - name: Setup Node.js 20
           uses: actions/setup-node@v4
           with:
             node-version: '20'
             cache: 'npm'
             cache-dependency-path: 'client/package-lock.json'

         - name: Install SPA dependencies
           run: cd client && npm ci

         - name: Install Playwright browsers
           run: cd e2e && npm ci && npx playwright install chromium --with-deps

         - name: Start SPA dev server (background)
           run: |
             cd client && npm run dev &
             # Wait for Vite to be ready on port 3000
             npx wait-on http://localhost:3000 --timeout 60000

         - name: Run Playwright smoke tests
           run: |
             mkdir -p test-results
             cd e2e && npx playwright test tests/smoke/ \
               --reporter=junit \
               2>&1 | tee ../test-results/e2e-results.xml

         - name: Upload E2E results
           if: always()
           uses: actions/upload-artifact@v4
           with:
             name: e2e-test-results
             path: test-results/e2e-results.xml
   ```

   CI design decisions:
   - `JWT_SIGNING_KEY` is read from a GitHub Actions repository secret (`CI_JWT_SIGNING_KEY`) — never hardcoded in the yaml file (OWASP A02).
   - PostgreSQL and Redis use GitHub Actions `services:` containers — they start before the job steps and are health-checked before test execution.
   - `needs: api-tests` on the e2e job ensures Playwright only runs if the API build passes.
   - `actions/upload-artifact@v4` uploads both JUnit XML files as artifacts for review — available even on failure (`if: always()`).

2. **Add `wait-on` to the SPA dev server start** — install globally or as a dev dependency in the CI environment:
   ```bash
   # In CI e2e-tests job (add to Install Playwright browsers step or as its own step)
   npm install -g wait-on
   ```
   Alternatively, add `"wait-on": "^7.0.0"` to `/e2e/package.json` devDependencies and use `npx wait-on`.

3. **Create `Performance/LoadBaselineTests.cs`** — p95 latency baseline (AC-4):
   ```csharp
   using Api.Tests.Infrastructure;
   using System.Diagnostics;

   namespace Api.Tests.Performance;

   /// <summary>
   /// Establishes the NFR-001 / NFR-015 p95 latency baseline.
   /// 100 sequential GET /api/health requests must all return HTTP 200 with p95 &lt; 2000ms.
   /// This test is intentionally sequential (not parallel) to measure per-request latency,
   /// not throughput, as the load harness for concurrent tests is in the CI load stage.
   /// </summary>
   public class LoadBaselineTests : IntegrationTestBase
   {
       [Fact]
       public async Task HealthEndpoint_100SequentialRequests_P95Under2Seconds()
       {
           const int requestCount  = 100;
           const int p95Threshold  = 2000;   // milliseconds — NFR-001 / NFR-015

           var responseTimes = new List<double>(requestCount);

           for (int i = 0; i < requestCount; i++)
           {
               var sw = Stopwatch.StartNew();
               var response = await Client.GetAsync("/api/health");
               sw.Stop();

               Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
               responseTimes.Add(sw.Elapsed.TotalMilliseconds);
           }

           responseTimes.Sort();
           var p95Index        = (int)Math.Ceiling(requestCount * 0.95) - 1;
           var p95ResponseTime = responseTimes[p95Index];

           // Record p95 in test output for CI baseline tracking
           Console.WriteLine($"[NFR-001] p95 response time: {p95ResponseTime:F2}ms (threshold: {p95Threshold}ms)");

           Assert.True(p95ResponseTime < p95Threshold,
               $"p95 response time {p95ResponseTime:F2}ms exceeds NFR-001 threshold of {p95Threshold}ms");
       }
   }
   ```

4. **Add `CI_JWT_SIGNING_KEY` to GitHub repository secrets**:
   - Go to GitHub repository → Settings → Secrets and variables → Actions → New repository secret
   - Name: `CI_JWT_SIGNING_KEY`
   - Value: a 32+ character random string (development-safe, not the production key)
   - Document this requirement in `CONTRIBUTING.md` or `README.md` under "CI Setup"

5. **Verify `Program.cs` is accessible to `WebApplicationFactory<Program>`** — ensure `Program.cs` is `public` or the assembly is accessible:
   In .NET 9 with minimal API, add to `/api/Program.cs` (or a partial class) to expose `Program` to the test assembly:
   ```csharp
   // At the bottom of Program.cs — makes the generated Program class accessible from test project
   public partial class Program { }
   ```

## Current Project State
```
/
├── api/                         # us_002–us_005: full API with auth, health checks
├── api.tests/                   # task_001: xUnit, Moq, IntegrationTestBase
│   ├── Infrastructure/
│   │   ├── IntegrationTestBase.cs
│   │   └── DatabaseAvailableFactAttribute.cs
│   ├── Smoke/HealthEndpointTests.cs
│   └── Unit/AppointmentRepositoryMockTests.cs
├── client/                      # us_001: React SPA
├── e2e/                         # task_002: Playwright smoke test
│   └── tests/smoke/spa-smoke.spec.ts
└── .github/workflows/           # NOT YET CREATED — created by this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/.github/workflows/ci.yml` | PR-triggered CI: `api-tests` job (dotnet test + JUnit XML + PostgreSQL/Redis services) + `e2e-tests` job (Playwright smoke); non-zero exit on any failure |
| CREATE | `/api.tests/Performance/LoadBaselineTests.cs` | 100 sequential `GET /api/health` requests; p95 recorded and asserted < 2000ms (NFR-001/NFR-015) |
| MODIFY | `/api/Program.cs` | Add `public partial class Program { }` at bottom to expose `Program` to `WebApplicationFactory<Program>` |

## External References
- GitHub Actions — workflow syntax: https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions
- GitHub Actions — service containers (PostgreSQL): https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers
- GitHub Actions — repository secrets: https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions
- `actions/setup-dotnet@v4`: https://github.com/actions/setup-dotnet
- `actions/setup-node@v4`: https://github.com/actions/setup-node
- `wait-on` — wait for port/url to be available: https://github.com/jeffbski/wait-on
- `WebApplicationFactory<TEntryPoint>` — `public partial class Program {}` pattern: https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-9.0#basic-tests-with-the-default-webapplicationfactory
- NFR-001 / NFR-015 source: project `design.md`

## Build Commands
```bash
# Run p95 baseline test locally (requires API running or WebApplicationFactory)
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet test api.tests/Api.Tests.csproj --filter "FullyQualifiedName~LoadBaselineTests" \
  --logger "console;verbosity=normal"

# Validate CI yaml syntax (GitHub CLI)
gh workflow list   # confirms ci.yml is parsed correctly after push

# Run full test suite as CI would
mkdir -p test-results
dotnet test api.tests/Api.Tests.csproj \
  --configuration Release \
  --logger "junit;LogFilePath=../test-results/api-tests.xml"

# Start SPA + run Playwright (simulates CI e2e-tests job)
(cd client && npm run dev) &
npx wait-on http://localhost:3000 --timeout 60000
cd e2e && npx playwright test tests/smoke/
```

## Implementation Validation Strategy
- [ ] `LoadBaselineTests` passes: 100 requests all return HTTP 200; p95 < 2000ms; console output shows `[NFR-001] p95 response time: Xms`
- [ ] `/.github/workflows/ci.yml` is valid YAML; `gh workflow list` shows `CI` workflow after push
- [ ] Opening a test PR to `main` triggers both `api-tests` and `e2e-tests` jobs; both pass (green checkmarks)
- [ ] Introducing a deliberate test failure causes the CI job to exit with non-zero code, blocking merge
- [ ] `test-results/api-tests.xml` and `test-results/e2e-results.xml` are uploaded as CI artifacts
- [ ] `JWT_SIGNING_KEY` secret is never visible in CI logs (masked by GitHub Actions)

## Implementation Checklist
- [ ] Add `public partial class Program { }` at bottom of `/api/Program.cs`
- [ ] Create `/.github/workflows/ci.yml` with `pull_request` trigger on `main`
- [ ] Add `api-tests` job: `setup-dotnet@v4` (9.0.x), `dotnet tool restore`, `dotnet restore`, `dotnet build`, `dotnet ef database update`, `dotnet test --logger junit`, upload artifact
- [ ] Configure PostgreSQL and Redis as `services:` in `api-tests` job with health checks
- [ ] Pass `DATABASE_URL`, `REDIS_URL`, `JWT_SIGNING_KEY` env vars in `api-tests` job (key from `secrets.CI_JWT_SIGNING_KEY`)
- [ ] Add `e2e-tests` job: `setup-node@v4` (20), SPA `npm ci`, Playwright install, `npm run dev &`, `wait-on`, `npx playwright test tests/smoke/`, upload artifact
- [ ] Add `needs: api-tests` to `e2e-tests` job
- [ ] Create `Performance/LoadBaselineTests.cs`: 100 sequential requests, p95 calculation, `Assert.True(p95 < 2000)`
- [ ] Run load baseline test locally — confirm p95 output and assert passes
- [ ] Run `dotnet test` — confirm all existing tests still pass with new `Program` partial class
