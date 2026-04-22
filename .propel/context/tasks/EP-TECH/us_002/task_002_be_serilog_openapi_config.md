---
title: "Task — Serilog Structured Logging with Seq Sink + OpenAPI / Swagger / Scalar Configuration"
task_id: task_002
story_id: us_002
epic: EP-TECH
layer: Backend
status: Not Started
date: 2026-04-20
---

# Task - task_002

## Requirement Reference
- User Story: [us_002] — ASP.NET Core 9 Web API Scaffold with Modular Feature Folders
- Story Location: `.propel/context/tasks/EP-TECH/us_002/us_002.md`
- Acceptance Criteria:
  - AC-1 (partial): Swagger/Scalar OpenAPI UI accessible at `http://localhost:5000/swagger`; all registered endpoints listed in the spec
  - AC-5: Serilog configured with the Seq community server sink; every API request produces a structured log entry containing `RequestMethod`, `RequestPath`, `StatusCode`, `ElapsedMs`, and `TraceId` fields queryable via the Seq UI
  - Edge Case 2: Startup-time Swagger validation step emits a Serilog warning when a controller is missing `[ApiController]`; that controller is excluded from the OpenAPI spec

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
| Logging | Serilog.AspNetCore | 8.x |
| Logging Sink | Serilog.Sinks.Seq | 6.x |
| Logging Enricher | Serilog.Enrichers.TraceIdentifier | 3.x |
| OpenAPI | Microsoft.AspNetCore.OpenApi | 9.x |
| OpenAPI UI | Scalar.AspNetCore | 2.x |
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
Install and configure Serilog with the Seq community sink and the `TraceIdentifier` enricher so that every HTTP request produces a structured log entry with `RequestMethod`, `RequestPath`, `StatusCode`, `ElapsedMs`, and `TraceId`. Configure the OpenAPI pipeline using `Microsoft.AspNetCore.OpenApi` and expose the Scalar UI at `/swagger`. Add a startup-time reflection scan that logs a Serilog warning for each controller missing the `[ApiController]` attribute and excludes those controllers from the generated OpenAPI document, satisfying EC-2.

## Dependent Tasks
- `task_001_be_dotnet_api_scaffold.md` — `/api` project, `Program.cs`, and feature folder structure must exist.

## Impacted Components
- `/api/Api.csproj` — MODIFY: add NuGet package references
- `/api/Program.cs` — MODIFY: add Serilog host bootstrapping, `UseSerilogRequestLogging()`, OpenAPI/Scalar middleware
- `/api/appsettings.json` — MODIFY: add `Serilog` config section + Seq server URL
- `/api/appsettings.Development.json` — MODIFY: override Seq server URL for local dev
- `/api/Infrastructure/OpenApi/OpenApiStartupValidator.cs` — CREATE: reflection-based startup scanner for missing `[ApiController]`

## Implementation Plan

1. **Add NuGet packages**:
   ```bash
   cd /api
   dotnet add package Serilog.AspNetCore --version 8.*
   dotnet add package Serilog.Sinks.Seq --version 6.*
   dotnet add package Serilog.Enrichers.TraceIdentifier --version 3.*
   dotnet add package Scalar.AspNetCore --version 2.*
   ```
   `Microsoft.AspNetCore.OpenApi` is bundled with the ASP.NET Core 9 SDK — no extra NuGet reference needed.

