---
title: "Task — ASP.NET Core 9 Web API Project Scaffold with Modular Feature Folders & DI Auto-Registration"
task_id: task_001
story_id: us_002
epic: EP-TECH
layer: Backend
status: Not Started
date: 2026-04-20
---

# Task - task_001

## Requirement Reference
- User Story: [us_002] — ASP.NET Core 9 Web API Scaffold with Modular Feature Folders
- Story Location: `.propel/context/tasks/EP-TECH/us_002/us_002.md`
- Acceptance Criteria:
  - AC-1: `dotnet run` starts the API on port 5000 without errors; Swagger/Scalar OpenAPI UI accessible at `http://localhost:5000/swagger` listing all registered endpoints
  - AC-2: Modular feature folder structure (`/api/Features/Booking`, `…/Intake`, `…/Clinical`, `…/Coding`, `…/Notifications`, `…/Admin`); new controller added under any feature folder is auto-registered by ASP.NET Core DI and appears in the OpenAPI spec without changes to `Program.cs`
  - AC-6: Missing or invalid `DATABASE_URL` environment variable causes the application to throw `InvalidOperationException("DATABASE_URL environment variable is required")` before reaching `app.Run()`; no partial startup occurs
  - Edge Case 1: Duplicate service registration across feature folders → DI container throws `InvalidOperationException` identifying the duplicate at startup; application does not start

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
| Runtime | .NET | 9.0 |
| Build | dotnet CLI | 9.x |
| Database (env var) | PostgreSQL | 16 |
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
Scaffold the `/api` ASP.NET Core 9 Web API project using `dotnet new webapi --use-controllers`, configure `Program.cs` with `AddControllers()` for assembly-level DI auto-discovery, and create the six modular feature folders (`Booking`, `Intake`, `Clinical`, `Coding`, `Notifications`, `Admin`) each with `Controllers/`, `Models/`, and `Services/` sub-folders. Configure `launchSettings.json` to bind on port 5000. Add a startup environment variable guard that validates `DATABASE_URL` before `app.Run()`, throwing a descriptive `InvalidOperationException` on failure. Configure `AddControllers()` to scan the full assembly so any controller placed under any feature folder is auto-registered without a `Program.cs` change.

## Dependent Tasks
- None — this is the foundational scaffold task for us_002.

## Impacted Components
- `/api/Api.csproj` — new file (dotnet webapi project, net9.0 target)
- `/api/Program.cs` — new file (DI, middleware pipeline, `DATABASE_URL` guard, launch on port 5000)
- `/api/appsettings.json` — new file (base config skeleton)
- `/api/appsettings.Development.json` — new file (development overrides)
- `/api/Properties/launchSettings.json` — new file (port 5000 HTTP profile)
- `/api/Features/Booking/Controllers/` — new directory
- `/api/Features/Booking/Models/` — new directory
- `/api/Features/Booking/Services/` — new directory
- `/api/Features/Intake/Controllers/` — new directory (+ Models/, Services/)
- `/api/Features/Clinical/Controllers/` — new directory (+ Models/, Services/)
- `/api/Features/Coding/Controllers/` — new directory (+ Models/, Services/)
- `/api/Features/Notifications/Controllers/` — new directory (+ Models/, Services/)
- `/api/Features/Admin/Controllers/` — new directory (+ Models/, Services/)
- `/api/Features/Shared/` — new directory (cross-cutting domain primitives: base controller, response envelope)
- `.gitkeep` files — one per leaf directory to preserve empty structure in Git

## Implementation Plan

1. **Create the `/api` project**:
   ```bash
   mkdir api && cd api
   dotnet new webapi --framework net9.0 --use-controllers --name Api --output .
   ```
   This generates: `Api.csproj`, `Program.cs`, `appsettings.json`, `appsettings.Development.json`, `Properties/launchSettings.json`, and a sample `WeatherForecast` controller.

2. **Remove generated sample files**:
   Delete `Controllers/WeatherForecastController.cs`, `WeatherForecast.cs` — they are placeholder artefacts not needed in production code.

