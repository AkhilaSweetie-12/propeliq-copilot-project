---
title: "Task — JWT Authentication Middleware + Health Stub Endpoint + HTTP 405 & p95 Latency Baseline"
task_id: task_003
story_id: us_002
epic: EP-TECH
layer: Backend
status: Not Started
date: 2026-04-20
---

# Task - task_003

## Requirement Reference
- User Story: [us_002] — ASP.NET Core 9 Web API Scaffold with Modular Feature Folders
- Story Location: `.propel/context/tasks/EP-TECH/us_002/us_002.md`
- Acceptance Criteria:
  - AC-3: 50 sequential requests to the stub health endpoint all respond within 2 seconds p95, establishing the NFR-001 baseline
  - AC-4: A `[Authorize]`-protected endpoint returns HTTP 401 Unauthorized with `WWW-Authenticate: Bearer` header before handler logic executes; no stack trace is leaked in the response body
  - Edge Case 3: Calling an endpoint with an unsupported HTTP method (e.g., `PATCH` on a `GET`-only endpoint) returns HTTP 405 Method Not Allowed with an `Allow` header listing valid methods; no unhandled exception is thrown

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
| Authentication | Microsoft.AspNetCore.Authentication.JwtBearer | 9.x |
| Configuration | Microsoft.Extensions.Configuration | 9.x |
| Load tool (validation only) | dotnet-load / curl loop | N/A |
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
Install and configure JWT Bearer authentication in `Program.cs` using `AddAuthentication().AddJwtBearer()` with the correct middleware order (`UseAuthentication()` before `UseAuthorization()`). Implement a global exception handler that suppresses stack traces from all error responses. Create a stub `GET /api/health` endpoint (no auth required) returning a structured JSON health object, and a `GET /api/health/protected` endpoint (with `[Authorize]`) to validate HTTP 401 behaviour. Document the p95 latency baseline for NFR-001 by running 50 sequential requests against `/api/health` and recording response times. HTTP 405 behaviour is provided out-of-the-box by ASP.NET Core's routing engine when `[HttpGet]` decorators are used — validate this is active and add a test entry to the validation strategy.

## Dependent Tasks
- `task_001_be_dotnet_api_scaffold.md` — `/api` project, `Program.cs`, and feature folder structure must exist.
- `task_002_be_serilog_openapi_config.md` — Serilog must be configured before the exception handler middleware can log structured error events.

## Impacted Components
- `/api/Api.csproj` — MODIFY: add `Microsoft.AspNetCore.Authentication.JwtBearer`
- `/api/Program.cs` — MODIFY: add `AddAuthentication().AddJwtBearer()`, `UseAuthentication()`, `UseAuthorization()`, global exception handler
- `/api/appsettings.json` — MODIFY: add `Jwt` configuration section (Issuer, Audience — no signing key in config; key from env var only)
- `/api/Features/Shared/Controllers/HealthController.cs` — CREATE: `GET /api/health` (no auth) + `GET /api/health/protected` (`[Authorize]`)
- `/api/Infrastructure/Middleware/GlobalExceptionHandlerMiddleware.cs` — CREATE: suppress stack traces, return RFC 7807 `ProblemDetails` with correlation ID

## Implementation Plan

1. **Add NuGet packages**:
   ```bash
   cd /api
   dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer --version 9.*
   ```

2. **Configure `appsettings.json`** — add `Jwt` section (issuer and audience only; signing key is read from `JWT_SIGNING_KEY` environment variable at runtime — never stored in config files):
   ```json
   {
     "Jwt": {
       "Issuer": "https://api.patient-access.local",
       "Audience": "patient-access-spa"
     }
   }
   ```

3. **Configure JWT Bearer authentication in `Program.cs`**:
   ```csharp
   var jwtSigningKey = builder.Configuration["JWT_SIGNING_KEY"]
       ?? Environment.GetEnvironmentVariable("JWT_SIGNING_KEY")
       ?? throw new InvalidOperationException(
           "JWT_SIGNING_KEY environment variable is required");
   
   builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
       .AddJwtBearer(opts =>
       {
           opts.TokenValidationParameters = new TokenValidationParameters
           {
               ValidateIssuer            = true,
               ValidIssuer               = builder.Configuration["Jwt:Issuer"],
               ValidateAudience          = true,
               ValidAudience             = builder.Configuration["Jwt:Audience"],
               ValidateLifetime          = true,
               ValidateIssuerSigningKey  = true,
               IssuerSigningKey          = new SymmetricSecurityKey(
                   Encoding.UTF8.GetBytes(jwtSigningKey)),
               ClockSkew                 = TimeSpan.FromSeconds(30)
           };
           opts.Events = new JwtBearerEvents
           {
               OnChallenge = ctx =>
               {
                   // Suppress default challenge response to prevent stack-trace leakage
                   ctx.HandleResponse();
                   ctx.Response.StatusCode  = StatusCodes.Status401Unauthorized;
                   ctx.Response.Headers.WWWAuthenticate = "Bearer";
                   ctx.Response.ContentType = "application/problem+json";
                   return ctx.Response.WriteAsync("""
                       {"type":"https://tools.ietf.org/html/rfc7235#section-3.1",
                        "title":"Unauthorized","status":401,
                        "detail":"A valid Bearer token is required"}
                       """);
               }
           };
       });
   builder.Services.AddAuthorization();
   ```

