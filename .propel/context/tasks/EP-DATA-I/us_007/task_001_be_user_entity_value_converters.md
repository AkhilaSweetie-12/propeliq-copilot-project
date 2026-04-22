---
title: "Task — User EF Core Entity, PHI Email Value Converter, Enums, Soft-Delete, UpdatedAt Interceptor"
task_id: task_001
story_id: us_007
epic: EP-DATA-I
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_007] — `users` Entity with PHI Column-Level Encryption
- Story Location: `.propel/context/tasks/EP-DATA-I/us_007/us_007.md`
- Acceptance Criteria:
  - AC-2: `SaveChangesAsync()` writes AES-256 encrypted ciphertext to `email` column; `SELECT email FROM users` returns ciphertext; only the application layer with `PHI_ENCRYPTION_KEY` can decrypt
  - AC-3: EF Core value converter in `OnModelCreating` transparently decrypts `email` on read; service layer receives plaintext without manual decrypt calls
  - AC-4 (enum side): `UserRole` enum restricted to Patient / Staff / Admin; any value outside this set is rejected by both the enum type and the DB CHECK constraint
  - AC-5: `user.Status = UserStatus.Inactive` + `SaveChangesAsync()` marks the row inactive and retains all data; no hard-delete exposed on the repository interface
  - AC-6: `SaveChanges` interceptor automatically sets `updated_at = DateTimeOffset.UtcNow` before any UPDATE; service caller must not set `updated_at` manually
  - Edge Case 1: Duplicate `email` (encrypted) → EF Core raises `DbUpdateException` → application layer catches and throws `EmailAlreadyRegisteredException` (no DB internals in message)
  - Edge Case 3: Login email lookup uses application-side encryption to build ciphertext of the search term, then matches against stored ciphertext via `IUserRepository.FindByEmailAsync()`

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
| ORM | EF Core | 9.x |
| DB Driver | Npgsql | 9.x |
| Auth | ASP.NET Core Identity | 9.x |
| Encryption | .NET `System.Security.Cryptography` (AES-256-CBC) | Built-in |
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
Define the `User` EF Core entity with all PHI-compliant fields, create `UserRole` and `UserStatus` enums, implement the `PhiEmailEncryptionConverter` (AES-256-CBC using `PHI_ENCRYPTION_KEY` env var) and register it on the `email` column in `OnModelCreating`. Create `AuditTimestampInterceptor : SaveChangesInterceptor` that sets `updated_at` to `DateTimeOffset.UtcNow` before every UPDATE. Add `IUserRepository` interface exposing `FindByEmailAsync` (encrypt-and-query pattern for EC-3). Create `EmailAlreadyRegisteredException` and a `UniqueConstraintExceptionHandler` helper. Register the entity, interceptor, and DbSet in `ApplicationDbContext`. Add `PHI_ENCRYPTION_KEY` validation to `StartupGuard.ValidateEnvironment()`.

## Dependent Tasks
- `us_004 task_001_be_efcore_dbcontext_factory.md` — `ApplicationDbContext` + `IDesignTimeDbContextFactory` must exist; this task adds a `DbSet<User>` and `OnModelCreating` configuration to it.
- `us_005 task_001_be_identity_bcrypt_user.md` — `ApplicationUser` and BCrypt hasher exist; the `User` entity here is the domain entity (EF model), separate from `ApplicationUser` (Identity). The `User.PasswordHash` stores the BCrypt output from us_005's `BcryptPasswordHasher`.