3. **Configure `Program.cs`** — minimal pipeline:
   ```csharp
   using Api.Infrastructure;                // startup guard (Step 4)
   
   var builder = WebApplication.CreateBuilder(args);
   
   StartupGuard.ValidateEnvironment();      // throws before DI if env invalid
   
   builder.Services.AddControllers();       // scans full assembly — no per-feature registration needed
   builder.Services.AddEndpointsApiExplorer();
   builder.Services.AddSwaggerGen();
   
   var app = builder.Build();
   
   if (app.Environment.IsDevelopment())
   {
       app.UseSwagger();
       app.UseSwaggerUI();
   }
   
   app.UseHttpsRedirection();
   app.UseAuthorization();
   app.MapControllers();
   app.Run();
   ```

4. **Create `Api/Infrastructure/StartupGuard.cs`** — environment validation:
   ```csharp
   namespace Api.Infrastructure;
   
   public static class StartupGuard
   {
       public static void ValidateEnvironment()
       {
           var dbUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
           if (string.IsNullOrWhiteSpace(dbUrl))
               throw new InvalidOperationException(
                   "DATABASE_URL environment variable is required");
       }
   }
   ```
   Note: this is called before `builder.Build()` so no partial DI startup can occur.

5. **Configure `Properties/launchSettings.json`** — set application URL to port 5000 only:
   ```json
   {
     "profiles": {
       "Api": {
         "commandName": "Project",
         "dotnetRunMessages": true,
         "applicationUrl": "http://localhost:5000",
         "environmentVariables": {
           "ASPNETCORE_ENVIRONMENT": "Development"
         }
       }
     }
   }
   ```

6. **Create modular feature folder structure**:
   ```
   /api/Features/
   ├── Booking/
   │   ├── Controllers/   (.gitkeep)
   │   ├── Models/        (.gitkeep)
   │   └── Services/      (.gitkeep)
   ├── Intake/            (same sub-folders)
   ├── Clinical/          (same sub-folders)
   ├── Coding/            (same sub-folders)
   ├── Notifications/     (same sub-folders)
   ├── Admin/             (same sub-folders)
   └── Shared/
       ├── Controllers/ApiControllerBase.cs   (abstract base with [ApiController])
       └── Models/ApiResponse.cs             (generic response envelope)
   ```

7. **Create `Features/Shared/Controllers/ApiControllerBase.cs`**:
   ```csharp
   using Microsoft.AspNetCore.Mvc;
   
   namespace Api.Features.Shared.Controllers;
   
   [ApiController]
   [Route("api/[controller]")]
   public abstract class ApiControllerBase : ControllerBase { }
   ```
   All feature controllers inherit from this base — ensures `[ApiController]` is always present (addressing EC-2 which is implemented in task_002).

8. **Verify DI auto-discovery**: add a `GET /api/booking/ping` stub controller under `Features/Booking/Controllers/BookingController.cs` inheriting `ApiControllerBase`. Run `dotnet run` and confirm the endpoint appears in the Swagger UI without any `Program.cs` change. Remove the stub after verification or retain as smoke-test endpoint.

## Current Project State
```
/                        # Monorepo root
├── client/              # task_001 from us_001 (React SPA)
└── api/                 # NOT YET CREATED — created by this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Api.csproj` | .NET 9 webapi project file |
| CREATE | `/api/Program.cs` | Minimal API pipeline with DI, Swagger, `DATABASE_URL` guard, port 5000 |
| CREATE | `/api/appsettings.json` | Base configuration skeleton |
| CREATE | `/api/appsettings.Development.json` | Development environment overrides |
| CREATE | `/api/Properties/launchSettings.json` | HTTP launch profile bound to port 5000 |
| CREATE | `/api/Infrastructure/StartupGuard.cs` | Static env-var validation method throwing `InvalidOperationException` |
| CREATE | `/api/Features/Booking/Controllers/.gitkeep` | Preserve directory in Git |
| CREATE | `/api/Features/Booking/Models/.gitkeep` | Preserve directory in Git |
| CREATE | `/api/Features/Booking/Services/.gitkeep` | Preserve directory in Git |
| CREATE | `/api/Features/{Intake,Clinical,Coding,Notifications,Admin}/Controllers/.gitkeep` | Same per-feature pattern × 5 |
| CREATE | `/api/Features/Shared/Controllers/ApiControllerBase.cs` | Abstract base controller with `[ApiController][Route]` |
| CREATE | `/api/Features/Shared/Models/ApiResponse.cs` | Generic `ApiResponse<T>` response envelope |
| DELETE | `/api/Controllers/WeatherForecastController.cs` | Remove generated sample |
| DELETE | `/api/WeatherForecast.cs` | Remove generated sample |

