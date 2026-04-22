---
title: "Task — Redis Blocklist (JWT jti Logout), Refresh Token Rotation & Replay Prevention"
task_id: task_003
story_id: us_005
epic: EP-TECH
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_003

## Requirement Reference
- User Story: [us_005] — JWT Authentication Infrastructure (Identity + BCrypt + Redis Blocklist)
- Story Location: `.propel/context/tasks/EP-TECH/us_005/us_005.md`
- Acceptance Criteria:
  - AC-1 (partial): Refresh token issued at login is stored in Redis with TTL equal to refresh token lifetime
  - AC-3: `POST /api/auth/logout` adds JWT `jti` to Redis blocklist with TTL = token's remaining expiry; subsequent requests with that JWT return HTTP 401
  - AC-6: Redis inspection via `redis-cli SCAN`/`GET` shows only opaque token identifiers and TTL metadata; no PHI in any Redis value
  - AC-7: `POST /api/auth/refresh` invalidates the old refresh token (deleted from Redis), issues new access + refresh tokens, stores new refresh token in Redis; replaying the old refresh token returns HTTP 401 (replay prevention)
  - Edge Case 1: Redis temporarily unreachable → auth middleware falls back to stateless JWT signature-only validation; logs `WARNING` circuit-open event to Serilog; no security bypass
  - Edge Case 4: Concurrent refresh token submission (race condition) → Redis `SET NX` lock on refresh token ID; only one request succeeds; second request returns HTTP 401 and token family is revoked

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
| Cache Client | StackExchange.Redis | 2.x |
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
Implement `ITokenBlocklistService` backed by `StackExchange.Redis` to maintain the JWT `jti` blocklist and refresh token store. Integrate the blocklist check into the JWT Bearer pipeline via a custom `ITokenValidator` or `OnTokenValidated` event. Implement refresh token rotation (`POST /api/auth/refresh`) with `SET NX` concurrency locking to prevent replay attacks. All Redis values must be opaque identifiers only — no PHI. Implement a circuit-breaker pattern for Redis unavailability that falls back to signature-only JWT validation with a Serilog warning.

## Dependent Tasks
- `task_001_be_identity_bcrypt_user.md` — `ApplicationUser`, `AppRoles` must exist.
- `task_002_be_jwt_token_service.md` — `IJwtTokenService` and `GetJtiFromToken()` must exist; JWT Bearer pipeline must be configured.
- `us_003 task_001_infra_docker_compose_services.md` — Redis must be running at `REDIS_URL`.

## Impacted Components
- `/api/Api.csproj` — MODIFY (StackExchange.Redis already added in us_003 task_003; verify — no duplicate)
- `/api/Features/Auth/Services/ITokenBlocklistService.cs` — CREATE: interface for blocklist + refresh token store
- `/api/Features/Auth/Services/RedisTokenBlocklistService.cs` — CREATE: Redis-backed implementation
- `/api/Features/Auth/Services/RefreshTokenService.cs` — CREATE: refresh token generation, rotation, and Redis storage
- `/api/Features/Auth/Services/IRefreshTokenService.cs` — CREATE: interface for refresh token operations
- `/api/Program.cs` — MODIFY: register Redis `IConnectionMultiplexer`, register `ITokenBlocklistService`, add `OnTokenValidated` event to JWT Bearer options
- `/api/appsettings.json` — MODIFY: add `Redis:Url` and `Jwt:RefreshTokenTtlDays`

## Implementation Plan

1. **Verify / register Redis `IConnectionMultiplexer`** in `Program.cs`:
   ```csharp
   var redisUrl = builder.Configuration["REDIS_URL"]
       ?? Environment.GetEnvironmentVariable("REDIS_URL")
       ?? "redis://localhost:6379";

   builder.Services.AddSingleton<IConnectionMultiplexer>(
       ConnectionMultiplexer.Connect(redisUrl));
   ```
   `IConnectionMultiplexer` is `Singleton` — one connection per process, shared across all requests.

2. **Create `Features/Auth/Services/ITokenBlocklistService.cs`**:
   ```csharp
   namespace Api.Features.Auth.Services;

   public interface ITokenBlocklistService
   {
       /// <summary>Adds a JWT jti to the blocklist with the given TTL (token remaining expiry).</summary>
       Task BlockTokenAsync(string jti, TimeSpan ttl, CancellationToken ct = default);

       /// <summary>Returns true if the jti is on the blocklist (token has been logged out).</summary>
       Task<bool> IsBlockedAsync(string jti, CancellationToken ct = default);
   }
   ```

