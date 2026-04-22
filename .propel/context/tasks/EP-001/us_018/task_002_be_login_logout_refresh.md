---
title: "Task — Login, Logout, Token Refresh Endpoints; BCrypt Verification, Redis Refresh Token & Blocklist, RBAC Middleware"
task_id: task_002
story_id: us_018
epic: EP-001
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_018] — Shared Login Page with Role-Based Routing
- Story Location: `.propel/context/tasks/EP-001/us_018/us_018.md`
- Acceptance Criteria:
  - AC-1: `POST /api/auth/login` — verifies BCrypt hash; issues 15-min JWT + 7-day refresh token stored in Upstash Redis (`SETEX refresh_token:{user_id}`); writes `audit_logs` `action_type = UserLoggedIn`; returns HTTP 200 with `{access_token, refresh_token}`
  - AC-2: Invalid credentials → HTTP 401 "Invalid credentials" (no field disambiguation); no audit log entry
  - AC-3/AC-4: RBAC middleware enforces role boundaries; HTTP 403 on role mismatch; Serilog `WARN` logged
  - AC-5: Expired JWT → HTTP 401 with `WWW-Authenticate: Bearer error="token_expired"`; `POST /api/auth/refresh` issues new access token using stored Redis refresh token (rotating — old token deleted, new token stored)
  - AC-6: `POST /api/auth/logout` → JWT `jti` added to Redis blocklist (`SETEX blocklist:{jti}` TTL = remaining lifetime); refresh token key deleted; subsequent requests with old JWT → HTTP 401
- Edge Cases:
  - EC-1 (Inactive account): `users.status = Inactive` → HTTP 401 "Invalid credentials"; Serilog `WARN` with reason `AccountInactive` (no account status disclosure)
  - EC-2 (Multi-tab): Redis blocklist globally invalidates the JWT; all requests with old JWT → 401
  - EC-3 (Redis unavailable on logout): API returns HTTP 503; no silent bypass introduced

## Design References (Frontend Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No |
| **Wireframe Status** | N/A |

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Backend | ASP.NET Core 9 Web API | .NET 9 LTS |
| Language | C# | 13 |
| ORM | EF Core 9 | 9.x |
| Database | PostgreSQL | via Npgsql 9 |
| Hashing | BCrypt.Net-Next | 4.x |
| Cache | Upstash Redis (StackExchange.Redis) | 2.x |
| Auth | JWT HS256 (System.IdentityModel.Tokens.Jwt) | 7.x |
| Logging | Serilog 8 | 8.x |
| AI/ML | N/A | N/A |
| Mobile | N/A | N/A |

## AI References (AI Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |

## Mobile References (Mobile Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |
| **Platform Target** | N/A |

## Task Overview
Implement `POST /api/auth/login`, `POST /api/auth/logout`, and `POST /api/auth/refresh` endpoints plus RBAC middleware. Login verifies BCrypt, issues a 15-minute JWT (HS256, `jti` claim) and a 7-day refresh token stored in Redis under `refresh_token:{userId}`, and writes an audit log. Logout adds the JWT `jti` to a Redis blocklist with TTL equal to the remaining token lifetime and deletes the refresh token key. The refresh endpoint validates the Redis-stored refresh token (rotating — delete old, write new). RBAC is enforced by ASP.NET Core authorization policies (`[Authorize(Roles = "...")]`) augmented by a custom `JwtBlocklistMiddleware` that rejects blocklisted `jti` values before the controller is reached. Redis unavailability on logout returns HTTP 503 (EC-3).

## Dependent Tasks
- `us_007` (EP-DATA-I) — `users` table with `email`, `password_hash`, `role`, `status` columns must exist
- `us_015` (EP-DATA-II) — `IAuditLogRepository` with `AddAsync()` must exist
- `us_017 task_002` — `AuthController` skeleton; `User` entity `Activate()`, `VerificationToken` fields; env var `EMAIL_VERIFICATION_KEY` already in `StartupGuard`
- `us_005` (EP-TECH) — JWT infrastructure: `ITokenService` or equivalent DI registration; `JWT_SIGNING_KEY` validated by `StartupGuard`