4. **Correct middleware order in `Program.cs`** (middleware must be in this exact sequence):
   ```csharp
   app.UseGlobalExceptionHandler();  // Step 5 — must be first
   app.UseSerilogRequestLogging();   // task_002
   app.UseHttpsRedirection();
   app.UseAuthentication();          // must precede UseAuthorization
   app.UseAuthorization();
   app.MapControllers();
   ```

5. **Create `Infrastructure/Middleware/GlobalExceptionHandlerMiddleware.cs`** — catches all unhandled exceptions, logs them via Serilog, and returns RFC 7807 `ProblemDetails` with a `traceId` (no stack trace):
   ```csharp
   using Microsoft.AspNetCore.Mvc;
   using Serilog;
   
   namespace Api.Infrastructure.Middleware;
   
   public class GlobalExceptionHandlerMiddleware(RequestDelegate next)
   {
       public async Task InvokeAsync(HttpContext ctx)
       {
           try { await next(ctx); }
           catch (Exception ex)
           {
               Log.Error(ex, "Unhandled exception on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
               ctx.Response.StatusCode  = StatusCodes.Status500InternalServerError;
               ctx.Response.ContentType = "application/problem+json";
               var problem = new ProblemDetails
               {
                   Type    = "https://tools.ietf.org/html/rfc7807",
                   Title   = "An unexpected error occurred",
                   Status  = 500,
                   Detail  = "An internal error occurred. Please retry or contact support.",
                   Extensions = { ["traceId"] = ctx.TraceIdentifier }
               };
               await ctx.Response.WriteAsJsonAsync(problem);
           }
       }
   }
   
   public static class GlobalExceptionHandlerMiddlewareExtensions
   {
       public static IApplicationBuilder UseGlobalExceptionHandler(this IApplicationBuilder app)
           => app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
   }
   ```
   Note: `ex.Message` and `ex.StackTrace` are intentionally excluded from the response body (OWASP A05 — Security Misconfiguration).

6. **Create `Features/Shared/Controllers/HealthController.cs`**:
   ```csharp
   using Api.Features.Shared.Controllers;
   using Microsoft.AspNetCore.Authorization;
   using Microsoft.AspNetCore.Mvc;
   
   namespace Api.Features.Shared.Controllers;
   
   [Route("api/health")]
   public class HealthController : ApiControllerBase
   {
       [HttpGet]
       [AllowAnonymous]
       [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
       public IActionResult GetHealth() =>
           Ok(new HealthResponse("healthy", DateTimeOffset.UtcNow));
   
       [HttpGet("protected")]
       [Authorize]
       [ProducesResponseType(StatusCodes.Status200OK)]
       [ProducesResponseType(StatusCodes.Status401Unauthorized)]
       public IActionResult GetProtectedHealth() =>
           Ok(new HealthResponse("healthy-authenticated", DateTimeOffset.UtcNow));
   }
   
   public record HealthResponse(string Status, DateTimeOffset Timestamp);
   ```
   The `[HttpGet]` (and no `[HttpPatch]`) decorator means ASP.NET Core's routing engine automatically returns HTTP 405 with an `Allow: GET` header for any other method — no custom code required (EC-3).

7. **Record p95 latency baseline** for NFR-001: after the server is running, execute 50 sequential `curl` requests to `GET /api/health` and record elapsed times. The median and p95 must be ≤ 2000 ms. Document actual measurements in the task validation notes.
   ```bash
   for i in $(seq 1 50); do
     curl -o /dev/null -s -w "%{time_total}\n" http://localhost:5000/api/health
   done | sort -n | awk 'NR==48{print "p95:", $0 "s"}'
   ```
   Expected output with in-process stub: p95 < 50ms (well within 2s NFR-001 baseline).