2. **Configure Serilog in `Program.cs`** — replace default logging host at the top of `Program.cs` (before `WebApplication.CreateBuilder()`):
   ```csharp
   using Serilog;
   using Serilog.Enrichers;
   
   Log.Logger = new LoggerConfiguration()
       .ReadFrom.Configuration(new ConfigurationBuilder()
           .AddJsonFile("appsettings.json", optional: false)
           .AddEnvironmentVariables()
           .Build())
       .Enrich.WithTraceIdentifier()
       .CreateBootstrapLogger();
   
   try
   {
       // existing Program.cs body ...
       builder.Host.UseSerilog((ctx, services, config) =>
           config.ReadFrom.Configuration(ctx.Configuration)
                 .ReadFrom.Services(services)
                 .Enrich.WithTraceIdentifier());
   
       // after app.Build():
       app.UseSerilogRequestLogging(opts =>
       {
           opts.EnrichDiagnosticContext = (diagCtx, httpCtx) =>
           {
               diagCtx.Set("RequestHost", httpCtx.Request.Host.Value ?? string.Empty);
               diagCtx.Set("RequestScheme", httpCtx.Request.Scheme);
           };
           opts.MessageTemplate =
               "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
       });
   }
   catch (Exception ex)
   {
       Log.Fatal(ex, "Application startup failed");
   }
   finally
   {
       Log.CloseAndFlush();
   }
   ```
   The `UseSerilogRequestLogging()` middleware emits structured properties: `RequestMethod`, `RequestPath`, `StatusCode`, `Elapsed` (surfaced as `ElapsedMs` in the Seq template), and `TraceId` via the `WithTraceIdentifier()` enricher.

3. **Configure `appsettings.json`** — add Serilog section:
   ```json
   {
     "Serilog": {
       "Using": ["Serilog.Sinks.Seq"],
       "MinimumLevel": {
         "Default": "Information",
         "Override": {
           "Microsoft": "Warning",
           "System": "Warning",
           "Microsoft.AspNetCore": "Warning"
         }
       },
       "WriteTo": [
         { "Name": "Console" },
         {
           "Name": "Seq",
           "Args": { "serverUrl": "http://localhost:5341" }
         }
       ],
       "Enrich": ["FromLogContext", "WithMachineName", "WithThreadId", "WithTraceIdentifier"],
       "Properties": {
         "Application": "Api"
       }
     }
   }
   ```

4. **Configure OpenAPI / Scalar** in `Program.cs`:
   ```csharp
   builder.Services.AddEndpointsApiExplorer();
   builder.Services.AddOpenApi();         // Microsoft.AspNetCore.OpenApi (ASP.NET Core 9 built-in)
   builder.Services.AddSwaggerGen(opts =>  // still needed for Scalar to consume spec
   {
       opts.SwaggerDoc("v1", new() { Title = "Patient Access API", Version = "v1" });
       // Exclude controllers missing [ApiController] — resolved by document filter (Step 5)
       opts.DocumentFilter<ApiControllerDocumentFilter>();
   });
   
   // Middleware (in Development only):
   if (app.Environment.IsDevelopment())
   {
       app.UseSwagger();
       app.MapScalarApiReference(opts =>
       {
           opts.Title = "Patient Access API";
           opts.Route = "/swagger";          // keeps URL consistent with AC-1
       });
   }
   ```

5. **Create `Infrastructure/OpenApi/ApiControllerDocumentFilter.cs`** — Swashbuckle document filter that excludes controllers missing `[ApiController]` and emits a Serilog warning:
   ```csharp
   using Microsoft.AspNetCore.Mvc;
   using Microsoft.OpenApi.Models;
   using Serilog;
   using Swashbuckle.AspNetCore.SwaggerGen;
   using System.Reflection;
   
   namespace Api.Infrastructure.OpenApi;
   
   public class ApiControllerDocumentFilter : IDocumentFilter
   {
       public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
       {
           var assembly = Assembly.GetExecutingAssembly();
           var invalidControllers = assembly.GetTypes()
               .Where(t => typeof(Microsoft.AspNetCore.Mvc.ControllerBase).IsAssignableFrom(t)
                        && !t.IsAbstract
                        && !t.IsDefined(typeof(ApiControllerAttribute), inherit: true))
               .ToList();
   
           foreach (var ctrl in invalidControllers)
           {
               Log.Warning(
                   "Controller {ControllerName} is missing [ApiController] attribute and has been excluded from the OpenAPI spec",
                   ctrl.FullName);
   
               // Remove all paths registered by this controller from the spec
               var pathsToRemove = context.ApiDescriptions
                   .Where(d => d.ActionDescriptor.RouteValues.TryGetValue("controller", out var ctrlName)
                             && string.Equals(ctrlName,
                                   ctrl.Name.Replace("Controller", string.Empty),
                                   StringComparison.OrdinalIgnoreCase))
                   .SelectMany(d => swaggerDoc.Paths.Keys
                       .Where(k => k.Contains(d.RelativePath ?? string.Empty, StringComparison.OrdinalIgnoreCase)))
                   .Distinct()
                   .ToList();
   
               foreach (var path in pathsToRemove)
                   swaggerDoc.Paths.Remove(path);
           }
       }
   }
   ```