## Impacted Components
- `/src/Api/Controllers/AuthController.cs` — MODIFY: add `Login`, `Logout`, `Refresh` action methods
- `/src/Application/Auth/Commands/LoginUserCommand.cs` — CREATE: command + handler
- `/src/Application/Auth/Commands/LogoutUserCommand.cs` — CREATE: command + handler
- `/src/Application/Auth/Commands/RefreshTokenCommand.cs` — CREATE: command + handler
- `/src/Application/Auth/IJwtService.cs` — CREATE (or confirm from us_005): interface for JWT issuance and `jti` extraction
- `/src/Application/Auth/IRefreshTokenService.cs` — CREATE: interface for Redis refresh token CRUD
- `/src/Infrastructure/Auth/JwtService.cs` — CREATE or MODIFY: `IssueAccessToken()`, `GetJti()`, `GetRemainingLifetime()`
- `/src/Infrastructure/Auth/RedisRefreshTokenService.cs` — CREATE: `StoreAsync()`, `ValidateAndRotateAsync()`, `DeleteAsync()`
- `/src/Infrastructure/Auth/JwtBlocklistMiddleware.cs` — CREATE: request pipeline middleware; checks `blocklist:{jti}` in Redis before routing
- `/src/Api/Program.cs` — MODIFY: register `JwtBlocklistMiddleware`, Hangfire, RBAC policies, `IRefreshTokenService`

## Implementation Plan

1. **Create `IJwtService` and `JwtService`** — JWT issuance with `jti` claim:
   ```csharp
   // /src/Application/Auth/IJwtService.cs
   public interface IJwtService
   {
       string IssueAccessToken(Guid userId, string email, string role);
       string GetJti(string token);
       TimeSpan GetRemainingLifetime(string token);
   }

   // /src/Infrastructure/Auth/JwtService.cs
   public class JwtService : IJwtService
   {
       private readonly string _signingKey;
       private const int AccessTokenMinutes = 15;

       public JwtService(IConfiguration config)
       {
           _signingKey = config["JWT_SIGNING_KEY"]
               ?? throw new InvalidOperationException("JWT_SIGNING_KEY is not configured.");
       }

       public string IssueAccessToken(Guid userId, string email, string role)
       {
           var jti = Guid.NewGuid().ToString();
           var claims = new[]
           {
               new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
               new Claim(JwtRegisteredClaimNames.Jti, jti),
               new Claim(ClaimTypes.Role, role),
               // OWASP A07: email NOT included in JWT payload — userId is sufficient for all API operations
           };
           var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_signingKey));
           var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
           var token = new JwtSecurityToken(
               issuer: "propeliq",
               audience: "propeliq-api",
               claims: claims,
               expires: DateTime.UtcNow.AddMinutes(AccessTokenMinutes),
               signingCredentials: creds);
           return new JwtSecurityTokenHandler().WriteToken(token);
       }

       public string GetJti(string token)
       {
           var handler = new JwtSecurityTokenHandler();
           var jwt = handler.ReadJwtToken(token);
           return jwt.Id;
       }

       public TimeSpan GetRemainingLifetime(string token)
       {
           var handler = new JwtSecurityTokenHandler();
           var jwt = handler.ReadJwtToken(token);
           var remaining = jwt.ValidTo - DateTime.UtcNow;
           return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
       }
   }
   ```

