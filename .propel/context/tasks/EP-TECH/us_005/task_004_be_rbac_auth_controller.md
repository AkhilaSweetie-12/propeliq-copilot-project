---
title: "Task — RBAC Policy Registration (Patient/Staff/Admin) + Auth Controller Endpoints"
task_id: task_004
story_id: us_005
epic: EP-TECH
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_004

## Requirement Reference
- User Story: [us_005] — JWT Authentication Infrastructure (Identity + BCrypt + Redis Blocklist)
- Story Location: `.propel/context/tasks/EP-TECH/us_005/us_005.md`
- Acceptance Criteria:
  - AC-1 (complete): `POST /api/auth/login` returns HTTP 200 with access token + refresh token; login validates credentials via `UserManager<ApplicationUser>` and BCrypt
  - AC-3 (complete): `POST /api/auth/logout` adds `jti` to Redis blocklist (via `ITokenBlocklistService`), returns HTTP 204
  - AC-4: RBAC policy registered for three roles; `Patient` calling `[Authorize(Roles = "Staff")]` endpoint → HTTP 403 Forbidden; no patient data or app state in 403 body
  - AC-7 (complete): `POST /api/auth/refresh` validates refresh token, issues new token pair, stores new refresh token in Redis, returns HTTP 401 on replay
  - AC-5 (partial): `POST /api/auth/register` persists user with BCrypt hash; plaintext password absent from all logs, responses, and DB fields

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
| Identity | Microsoft.AspNetCore.Identity | 9.x |
| Authorization | Microsoft.AspNetCore.Authorization | 9.x |
| Cache Client | StackExchange.Redis | 2.x |
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
Register RBAC authorization policies in `Program.cs` for the three roles (`Patient`, `Staff`, `Admin`) using `AddAuthorization()` with named policies. Add a 403 Forbidden handler that suppresses application state from the response body. Implement the `AuthController` with four endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `POST /api/auth/refresh`. Each endpoint delegates to `UserManager<ApplicationUser>`, `IJwtTokenService`, `ITokenBlocklistService`, and `IRefreshTokenService` from previous tasks. Ensure plaintext passwords never reach logs, responses, or EF entity properties.

## Dependent Tasks
- `task_001_be_identity_bcrypt_user.md` — `ApplicationUser`, `AppRoles`, `BcryptPasswordHasher` must exist.
- `task_002_be_jwt_token_service.md` — `IJwtTokenService` must exist.
- `task_003_be_redis_blocklist_refresh_tokens.md` — `ITokenBlocklistService`, `IRefreshTokenService` must exist.

## Impacted Components
- `/api/Program.cs` — MODIFY: register `AddAuthorization()` with role policies and a 403 `IProblemDetailsService` suppression handler
- `/api/Features/Auth/Controllers/AuthController.cs` — CREATE: `POST /api/auth/register`, `/login`, `/logout`, `/refresh`
- `/api/Features/Auth/Models/Requests/RegisterRequest.cs` — CREATE: request DTO with validation annotations
- `/api/Features/Auth/Models/Requests/LoginRequest.cs` — CREATE: request DTO
- `/api/Features/Auth/Models/Requests/RefreshRequest.cs` — CREATE: request DTO
- `/api/Features/Auth/Models/Responses/AuthResponse.cs` — CREATE: response DTO (access token + refresh token; no PHI)

## Implementation Plan

1. **Register RBAC authorization in `Program.cs`**:
   ```csharp
   builder.Services.AddAuthorization(opts =>
   {
       opts.AddPolicy(AppRoles.Patient, p => p.RequireRole(AppRoles.Patient));
       opts.AddPolicy(AppRoles.Staff,   p => p.RequireRole(AppRoles.Staff));
       opts.AddPolicy(AppRoles.Admin,   p => p.RequireRole(AppRoles.Admin));

       // Default policy — requires authenticated user (any role)
       opts.DefaultPolicy = new AuthorizationPolicyBuilder()
           .RequireAuthenticatedUser()
           .Build();
   });
   ```