## Impacted Components
- `/api/Features/Users/Entities/User.cs` — CREATE: `User` entity class + `UserRole`/`UserStatus` enums
- `/api/Features/Users/Security/PhiEmailEncryptionConverter.cs` — CREATE: AES-256-CBC EF Core value converter
- `/api/Infrastructure/Interceptors/AuditTimestampInterceptor.cs` — CREATE: `SaveChangesInterceptor` setting `updated_at`
- `/api/Features/Users/Services/IUserRepository.cs` — CREATE: `FindByEmailAsync`, `FindByIdAsync`, `CreateAsync`, `UpdateStatusAsync`
- `/api/Features/Users/Exceptions/EmailAlreadyRegisteredException.cs` — CREATE: domain exception for duplicate email
- `/api/Data/ApplicationDbContext.cs` — MODIFY: add `DbSet<User>`, `OnModelCreating` config (value converter, constraints), `AddInterceptors(AuditTimestampInterceptor)`
- `/api/Infrastructure/Startup/StartupGuard.cs` — MODIFY: add `PHI_ENCRYPTION_KEY` to environment validation

## Implementation Plan

1. **Create `UserRole` and `UserStatus` enums inside `User.cs`** (co-located with entity, AC-4, AC-5):
   ```csharp
   // /api/Features/Users/Entities/User.cs
   namespace Api.Features.Users.Entities;

   public enum UserRole   { Patient, Staff, Admin }
   public enum UserStatus { Active, Inactive }

   public sealed class User
   {
       public Guid            UserId       { get; set; }
       public string          Email        { get; set; } = string.Empty;  // stored AES-256 encrypted
       public string          PasswordHash { get; set; } = string.Empty;  // BCrypt hash from BcryptPasswordHasher
       public UserRole        Role         { get; set; }
       public UserStatus      Status       { get; set; } = UserStatus.Active;
       public DateTimeOffset  CreatedAt    { get; set; }
       public DateTimeOffset  UpdatedAt    { get; set; }
   }
   ```
   Do NOT expose a delete method or hard-delete property. Soft-delete is the sole deactivation path (AC-5).

2. **Create `PhiEmailEncryptionConverter.cs`** — AES-256-CBC value converter (AC-2, AC-3):
   ```csharp
   using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
   using System.Security.Cryptography;
   using System.Text;

   namespace Api.Features.Users.Security;

   /// <summary>
   /// EF Core value converter that transparently encrypts email on write (AES-256-CBC)
   /// and decrypts on read. Key is sourced exclusively from PHI_ENCRYPTION_KEY env var.
   /// The IV is prepended to the ciphertext (Base64-encoded) so each encrypted value
   /// is unique even for identical inputs — prevents frequency analysis attacks.
   /// </summary>
   public sealed class PhiEmailEncryptionConverter : ValueConverter<string, string>
   {
       public PhiEmailEncryptionConverter()
           : base(
               plaintext  => Encrypt(plaintext),
               ciphertext => Decrypt(ciphertext))
       {
       }

       private static string Encrypt(string plaintext)
       {
           var key = GetKey();
           using var aes = CreateAes(key);
           aes.GenerateIV();

           using var encryptor    = aes.CreateEncryptor(aes.Key, aes.IV);
           var       plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
           var       ciphertextBytes = encryptor.TransformFinalBlock(plaintextBytes, 0, plaintextBytes.Length);

           // Prepend IV to ciphertext — IV is non-secret, required for deterministic lookup
           // For login lookup, caller MUST re-encrypt with the same key+IV to get matching ciphertext.
           // We use a HMAC-derived IV from the plaintext so lookups remain deterministic (EC-3):
           var deterministicIv = DeriveIv(key, plaintext);
           using var encryptor2   = aes.CreateEncryptor(key, deterministicIv);
           var       cipherBytes2 = encryptor2.TransformFinalBlock(plaintextBytes, 0, plaintextBytes.Length);

           // Output: Base64(IV || ciphertext)
           var result = new byte[deterministicIv.Length + cipherBytes2.Length];
           Buffer.BlockCopy(deterministicIv, 0, result, 0, deterministicIv.Length);
           Buffer.BlockCopy(cipherBytes2, 0, result, deterministicIv.Length, cipherBytes2.Length);
           return Convert.ToBase64String(result);
       }

       private static string Decrypt(string base64Ciphertext)
       {
           var key   = GetKey();
           var bytes = Convert.FromBase64String(base64Ciphertext);

           // First 16 bytes = IV (AES block size)
           var iv         = bytes[..16];
           var cipherData = bytes[16..];

           using var aes       = CreateAes(key);
           using var decryptor = aes.CreateDecryptor(key, iv);
           var plainBytes      = decryptor.TransformFinalBlock(cipherData, 0, cipherData.Length);
           return Encoding.UTF8.GetString(plainBytes);
       }

       private static byte[] DeriveIv(byte[] key, string plaintext)
       {
           // HMAC-SHA256(key, plaintext) → first 16 bytes as deterministic IV
           // This makes encryption deterministic for the same key+plaintext combination
           // so WHERE email = EncryptedValue queries work via the UNIQUE index (EC-3).
           using var hmac = new HMACSHA256(key);
           var       hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(plaintext));
           return hash[..16];
       }

       private static byte[] GetKey()
       {
           var raw = Environment.GetEnvironmentVariable("PHI_ENCRYPTION_KEY")
               ?? throw new InvalidOperationException(
                   "PHI_ENCRYPTION_KEY environment variable is not set. " +
                   "This key is required for PHI column encryption. Set it before starting the application.");
           // Derive a 32-byte (256-bit) key using SHA-256 of the raw env var value
           return SHA256.HashData(Encoding.UTF8.GetBytes(raw));
       }

       private static Aes CreateAes(byte[] key)
       {
           var aes     = Aes.Create();
           aes.Key     = key;
           aes.Mode    = CipherMode.CBC;
           aes.Padding = PaddingMode.PKCS7;
           return aes;
       }
   }
   ```
   Encryption design decisions:
   - **Deterministic IV** via HMAC-SHA256(key, plaintext)[0..16] — same email always encrypts to the same ciphertext under the same key, enabling `WHERE email = ?` queries via the UNIQUE index (EC-3).
   - **AES-256-CBC** with PKCS7 padding — standard symmetric encryption; 256-bit key derived from env var via SHA-256.
   - **Key never logged** — `GetKey()` throws `InvalidOperationException` with a safe message (no key value in the message).
   - The IV is prepended to the output to enable future migration to random-IV if lookup-by-email is replaced by a lookup table.

