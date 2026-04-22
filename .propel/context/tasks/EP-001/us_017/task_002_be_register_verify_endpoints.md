---
title: "Task — Registration & Email Verification API Endpoints, BCrypt Hashing, Signed Token, Hangfire SMTP Retry"
task_id: task_002
story_id: us_017
epic: EP-001
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_017] — Patient Self-Registration with Email Verification
- Story Location: `.propel/context/tasks/EP-001/us_017/us_017.md`
- Acceptance Criteria:
  - AC-1: `POST /api/auth/register` — inserts `users` row with `status = Inactive`, `role = Patient`, writes `audit_logs` entry (`action_type = UserRegistered`), returns HTTP 201
  - AC-3: Email already exists → HTTP 409 Conflict with "An account with this email already exists"; no row inserted; no email sent
  - AC-4: `GET /api/auth/verify?token=XYZ` — valid/unexpired token → update `users.status = Active`, write `audit_logs` (`action_type = EmailVerified`), redirect to SCR-001
  - AC-5: Expired token → HTTP 400 "Verification link expired"; `POST /api/auth/resend-verification` → invalidate old token, issue new signed token, send new email
- Edge Cases:
  - EC-2 (verify idempotent): Already `Active` → HTTP 200 "Your account is already verified", redirect to login
  - EC-3 (SMTP failure): Return HTTP 201 (row created); log `ERROR` to Serilog; Hangfire retry up to 3× within 10 minutes; on all retries failed write `audit_logs` `action_type = EmailVerificationFailed`
  - EC-1 (double-click): Unique email index on `users` causes second registration to return HTTP 409 (handled by existing unique index from us_007)

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
| Email | MailKit / SmtpClient abstraction | N/A |
| Background Jobs | Hangfire | 1.8.x |
| Logging | Serilog 8 | 8.x |
| Auth | JWT (existing infrastructure from US_005) | N/A |
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
Implement three API endpoints on `AuthController`: `POST /api/auth/register`, `GET /api/auth/verify`, and `POST /api/auth/resend-verification`. Registration uses BCrypt hashing (work factor 12), inserts an `Inactive/Patient` user, issues a signed HMAC-SHA256 email verification token with 24-hour TTL, dispatches a Hangfire background job for SMTP delivery (EC-3 retry), and writes `audit_logs`. Verification validates the token signature and expiry, activates the user, and writes a second audit entry. Resend invalidates the previous token and issues a new one.

## Dependent Tasks
- `us_007` (EP-DATA-I) — `users` table migration with unique index on `email` must be applied
- `us_015` (EP-DATA-II) — `AuditLog` entity and `IAuditLogRepository` with `AddAsync()` must exist
- `us_005` (EP-TECH) — JWT infrastructure; `ITokenService` or equivalent may provide HMAC signing primitives

## Impacted Components
- `/src/Api/Controllers/AuthController.cs` — MODIFY or CREATE: add `Register`, `VerifyEmail`, `ResendVerification` action methods
- `/src/Application/Auth/Commands/RegisterUserCommand.cs` — CREATE: MediatR command + handler (or service method if MediatR not in use)
- `/src/Application/Auth/Commands/VerifyEmailCommand.cs` — CREATE: command + handler
- `/src/Application/Auth/Commands/ResendVerificationCommand.cs` — CREATE: command + handler
- `/src/Application/Auth/IEmailVerificationTokenService.cs` — CREATE: interface for token generation/validation
- `/src/Infrastructure/Auth/EmailVerificationTokenService.cs` — CREATE: HMAC-SHA256 signed token implementation
- `/src/Infrastructure/Email/IEmailService.cs` — CREATE: abstraction for SMTP dispatch
- `/src/Infrastructure/Email/HangfireEmailJob.cs` — CREATE: Hangfire background job with 3-retry policy
- `/src/Infrastructure/Email/SmtpEmailService.cs` — CREATE: MailKit-based SMTP implementation
- `/src/Domain/Users/UserStatus.cs` — MODIFY or confirm: `Inactive` and `Active` values exist
- `/src/Infrastructure/Persistence/ApplicationDbContext.cs` — confirm: `Users` DbSet exists (from us_007)