2. **Create `IRefreshTokenService` and `RedisRefreshTokenService`** — Redis-backed refresh token storage:
   ```csharp
   // /src/Application/Auth/IRefreshTokenService.cs
   public interface IRefreshTokenService
   {
       Task StoreAsync(Guid userId, string refreshToken, CancellationToken ct = default);
       Task<bool> ValidateAndRotateAsync(Guid userId, string refreshToken, string newRefreshToken, CancellationToken ct = default);
       Task DeleteAsync(Guid userId, CancellationToken ct = default);
       Task BlocklistJtiAsync(string jti, TimeSpan ttl, CancellationToken ct = default);
       Task<bool> IsBlocklistedAsync(string jti, CancellationToken ct = default);
   }

   // /src/Infrastructure/Auth/RedisRefreshTokenService.cs
   public class RedisRefreshTokenService : IRefreshTokenService
   {
       private readonly IConnectionMultiplexer _redis;
       private const int RefreshTokenDays = 7;

       // Key patterns:
       private static string RefreshKey(Guid userId) => $"refresh_token:{userId}";
       private static string BlocklistKey(string jti) => $"blocklist:{jti}";

       public async Task StoreAsync(Guid userId, string refreshToken, CancellationToken ct = default)
       {
           var db = _redis.GetDatabase();
           await db.StringSetAsync(RefreshKey(userId), refreshToken, TimeSpan.FromDays(RefreshTokenDays));
       }

       public async Task<bool> ValidateAndRotateAsync(Guid userId, string refreshToken, string newRefreshToken, CancellationToken ct = default)
       {
           var db = _redis.GetDatabase();
           var stored = await db.StringGetAsync(RefreshKey(userId));
           if (!stored.HasValue || stored != refreshToken) return false;
           // Rotate: delete old, store new (atomic-ish — acceptable for Redis single-instance)
           await db.KeyDeleteAsync(RefreshKey(userId));
           await db.StringSetAsync(RefreshKey(userId), newRefreshToken, TimeSpan.FromDays(RefreshTokenDays));
           return true;
       }

       public async Task DeleteAsync(Guid userId, CancellationToken ct = default)
       {
           var db = _redis.GetDatabase();
           await db.KeyDeleteAsync(RefreshKey(userId));
       }

       public async Task BlocklistJtiAsync(string jti, TimeSpan ttl, CancellationToken ct = default)
       {
           var db = _redis.GetDatabase();
           await db.StringSetAsync(BlocklistKey(jti), "1", ttl);
       }

       public async Task<bool> IsBlocklistedAsync(string jti, CancellationToken ct = default)
       {
           var db = _redis.GetDatabase();
           return await db.KeyExistsAsync(BlocklistKey(jti));
       }
   }
   ```

3. **Create `JwtBlocklistMiddleware`** — checked before controller routing (AC-6, EC-2):
   ```csharp
   // /src/Infrastructure/Auth/JwtBlocklistMiddleware.cs
   public class JwtBlocklistMiddleware
   {
       private readonly RequestDelegate _next;

       public JwtBlocklistMiddleware(RequestDelegate next) => _next = next;

       public async Task InvokeAsync(HttpContext context, IRefreshTokenService tokenService, ILogger<JwtBlocklistMiddleware> logger)
       {
           var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
           if (authHeader?.StartsWith("Bearer ") == true)
           {
               var token = authHeader["Bearer ".Length..];
               try
               {
                   var handler = new JwtSecurityTokenHandler();
                   if (handler.CanReadToken(token))
                   {
                       var jwt = handler.ReadJwtToken(token);
                       var jti = jwt.Id;
                       if (!string.IsNullOrEmpty(jti) && await tokenService.IsBlocklistedAsync(jti))
                       {
                           context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                           await context.Response.WriteAsJsonAsync(new { message = "Token has been revoked." });
                           return;
                       }
                   }
               }
               catch
               {
                   // Malformed token — let the authentication middleware handle it
               }
           }
           await _next(context);
       }
   }
   ```
   Register in `Program.cs` AFTER `app.UseAuthentication()` and BEFORE `app.UseAuthorization()`:
   ```csharp
   app.UseAuthentication();
   app.UseMiddleware<JwtBlocklistMiddleware>();   // blocklist check before authorization
   app.UseAuthorization();
   ```