3. **Create `AuditTimestampInterceptor.cs`** (AC-6):
   ```csharp
   using Api.Features.Users.Entities;
   using Microsoft.EntityFrameworkCore;
   using Microsoft.EntityFrameworkCore.Diagnostics;

   namespace Api.Infrastructure.Interceptors;

   /// <summary>
   /// Sets UpdatedAt on all modified entities before EF Core issues the UPDATE SQL.
   /// Service callers must NOT set UpdatedAt manually — this interceptor is the sole owner.
   /// </summary>
   public sealed class AuditTimestampInterceptor : SaveChangesInterceptor
   {
       public override InterceptionResult<int> SavingChanges(
           DbContextEventData eventData, InterceptionResult<int> result)
       {
           SetTimestamps(eventData.Context);
           return base.SavingChanges(eventData, result);
       }

       public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
           DbContextEventData eventData, InterceptionResult<int> result,
           CancellationToken cancellationToken = default)
       {
           SetTimestamps(eventData.Context);
           return base.SavingChangesAsync(eventData, result, cancellationToken);
       }

       private static void SetTimestamps(DbContext? context)
       {
           if (context is null) return;

           var now = DateTimeOffset.UtcNow;

           foreach (var entry in context.ChangeTracker.Entries<User>())
           {
               if (entry.State == EntityState.Modified)
                   entry.Entity.UpdatedAt = now;

               if (entry.State == EntityState.Added)
               {
                   entry.Entity.CreatedAt = now;
                   entry.Entity.UpdatedAt = now;
               }
           }
       }
   }
   ```