## Implementation Plan

1. **Define `EmailVerificationToken` as a value object in the `users` table** — the signed token is a self-contained HMAC-SHA256 JWT-style string; the raw token value is stored in `users.verification_token` (TEXT, nullable) and `users.verification_token_expires_at` (TIMESTAMPTZ, nullable). No separate table is required. Update the `User` entity to add these two fields if not present (coordinate with us_007 entity definition).

   ```csharp
   // In User entity — add nullable fields (verify against existing User entity from us_007):
   public string? VerificationToken { get; private set; }
   public DateTime? VerificationTokenExpiresAt { get; private set; }

   // Factory update:
   public void SetVerificationToken(string token, DateTime expiresAt)
   {
       VerificationToken = token;
       VerificationTokenExpiresAt = expiresAt;
   }

   public void ClearVerificationToken()
   {
       VerificationToken = null;
       VerificationTokenExpiresAt = null;
   }

   public void Activate()
   {
       if (Status == UserStatus.Active) return;   // idempotent — EC-2
       Status = UserStatus.Active;
       ClearVerificationToken();
   }
   ```

2. **Create `IEmailVerificationTokenService`** — interface + HMAC-SHA256 implementation:
   ```csharp
   // /src/Application/Auth/IEmailVerificationTokenService.cs
   public interface IEmailVerificationTokenService
   {
       string GenerateToken(Guid userId, string email);
       bool ValidateToken(string token, Guid userId, out bool isExpired);
   }

   // /src/Infrastructure/Auth/EmailVerificationTokenService.cs
   // Token format: base64url("{userId}:{email}:{expiresAt}") + "." + base64url(HMAC-SHA256(key, payload))
   // Key sourced from environment variable EMAIL_VERIFICATION_KEY (validated by StartupGuard)
   // TTL: configurable via appsettings — "EmailVerification:TokenTtlHours" (default: 24)
   public class EmailVerificationTokenService : IEmailVerificationTokenService
   {
       private readonly byte[] _key;
       private readonly int _ttlHours;

       public EmailVerificationTokenService(IConfiguration config)
       {
           var keyValue = config["EmailVerification:Key"]
               ?? throw new InvalidOperationException("EmailVerification:Key is not configured.");
           _key = Convert.FromBase64String(keyValue);
           _ttlHours = config.GetValue<int>("EmailVerification:TokenTtlHours", 24);
       }

       public string GenerateToken(Guid userId, string email)
       {
           var expiresAt = DateTime.UtcNow.AddHours(_ttlHours).ToString("O");
           var payload = $"{userId}:{email}:{expiresAt}";
           var payloadBytes = Encoding.UTF8.GetBytes(payload);
           using var hmac = new HMACSHA256(_key);
           var sig = hmac.ComputeHash(payloadBytes);
           return $"{Base64UrlEncode(payloadBytes)}.{Base64UrlEncode(sig)}";
       }

       public bool ValidateToken(string token, Guid userId, out bool isExpired)
       {
           isExpired = false;
           var parts = token.Split('.');
           if (parts.Length != 2) return false;
           var payloadBytes = Base64UrlDecode(parts[0]);
           using var hmac = new HMACSHA256(_key);
           var expectedSig = hmac.ComputeHash(payloadBytes);
           if (!CryptographicOperations.FixedTimeEquals(expectedSig, Base64UrlDecode(parts[1]))) return false;
           // signature valid — check expiry and userId match
           var payload = Encoding.UTF8.GetString(payloadBytes);
           var segments = payload.Split(':');
           if (segments.Length < 3) return false;
           if (!Guid.TryParse(segments[0], out var tokenUserId) || tokenUserId != userId) return false;
           var expiresAt = DateTime.Parse(segments[2], null, System.Globalization.DateTimeStyles.RoundtripKind);
           if (DateTime.UtcNow > expiresAt) { isExpired = true; return false; }
           return true;
       }

       private static string Base64UrlEncode(byte[] data) =>
           Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
       private static byte[] Base64UrlDecode(string s) =>
           Convert.FromBase64String(s.Replace('-', '+').Replace('_', '/').PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
   }
   ```
   > **Security note**: `CryptographicOperations.FixedTimeEquals` prevents timing attacks on HMAC comparison (OWASP A02).