4. **Create `LoginUserCommandHandler`** (AC-1, AC-2, EC-1):
   ```csharp
   public class LoginUserCommandHandler : IRequestHandler<LoginUserCommand, LoginResult>
   {
       public async Task<LoginResult> Handle(LoginUserCommand request, CancellationToken ct)
       {
           var user = await _users.FindByEmailAsync(request.Email, ct);

           // AC-2 + EC-1: Generic "Invalid credentials" for ALL failure modes — no field or status disclosure
           if (user is null)
           {
               _logger.LogWarning("Login attempt for unknown email.");  // OWASP A07: email NOT logged
               throw new InvalidCredentialsException();
           }

           if (user.Status == UserStatus.Inactive)
           {
               _logger.LogWarning("Login attempt for inactive account. UserId={UserId} Reason=AccountInactive", user.Id);
               throw new InvalidCredentialsException();
           }

           if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
           {
               _logger.LogWarning("Failed login attempt for UserId={UserId}", user.Id);  // OWASP A07: no password logged
               throw new InvalidCredentialsException();
           }

           // AC-1: Issue tokens
           var accessToken = _jwtService.IssueAccessToken(user.Id, user.Email, user.Role.ToString());
           var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
           await _refreshTokenService.StoreAsync(user.Id, refreshToken, ct);

           // AC-1: Audit log
           var auditLog = AuditLog.Create(
               entityType: "User",
               entityId: user.Id.ToString(),
               actionType: "UserLoggedIn",
               performedBy: user.Id.ToString(),
               changeSummary: "Successful login.");
           await _auditLogs.AddAsync(auditLog, ct);
           await _unitOfWork.SaveChangesAsync(ct);

           return new LoginResult(accessToken, refreshToken);
       }
   }
   ```

5. **Create `LogoutUserCommandHandler`** (AC-6, EC-3):
   ```csharp
   public class LogoutUserCommandHandler : IRequestHandler<LogoutUserCommand, Unit>
   {
       public async Task<Unit> Handle(LogoutUserCommand request, CancellationToken ct)
       {
           try
           {
               // AC-6: Blocklist current JWT jti with TTL = remaining lifetime
               var jti = _jwtService.GetJti(request.AccessToken);
               var remaining = _jwtService.GetRemainingLifetime(request.AccessToken);
               if (remaining > TimeSpan.Zero)
                   await _refreshTokenService.BlocklistJtiAsync(jti, remaining, ct);

               // AC-6: Delete refresh token from Redis
               await _refreshTokenService.DeleteAsync(request.UserId, ct);
           }
           catch (RedisException ex)
           {
               // EC-3: Redis unavailable — throw specific exception; controller returns 503
               _logger.LogError(ex, "Redis unavailable during logout for UserId={UserId}", request.UserId);
               throw new RedisUnavailableException("Logout service temporarily unavailable.");
           }

           return Unit.Value;
       }
   }
   ```

6. **Create `RefreshTokenCommandHandler`** (AC-5):
   ```csharp
   public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, RefreshTokenResult>
   {
       public async Task<RefreshTokenResult> Handle(RefreshTokenCommand request, CancellationToken ct)
       {
           // Validate userId can be extracted from the expired token (read without validation)
           var handler = new JwtSecurityTokenHandler();
           JwtSecurityToken? expiredJwt;
           try { expiredJwt = handler.ReadJwtToken(request.ExpiredAccessToken); }
           catch { throw new InvalidTokenException(); }

           if (!Guid.TryParse(expiredJwt.Subject, out var userId))
               throw new InvalidTokenException();

           var user = await _users.FindByIdAsync(userId, ct)
               ?? throw new InvalidTokenException();

           // AC-5: Validate stored refresh token and rotate
           var newRefreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
           var isValid = await _refreshTokenService.ValidateAndRotateAsync(userId, request.RefreshToken, newRefreshToken, ct);
           if (!isValid) throw new InvalidTokenException();

           // Issue new access token
           var newAccessToken = _jwtService.IssueAccessToken(user.Id, user.Email, user.Role.ToString());
           return new RefreshTokenResult(newAccessToken, newRefreshToken);
       }
   }
   ```