6. **Create `Infrastructure/OpenApi/OpenApiStartupValidator.cs`** — called from `StartupGuard.ValidateEnvironment()` to provide early-startup warnings (pre-middleware, logged to the bootstrap logger):
   ```csharp
   using System.Reflection;
   using Microsoft.AspNetCore.Mvc;
   using Serilog;
   
   namespace Api.Infrastructure.OpenApi;
   
   public static class OpenApiStartupValidator
   {
       public static void WarnMissingApiControllerAttributes()
       {
           var assembly = Assembly.GetExecutingAssembly();
           var invalid = assembly.GetTypes()
               .Where(t => typeof(Microsoft.AspNetCore.Mvc.ControllerBase).IsAssignableFrom(t)
                        && !t.IsAbstract
                        && !t.IsDefined(typeof(ApiControllerAttribute), inherit: true))
               .ToList();
   
           foreach (var t in invalid)
               Log.Warning("[Startup] Controller {Name} is missing [ApiController] — excluded from OpenAPI spec", t.FullName);
       }
   }
   ```

7. **Register document filter** in `AddSwaggerGen()` (Step 4 above) and call `OpenApiStartupValidator.WarnMissingApiControllerAttributes()` after the bootstrap logger is initialised (top of `Program.cs`, before `WebApplication.CreateBuilder()`).

## Current Project State
```
/api/
├── Api.csproj               # task_001 (net9.0, webapi, --use-controllers)
├── Program.cs               # task_001 (AddControllers, StartupGuard, port 5000)
├── appsettings.json         # task_001 (base skeleton) — WILL BE MODIFIED
├── appsettings.Development.json  # task_001 — WILL BE MODIFIED
├── Infrastructure/
│   └── StartupGuard.cs      # task_001 (DATABASE_URL guard)
└── Features/                # task_001 (Booking/Intake/Clinical/Coding/Notifications/Admin + Shared)
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `/api/Api.csproj` | Add NuGet: `Serilog.AspNetCore`, `Serilog.Sinks.Seq`, `Serilog.Enrichers.TraceIdentifier`, `Scalar.AspNetCore` |
| MODIFY | `/api/Program.cs` | Add Serilog host bootstrapping, `UseSerilogRequestLogging()`, OpenAPI `AddOpenApi()` + `AddSwaggerGen()` with `ApiControllerDocumentFilter`, `MapScalarApiReference(route="/swagger")` |
| MODIFY | `/api/appsettings.json` | Add `Serilog` config section: Console + Seq sinks, minimum levels, TraceIdentifier enricher |
| MODIFY | `/api/appsettings.Development.json` | Override `Serilog:WriteTo:Seq:serverUrl` to `http://localhost:5341` |
| CREATE | `/api/Infrastructure/OpenApi/ApiControllerDocumentFilter.cs` | Swashbuckle document filter: logs warning + removes paths for controllers missing `[ApiController]` |
| CREATE | `/api/Infrastructure/OpenApi/OpenApiStartupValidator.cs` | Bootstrap-time reflection scan emitting Serilog warnings for invalid controllers |