3. **Create `IEmailService` abstraction and `HangfireEmailJob`** (EC-3):
   ```csharp
   // /src/Infrastructure/Email/IEmailService.cs
   public interface IEmailService
   {
       Task SendVerificationEmailAsync(string toEmail, string verificationUrl, CancellationToken ct = default);
   }

   // /src/Infrastructure/Email/HangfireEmailJob.cs
   public class HangfireEmailJob
   {
       private readonly IEmailService _emailService;
       private readonly ILogger<HangfireEmailJob> _logger;
       private readonly IAuditLogRepository _auditLogs;
       private readonly IUserRepository _users;

       public async Task SendVerificationEmailWithRetryAsync(Guid userId, string toEmail, string verificationUrl)
       {
           try
           {
               await _emailService.SendVerificationEmailAsync(toEmail, verificationUrl);
           }
           catch (Exception ex)
           {
               // EC-3: Serilog ERROR — PHI (email) NOT logged; only userId
               _logger.LogError(ex, "Failed to send verification email for UserId={UserId}", userId);
               throw; // Hangfire retries automatically on exception
           }
       }

       // Called by Hangfire OnFailure after all retries exhausted
       public async Task OnAllRetriesExhaustedAsync(Guid userId)
       {
           var log = AuditLog.Create(
               entityType: "User",
               entityId: userId.ToString(),
               actionType: "EmailVerificationFailed",
               performedBy: userId.ToString(),
               changeSummary: "All SMTP retry attempts exhausted.");
           await _auditLogs.AddAsync(log);
       }
   }
   ```
   Hangfire retry policy configured in `Program.cs`:
   ```csharp
   // In Program.cs DI registration — Hangfire auto-retry policy:
   GlobalJobFilters.Filters.Add(new AutomaticRetryAttribute { Attempts = 3, DelaysInSeconds = [120, 300, 600] });
   // 3 retries at 2min, 5min, 10min intervals (within 10-minute window — EC-3)
   ```

4. **Create `RegisterUserCommand` handler** (AC-1, AC-3, EC-3):
   ```csharp
   // /src/Application/Auth/Commands/RegisterUserCommandHandler.cs
   public class RegisterUserCommandHandler : IRequestHandler<RegisterUserCommand, Unit>
   {
       public async Task<Unit> Handle(RegisterUserCommand request, CancellationToken ct)
       {
           // AC-3: Check unique email — query existing user
           var existing = await _users.FindByEmailAsync(request.Email, ct);
           if (existing is not null)
               throw new EmailAlreadyRegisteredException(request.Email);

           // AC-1: Hash password with BCrypt work factor 12
           var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 12);

           // Create user — Inactive, Patient role
           var user = User.Create(
               firstName: request.FirstName,
               lastName: request.LastName,
               email: request.Email,
               passwordHash: passwordHash,
               role: UserRole.Patient,
               status: UserStatus.Inactive);

           // Generate verification token
           var token = _tokenService.GenerateToken(user.Id, user.Email);
           var expiresAt = DateTime.UtcNow.AddHours(24);
           user.SetVerificationToken(token, expiresAt);

           try
           {
               await _users.AddAsync(user, ct);
               await _unitOfWork.SaveChangesAsync(ct);
           }
           catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("unique") == true)
           {
               // EC-1: Race condition double-click — unique constraint hit at DB level
               throw new EmailAlreadyRegisteredException(user.Email);
           }

           // AC-1: Write audit log
           var auditLog = AuditLog.Create(
               entityType: "User",
               entityId: user.Id.ToString(),
               actionType: "UserRegistered",
               performedBy: user.Id.ToString(),
               changeSummary: "Patient self-registration.");
           await _auditLogs.AddAsync(auditLog);
           await _unitOfWork.SaveChangesAsync(ct);

           // EC-3: Enqueue Hangfire job — SMTP failure does NOT block 201 response
           var verificationUrl = $"{_baseUrl}/api/auth/verify?token={Uri.EscapeDataString(token)}&userId={user.Id}";
           BackgroundJob.Enqueue<HangfireEmailJob>(job =>
               job.SendVerificationEmailWithRetryAsync(user.Id, user.Email, verificationUrl));

           return Unit.Value;
       }
   }
   ```