4. **Create `IUserRepository.cs`** — soft-delete and lookup interface (AC-5, EC-3):
   ```csharp
   using Api.Features.Users.Entities;

   namespace Api.Features.Users.Services;

   /// <summary>
   /// Repository contract for the users entity.
   /// Hard-delete is intentionally absent — deactivation (soft-delete) is the sole removal pattern (AC-5).
   /// </summary>
   public interface IUserRepository
   {
       Task<User?>         FindByIdAsync(Guid userId, CancellationToken ct = default);

       /// <summary>
       /// Looks up a user by plaintext email.
       /// Internally encrypts the search term with PHI_ENCRYPTION_KEY and queries the UNIQUE index (EC-3).
       /// </summary>
       Task<User?>         FindByEmailAsync(string plaintextEmail, CancellationToken ct = default);

       Task<User>          CreateAsync(User user, CancellationToken ct = default);

       /// <summary>
       /// Sets user.Status = Inactive and saves. Hard-delete is not exposed.
       /// </summary>
       Task                DeactivateAsync(Guid userId, CancellationToken ct = default);
   }
   ```

5. **Create `EmailAlreadyRegisteredException.cs`** (EC-1):
   ```csharp
   namespace Api.Features.Users.Exceptions;

   /// <summary>
   /// Thrown by the service layer when a duplicate email INSERT triggers the UNIQUE constraint.
   /// Wraps DbUpdateException to prevent leaking database internals to callers (OWASP A05).
   /// </summary>
   public sealed class EmailAlreadyRegisteredException : Exception
   {
       public EmailAlreadyRegisteredException()
           : base("An account with this email address is already registered.")
       {
       }
   }
   ```
   Usage in a repository implementation:
   ```csharp
   catch (DbUpdateException ex)
       when (ex.InnerException?.Message.Contains("users_email_key", StringComparison.Ordinal) == true)
   {
       throw new EmailAlreadyRegisteredException();
   }
   ```
   The PostgreSQL constraint name `users_email_key` is set in the migration (task_002). If the DB constraint name changes, update this catch filter.

6. **Modify `ApplicationDbContext.cs`** — add DbSet, value converter, enums, and interceptor:
   ```csharp
   // Add to class body:
   public DbSet<User> Users => Set<User>();

   // In OnModelCreating:
   modelBuilder.Entity<User>(entity =>
   {
       entity.ToTable("users");
       entity.HasKey(u => u.UserId);
       entity.Property(u => u.UserId)
             .HasColumnName("user_id")
             .HasDefaultValueSql("gen_random_uuid()");

       entity.Property(u => u.Email)
             .HasColumnName("email")
             .IsRequired()
             .HasConversion(new PhiEmailEncryptionConverter());

       entity.HasIndex(u => u.Email)
             .IsUnique()
             .HasDatabaseName("users_email_key");

       entity.Property(u => u.PasswordHash)
             .HasColumnName("password_hash")
             .IsRequired();

       entity.Property(u => u.Role)
             .HasColumnName("role")
             .IsRequired()
             .HasConversion(
                 v => v.ToString(),
                 v => Enum.Parse<UserRole>(v));

       entity.Property(u => u.Status)
             .HasColumnName("status")
             .IsRequired()
             .HasDefaultValue(UserStatus.Active)
             .HasConversion(
                 v => v.ToString(),
                 v => Enum.Parse<UserStatus>(v));

       entity.Property(u => u.CreatedAt)
             .HasColumnName("created_at")
             .IsRequired();

       entity.Property(u => u.UpdatedAt)
             .HasColumnName("updated_at")
             .IsRequired();
   });

   // In AddDbContext registration in Program.cs / DI:
   services.AddDbContext<ApplicationDbContext>(opts =>
       opts.UseNpgsql(connectionString)
           .AddInterceptors(new AuditTimestampInterceptor()));
   ```