7. **Add `Login`, `Logout`, `Refresh` to `AuthController`** (AC-1–AC-6):
   ```csharp
   [HttpPost("login")]
   [AllowAnonymous]
   [ProducesResponseType(StatusCodes.Status200OK)]
   [ProducesResponseType(StatusCodes.Status401Unauthorized)]
   public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
   {
       try
       {
           var result = await _mediator.Send(new LoginUserCommand(request.Email, request.Password), ct);
           return Ok(new { access_token = result.AccessToken, refresh_token = result.RefreshToken });
       }
       catch (InvalidCredentialsException)
       {
           return Unauthorized(new { message = "Invalid credentials." });  // AC-2 — generic; no field disclosure
       }
   }

   [HttpPost("logout")]
   [Authorize]
   [ProducesResponseType(StatusCodes.Status200OK)]
   [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
   public async Task<IActionResult> Logout([FromBody] LogoutRequest request, CancellationToken ct)
   {
       var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
       var accessToken = HttpContext.Request.Headers.Authorization.FirstOrDefault()?["Bearer ".Length..] ?? string.Empty;
       try
       {
           await _mediator.Send(new LogoutUserCommand(userId, accessToken, request.RefreshToken), ct);
           return Ok(new { message = "Signed out successfully." });
       }
       catch (RedisUnavailableException)
       {
           return StatusCode(503, new { message = "Could not sign out — try again." });  // EC-3
       }
   }

   [HttpPost("refresh")]
   [AllowAnonymous]
   [ProducesResponseType(StatusCodes.Status200OK)]
   [ProducesResponseType(StatusCodes.Status401Unauthorized)]
   public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request, CancellationToken ct)
   {
       try
       {
           var result = await _mediator.Send(new RefreshTokenCommand(request.ExpiredAccessToken, request.RefreshToken), ct);
           return Ok(new { access_token = result.AccessToken, refresh_token = result.RefreshToken });
       }
       catch (InvalidTokenException)
       {
           return Unauthorized(new { message = "Session expired. Please log in again." });
       }
   }
   ```

8. **Configure RBAC authorization policies in `Program.cs`** (AC-3, AC-4):
   ```csharp
   // In Program.cs — after AddAuthentication():
   builder.Services.AddAuthorization(options =>
   {
       options.AddPolicy("PatientOnly",  p => p.RequireRole("Patient"));
       options.AddPolicy("StaffOrAbove", p => p.RequireRole("Staff", "Admin"));
       options.AddPolicy("AdminOnly",    p => p.RequireRole("Admin"));
   });

   // Global 403 response — log WARN (AC-3/AC-4):
   builder.Services.AddSingleton<IAuthorizationMiddlewareResultHandler, RbacAuthorizationResultHandler>();

   // RbacAuthorizationResultHandler.cs — handles 403:
   public class RbacAuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
   {
       private readonly AuthorizationMiddlewareResultHandler _default = new();
       private readonly ILogger<RbacAuthorizationResultHandler> _logger;

       public async Task HandleAsync(RequestDelegate next, HttpContext context,
           AuthorizationPolicy policy, PolicyAuthorizationResult authorizeResult)
       {
           if (authorizeResult.Forbidden)
           {
               var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous";
               var path = context.Request.Path;
               _logger.LogWarning("Access denied. UserId={UserId} Path={Path}", userId, path);  // AC-3/AC-4
               context.Response.StatusCode = StatusCodes.Status403Forbidden;
               await context.Response.WriteAsJsonAsync(new { message = "Access denied." });
               return;
           }
           await _default.HandleAsync(next, context, policy, authorizeResult);
       }
   }
   ```

   Apply to controllers with `[Authorize(Policy = "AdminOnly")]`, `[Authorize(Policy = "StaffOrAbove")]`, `[Authorize(Policy = "PatientOnly")]` as appropriate.

   > **Note**: `WWW-Authenticate: Bearer error="token_expired"` header for expired tokens (AC-5) is set by the JWT bearer authentication handler when `TokenValidationParameters.ClockSkew = TimeSpan.Zero`. Ensure this is configured in the JWT bearer options:
   ```csharp
   .AddJwtBearer(options =>
   {
       options.TokenValidationParameters = new TokenValidationParameters
       {
           ValidateIssuer = true, ValidIssuer = "propeliq",
           ValidateAudience = true, ValidAudience = "propeliq-api",
           ValidateIssuerSigningKey = true,
           IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
           ValidateLifetime = true,
           ClockSkew = TimeSpan.Zero,   // AC-5: strict expiry — no tolerance window
       };
       options.Events = new JwtBearerEvents
       {
           OnChallenge = ctx =>
           {
               if (ctx.AuthenticateFailure?.GetType() == typeof(SecurityTokenExpiredException))
               {
                   ctx.Response.Headers.WWWAuthenticate = "Bearer error=\"token_expired\"";  // AC-5
               }
               return Task.CompletedTask;
           }
       };
   });
   ```