5. **Create `VerifyEmailCommand` handler** (AC-4, AC-5, EC-2):
   ```csharp
   public class VerifyEmailCommandHandler : IRequestHandler<VerifyEmailCommand, VerifyEmailResult>
   {
       public async Task<VerifyEmailResult> Handle(VerifyEmailCommand request, CancellationToken ct)
       {
           var user = await _users.FindByIdAsync(request.UserId, ct)
               ?? throw new UserNotFoundException(request.UserId);

           // EC-2: Already active — idempotent
           if (user.Status == UserStatus.Active)
               return new VerifyEmailResult(AlreadyActive: true);

           // Validate token stored on user matches request token
           if (user.VerificationToken != request.Token)
               throw new InvalidVerificationTokenException();

           bool isExpired;
           bool isValid = _tokenService.ValidateToken(request.Token, request.UserId, out isExpired);

           if (isExpired)
               throw new VerificationTokenExpiredException();   // AC-5 — HTTP 400

           if (!isValid)
               throw new InvalidVerificationTokenException();

           // AC-4: Activate user
           user.Activate();
           await _unitOfWork.SaveChangesAsync(ct);

           var auditLog = AuditLog.Create(
               entityType: "User",
               entityId: user.Id.ToString(),
               actionType: "EmailVerified",
               performedBy: user.Id.ToString(),
               changeSummary: "Email verification completed.");
           await _auditLogs.AddAsync(auditLog);
           await _unitOfWork.SaveChangesAsync(ct);

           return new VerifyEmailResult(AlreadyActive: false);
       }
   }
   ```

6. **Create `ResendVerificationCommand` handler** (AC-5):
   ```csharp
   public class ResendVerificationCommandHandler : IRequestHandler<ResendVerificationCommand, Unit>
   {
       public async Task<Unit> Handle(ResendVerificationCommand request, CancellationToken ct)
       {
           var user = await _users.FindByEmailAsync(request.Email, ct)
               ?? throw new UserNotFoundException(request.Email);

           if (user.Status == UserStatus.Active)
               throw new AccountAlreadyActiveException();

           // AC-5: Invalidate old token, generate new one
           var newToken = _tokenService.GenerateToken(user.Id, user.Email);
           user.SetVerificationToken(newToken, DateTime.UtcNow.AddHours(24));
           await _unitOfWork.SaveChangesAsync(ct);

           var verificationUrl = $"{_baseUrl}/api/auth/verify?token={Uri.EscapeDataString(newToken)}&userId={user.Id}";
           BackgroundJob.Enqueue<HangfireEmailJob>(job =>
               job.SendVerificationEmailWithRetryAsync(user.Id, user.Email, verificationUrl));

           return Unit.Value;
       }
   }
   ```

