---
title: "Task — Enhanced /api/health Endpoint with PostgreSQL, Redis & Ollama Connectivity Checks"
task_id: task_003
story_id: us_003
epic: EP-TECH
layer: Backend
status: Not Started
date: 2026-04-20
---

# Task - task_003

## Requirement Reference
- User Story: [us_003] — GitHub Codespaces DevContainer & Full Service Stack Setup
- Story Location: `.propel/context/tasks/EP-TECH/us_003/us_003.md`
- Acceptance Criteria:
  - AC-5: `GET /api/health` returns HTTP 200 with a JSON body confirming database connectivity (PostgreSQL), cache connectivity (Redis), and AI model availability (Ollama); satisfies the 99.9% uptime monitoring baseline (NFR-011)

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
| Health Checks | Microsoft.Extensions.Diagnostics.HealthChecks | 9.x |
| DB Client | Npgsql | 8.x |
| Cache Client | StackExchange.Redis | 2.x |
| HTTP Client | System.Net.Http.HttpClient (built-in) | 9.x |
| AI/ML | N/A | N/A |
| Vector Store | N/A | N/A |
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
Extend the `GET /api/health` endpoint from us_002 task_003 to perform real dependency health checks: a PostgreSQL connection attempt (using `Npgsql`), a Redis `PING` (using `StackExchange.Redis`), and an HTTP `GET http://localhost:11434/api/tags` to verify Ollama model availability. Use ASP.NET Core's built-in `IHealthChecksBuilder` to register each check, and map the health check report to a structured JSON response body (status per dependency + overall status). The endpoint remains `[AllowAnonymous]` (no JWT required) and must respond within 2 seconds even when a downstream service is degraded (checked with individual timeouts).

## Dependent Tasks
- `us_002 task_001_be_dotnet_api_scaffold.md` — `/api` project and `HealthController.cs` base must exist.
- `us_002 task_003_be_auth_middleware_health.md` — `GET /api/health` endpoint scaffold must exist; this task extends it.
- `us_003 task_001_infra_docker_compose_services.md` — compose services must be defined; this task checks their connectivity.

## Impacted Components
- `/api/Api.csproj` — MODIFY: add `Npgsql`, `StackExchange.Redis`, `AspNetCore.HealthChecks.NpgSql`, `AspNetCore.HealthChecks.Redis` NuGet packages
- `/api/Program.cs` — MODIFY: register `AddHealthChecks()` with Npgsql, Redis, and Ollama checks; map `/api/health` to the health endpoint using `MapHealthChecks()`
- `/api/Features/Shared/Controllers/HealthController.cs` — MODIFY: replace simple `Ok()` response with `IHealthCheckService`-derived structured JSON; or remove manual implementation and delegate to `MapHealthChecks` middleware response writer
- `/api/Infrastructure/Health/OllamaHealthCheck.cs` — CREATE: custom `IHealthCheck` implementation calling `GET /api/tags` on the Ollama service

## Implementation Plan

1. **Add NuGet packages**:
   ```bash
   cd /api
   dotnet add package Npgsql --version 8.*
   dotnet add package StackExchange.Redis --version 2.*
   dotnet add package AspNetCore.HealthChecks.NpgSql --version 8.*
   dotnet add package AspNetCore.HealthChecks.Redis --version 8.*
   ```
   The `Microsoft.Extensions.Diagnostics.HealthChecks` framework is bundled with ASP.NET Core 9.

2. **Register health checks in `Program.cs`**:
   ```csharp
   builder.Services.AddHealthChecks()
       .AddNpgSql(
           connectionString: builder.Configuration["DATABASE_URL"]
               ?? Environment.GetEnvironmentVariable("DATABASE_URL")
               ?? throw new InvalidOperationException("DATABASE_URL is required"),
           name: "postgres",
           tags: ["db", "ready"],
           timeout: TimeSpan.FromSeconds(5))
       .AddRedis(
           redisConnectionString: builder.Configuration["REDIS_URL"]
               ?? Environment.GetEnvironmentVariable("REDIS_URL")
               ?? "redis://localhost:6379",
           name: "redis",
           tags: ["cache", "ready"],
           timeout: TimeSpan.FromSeconds(3))
       .AddCheck<OllamaHealthCheck>(
           name: "ollama",
           tags: ["ai", "ready"],
           timeout: TimeSpan.FromSeconds(5));
   
   // Register HttpClient for OllamaHealthCheck
   builder.Services.AddHttpClient<OllamaHealthCheck>(client =>
   {
       var ollamaBase = builder.Configuration["OLLAMA_BASE_URL"]
           ?? Environment.GetEnvironmentVariable("OLLAMA_BASE_URL")
           ?? "http://localhost:11434";
       client.BaseAddress = new Uri(ollamaBase);
       client.Timeout = TimeSpan.FromSeconds(5);
   });
   ```

