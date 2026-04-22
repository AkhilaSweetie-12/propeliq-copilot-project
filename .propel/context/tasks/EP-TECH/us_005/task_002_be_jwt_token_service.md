---
title: "Task — JWT Access Token Issuance Service (15-min TTL, HS256, Signing Key Guard)"
task_id: task_002
story_id: us_005
epic: EP-TECH
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_005] — JWT Authentication Infrastructure (Identity + BCrypt + Redis Blocklist)
- Story Location: `.propel/context/tasks/EP-TECH/us_005/us_005.md`
- Acceptance Criteria:
  - AC-1 (partial): `POST /api/auth/login` returns a signed JWT access token with TTL = 15 minutes, algorithm HS256; token contains `sub`, `jti`, `role`, `iat`, `exp` claims
  - AC-2: JWT access token used after 15 minutes returns HTTP 401 Unauthorized; ASP.NET Core JWT Bearer middleware enforces `exp` claim validation
  - Edge Case 3: Malformed or tampered JWT → HTTP 401 with `error="invalid_token"` in `WWW-Authenticate` header; no internal exception detail in response body (OWASP A02:2021)

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
| JWT | System.IdentityModel.Tokens.Jwt | 8.x |
| Authentication | Microsoft.AspNetCore.Authentication.JwtBearer | 9.x |
| Identity | Microsoft.AspNetCore.Identity | 9.x |
| Configuration | Microsoft.Extensions.Configuration | 9.x |
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
Create the `JwtTokenService` that generates short-lived JWT access tokens (15-minute TTL, HS256 algorithm) containing `sub` (user ID), `jti` (UUID for blocklist use), `role`, `email`, `iat`, and `exp` claims — with no PHI in any claim. Configure `AddAuthentication().AddJwtBearer()` in `Program.cs` with strict `TokenValidationParameters` enforcing issuer, audience, lifetime, and signature. Ensure `JwtBearerEvents.OnChallenge` and `OnAuthenticationFailed` suppress internal exception details from responses (OWASP A02). Read the signing key exclusively from `JWT_SIGNING_KEY` environment variable (validated by `StartupGuard` from task_001).

## Dependent Tasks
- `task_001_be_identity_bcrypt_user.md` — `ApplicationUser`, `AppRoles`, `StartupGuard` (with `JWT_SIGNING_KEY` guard) must exist.
- `us_002 task_003_be_auth_middleware_health.md` — JWT Bearer middleware stub from us_002 will be replaced/upgraded here with full token validation parameters.

## Impacted Components
- `/api/Features/Auth/Services/JwtTokenService.cs` — CREATE: service generating signed JWT access tokens
- `/api/Features/Auth/Services/IJwtTokenService.cs` — CREATE: interface for `JwtTokenService`
- `/api/Program.cs` — MODIFY: replace the JWT Bearer stub from us_002 task_003 with full `TokenValidationParameters`; suppress exception details in `OnChallenge`/`OnAuthenticationFailed`
- `/api/appsettings.json` — MODIFY: confirm `Jwt:Issuer`, `Jwt:Audience`, `Jwt:AccessTokenTtlMinutes=15` present

## Implementation Plan

1. **Create `Features/Auth/Services/IJwtTokenService.cs`**:
   ```csharp
   namespace Api.Features.Auth.Services;

   public interface IJwtTokenService
   {
       /// <summary>Generates a signed JWT access token for the given user and roles.</summary>
       string GenerateAccessToken(string userId, string email, IEnumerable<string> roles);

       /// <summary>Returns the jti claim value from a valid token without full validation.</summary>
       string? GetJtiFromToken(string token);
   }
   ```