7. **Modify `StartupGuard.ValidateEnvironment()`** — add `PHI_ENCRYPTION_KEY` check:
   ```csharp
   private static readonly string[] RequiredVars =
   [
       "DATABASE_URL",
       "JWT_SIGNING_KEY",
       "PHI_ENCRYPTION_KEY",   // ADD: required for AES-256 email encryption (us_007)
   ];
   ```
   If `PHI_ENCRYPTION_KEY` is absent at startup the application must fail fast with a clear message — never silently fall back to an unencrypted or weak key.

8. **Create stub `UserRepository.cs`** implementing `IUserRepository` (wires encrypt-before-query for EC-3):
   ```csharp
   using Api.Data;
   using Api.Features.Users.Entities;
   using Api.Features.Users.Exceptions;
   using Api.Features.Users.Security;
   using Microsoft.EntityFrameworkCore;

   namespace Api.Features.Users.Services;

   public sealed class UserRepository : IUserRepository
   {
       private readonly ApplicationDbContext       _db;
       private readonly PhiEmailEncryptionConverter _converter;

       public UserRepository(ApplicationDbContext db)
       {
           _db        = db;
           _converter = new PhiEmailEncryptionConverter();
       }

       public Task<User?> FindByIdAsync(Guid userId, CancellationToken ct = default)
           => _db.Users.FirstOrDefaultAsync(u => u.UserId == userId, ct);

       public Task<User?> FindByEmailAsync(string plaintextEmail, CancellationToken ct = default)
       {
           // EC-3: encrypt the search term with the same key → ciphertext matches stored value
           // EF Core's value converter handles this automatically on the WHERE predicate
           // when the converter is registered via HasConversion — EF Core encrypts
           // the parameter before generating SQL:
           return _db.Users.FirstOrDefaultAsync(u => u.Email == plaintextEmail, ct);
           // Note: EF Core with the value converter will encrypt `plaintextEmail` before
           // generating the SQL, so the comparison is ciphertext == ciphertext.
       }

       public async Task<User> CreateAsync(User user, CancellationToken ct = default)
       {
           try
           {
               _db.Users.Add(user);
               await _db.SaveChangesAsync(ct);
               return user;
           }
           catch (DbUpdateException ex)
               when (ex.InnerException?.Message.Contains("users_email_key", StringComparison.Ordinal) == true)
           {
               throw new EmailAlreadyRegisteredException();
           }
       }

       public async Task DeactivateAsync(Guid userId, CancellationToken ct = default)
       {
           var user = await FindByIdAsync(userId, ct)
               ?? throw new KeyNotFoundException($"User {userId} not found.");
           user.Status = UserStatus.Inactive;
           await _db.SaveChangesAsync(ct);
       }
   }
   ```

## Current Project State
```
/api/
├── Data/
│   └── ApplicationDbContext.cs      # us_004: WILL BE MODIFIED
├── Features/
│   └── Users/                       # NOT YET CREATED — created by this task
├── Infrastructure/
│   ├── Startup/
│   │   └── StartupGuard.cs          # us_002: WILL BE MODIFIED
│   └── Interceptors/                # NOT YET CREATED — created by this task
└── Features/Booking/Services/
    └── IAppointmentRepository.cs    # us_006 stub
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Features/Users/Entities/User.cs` | `User` entity + `UserRole` enum (Patient/Staff/Admin) + `UserStatus` enum (Active/Inactive); no hard-delete property |
| CREATE | `/api/Features/Users/Security/PhiEmailEncryptionConverter.cs` | AES-256-CBC EF Core value converter; deterministic IV via HMAC-SHA256(key, plaintext)[0..16]; key from `PHI_ENCRYPTION_KEY` env var |
| CREATE | `/api/Infrastructure/Interceptors/AuditTimestampInterceptor.cs` | `SaveChangesInterceptor` setting `UpdatedAt = DateTimeOffset.UtcNow` on Added/Modified entities |
| CREATE | `/api/Features/Users/Services/IUserRepository.cs` | Interface with `FindByEmailAsync`, `FindByIdAsync`, `CreateAsync`, `DeactivateAsync`; no hard-delete |
| CREATE | `/api/Features/Users/Services/UserRepository.cs` | Concrete implementation; `CreateAsync` catches `DbUpdateException` → `EmailAlreadyRegisteredException` |
| CREATE | `/api/Features/Users/Exceptions/EmailAlreadyRegisteredException.cs` | Domain exception; safe message; no DB internals |
| MODIFY | `/api/Data/ApplicationDbContext.cs` | Add `DbSet<User>`, `OnModelCreating` config (value converter, enums, unique index), `AddInterceptors(new AuditTimestampInterceptor())` |
| MODIFY | `/api/Infrastructure/Startup/StartupGuard.cs` | Add `PHI_ENCRYPTION_KEY` to required environment variables list |