## External References
- `dotnet new webapi` template options (.NET 9): https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-new
- ASP.NET Core controller discovery and routing: https://learn.microsoft.com/en-us/aspnet/core/web-api/?view=aspnetcore-9.0
- `AddControllers()` assembly scanning (no per-controller registration): https://learn.microsoft.com/en-us/aspnet/core/mvc/controllers/dependency-injection?view=aspnetcore-9.0
- launchSettings.json reference: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/environments?view=aspnetcore-9.0#development-and-launchsettingsjson
- `ASPNETCORE_URLS` vs launchSettings applicationUrl: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/servers/kestrel/endpoints?view=aspnetcore-9.0

## Build Commands
```bash
# Scaffold project
cd api && dotnet new webapi --framework net9.0 --use-controllers --name Api --output .

# Restore packages
dotnet restore

# Build (must exit 0)
dotnet build --configuration Release --no-restore

# Run (requires DATABASE_URL set)
DATABASE_URL="Host=localhost;Database=dev;Username=dev;Password=dev" dotnet run

# Run without DATABASE_URL — must throw InvalidOperationException
dotnet run  # Expected: InvalidOperationException("DATABASE_URL environment variable is required")

# Verify Swagger UI (after dotnet run with DATABASE_URL)
curl -s http://localhost:5000/swagger/index.html | grep -i "swagger"
```

## Implementation Validation Strategy
- [ ] `dotnet run` with valid `DATABASE_URL` starts server on `http://localhost:5000` (no port conflict)
- [ ] `curl http://localhost:5000/swagger/index.html` returns HTTP 200 with Swagger UI HTML
- [ ] Adding a new controller under any `Features/*/Controllers/` without touching `Program.cs` causes the new endpoint to appear in the Swagger spec at next `dotnet run`
- [ ] `dotnet run` without `DATABASE_URL` exits with `InvalidOperationException: DATABASE_URL environment variable is required` before DI registration completes
- [ ] `dotnet build --configuration Release` exits 0 with zero warnings

## Implementation Checklist
- [ ] Scaffold `/api` project: `dotnet new webapi --framework net9.0 --use-controllers --name Api`
- [ ] Remove generated sample files (`WeatherForecastController.cs`, `WeatherForecast.cs`)
- [ ] Update `Program.cs`: `AddControllers()` + `AddEndpointsApiExplorer()` + `AddSwaggerGen()` + `UseSwagger()` + `UseSwaggerUI()` + `MapControllers()`
- [ ] Create `Infrastructure/StartupGuard.cs` with `DATABASE_URL` null/empty check throwing `InvalidOperationException`
- [ ] Call `StartupGuard.ValidateEnvironment()` before `builder.Build()` in `Program.cs`
- [ ] Set `applicationUrl: http://localhost:5000` in `Properties/launchSettings.json`
- [ ] Create all 6 feature folder structures (`Booking`, `Intake`, `Clinical`, `Coding`, `Notifications`, `Admin`) with `Controllers/`, `Models/`, `Services/` sub-folders and `.gitkeep` files
- [ ] Create `Features/Shared/Controllers/ApiControllerBase.cs` abstract base with `[ApiController]` and `[Route("api/[controller]")]`
- [ ] Create `Features/Shared/Models/ApiResponse.cs` generic response envelope
- [ ] Run `dotnet build` — confirm zero errors and zero warnings