## Domain Exceptions to Create
| Exception Class | HTTP Mapping | Description |
|-----------------|-------------|-------------|
| `InvalidCredentialsException` | 401 Unauthorized | Generic auth failure (covers wrong password, inactive account, unknown email) |
| `RedisUnavailableException` | 503 Service Unavailable | Redis connection failure during logout |
| `InvalidTokenException` | 401 Unauthorized | Refresh token invalid, expired, or not in Redis |

## Current Project State
```
/src/
├── Api/Controllers/
│   └── AuthController.cs                # MODIFY — add Login, Logout, Refresh (Register/Verify already added by us_017)
├── Application/Auth/
│   ├── Commands/
│   │   ├── RegisterUserCommandHandler.cs    # CREATED (us_017 task_002)
│   │   ├── VerifyEmailCommandHandler.cs     # CREATED (us_017 task_002)
│   │   ├── ResendVerificationCommandHandler.cs # CREATED (us_017 task_002)
│   │   ├── LoginUserCommand.cs              # NOT YET CREATED
│   │   ├── LogoutUserCommand.cs             # NOT YET CREATED
│   │   └── RefreshTokenCommand.cs           # NOT YET CREATED
│   ├── IJwtService.cs                       # NOT YET CREATED (confirm vs us_005)
│   └── IRefreshTokenService.cs              # NOT YET CREATED
├── Infrastructure/Auth/
│   ├── EmailVerificationTokenService.cs     # CREATED (us_017 task_002)
│   ├── JwtService.cs                        # NOT YET CREATED (confirm vs us_005)
│   ├── RedisRefreshTokenService.cs          # NOT YET CREATED
│   └── JwtBlocklistMiddleware.cs            # NOT YET CREATED
├── Api/Program.cs                           # MODIFY — register middleware, RBAC policies, Redis services
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/src/Application/Auth/IJwtService.cs` | `IssueAccessToken()`, `GetJti()`, `GetRemainingLifetime()` |
| CREATE | `/src/Infrastructure/Auth/JwtService.cs` | HS256 JWT; `jti = Guid.NewGuid()`; `ClockSkew = TimeSpan.Zero`; email NOT in payload (OWASP A07) |
| CREATE | `/src/Application/Auth/IRefreshTokenService.cs` | `StoreAsync`, `ValidateAndRotateAsync`, `DeleteAsync`, `BlocklistJtiAsync`, `IsBlocklistedAsync` |
| CREATE | `/src/Infrastructure/Auth/RedisRefreshTokenService.cs` | Upstash Redis via StackExchange.Redis; key patterns `refresh_token:{userId}`, `blocklist:{jti}` |
| CREATE | `/src/Infrastructure/Auth/JwtBlocklistMiddleware.cs` | Checks `blocklist:{jti}` before routing; returns 401 on hit |
| CREATE | `/src/Application/Auth/Commands/LoginUserCommandHandler.cs` | BCrypt.Verify; AC-2 generic error; AC-1 tokens + audit; EC-1 Inactive → same 401 |
| CREATE | `/src/Application/Auth/Commands/LogoutUserCommandHandler.cs` | Blocklist jti; delete refresh key; EC-3 `RedisUnavailableException` on `RedisException` |
| CREATE | `/src/Application/Auth/Commands/RefreshTokenCommandHandler.cs` | Read expired JWT subject; `ValidateAndRotateAsync`; issue new access token |
| MODIFY | `/src/Api/Controllers/AuthController.cs` | Add `Login`, `Logout`, `Refresh` actions; 503 on `RedisUnavailableException` |
| MODIFY | `/src/Api/Program.cs` | Register `JwtBlocklistMiddleware`, `RedisRefreshTokenService`, `JwtService`, RBAC policies, `RbacAuthorizationResultHandler`; configure `ClockSkew = TimeSpan.Zero`; `OnChallenge` sets `WWW-Authenticate: Bearer error="token_expired"` |