## External References
- EF Core Value Converters: https://learn.microsoft.com/en-us/ef/core/modeling/value-conversions
- EF Core SaveChanges Interceptors: https://learn.microsoft.com/en-us/ef/core/logging-events-diagnostics/interceptors#savechanges-interception
- AES-256-CBC in .NET: https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.aes
- HMAC-SHA256 deterministic IV pattern: https://security.stackexchange.com/a/85387
- DR-001 data requirement: `.propel/context/docs/design.md#DR-001`
- HIPAA PHI column-level encryption guidance: NFR/TR from design.md (TR-006)

## Build Commands
```bash
# Verify entity registers without errors (no migration yet — task_002 handles migration)
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet build api/Api.csproj --configuration Debug

# Run unit tests confirming encrypt/decrypt round-trip and interceptor
dotnet test api.tests/Api.Tests.csproj --filter "FullyQualifiedName~PhiEmail|FullyQualifiedName~AuditTimestamp"

# Register UserRepository in DI (add to Program.cs after this task)
# services.AddScoped<IUserRepository, UserRepository>();
```

## Implementation Validation Strategy
- [ ] `PhiEmailEncryptionConverter.Encrypt("user@example.com")` followed by `.Decrypt(result)` returns `"user@example.com"` exactly
- [ ] Two calls to `Encrypt("user@example.com")` with the same key return identical ciphertext (deterministic IV — enables UNIQUE index lookup)
- [ ] `ApplicationDbContext` scaffolds without errors after changes; `dotnet build` succeeds
- [ ] `AuditTimestampInterceptor` sets `UpdatedAt` before `SaveChangesAsync`; service layer not setting `UpdatedAt` manually still produces correct timestamp
- [ ] `StartupGuard.ValidateEnvironment()` throws without `PHI_ENCRYPTION_KEY`; fails at startup before any DB connection

## Implementation Checklist
- [ ] Create `User.cs` entity with `UserRole` enum, `UserStatus` enum, all 8 columns; no hard-delete
- [ ] Create `PhiEmailEncryptionConverter.cs`: AES-256-CBC, deterministic IV = HMAC-SHA256(key, plaintext)[0..16], key from `PHI_ENCRYPTION_KEY`
- [ ] Create `AuditTimestampInterceptor.cs`: `SavingChanges` + `SavingChangesAsync` set `UpdatedAt` on Modified; set `CreatedAt` + `UpdatedAt` on Added
- [ ] Create `IUserRepository.cs`: `FindByIdAsync`, `FindByEmailAsync`, `CreateAsync`, `DeactivateAsync` (no hard-delete)
- [ ] Create `UserRepository.cs`: concrete implementation; `CreateAsync` catches `DbUpdateException` for `users_email_key` → `EmailAlreadyRegisteredException`
- [ ] Create `EmailAlreadyRegisteredException.cs`: safe message, no DB internals
- [ ] Modify `ApplicationDbContext.cs`: add `DbSet<User>`, full `OnModelCreating` config, `AddInterceptors`
- [ ] Modify `StartupGuard.cs`: add `PHI_ENCRYPTION_KEY` to required vars; `dotnet build` succeeds