2. **Create `Features/Auth/Services/JwtTokenService.cs`**:
   ```csharp
   using System.IdentityModel.Tokens.Jwt;
   using System.Security.Claims;
   using System.Text;
   using Microsoft.Extensions.Configuration;
   using Microsoft.IdentityModel.Tokens;

   namespace Api.Features.Auth.Services;

   public class JwtTokenService(IConfiguration config) : IJwtTokenService
   {
       private readonly string  _signingKey = Environment.GetEnvironmentVariable("JWT_SIGNING_KEY")
           ?? throw new InvalidOperationException("JWT_SIGNING_KEY environment variable is required");
       private readonly string  _issuer     = config["Jwt:Issuer"]   ?? "https://api.patient-access.local";
       private readonly string  _audience   = config["Jwt:Audience"] ?? "patient-access-spa";
       private readonly int     _ttlMinutes = int.TryParse(config["Jwt:AccessTokenTtlMinutes"], out var m) ? m : 15;

       public string GenerateAccessToken(string userId, string email, IEnumerable<string> roles)
       {
           var jti    = Guid.NewGuid().ToString();
           var now    = DateTime.UtcNow;
           var expiry = now.AddMinutes(_ttlMinutes);

           var claims = new List<Claim>
           {
               new(JwtRegisteredClaimNames.Sub,   userId),
               new(JwtRegisteredClaimNames.Jti,   jti),
               new(JwtRegisteredClaimNames.Iat,   new DateTimeOffset(now).ToUnixTimeSeconds().ToString(),
                                                   ClaimValueTypes.Integer64),
               new(ClaimTypes.Email, email),
               // No PHI claims — only identity and role information
           };

           foreach (var role in roles)
               claims.Add(new Claim(ClaimTypes.Role, role));

           var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_signingKey));
           var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

           var token = new JwtSecurityToken(
               issuer:             _issuer,
               audience:           _audience,
               claims:             claims,
               notBefore:          now,
               expires:            expiry,
               signingCredentials: creds);

           return new JwtSecurityTokenHandler().WriteToken(token);
       }

       public string? GetJtiFromToken(string token)
       {
           try
           {
               var handler = new JwtSecurityTokenHandler();
               if (!handler.CanReadToken(token)) return null;
               var jwt = handler.ReadJwtToken(token);
               return jwt.Id;  // jti claim
           }
           catch
           {
               return null;   // malformed token — caller handles null as invalid
           }
       }
   }
   ```
   Design decisions:
   - `email` claim included for display only; no PHI (name, DOB, address, insurance) in any claim (AC-6 / TR-006)
   - `jti` = `Guid.NewGuid()` — globally unique per token, used as blocklist key in task_003
   - `_ttlMinutes` reads from config; default = 15 (NFR-009)

3. **Register `JwtTokenService` in `Program.cs`**:
   ```csharp
   builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
   ```

4. **Replace JWT Bearer stub from us_002 task_003 with full `TokenValidationParameters`** in `Program.cs`:
   ```csharp
   var jwtSigningKey = Environment.GetEnvironmentVariable("JWT_SIGNING_KEY")
       ?? throw new InvalidOperationException("JWT_SIGNING_KEY environment variable is required");

   builder.Services
       .AddAuthentication(opts =>
       {
           opts.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
           opts.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
       })
       .AddJwtBearer(opts =>
       {
           opts.TokenValidationParameters = new TokenValidationParameters
           {
               ValidateIssuer            = true,
               ValidIssuer               = builder.Configuration["Jwt:Issuer"],
               ValidateAudience          = true,
               ValidAudience             = builder.Configuration["Jwt:Audience"],
               ValidateLifetime          = true,   // enforces exp claim (AC-2)
               ValidateIssuerSigningKey  = true,
               IssuerSigningKey          = new SymmetricSecurityKey(
                                               Encoding.UTF8.GetBytes(jwtSigningKey)),
               ClockSkew                 = TimeSpan.FromSeconds(30)
           };
           opts.Events = new JwtBearerEvents
           {
               OnChallenge = ctx =>
               {
                   // Suppress default challenge to prevent exception detail leakage (OWASP A02 / EC-3)
                   ctx.HandleResponse();
                   ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                   ctx.Response.Headers.WWWAuthenticate =
                       string.IsNullOrEmpty(ctx.Error)
                           ? "Bearer"
                           : $"Bearer error=\"{ctx.Error}\"";  // e.g., error="invalid_token"
                   ctx.Response.ContentType = "application/problem+json";
                   return ctx.Response.WriteAsync(
                       """{"type":"https://tools.ietf.org/html/rfc7235#section-3.1",
                           "title":"Unauthorized","status":401,
                           "detail":"A valid Bearer token is required"}""");
               },
               OnAuthenticationFailed = ctx =>
               {
                   // Log the failure type (not the exception detail) to Serilog
                   Serilog.Log.Warning("JWT authentication failed: {FailureType}",
                       ctx.Exception.GetType().Name);
                   return Task.CompletedTask;
               }
           };
       });
   ```
   Key: `ctx.Error` is populated by the JWT middleware with RFC-compliant error codes (`invalid_token`, `expired_token`) — safe to include in the header. Internal `ctx.Exception.Message` is intentionally excluded from both header and body.

5. **Update `appsettings.json`** — add `AccessTokenTtlMinutes`:
   ```json
   {
     "Jwt": {
       "Issuer": "https://api.patient-access.local",
       "Audience": "patient-access-spa",
       "AccessTokenTtlMinutes": 15
     }
   }
   ```