2. **Add HTTP 403 Forbidden handler** in `Program.cs` to suppress application state from 403 responses (AC-4):
   ```csharp
   builder.Services.AddProblemDetails(opts =>
   {
       opts.CustomizeProblemDetails = ctx =>
       {
           // Ensure no application state is leaked in 403 or other error responses
           ctx.ProblemDetails.Extensions.Remove("exception");
           ctx.ProblemDetails.Extensions.Remove("traceId");
           if (ctx.HttpContext.Response.StatusCode == StatusCodes.Status403Forbidden)
           {
               ctx.ProblemDetails.Detail = null;  // suppress any detail that could leak state
               ctx.ProblemDetails.Title  = "Forbidden";
           }
       };
   });
   ```
   Also ensure `app.UseStatusCodePages()` is NOT registered (it can leak state); rely on `UseExceptionHandler` and `GlobalExceptionHandlerMiddleware` from us_002.

3. **Create request / response DTOs**:

   `Features/Auth/Models/Requests/RegisterRequest.cs`:
   ```csharp
   using System.ComponentModel.DataAnnotations;

   namespace Api.Features.Auth.Models.Requests;

   public record RegisterRequest(
       [Required, EmailAddress] string Email,
       [Required, MinLength(12)] string Password,
       [Required] string FirstName,
       [Required] string LastName,
       [Required] string Role   // "Patient" | "Staff" | "Admin"
   );
   ```

   `Features/Auth/Models/Requests/LoginRequest.cs`:
   ```csharp
   namespace Api.Features.Auth.Models.Requests;
   public record LoginRequest([Required] string Email, [Required] string Password);
   ```

   `Features/Auth/Models/Requests/RefreshRequest.cs`:
   ```csharp
   namespace Api.Features.Auth.Models.Requests;
   public record RefreshRequest([Required] string RefreshToken);
   ```

   `Features/Auth/Models/Responses/AuthResponse.cs`:
   ```csharp
   namespace Api.Features.Auth.Models.Responses;
   // No PHI in this response — only opaque tokens and role information
   public record AuthResponse(string AccessToken, string RefreshToken, int ExpiresInSeconds, string Role);
   ```