3. **Create `Features/Auth/Services/RedisTokenBlocklistService.cs`**:
   ```csharp
   using StackExchange.Redis;
   using Serilog;

   namespace Api.Features.Auth.Services;

   public class RedisTokenBlocklistService(IConnectionMultiplexer redis) : ITokenBlocklistService
   {
       private const string KeyPrefix = "blocklist:jti:";  // opaque prefix — no PHI

       public async Task BlockTokenAsync(string jti, TimeSpan ttl, CancellationToken ct = default)
       {
           try
           {
               var db  = redis.GetDatabase();
               var key = $"{KeyPrefix}{jti}";
               // Value is "1" (opaque marker) — no user data stored (AC-6 / TR-006)
               await db.StringSetAsync(key, "1", ttl);
           }
           catch (RedisException ex)
           {
               // Redis unavailable: log warning but do not throw — token expiry will handle cleanup
               Log.Warning(ex, "Redis unavailable when blocking token jti={Jti}; token will expire naturally", jti);
           }
       }

       public async Task<bool> IsBlockedAsync(string jti, CancellationToken ct = default)
       {
           try
           {
               var db  = redis.GetDatabase();
               return await db.KeyExistsAsync($"{KeyPrefix}{jti}");
           }
           catch (RedisException ex)
           {
               // Circuit-open fallback (EC-1): log WARNING, fall back to allowing the request
               // JWT signature + expiry validation still applies — not a full bypass
               Log.Warning(ex, "Redis unavailable during blocklist check for jti={Jti}; falling back to stateless validation", jti);
               return false;  // assume not blocked — stateless JWT validation is the safety net
           }
       }
   }
   ```

4. **Add `OnTokenValidated` event to JWT Bearer options in `Program.cs`** to enforce the blocklist:
   ```csharp
   opts.Events = new JwtBearerEvents
   {
       // ...existing OnChallenge and OnAuthenticationFailed from task_002...
       OnTokenValidated = async ctx =>
       {
           var blocklist = ctx.HttpContext.RequestServices
               .GetRequiredService<ITokenBlocklistService>();
           var jti = ctx.Principal?.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti)?.Value;
           if (jti is not null && await blocklist.IsBlockedAsync(jti, ctx.HttpContext.RequestAborted))
           {
               ctx.Fail("Token has been revoked");
           }
       }
   };
   ```

5. **Create `Features/Auth/Services/IRefreshTokenService.cs`**:
   ```csharp
   namespace Api.Features.Auth.Services;

   public interface IRefreshTokenService
   {
       Task<string>  CreateAndStoreRefreshTokenAsync(string userId, CancellationToken ct = default);
       Task<string?> ValidateAndConsumeRefreshTokenAsync(string refreshToken, CancellationToken ct = default);
       Task          RevokeAllUserRefreshTokensAsync(string userId, CancellationToken ct = default);
   }
   ```