3. **Map health check endpoint in `Program.cs`** with a custom JSON response writer:
   ```csharp
   app.MapHealthChecks("/api/health", new HealthCheckOptions
   {
       AllowCachingResponses = false,
       ResponseWriter = WriteHealthCheckResponse
   });
   
   // Remove or redirect the manual HealthController GET /api/health to avoid duplicate routing
   // Option A: Remove the [HttpGet] method from HealthController (keeping /api/health/protected)
   // Option B: Keep HealthController.GetHealth() as the fallback and redirect via HealthCheckOptions
   // Recommended: Option A — delegate /api/health entirely to the ASP.NET Core health middleware
   ```

4. **Implement custom JSON response writer** as a static method or a separate class in `Infrastructure/Health/`:
   ```csharp
   using Microsoft.Extensions.Diagnostics.HealthChecks;
   
   namespace Api.Infrastructure.Health;
   
   public static class HealthCheckResponseWriter
   {
       public static async Task WriteHealthCheckResponse(
           HttpContext context,
           HealthReport report)
       {
           context.Response.ContentType = "application/json; charset=utf-8";
   
           var response = new
           {
               status = report.Status.ToString().ToLowerInvariant(),
               totalDurationMs = report.TotalDuration.TotalMilliseconds,
               checks = report.Entries.Select(e => new
               {
                   name = e.Key,
                   status = e.Value.Status.ToString().ToLowerInvariant(),
                   description = e.Value.Description,
                   durationMs = e.Value.Duration.TotalMilliseconds
                   // Note: exception details are intentionally excluded (OWASP A05)
               }),
               timestamp = DateTimeOffset.UtcNow
           };
   
           await context.Response.WriteAsJsonAsync(response);
       }
   }
   ```
   This returns a structure such as:
   ```json
   {
     "status": "healthy",
     "totalDurationMs": 45.3,
     "checks": [
       { "name": "postgres", "status": "healthy", "durationMs": 12.1 },
       { "name": "redis",    "status": "healthy", "durationMs": 8.4  },
       { "name": "ollama",   "status": "healthy", "durationMs": 24.8 }
     ],
     "timestamp": "2026-04-20T10:00:00Z"
   }
   ```

5. **Create `Infrastructure/Health/OllamaHealthCheck.cs`** — custom health check for Ollama:
   ```csharp
   using Microsoft.Extensions.Diagnostics.HealthChecks;
   
   namespace Api.Infrastructure.Health;
   
   public class OllamaHealthCheck(HttpClient httpClient) : IHealthCheck
   {
       public async Task<HealthCheckResult> CheckHealthAsync(
           HealthCheckContext context,
           CancellationToken cancellationToken = default)
       {
           try
           {
               var response = await httpClient.GetAsync("/api/tags", cancellationToken);
               if (!response.IsSuccessStatusCode)
                   return HealthCheckResult.Degraded(
                       $"Ollama returned HTTP {(int)response.StatusCode}");
   
               var body = await response.Content.ReadAsStringAsync(cancellationToken);
               // Check at least one model is available
               if (!body.Contains("\"models\""))
                   return HealthCheckResult.Degraded("Ollama is running but no models are loaded");
   
               return HealthCheckResult.Healthy("Ollama is running and models are available");
           }
           catch (HttpRequestException ex)
           {
               // Log only the type — no exception details in health response (OWASP A05)
               return HealthCheckResult.Unhealthy(
                   "Cannot connect to Ollama service",
                   exception: null,     // suppress exception from response
                   data: new Dictionary<string, object> { ["hint"] = ex.GetType().Name });
           }
           catch (TaskCanceledException)
           {
               return HealthCheckResult.Unhealthy("Ollama health check timed out");
           }
       }
   }
   ```

6. **Update `HealthController.cs`** — remove the `GET /api/health` action (now handled by `MapHealthChecks`) but keep the `[Authorize]`-protected `GET /api/health/protected` stub:
   ```csharp
   [Route("api/health")]
   public class HealthController : ApiControllerBase
   {
       // GET /api/health is now served by MapHealthChecks middleware — removed from controller
   
       [HttpGet("protected")]
       [Authorize]
       [ProducesResponseType(StatusCodes.Status200OK)]
       [ProducesResponseType(StatusCodes.Status401Unauthorized)]
       public IActionResult GetProtectedHealth() =>
           Ok(new { status = "authenticated" });
   }
   ```

7. **Verify response time under degraded conditions**: with a stopped Postgres container, the health endpoint must still return within 2 seconds (timeout is set to 5s per check, but they run in parallel — total wall-clock time = max(individual timeout) ≤ 5s, well within the 2s NFR target for the healthy case and gracefully degraded for the unhealthy case).