7. **Create `AuthController` endpoints** (AC-1, AC-3, AC-4, AC-5):
   ```csharp
   // /src/Api/Controllers/AuthController.cs
   [ApiController]
   [Route("api/auth")]
   public class AuthController : ControllerBase
   {
       [HttpPost("register")]
       [AllowAnonymous]
       [ProducesResponseType(StatusCodes.Status201Created)]
       [ProducesResponseType(StatusCodes.Status409Conflict)]
       [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
       public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
       {
           // Server-side password complexity validation (OWASP A03 — never trust client-only validation)
           var validationResult = PasswordComplexityValidator.Validate(request.Password);
           if (!validationResult.IsValid)
               return UnprocessableEntity(new { errors = validationResult.Errors });

           try
           {
               await _mediator.Send(new RegisterUserCommand(request.FirstName, request.LastName, request.Email, request.Password), ct);
               return StatusCode(201);
           }
           catch (EmailAlreadyRegisteredException)
           {
               return Conflict(new { message = "An account with this email already exists." });
           }
       }

       [HttpGet("verify")]
       [AllowAnonymous]
       [ProducesResponseType(StatusCodes.Status302Found)]
       [ProducesResponseType(StatusCodes.Status400BadRequest)]
       public async Task<IActionResult> VerifyEmail([FromQuery] string token, [FromQuery] Guid userId, CancellationToken ct)
       {
           if (string.IsNullOrWhiteSpace(token) || userId == Guid.Empty)
               return BadRequest(new { message = "Invalid verification link." });

           try
           {
               var result = await _mediator.Send(new VerifyEmailCommand(token, userId), ct);
               if (result.AlreadyActive)
                   return Redirect($"{_frontendBaseUrl}/login?notice=already_verified");   // EC-2
               return Redirect($"{_frontendBaseUrl}/login?verified=true");                 // AC-4
           }
           catch (VerificationTokenExpiredException)
           {
               return BadRequest(new { message = "Verification link expired." });           // AC-5
           }
           catch (InvalidVerificationTokenException)
           {
               return BadRequest(new { message = "Invalid verification link." });
           }
       }

       [HttpPost("resend-verification")]
       [AllowAnonymous]
       [ProducesResponseType(StatusCodes.Status200OK)]
       [ProducesResponseType(StatusCodes.Status404NotFound)]
       public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest request, CancellationToken ct)
       {
           try
           {
               await _mediator.Send(new ResendVerificationCommand(request.Email), ct);
               return Ok(new { message = "Verification email sent." });
           }
           catch (UserNotFoundException)
           {
               // OWASP A07: Do NOT reveal whether email exists — return 200 regardless
               return Ok(new { message = "If an account with this email exists, a verification email has been sent." });
           }
           catch (AccountAlreadyActiveException)
           {
               return Ok(new { message = "This account is already verified." });
           }
       }
   }
   ```
   > **OWASP A07 note**: `ResendVerification` returns HTTP 200 even when email is not found to prevent email enumeration attacks.

8. **Add `PasswordComplexityValidator`** (AC-2 — server-side enforcement, OWASP A07):
   ```csharp
   // /src/Application/Auth/PasswordComplexityValidator.cs
   public static class PasswordComplexityValidator
   {
       public static (bool IsValid, IReadOnlyList<string> Errors) Validate(string password)
       {
           var errors = new List<string>();
           if (password.Length < 8) errors.Add("Password must be at least 8 characters.");
           if (!Regex.IsMatch(password, @"[A-Z]")) errors.Add("Password must contain at least one uppercase letter.");
           if (!Regex.IsMatch(password, @"[a-z]")) errors.Add("Password must contain at least one lowercase letter.");
           if (!Regex.IsMatch(password, @"\d")) errors.Add("Password must contain at least one digit.");
           if (!Regex.IsMatch(password, @"[^A-Za-z0-9]")) errors.Add("Password must contain at least one symbol.");
           return (!errors.Any(), errors.AsReadOnly());
       }
   }
   ```