6. **Create `Features/Auth/Services/RefreshTokenService.cs`** — Redis-backed, replay-safe:
   ```csharp
   using System.Security.Cryptography;
   using StackExchange.Redis;
   using Serilog;

   namespace Api.Features.Auth.Services;

   public class RefreshTokenService(IConnectionMultiplexer redis, IConfiguration config) : IRefreshTokenService
   {
       private static readonly TimeSpan DefaultTtl = TimeSpan.FromDays(
           int.TryParse(config["Jwt:RefreshTokenTtlDays"], out var d) ? d : 30);

       private const string TokenKeyPrefix  = "refresh:token:";   // key = hashed token value
       private const string UserKeyPrefix   = "refresh:user:";    // key = userId → set of token hashes
       private const string LockKeyPrefix   = "refresh:lock:";    // NX lock for concurrent refresh

       public async Task<string> CreateAndStoreRefreshTokenAsync(string userId, CancellationToken ct = default)
       {
           var rawToken   = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
           var tokenHash  = Convert.ToBase64String(
               System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken)));

           var db      = redis.GetDatabase();
           var tokenKey = $"{TokenKeyPrefix}{tokenHash}";

           // Store opaque userId against the token hash — NO PHI (AC-6)
           await db.StringSetAsync(tokenKey, userId, DefaultTtl);

           // Track token family per user for full revocation (EC-4)
           await db.SetAddAsync($"{UserKeyPrefix}{userId}", tokenHash);
           await db.KeyExpireAsync($"{UserKeyPrefix}{userId}", DefaultTtl);

           return rawToken;   // raw token returned to client; only hash stored in Redis
       }

       public async Task<string?> ValidateAndConsumeRefreshTokenAsync(string refreshToken, CancellationToken ct = default)
       {
           var tokenHash = Convert.ToBase64String(
               System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(refreshToken)));

           var db       = redis.GetDatabase();
           var lockKey  = $"{LockKeyPrefix}{tokenHash}";
           var tokenKey = $"{TokenKeyPrefix}{tokenHash}";

           // SET NX lock — only one concurrent refresh per token (EC-4)
           var lockAcquired = await db.StringSetAsync(lockKey, "1",
               TimeSpan.FromSeconds(10), When.NotExists);

           if (!lockAcquired)
           {
               // Another request is already processing this token — revoke entire family as precaution (EC-4)
               var storedUser = await db.StringGetAsync(tokenKey);
               if (storedUser.HasValue)
                   await RevokeAllUserRefreshTokensAsync(storedUser!, ct);
               Log.Warning("Concurrent refresh token attempt detected for token hash {Hash}; family revoked", tokenHash);
               return null;
           }

           try
           {
               var userId = await db.StringGetAsync(tokenKey);
               if (!userId.HasValue) return null;   // token not found or already consumed

               // Delete the consumed token (one-time use — AC-7)
               await db.KeyDeleteAsync(tokenKey);
               await db.SetRemoveAsync($"{UserKeyPrefix}{userId}", tokenHash);

               return userId;
           }
           finally
           {
               await db.KeyDeleteAsync(lockKey);
           }
       }

       public async Task RevokeAllUserRefreshTokensAsync(string userId, CancellationToken ct = default)
       {
           var db     = redis.GetDatabase();
           var hashes = await db.SetMembersAsync($"{UserKeyPrefix}{userId}");
           var batch  = db.CreateBatch();
           foreach (var hash in hashes)
               _ = batch.KeyDeleteAsync($"{TokenKeyPrefix}{hash}");
           _ = batch.KeyDeleteAsync($"{UserKeyPrefix}{userId}");
           batch.Execute();
       }
   }
   ```

7. **Register services in `Program.cs`**:
   ```csharp
   builder.Services.AddScoped<ITokenBlocklistService, RedisTokenBlocklistService>();
   builder.Services.AddScoped<IRefreshTokenService, RefreshTokenService>();
   ```

8. **Update `appsettings.json`** — add refresh token TTL:
   ```json
   {
     "Jwt": {
       "AccessTokenTtlMinutes": 15,
       "RefreshTokenTtlDays": 30
     }
   }
   ```