4. **Create `Features/Auth/Controllers/AuthController.cs`**:
   ```csharp
   using Api.Features.Auth.Models;
   using Api.Features.Auth.Models.Requests;
   using Api.Features.Auth.Models.Responses;
   using Api.Features.Auth.Services;
   using Api.Features.Shared.Controllers;
   using Microsoft.AspNetCore.Authorization;
   using Microsoft.AspNetCore.Identity;
   using Microsoft.AspNetCore.Mvc;

   namespace Api.Features.Auth.Controllers;

   [Route("api/auth")]
   public class AuthController(
       UserManager<ApplicationUser> userManager,
       IJwtTokenService             jwtService,
       ITokenBlocklistService       blocklist,
       IRefreshTokenService         refreshService,
       IConfiguration               config) : ApiControllerBase
   {
       private int AccessTokenTtl =>
           int.TryParse(config["Jwt:AccessTokenTtlMinutes"], out var m) ? m : 15;

       [HttpPost("register")]
       [AllowAnonymous]
       public async Task<IActionResult> Register([FromBody] RegisterRequest req)
       {
           if (!AppRoles.All.Contains(req.Role))
               return BadRequest(new { detail = "Invalid role. Must be Patient, Staff, or Admin." });

           var user = new ApplicationUser
           {
               UserName  = req.Email,
               Email     = req.Email,
               FirstName = req.FirstName,
               LastName  = req.LastName
           };

           // UserManager calls BcryptPasswordHasher.HashPassword() — plaintext never stored or logged
           var result = await userManager.CreateAsync(user, req.Password);
           if (!result.Succeeded)
               return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

           await userManager.AddToRoleAsync(user, req.Role);
           return Created($"/api/users/{user.Id}", new { userId = user.Id });
       }

       [HttpPost("login")]
       [AllowAnonymous]
       public async Task<IActionResult> Login([FromBody] LoginRequest req)
       {
           var user = await userManager.FindByEmailAsync(req.Email);
           if (user is null || !await userManager.CheckPasswordAsync(user, req.Password))
               return Unauthorized(new { detail = "Invalid credentials." });
               // Note: identical response for "user not found" and "wrong password" — prevents user enumeration

           if (await userManager.IsLockedOutAsync(user))
               return StatusCode(StatusCodes.Status423Locked, new { detail = "Account is temporarily locked." });

           var roles        = await userManager.GetRolesAsync(user);
           var accessToken  = jwtService.GenerateAccessToken(user.Id, user.Email!, roles);
           var refreshToken = await refreshService.CreateAndStoreRefreshTokenAsync(user.Id);

           user.LastLoginAt = DateTimeOffset.UtcNow;
           await userManager.UpdateAsync(user);

           return Ok(new AuthResponse(accessToken, refreshToken, AccessTokenTtl * 60, roles.FirstOrDefault() ?? string.Empty));
       }

       [HttpPost("logout")]
       [Authorize]
       public async Task<IActionResult> Logout()
       {
           var jti = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti)?.Value;
           var exp = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Exp)?.Value;

           if (jti is not null)
           {
               var remainingTtl = exp is not null
                   ? DateTimeOffset.FromUnixTimeSeconds(long.Parse(exp)) - DateTimeOffset.UtcNow
                   : TimeSpan.FromMinutes(15);

               if (remainingTtl > TimeSpan.Zero)
                   await blocklist.BlockTokenAsync(jti, remainingTtl);
           }

           var userId = userManager.GetUserId(User);
           if (userId is not null)
               await refreshService.RevokeAllUserRefreshTokensAsync(userId);

           return NoContent();   // 204 — no body to leak state
       }

       [HttpPost("refresh")]
       [AllowAnonymous]
       public async Task<IActionResult> Refresh([FromBody] RefreshRequest req)
       {
           var userId = await refreshService.ValidateAndConsumeRefreshTokenAsync(req.RefreshToken);
           if (userId is null)
               return Unauthorized(new { detail = "Invalid or expired refresh token." });

           var user = await userManager.FindByIdAsync(userId);
           if (user is null)
               return Unauthorized(new { detail = "Invalid or expired refresh token." });

           var roles           = await userManager.GetRolesAsync(user);
           var newAccessToken  = jwtService.GenerateAccessToken(user.Id, user.Email!, roles);
           var newRefreshToken = await refreshService.CreateAndStoreRefreshTokenAsync(user.Id);

           return Ok(new AuthResponse(newAccessToken, newRefreshToken, AccessTokenTtl * 60, roles.FirstOrDefault() ?? string.Empty));
       }
   }
   ```
   Security notes:
   - `Login` returns an identical 401 for "user not found" and "wrong password" — prevents user enumeration (OWASP A07).
   - `Logout` returns 204 with no body — no application state leaked (AC-4 principle applied to logout too).
   - `Refresh` does not confirm which specific failure occurred — identical 401 for invalid/expired/replayed tokens.

5. **Seed roles in database** — add to `MigrateAsync` block in `Program.cs` (after migration, using `RoleManager`):
   ```csharp
   using (var scope = app.Services.CreateScope())
   {
       var db          = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
       await db.Database.MigrateAsync();

       var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
       foreach (var role in AppRoles.All)
           if (!await roleManager.RoleExistsAsync(role))
               await roleManager.CreateAsync(new IdentityRole(role));
   }
   ```

## Current Project State
```
/api/
├── Program.cs                        # us_002 + tasks 001–003: DI, Serilog, JWT, AddIdentity — WILL BE MODIFIED
├── Features/Auth/
│   ├── Models/
│   │   ├── ApplicationUser.cs        # task_001
│   │   └── AppRoles.cs              # task_001
│   └── Services/
│       ├── IJwtTokenService.cs       # task_002
│       ├── JwtTokenService.cs        # task_002
│       ├── ITokenBlocklistService.cs # task_003
│       ├── RedisTokenBlocklistService.cs  # task_003
│       ├── IRefreshTokenService.cs   # task_003
│       └── RefreshTokenService.cs    # task_003
└── Infrastructure/
    └── Identity/
        └── BcryptPasswordHasher.cs   # task_001
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `/api/Program.cs` | Register `AddAuthorization()` with role policies; add `AddProblemDetails()` with 403 state suppression; add role seeding to `MigrateAsync` block |
| CREATE | `/api/Features/Auth/Controllers/AuthController.cs` | `POST /api/auth/register`, `/login` (user enumeration-safe), `/logout` (204, blocklist jti), `/refresh` (rotate tokens) |
| CREATE | `/api/Features/Auth/Models/Requests/RegisterRequest.cs` | Record DTO with DataAnnotations validation |
| CREATE | `/api/Features/Auth/Models/Requests/LoginRequest.cs` | Record DTO |
| CREATE | `/api/Features/Auth/Models/Requests/RefreshRequest.cs` | Record DTO |
| CREATE | `/api/Features/Auth/Models/Responses/AuthResponse.cs` | Record DTO: `AccessToken`, `RefreshToken`, `ExpiresInSeconds`, `Role`; no PHI |

## External References
- ASP.NET Core authorization policies (`AddAuthorization`): https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies?view=aspnetcore-9.0
- `UserManager<TUser>` — `CreateAsync`, `CheckPasswordAsync`, `AddToRoleAsync`: https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.identity.usermanager-1
- ASP.NET Core `ProblemDetails` customization: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling?view=aspnetcore-9.0#problem-details
- OWASP A07:2021 — Identification and Authentication Failures (user enumeration prevention): https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/
- NFR-008 RBAC roles (Patient, Staff, Admin): project `design.md`

## Build Commands
```bash
# Build
dotnet build api/Api.csproj --configuration Release