## External References
- Serilog.AspNetCore request logging middleware: https://github.com/serilog/serilog-aspnetcore#request-logging
- Serilog.Sinks.Seq configuration: https://docs.datalust.co/docs/using-serilog
- `Serilog.Enrichers.TraceIdentifier` NuGet: https://www.nuget.org/packages/Serilog.Enrichers.TraceIdentifier
- Scalar.AspNetCore — mounting at custom route: https://scalar.com/blog/scalar-for-asp-net-core
- Swashbuckle `IDocumentFilter` for excluding operations: https://github.com/domaindrivendev/Swashbuckle.AspNetCore#document-filters
- ASP.NET Core 9 `AddOpenApi()` built-in: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/openapi/aspnetcore-openapi?view=aspnetcore-9.0

## Build Commands
```bash
# Add NuGet packages
dotnet add package Serilog.AspNetCore --version 8.*
dotnet add package Serilog.Sinks.Seq --version 6.*
dotnet add package Serilog.Enrichers.TraceIdentifier --version 3.*
dotnet add package Scalar.AspNetCore --version 2.*

# Build (must exit 0)
dotnet build --configuration Release

# Start local Seq (Docker, for manual verification)
docker run --name seq -e ACCEPT_EULA=Y -p 5341:5341 -p 8081:80 datalust/seq:latest

# Run API (verify structured logs appear in Seq at http://localhost:8081)
DATABASE_URL="Host=localhost;..." dotnet run

# Verify Scalar UI at /swagger (AC-1)
curl -s http://localhost:5000/swagger | grep -i "scalar\|api"

# Verify structured log fields via Seq query:
# select RequestMethod, RequestPath, StatusCode, Elapsed, TraceId from stream
```

## Implementation Validation Strategy
- [ ] `curl http://localhost:5000/swagger` returns HTTP 200 and the Scalar UI renders with all registered API endpoints
- [ ] After making a request (`curl http://localhost:5000/api/health`), the Seq UI (`http://localhost:8081`) shows a structured log event with `RequestMethod`, `RequestPath`, `StatusCode`, `ElapsedMs`, and `TraceId` fields
- [ ] Adding a controller class that inherits `ControllerBase` but does NOT have `[ApiController]` to any feature folder, then running `dotnet run`, produces a Serilog warning log entry and that controller's endpoints are absent from the Scalar spec
- [ ] `dotnet build --configuration Release` exits 0

## Implementation Checklist
- [ ] Add `Serilog.AspNetCore`, `Serilog.Sinks.Seq`, `Serilog.Enrichers.TraceIdentifier`, `Scalar.AspNetCore` NuGet packages
- [ ] Configure bootstrap Serilog logger at top of `Program.cs` (before `CreateBuilder`) with try/catch/finally and `Log.CloseAndFlush()`
- [ ] Register `builder.Host.UseSerilog()` with `ReadFrom.Configuration()` and `WithTraceIdentifier()` enricher
- [ ] Call `app.UseSerilogRequestLogging()` with message template covering `RequestMethod`, `RequestPath`, `StatusCode`, `Elapsed`
- [ ] Add `Serilog` section to `appsettings.json` (Console sink + Seq sink with `serverUrl`)
- [ ] Override Seq `serverUrl` to `http://localhost:5341` in `appsettings.Development.json`
- [ ] Register `AddEndpointsApiExplorer()`, `AddOpenApi()`, `AddSwaggerGen()` with `ApiControllerDocumentFilter`
- [ ] Add `UseSwagger()` and `MapScalarApiReference(opts => opts.Route = "/swagger")` in Development middleware
- [ ] Create `Infrastructure/OpenApi/ApiControllerDocumentFilter.cs` — logs warning + removes invalid controller paths from spec
- [ ] Create `Infrastructure/OpenApi/OpenApiStartupValidator.cs` — bootstrap-time scan with `Log.Warning()`
- [ ] Run `dotnet build` — confirm zero errors