## Current Project State
```
/api/
├── Api.csproj                        # StackExchange.Redis already added (us_003 task_003)
├── Program.cs                        # task_002: JWT Bearer with OnChallenge/OnAuthenticationFailed — WILL BE MODIFIED
├── appsettings.json                  # task_002: Jwt section — WILL BE MODIFIED
└── Features/Auth/
    ├── Models/
    │   ├── ApplicationUser.cs        # task_001
    │   └── AppRoles.cs              # task_001
    └── Services/
        ├── IJwtTokenService.cs       # task_002
        └── JwtTokenService.cs       # task_002
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `/api/Program.cs` | Register `IConnectionMultiplexer` (Singleton), `ITokenBlocklistService`, `IRefreshTokenService`; add `OnTokenValidated` event to JWT Bearer options |
| CREATE | `/api/Features/Auth/Services/ITokenBlocklistService.cs` | Interface: `BlockTokenAsync(jti, ttl)`, `IsBlockedAsync(jti)` |
| CREATE | `/api/Features/Auth/Services/RedisTokenBlocklistService.cs` | Redis impl: key = `blocklist:jti:{jti}`, value = `"1"` (opaque), TTL = remaining token expiry; Redis failure → Serilog WARNING + fallback `false` |
| CREATE | `/api/Features/Auth/Services/IRefreshTokenService.cs` | Interface: `CreateAndStoreRefreshTokenAsync`, `ValidateAndConsumeRefreshTokenAsync`, `RevokeAllUserRefreshTokensAsync` |
| CREATE | `/api/Features/Auth/Services/RefreshTokenService.cs` | Redis impl: store SHA-256 hash of raw token; `SET NX` lock; one-time consumption; family revocation on concurrent attempt |
| MODIFY | `/api/appsettings.json` | Add `Jwt:RefreshTokenTtlDays: 30` |

## External References
- StackExchange.Redis — `IConnectionMultiplexer` singleton pattern: https://stackexchange.github.io/StackExchange.Redis/Configuration
- StackExchange.Redis — `StringSetAsync` with `When.NotExists` (SET NX): https://stackexchange.github.io/StackExchange.Redis/KeysValues
- JWT Bearer `OnTokenValidated` event: https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.authentication.jwtbearer.jwtbearereventsx.ontokenvalidated
- Refresh token rotation security (OWASP): https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html#refresh-token
- TR-006 (no PHI in Redis): project `design.md`

## Build Commands
```bash
# Build
dotnet build api/Api.csproj --configuration Release

# Run API with Redis
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
REDIS_URL="redis://localhost:6379" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet run --project api/Api.csproj

# Verify Redis keys are opaque (no PHI)
docker compose exec redis redis-cli SCAN 0 MATCH "*" COUNT 100
# Keys should match patterns: blocklist:jti:*, refresh:token:*, refresh:user:*
# No patient names, DOBs, or clinical data should appear in key names or values

# Test blocklist: add a jti, verify subsequent requests fail
docker compose exec redis redis-cli SET "blocklist:jti:test-jti-1234" "1" EX 900
```

## Implementation Validation Strategy
- [ ] `BlockTokenAsync("jti-abc", TimeSpan.FromMinutes(15))` creates key `blocklist:jti:jti-abc` in Redis with TTL ≤ 900s
- [ ] `IsBlockedAsync("jti-abc")` returns `true` after `BlockTokenAsync`; returns `false` after TTL expires
- [ ] Redis unavailable: `IsBlockedAsync` returns `false` (fallback) and logs `WARNING` with `RedisException` type (not message/stack)
- [ ] `CreateAndStoreRefreshTokenAsync` returns a base64 raw token; Redis contains only the SHA-256 hash as key, userId as value — no PHI
- [ ] `ValidateAndConsumeRefreshTokenAsync` with same token twice: first call returns userId; second call returns `null` (token consumed)
- [ ] Concurrent `ValidateAndConsumeRefreshTokenAsync` with same token: second concurrent attempt triggers family revocation; both return `null`/HTTP 401
- [ ] `redis-cli SCAN 0 MATCH "*"` shows only `blocklist:jti:*`, `refresh:token:*`, `refresh:user:*` prefixed keys; `GET` on any key returns only opaque identifiers
- [ ] `dotnet build --configuration Release` exits 0

## Implementation Checklist
- [ ] Register `IConnectionMultiplexer` as `Singleton` in `Program.cs` using `REDIS_URL` from env/config
- [ ] Create `ITokenBlocklistService` interface with `BlockTokenAsync` and `IsBlockedAsync`
- [ ] Create `RedisTokenBlocklistService`: key prefix `blocklist:jti:`, value `"1"`, Redis failure → `false` + Serilog WARNING
- [ ] Add `OnTokenValidated` event to JWT Bearer options: resolve `ITokenBlocklistService`, check `jti` claim, call `ctx.Fail()` if blocked
- [ ] Create `IRefreshTokenService` interface with create, validate+consume, revoke-all methods
- [ ] Create `RefreshTokenService`: store SHA-256 hash of raw token; `SET NX` lock for concurrent access (EC-4); one-time consumption; family revocation
- [ ] Register `ITokenBlocklistService` and `IRefreshTokenService` as `Scoped` in `Program.cs`
- [ ] Add `Jwt:RefreshTokenTtlDays: 30` to `appsettings.json`
- [ ] Verify `redis-cli SCAN` shows no PHI in key names or values
- [ ] Run `dotnet build` — confirm zero errors