## Current Project State
```
/api/
├── Api.csproj                    # us_002 task_001 + task_002 packages
├── Program.cs                    # us_002 task_001/002/003: DI, Serilog, JWT, port 5000
├── Features/Shared/Controllers/
│   └── HealthController.cs       # us_002 task_003: GET /api/health + /api/health/protected — WILL BE MODIFIED
└── Infrastructure/
    ├── StartupGuard.cs
    ├── Middleware/
    │   └── GlobalExceptionHandlerMiddleware.cs
    └── OpenApi/
        ├── ApiControllerDocumentFilter.cs
        └── OpenApiStartupValidator.cs
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `/api/Api.csproj` | Add NuGet: `Npgsql 8.*`, `StackExchange.Redis 2.*`, `AspNetCore.HealthChecks.NpgSql 8.*`, `AspNetCore.HealthChecks.Redis 8.*` |
| MODIFY | `/api/Program.cs` | Register `AddHealthChecks()` with Npgsql, Redis, and Ollama checks; map `MapHealthChecks("/api/health")` with custom JSON response writer |
| MODIFY | `/api/Features/Shared/Controllers/HealthController.cs` | Remove `GET /api/health` action (delegated to middleware); keep `GET /api/health/protected` |
| CREATE | `/api/Infrastructure/Health/OllamaHealthCheck.cs` | Custom `IHealthCheck` calling `GET /api/tags`; returns `Healthy`/`Degraded`/`Unhealthy` with no exception detail in response |
| CREATE | `/api/Infrastructure/Health/HealthCheckResponseWriter.cs` | Static class with custom JSON response writer: per-check status + duration, no stack traces |

## External References
- ASP.NET Core health checks overview: https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks?view=aspnetcore-9.0
- `AspNetCore.HealthChecks.NpgSql` NuGet: https://www.nuget.org/packages/AspNetCore.HealthChecks.NpgSql
- `AspNetCore.HealthChecks.Redis` NuGet: https://www.nuget.org/packages/AspNetCore.HealthChecks.Redis
- Custom `IHealthCheck` implementation: https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks?view=aspnetcore-9.0#create-health-checks
- Custom health check response writer: https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks?view=aspnetcore-9.0#customize-the-http-status-code
- Ollama REST API `/api/tags`: https://github.com/ollama/ollama/blob/main/docs/api.md#list-local-models
- NFR-011 source: `design.md` — 99.9% uptime baseline; health endpoint is the monitoring probe

## Build Commands
```bash
# Add health check packages
dotnet add package Npgsql --version 8.*
dotnet add package StackExchange.Redis --version 2.*
dotnet add package AspNetCore.HealthChecks.NpgSql --version 8.*
dotnet add package AspNetCore.HealthChecks.Redis --version 8.*

# Build
dotnet build --configuration Release

# Run and test health endpoint (all services must be running via docker compose)
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
REDIS_URL="redis://localhost:6379" \
OLLAMA_BASE_URL="http://localhost:11434" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet run

# Verify health endpoint returns HTTP 200 with JSON body
curl -s http://localhost:5000/api/health | python3 -m json.tool

# Test degraded scenario: stop postgres, verify health endpoint responds within 5s
docker compose stop postgres
curl -s -w "\nHTTP: %{http_code}\nTime: %{time_total}s\n" http://localhost:5000/api/health
```

## Implementation Validation Strategy
- [ ] `curl http://localhost:5000/api/health` with all services healthy returns HTTP 200 with `"status":"healthy"` and all three check entries (`postgres`, `redis`, `ollama`) showing `"status":"healthy"`
- [ ] `curl http://localhost:5000/api/health` with Postgres stopped returns HTTP 503 (unhealthy) with `"postgres":"unhealthy"` in the JSON — no stack trace or exception detail in the response body
- [ ] `curl http://localhost:5000/api/health` with Ollama container stopped returns HTTP 503 with `"ollama":"unhealthy"` — response arrives in < 6 seconds (Ollama timeout is 5s)
- [ ] `dotnet build --configuration Release` exits 0
- [ ] Serilog logs the health check request via `UseSerilogRequestLogging()` with `RequestPath=/api/health` and correct `StatusCode`

## Implementation Checklist
- [ ] Add `Npgsql 8.*`, `StackExchange.Redis 2.*`, `AspNetCore.HealthChecks.NpgSql 8.*`, `AspNetCore.HealthChecks.Redis 8.*` NuGet packages
- [ ] Register `AddHealthChecks()` in `Program.cs` with `.AddNpgSql()`, `.AddRedis()`, `.AddCheck<OllamaHealthCheck>()`
- [ ] Register `AddHttpClient<OllamaHealthCheck>()` with `BaseAddress` from `OLLAMA_BASE_URL` env var and 5s timeout
- [ ] Map `MapHealthChecks("/api/health")` with `ResponseWriter = HealthCheckResponseWriter.WriteHealthCheckResponse`
- [ ] Create `Infrastructure/Health/OllamaHealthCheck.cs`: `IHealthCheck` using injected `HttpClient`; `GET /api/tags`; returns `Healthy`/`Degraded`/`Unhealthy` with no exception detail
- [ ] Create `Infrastructure/Health/HealthCheckResponseWriter.cs`: structured JSON output (status, per-check name/status/durationMs, timestamp); no stack traces
- [ ] Remove `GET /api/health` action from `HealthController.cs` (delegated to middleware); retain `GET /api/health/protected`
- [ ] Run `dotnet build` — confirm zero errors
- [ ] Verify `curl /api/health` returns `"status":"healthy"` when all docker compose services are running