# Run API with all required env vars
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
REDIS_URL="redis://localhost:6379" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet run --project api/Api.csproj

# Register a user
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"StrongPassword123!","firstName":"Test","lastName":"User","role":"Patient"}'

# Login and capture tokens
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"StrongPassword123!"}'

# Test 403: Patient calling Staff endpoint
curl -v -H "Authorization: Bearer <patient_token>" http://localhost:5000/api/some-staff-endpoint
# Expected: HTTP 403 with {"title":"Forbidden","status":403} — no patient data in body

# Test logout
curl -s -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer <access_token>"
# Expected: HTTP 204

# Test blocked token after logout
curl -v -H "Authorization: Bearer <same_access_token>" http://localhost:5000/api/health/protected
# Expected: HTTP 401
```

## Implementation Validation Strategy
- [ ] `POST /api/auth/register` with valid request returns HTTP 201 with `userId`; `AspNetUsers` table has the user with `PasswordHash` starting with `$2b$12$`
- [ ] `POST /api/auth/login` with valid credentials returns HTTP 200 with `accessToken`, `refreshToken`, `expiresInSeconds=900`
- [ ] `POST /api/auth/login` with wrong password returns HTTP 401 — identical response to unknown email (no user enumeration)
- [ ] Patient user calling a `[Authorize(Roles = "Staff")]` endpoint returns HTTP 403 with `{"title":"Forbidden","status":403}` — no patient data or stack trace in body
- [ ] `POST /api/auth/logout` returns HTTP 204; subsequent use of the logged-out token returns HTTP 401
- [ ] `POST /api/auth/refresh` with valid refresh token returns new token pair; replaying the old token returns HTTP 401
- [ ] `dotnet build --configuration Release` exits 0

## Implementation Checklist
- [ ] Register `AddAuthorization()` in `Program.cs` with named policies for `Patient`, `Staff`, `Admin`
- [ ] Register `AddProblemDetails()` with `CustomizeProblemDetails` removing `exception` extension and suppressing `Detail` on 403
- [ ] Add role seeding loop (`Patient`, `Staff`, `Admin`) to the `MigrateAsync` startup block using `RoleManager<IdentityRole>`
- [ ] Create `RegisterRequest`, `LoginRequest`, `RefreshRequest` record DTOs with `[Required]` annotations
- [ ] Create `AuthResponse` record DTO: `AccessToken`, `RefreshToken`, `ExpiresInSeconds`, `Role` — no PHI
- [ ] Create `AuthController` with `[Route("api/auth")]` inheriting `ApiControllerBase`
- [ ] Implement `POST /api/auth/register`: `userManager.CreateAsync()`, `AddToRoleAsync()`, plaintext password never stored/logged
- [ ] Implement `POST /api/auth/login`: identical 401 for "not found" and "wrong password"; update `LastLoginAt`
- [ ] Implement `POST /api/auth/logout`: `blocklist.BlockTokenAsync(jti, remainingTtl)`, `refreshService.RevokeAllUserRefreshTokensAsync()`, return 204
- [ ] Implement `POST /api/auth/refresh`: `refreshService.ValidateAndConsumeRefreshTokenAsync()`, issue new pair, return 401 on replay
- [ ] Run `dotnet build` — confirm zero errors