## Current Project State
```
/api/
├── Api.csproj                       # us_002–us_004: EF Core, Serilog, Scalar, JwtBearer stub
├── Program.cs                       # us_002: JWT stub AddJwtBearer — WILL BE REPLACED
├── appsettings.json                 # us_002: Jwt:{Issuer,Audience} — WILL BE MODIFIED
├── Features/Auth/                   # task_001: ApplicationUser, AppRoles
│   └── Models/
│       ├── ApplicationUser.cs
│       └── AppRoles.cs
└── Infrastructure/
    └── StartupGuard.cs              # task_001: JWT_SIGNING_KEY guard added
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Features/Auth/Services/IJwtTokenService.cs` | Interface: `GenerateAccessToken()`, `GetJtiFromToken()` |
| CREATE | `/api/Features/Auth/Services/JwtTokenService.cs` | HS256 token generator; `jti` = `Guid.NewGuid()`; 15-min TTL; no PHI claims |
| MODIFY | `/api/Program.cs` | Replace JWT Bearer stub: full `TokenValidationParameters`, `OnChallenge` suppressing exception detail, `OnAuthenticationFailed` Serilog warning |
| MODIFY | `/api/appsettings.json` | Add `Jwt:AccessTokenTtlMinutes: 15` |

## External References
- `System.IdentityModel.Tokens.Jwt` — `JwtSecurityTokenHandler.WriteToken()`: https://learn.microsoft.com/en-us/dotnet/api/system.identitymodel.tokens.jwt.jwtsecuritytokenhandler
- ASP.NET Core JWT Bearer `TokenValidationParameters`: https://learn.microsoft.com/en-us/dotnet/api/microsoft.identitymodel.tokens.tokenvalidationparameters
- `JwtBearerEvents.OnChallenge` — suppressing default response: https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.authentication.jwtbearer.jwtbearereventsx
- RFC 6750 — Bearer Token `WWW-Authenticate` error codes (`invalid_token`): https://www.rfc-editor.org/rfc/rfc6750#section-3.1
- OWASP A02:2021 — Cryptographic Failures (no secrets in JWT claims): https://owasp.org/Top10/A02_2021-Cryptographic_Failures/

## Build Commands
```bash
# Build (must exit 0)
dotnet build api/Api.csproj --configuration Release

# Run API with required env vars
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet run --project api/Api.csproj

# Test expired/malformed token returns 401 + correct WWW-Authenticate header
curl -v -H "Authorization: Bearer invalid.jwt.token" http://localhost:5000/api/health/protected
# Expected: HTTP 401, WWW-Authenticate: Bearer error="invalid_token"

# Test missing token returns 401
curl -v http://localhost:5000/api/health/protected
# Expected: HTTP 401, WWW-Authenticate: Bearer
```

## Implementation Validation Strategy
- [ ] `dotnet build --configuration Release` exits 0
- [ ] `GenerateAccessToken()` returns a JWT string with `exp` = `iat + 15 minutes`; decoded token has `jti` (UUID), `sub`, `role`, `email` claims — no PHI fields
- [ ] Submitting a tampered JWT to `/api/health/protected` returns HTTP 401 with `WWW-Authenticate: Bearer error="invalid_token"`; response body contains no exception stack trace
- [ ] Submitting an expired JWT returns HTTP 401 with `error="invalid_token"` or `error="expired_token"` in header
- [ ] `dotnet run` without `JWT_SIGNING_KEY` throws `InvalidOperationException` before `app.Run()` (covered by `StartupGuard` from task_001)

## Implementation Checklist
- [ ] Create `Features/Auth/Services/IJwtTokenService.cs`: `GenerateAccessToken(userId, email, roles)` + `GetJtiFromToken(token)` interface
- [ ] Create `Features/Auth/Services/JwtTokenService.cs`: HS256, `jti=Guid.NewGuid()`, 15-min TTL from config, no PHI claims
- [ ] Register `AddScoped<IJwtTokenService, JwtTokenService>()` in `Program.cs`
- [ ] Replace JWT Bearer stub in `Program.cs` with full `TokenValidationParameters` (`ValidateLifetime=true`, `ClockSkew=30s`)
- [ ] Add `OnChallenge` event: suppress default response, write `WWW-Authenticate: Bearer error="..."`, return RFC 7807 JSON with no exception detail
- [ ] Add `OnAuthenticationFailed` event: log `ctx.Exception.GetType().Name` only (no message/stack trace)
- [ ] Add `Jwt:AccessTokenTtlMinutes: 15` to `appsettings.json`
- [ ] Run `dotnet build` — confirm zero errors