## Current Project State
```
/api/
├── Api.csproj               # task_001: net9.0 webapi; task_002: Serilog/Scalar packages
├── Program.cs               # task_001: AddControllers, StartupGuard; task_002: Serilog, OpenAPI — WILL BE MODIFIED
├── appsettings.json         # task_001 + task_002: Serilog section — WILL BE MODIFIED
├── Infrastructure/
│   ├── StartupGuard.cs      # task_001
│   └── OpenApi/             # task_002
│       ├── ApiControllerDocumentFilter.cs
│       └── OpenApiStartupValidator.cs
└── Features/
    └── Shared/
        ├── Controllers/ApiControllerBase.cs   # task_001
        └── Models/ApiResponse.cs             # task_001
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `/api/Api.csproj` | Add `Microsoft.AspNetCore.Authentication.JwtBearer 9.*` |
| MODIFY | `/api/Program.cs` | Add `AddAuthentication().AddJwtBearer()`, `AddAuthorization()`, correct middleware order: `UseGlobalExceptionHandler` → `UseAuthentication` → `UseAuthorization` |
| MODIFY | `/api/appsettings.json` | Add `Jwt` section with `Issuer` and `Audience` (no signing key) |
| CREATE | `/api/Infrastructure/Middleware/GlobalExceptionHandlerMiddleware.cs` | Exception handler suppressing stack traces; returns RFC 7807 `ProblemDetails` with `traceId` |
| CREATE | `/api/Features/Shared/Controllers/HealthController.cs` | `GET /api/health` (`[AllowAnonymous]`) + `GET /api/health/protected` (`[Authorize]`) |

## External References
- ASP.NET Core 9 JWT Bearer authentication setup: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/jwt-authn?view=aspnetcore-9.0
- `JwtBearerEvents.OnChallenge` for custom 401 response: https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.authentication.jwtbearer.jwtbearereventsx?view=aspnetcore-9.0
- ASP.NET Core middleware ordering (UseAuthentication before UseAuthorization): https://learn.microsoft.com/en-us/aspnet/core/security/authorization/introduction?view=aspnetcore-9.0
- ASP.NET Core problem details (RFC 7807): https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling?view=aspnetcore-9.0#problem-details
- HTTP 405 Method Not Allowed — routing engine behaviour: https://learn.microsoft.com/en-us/aspnet/core/web-api/?view=aspnetcore-9.0#automatic-http-405-errors
- NFR-001 source: `design.md` — p95 API latency ≤ 2 seconds under 100 concurrent users

## Build Commands
```bash
# Add JWT Bearer package
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer --version 9.*

# Build
dotnet build --configuration Release

# Run server (requires DATABASE_URL + JWT_SIGNING_KEY)
DATABASE_URL="Host=localhost;Database=dev;Username=dev;Password=dev" \
JWT_SIGNING_KEY="dev-signing-key-minimum-32-chars-long!" \
dotnet run

# Test HTTP 401 on protected endpoint (no token)
curl -v http://localhost:5000/api/health/protected
# Expected: HTTP/1.1 401 Unauthorized
# Expected header: WWW-Authenticate: Bearer

# Test HTTP 405 on health endpoint with wrong method
curl -v -X PATCH http://localhost:5000/api/health
# Expected: HTTP/1.1 405 Method Not Allowed
# Expected header: Allow: GET

# p95 baseline (50 sequential requests)
for i in $(seq 1 50); do curl -o /dev/null -s -w "%{time_total}\n" http://localhost:5000/api/health; done \
  | sort -n | awk 'NR==48{print "p95:", $0 "s"}'
```

## Implementation Validation Strategy
- [ ] `curl http://localhost:5000/api/health` returns HTTP 200 with `{"status":"healthy","timestamp":"..."}`
- [ ] `curl -v http://localhost:5000/api/health/protected` (no token) returns HTTP 401 with `WWW-Authenticate: Bearer` header; response body is RFC 7807 JSON with no stack trace or exception details
- [ ] `curl -v -X PATCH http://localhost:5000/api/health` returns HTTP 405 with `Allow: GET` header; no unhandled exception thrown
- [ ] 50-request p95 loop returns all responses < 2000ms (NFR-001 baseline established)
- [ ] Triggering an unhandled exception in a controller returns HTTP 500 with `ProblemDetails` JSON; `dotnet run` console shows no raw exception stack trace in the response
- [ ] `dotnet build --configuration Release` exits 0

## Implementation Checklist
- [ ] Add `Microsoft.AspNetCore.Authentication.JwtBearer 9.*` NuGet package
- [ ] Read `JWT_SIGNING_KEY` from environment variable (not from `appsettings.json`) — throw `InvalidOperationException` if missing
- [ ] Configure `AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer()` with `TokenValidationParameters` (ValidateIssuer, ValidateAudience, ValidateLifetime, ValidateIssuerSigningKey)
- [ ] Add `JwtBearerEvents.OnChallenge` to return HTTP 401 + `WWW-Authenticate: Bearer` header with RFC 7807 JSON body (no stack trace)
- [ ] Add `builder.Services.AddAuthorization()`
- [ ] Add `Jwt:Issuer` and `Jwt:Audience` to `appsettings.json` (no signing key in file)
- [ ] Create `Infrastructure/Middleware/GlobalExceptionHandlerMiddleware.cs` — logs to Serilog, returns `ProblemDetails` with `traceId`, no stack trace in response
- [ ] Register `UseGlobalExceptionHandler()` as the first middleware in the pipeline (before `UseSerilogRequestLogging`)
- [ ] Place `UseAuthentication()` before `UseAuthorization()` in middleware pipeline
- [ ] Create `Features/Shared/Controllers/HealthController.cs` with `GET /api/health` (`[AllowAnonymous]`) and `GET /api/health/protected` (`[Authorize]`)
- [ ] Run `dotnet build` — confirm zero errors