## Domain Exceptions to Create
| Exception Class | HTTP Mapping | Message |
|-----------------|-------------|---------|
| `EmailAlreadyRegisteredException` | 409 Conflict | "An account with this email already exists." |
| `VerificationTokenExpiredException` | 400 Bad Request | "Verification link expired." |
| `InvalidVerificationTokenException` | 400 Bad Request | "Invalid verification link." |
| `AccountAlreadyActiveException` | 200 OK (swallowed in controller) | "Account already active." |
| `UserNotFoundException` | 200 OK for resend; 400 for verify | Varies by context |

## Current Project State
```
/src/
├── Api/Controllers/
│   └── AuthController.cs              # WILL BE MODIFIED (add Register, VerifyEmail, ResendVerification)
├── Application/Auth/
│   ├── Commands/
│   │   ├── RegisterUserCommand.cs     # NOT YET CREATED
│   │   ├── VerifyEmailCommand.cs      # NOT YET CREATED
│   │   └── ResendVerificationCommand.cs # NOT YET CREATED
│   ├── IEmailVerificationTokenService.cs # NOT YET CREATED
│   └── PasswordComplexityValidator.cs  # NOT YET CREATED
├── Infrastructure/
│   ├── Auth/
│   │   └── EmailVerificationTokenService.cs # NOT YET CREATED
│   ├── Email/
│   │   ├── IEmailService.cs           # NOT YET CREATED
│   │   ├── SmtpEmailService.cs        # NOT YET CREATED
│   │   └── HangfireEmailJob.cs        # NOT YET CREATED
├── Domain/
│   └── Users/
│       ├── User.cs                    # MODIFY — add VerificationToken, VerificationTokenExpiresAt, Activate()
│       └── UserStatus.cs             # CONFIRM — Inactive and Active values exist
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `/src/Domain/Users/User.cs` | Add `VerificationToken`, `VerificationTokenExpiresAt`, `SetVerificationToken()`, `ClearVerificationToken()`, `Activate()` (idempotent) |
| CREATE | `/src/Application/Auth/IEmailVerificationTokenService.cs` | Interface: `GenerateToken()`, `ValidateToken()` |
| CREATE | `/src/Infrastructure/Auth/EmailVerificationTokenService.cs` | HMAC-SHA256 signed token; `CryptographicOperations.FixedTimeEquals` comparison |
| CREATE | `/src/Application/Auth/PasswordComplexityValidator.cs` | Static validator: length, upper, lower, digit, symbol checks |
| CREATE | `/src/Application/Auth/Commands/RegisterUserCommandHandler.cs` | BCrypt work factor 12; AC-3 email uniqueness; AC-1 user insert + audit; EC-3 Hangfire enqueue |
| CREATE | `/src/Application/Auth/Commands/VerifyEmailCommandHandler.cs` | Token validation; AC-4 user activation + audit; AC-5 expired exception; EC-2 idempotent |
| CREATE | `/src/Application/Auth/Commands/ResendVerificationCommandHandler.cs` | AC-5 invalidate old token; new token + Hangfire enqueue |
| CREATE | `/src/Infrastructure/Email/IEmailService.cs` | `SendVerificationEmailAsync()` interface |
| CREATE | `/src/Infrastructure/Email/SmtpEmailService.cs` | MailKit SMTP implementation |
| CREATE | `/src/Infrastructure/Email/HangfireEmailJob.cs` | 3-retry SMTP job; `OnAllRetriesExhaustedAsync()` writes audit log |
| MODIFY | `/src/Api/Controllers/AuthController.cs` | Add `Register`, `VerifyEmail`, `ResendVerification` action methods |
| MODIFY | `/src/Infrastructure/Persistence/ApplicationDbContext.cs` | Map new `User` fields: `VerificationToken` (TEXT nullable), `VerificationTokenExpiresAt` (TIMESTAMPTZ nullable) |

## StartupGuard Extension
Add `EMAIL_VERIFICATION_KEY` to `StartupGuard.ValidateEnvironment()`:
```csharp
// In StartupGuard.cs — add to required env var list:
"EMAIL_VERIFICATION_KEY"  // Base64-encoded HMAC key for email verification tokens
```

## appsettings.json Addition
```json
"EmailVerification": {
  "TokenTtlHours": 24
},
"Email": {
  "SmtpHost": "",
  "SmtpPort": 587,
  "FromAddress": "noreply@propeliq.health",
  "FromName": "PropelIQ Health"
}
```

## EF Core Migration Note
The `User` entity gains two nullable columns: `verification_token TEXT` and `verification_token_expires_at TIMESTAMPTZ`. These require a new migration:
- Migration name: `AddUserVerificationToken`
- `migrationBuilder.AddColumn<string>("verification_token", "users", nullable: true)`
- `migrationBuilder.AddColumn<DateTime>("verification_token_expires_at", "users", nullable: true)`
- `Down()` drops both columns
- No CHECK constraint required — nullable TEXT and TIMESTAMPTZ have no constraint
- No index on `verification_token` (token lookup is by `userId` first, then token comparison happens in-memory after loading the user row)

## Implementation Validation Strategy
- [ ] `POST /api/auth/register` with valid payload → HTTP 201; user row in DB with `status = 'Inactive'`, `role = 'Patient'`; `audit_logs` row with `action_type = 'UserRegistered'`
- [ ] `POST /api/auth/register` with existing email → HTTP 409; no new user row; `users` count unchanged
- [ ] `POST /api/auth/register` with password `"password"` (no upper/digit/symbol) → HTTP 422; response body contains array of failing rule messages
- [ ] `GET /api/auth/verify?token=VALID&userId=GUID` → HTTP 302 redirect to `/login?verified=true`; user `status = 'Active'` in DB; `audit_logs` row `action_type = 'EmailVerified'`
- [ ] `GET /api/auth/verify?token=EXPIRED&userId=GUID` → HTTP 400 `{"message":"Verification link expired."}`
- [ ] `GET /api/auth/verify` with already-active user → HTTP 302 redirect to `/login?notice=already_verified`
- [ ] `POST /api/auth/resend-verification` with valid inactive email → HTTP 200; new `verification_token` on user row; old token invalidated; Hangfire job enqueued
- [ ] SMTP failure simulation → HTTP 201 still returned; Serilog `ERROR` log emitted; Hangfire job retried up to 3×
- [ ] `CryptographicOperations.FixedTimeEquals` used in `EmailVerificationTokenService` — no string equality on HMAC

## Implementation Checklist
- [ ] `User` entity extended with `VerificationToken`, `VerificationTokenExpiresAt`, `SetVerificationToken()`, `Activate()` (idempotent guard on `Active` status)
- [ ] `EmailVerificationTokenService` uses `CryptographicOperations.FixedTimeEquals` for HMAC comparison (OWASP A02 timing-attack prevention)
- [ ] `EMAIL_VERIFICATION_KEY` added to `StartupGuard.ValidateEnvironment()`
- [ ] BCrypt work factor = 12 (never MD5, SHA-1, unsalted hash — OWASP A02)
- [ ] `RegisterUserCommandHandler` catches `DbUpdateException` with unique constraint message and re-throws `EmailAlreadyRegisteredException` (EC-1 race condition)
- [ ] `ResendVerification` endpoint returns HTTP 200 regardless of whether email exists (OWASP A07 email enumeration prevention)
- [ ] Hangfire retry policy: 3 attempts, delays [120s, 300s, 600s] — all within 10-minute window (EC-3)
- [ ] `OnAllRetriesExhaustedAsync` writes `audit_logs` entry with `action_type = EmailVerificationFailed`
- [ ] PHI (email address) NEVER logged in Serilog — only `UserId` in log messages (OWASP A07)
- [ ] EF Core migration `AddUserVerificationToken` created with `verification_token` and `verification_token_expires_at` columns; `Down()` drops both
- [ ] `PasswordComplexityValidator` enforced server-side (AC-2 — client-side validation is never sole enforcement)