## StartupGuard Extension
Confirm `JWT_SIGNING_KEY` and `REDIS_CONNECTION_STRING` are validated by `StartupGuard.ValidateEnvironment()`. Add `REDIS_CONNECTION_STRING` if not present:
```csharp
// In StartupGuard.cs — confirm or add:
"JWT_SIGNING_KEY",          // already present from us_005
"REDIS_CONNECTION_STRING"   // Upstash Redis URL — add if not present
```

## Implementation Validation Strategy
- [ ] `POST /api/auth/login` with valid `Active` user → HTTP 200 `{access_token, refresh_token}`; Redis key `refresh_token:{userId}` set with 7-day TTL; `audit_logs` row `action_type = 'UserLoggedIn'`
- [ ] `POST /api/auth/login` with wrong password → HTTP 401 `{"message":"Invalid credentials."}`; no audit log entry
- [ ] `POST /api/auth/login` with `status = Inactive` → HTTP 401 `{"message":"Invalid credentials."}`; Serilog WARN with `Reason=AccountInactive`
- [ ] `POST /api/auth/login` with unknown email → HTTP 401 `{"message":"Invalid credentials."}`; email NOT logged
- [ ] `GET /api/admin/users` with Patient JWT → HTTP 403 `{"message":"Access denied."}`; Serilog WARN logged (AC-3)
- [ ] `DELETE /api/admin/users/{id}` with Staff JWT → HTTP 403 `{"message":"Access denied."}` (AC-4)
- [ ] Request with expired JWT → HTTP 401 with `WWW-Authenticate: Bearer error="token_expired"` header (AC-5)
- [ ] `POST /api/auth/refresh` with valid refresh token → HTTP 200 `{access_token, refresh_token}`; old refresh key deleted in Redis; new key written
- [ ] `POST /api/auth/refresh` with invalid refresh token → HTTP 401
- [ ] `POST /api/auth/logout` → JWT `jti` blocklisted in Redis; subsequent request with same JWT → HTTP 401 (AC-6/EC-2)
- [ ] Redis `KeyExistsAsync` returns true for blocklisted jti → `JwtBlocklistMiddleware` returns 401 before controller
- [ ] Simulate Redis unavailable on `POST /api/auth/logout` → HTTP 503 (EC-3); no silent bypass

## Implementation Checklist
- [ ] `JwtService.IssueAccessToken()` sets `jti = Guid.NewGuid()` on every token
- [ ] `JwtService` does NOT include email in JWT payload (OWASP A07 — userId is sufficient)
- [ ] `ClockSkew = TimeSpan.Zero` on `TokenValidationParameters` — strict expiry enforcement (AC-5)
- [ ] `OnChallenge` event handler sets `WWW-Authenticate: Bearer error="token_expired"` only when `SecurityTokenExpiredException` (AC-5)
- [ ] `LoginUserCommandHandler` returns same `InvalidCredentialsException` for wrong password, unknown email, AND inactive account — no disclosure differentiation (AC-2/EC-1/OWASP A07)
- [ ] Failed login attempts are NOT written to `audit_logs` (AC-2 — only successful logins are audited)
- [ ] `RedisRefreshTokenService.ValidateAndRotateAsync()` uses `StringGetAsync` + compare THEN rotate — not a swap-and-check pattern that could allow replay
- [ ] `JwtBlocklistMiddleware` registered AFTER `UseAuthentication()` and BEFORE `UseAuthorization()` in `Program.cs`
- [ ] `RbacAuthorizationResultHandler` logs `WARN` with `UserId` and `Path` on 403 (AC-3/AC-4); never logs request body or PHI
- [ ] `REDIS_CONNECTION_STRING` validated by `StartupGuard.ValidateEnvironment()`
- [ ] `LogoutUserCommandHandler` catches `RedisException` specifically — not all exceptions — and re-throws `RedisUnavailableException` (EC-3 must not mask other errors)
- [ ] `RefreshToken` value is `RandomNumberGenerator.GetBytes(64)` encoded as Base64 — cryptographically random (OWASP A02)
