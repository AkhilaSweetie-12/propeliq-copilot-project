---
title: "Task — PatientIntake Entity, Generic PHI JSON+AES Converter, DTO Types, Interceptor Extension & Repository"
task_id: task_001
story_id: us_010
epic: EP-DATA-I
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_010] — `patient_intakes` Entity with Encrypted JSONB PHI Fields
- Story Location: `.propel/context/tasks/EP-DATA-I/us_010/us_010.md`
- Acceptance Criteria:
  - AC-2: Each PHI column individually encrypted with AES-256 before write; transparent decrypt on read via EF Core value converters registered in `OnModelCreating`
  - AC-3: `updated_at` refreshed by `SaveChanges` interceptor on update; `submitted_at` unchanged — interceptor must NOT touch `submitted_at`
  - AC-4 (enum side): `IntakeMethod` enum (AI / Manual); any other value rejected by CHECK constraint (database side in task_002)
  - AC-6: PHI columns stored as encrypted TEXT; decrypted TEXT is valid JSON; service layer deserialises to C# DTO without error
  - Edge Case 1: JSON payload > 64 KB per PHI field → `PayloadTooLargeException` at service boundary before EF Core is invoked
  - Edge Case 2: `PHI_ENCRYPTION_KEY` read at startup; mid-session rotation not supported; validated by `StartupGuard`
  - Edge Case 3: `patient_id` FK references non-existent user → `DbUpdateException` → `PatientNotFoundException`

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
| Serialization | `System.Text.Json` | Built-in (.NET 9) |
| Encryption | `System.Security.Cryptography` AES-256-CBC | Built-in |
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
Refactor `PhiEmailEncryptionConverter` (us_007) into a generic `PhiTextEncryptionConverter` that applies AES-256-CBC encryption to any `string` value, keeping the deterministic IV pattern. Add a new `PhiJsonEncryptionConverter<T>` that wraps it by first serialising `T` to JSON via `System.Text.Json` before encrypting — used for the five PHI JSONB columns. Create `IntakeMethod` enum and `PatientIntake` entity with strongly-typed DTO properties for the five PHI fields. Create the JSON-serializable DTO records (`DemographicsDto`, `MedicalHistoryDto`, `MedicationsDto`, `AllergiesDto`, `ChiefComplaintDto`). Create `PatientNotFoundException` and `PayloadTooLargeException`. Create `IPatientIntakeRepository` and `PatientIntakeRepository`. Register `DbSet<PatientIntake>` and configure `OnModelCreating`. Extend `AuditTimestampInterceptor` to cover `PatientIntake` (`UpdatedAt` only on Modified; `submitted_at` is set at creation and never touched by the interceptor).

## Dependent Tasks
- `us_007 task_001_be_user_entity_value_converters.md` — `PhiEmailEncryptionConverter` is the base implementation; this task refactors it into `PhiTextEncryptionConverter` and updates the `users.email` registration to use the renamed class.
- `task_002_db_patient_intake_migration.md` (same story) — migration generates the DB schema; entity config here drives the scaffold.

## Impacted Components
- `/api/Features/Users/Security/PhiEmailEncryptionConverter.cs` — RENAME/REFACTOR → `PhiTextEncryptionConverter.cs` in `/api/Infrastructure/Security/`; update `users.email` registration in `OnModelCreating`
- `/api/Infrastructure/Security/PhiJsonEncryptionConverter.cs` — CREATE: generic `ValueConverter<T, string>` that JSON-serialises then delegates to `PhiTextEncryptionConverter`
- `/api/Features/Intake/Entities/PatientIntake.cs` — CREATE: entity + `IntakeMethod` enum
- `/api/Features/Intake/DTOs/IntakeDtos.cs` — CREATE: `DemographicsDto`, `MedicalHistoryDto`, `MedicationsDto`, `AllergiesDto` records
- `/api/Features/Intake/Exceptions/PatientNotFoundException.cs` — CREATE: domain exception for FK violation on `patient_id`
- `/api/Features/Intake/Exceptions/PayloadTooLargeException.cs` — CREATE: domain exception for >64 KB PHI payload (EC-1)
- `/api/Features/Intake/Services/IPatientIntakeRepository.cs` — CREATE: repository interface
- `/api/Features/Intake/Services/PatientIntakeRepository.cs` — CREATE: concrete implementation with 64 KB guard
- `/api/Data/ApplicationDbContext.cs` — MODIFY: add `DbSet<PatientIntake>`, `OnModelCreating` config with `PhiJsonEncryptionConverter<T>` on 5 columns
- `/api/Infrastructure/Interceptors/AuditTimestampInterceptor.cs` — MODIFY: extend `SetTimestamps` to cover `PatientIntake`

## Implementation Plan

1. **Refactor `PhiEmailEncryptionConverter` → `PhiTextEncryptionConverter`** (DRY — shared by `users.email` and all 5 PHI columns):
   - Move file from `/api/Features/Users/Security/` to `/api/Infrastructure/Security/`
   - Rename class to `PhiTextEncryptionConverter`
   - Namespace: `Api.Infrastructure.Security`
   - Update the `users.email` `HasConversion` call in `ApplicationDbContext.OnModelCreating` to reference the new namespace/class name
   - The encryption algorithm (AES-256-CBC, deterministic IV via HMAC-SHA256, `PHI_ENCRYPTION_KEY`) is unchanged

2. **Create `PhiJsonEncryptionConverter<T>.cs`** — generic JSON + AES converter (AC-2, AC-6):
   ```csharp
   using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
   using System.Text.Json;

   namespace Api.Infrastructure.Security;

   /// <summary>
   /// EF Core value converter that serialises T to JSON (System.Text.Json) then
   /// encrypts the resulting string with AES-256-CBC via PhiTextEncryptionConverter.
   /// Used for all PHI JSONB columns stored as encrypted TEXT (AC-2 / AC-6).
   /// The JSON representation must never be logged or returned in error messages (OWASP A07).
   /// </summary>
   public sealed class PhiJsonEncryptionConverter<T> : ValueConverter<T, string>
       where T : notnull
   {
       private static readonly PhiTextEncryptionConverter _stringConverter = new();

       private static readonly JsonSerializerOptions _jsonOptions = new()
       {
           PropertyNamingPolicy        = JsonNamingPolicy.CamelCase,
           DefaultIgnoreCondition      = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
       };

       public PhiJsonEncryptionConverter()
           : base(
               dto        => _stringConverter.ConvertToProviderExpression.Compile()(
                                 JsonSerializer.Serialize(dto, _jsonOptions)),
               ciphertext => JsonSerializer.Deserialize<T>(
                                 _stringConverter.ConvertFromProviderExpression.Compile()(ciphertext),
                                 _jsonOptions)!)
       {
       }
   }
   ```
   Usage in `OnModelCreating`:
   ```csharp
   entity.Property(i => i.Demographics)
         .HasConversion(new PhiJsonEncryptionConverter<DemographicsDto>());
   ```
   The converter chain is: `DemographicsDto → JSON string → AES-256 ciphertext → TEXT in DB` (write) and `TEXT → AES-256 decrypt → JSON string → DemographicsDto` (read).

3. **Create PHI DTO records in `IntakeDtos.cs`** (AC-6 — JSON structure must be valid on deserialise):
   ```csharp
   // /api/Features/Intake/DTOs/IntakeDtos.cs
   namespace Api.Features.Intake.DTOs;

   /// <summary>
   /// Patient demographic data. All fields are PHI — never log or include in error responses.
   /// </summary>
   public sealed record DemographicsDto(
       string  FirstName,
       string  LastName,
       string  DateOfBirth,    // ISO-8601 string — DateOnly serialised as string for JSON compat
       string? Gender,
       string? Phone,
       string? Address
   );

   /// <summary>
   /// Free-form medical history. Fields are PHI.
   /// </summary>
   public sealed record MedicalHistoryDto(
       IReadOnlyList<string> Conditions,
       IReadOnlyList<string> Surgeries,
       IReadOnlyList<string> FamilyHistory
   );

   /// <summary>
   /// List of current medications. Fields are PHI.
   /// </summary>
   public sealed record MedicationsDto(
       IReadOnlyList<MedicationEntry> Items
   );

   public sealed record MedicationEntry(string Name, string? Dose, string? Frequency);

   /// <summary>
   /// Known allergies. Fields are PHI.
   /// </summary>
   public sealed record AllergiesDto(
       IReadOnlyList<string> Substances,
       IReadOnlyList<string> Reactions
   );
   ```
   Note: `chief_complaint` is a plain encrypted `string` (not a DTO) — store it as `string` in the entity and apply `PhiTextEncryptionConverter` directly (no JSON wrapping needed).

4. **Create `IntakeMethod` enum and `PatientIntake.cs`** entity (AC-1, AC-4):
   ```csharp
   // /api/Features/Intake/Entities/PatientIntake.cs
   using Api.Features.Intake.DTOs;

   namespace Api.Features.Intake.Entities;

   public enum IntakeMethod { AI, Manual }

   /// <summary>
   /// Represents a single patient intake form submission.
   /// All PHI columns (demographics, medical_history, medications, allergies, chief_complaint)
   /// are stored AES-256 encrypted as TEXT; EF Core value converters handle transparent encryption/decryption.
   /// submitted_at is set at creation and never updated — the interceptor only touches updated_at (AC-3).
   /// </summary>
   public sealed class PatientIntake
   {
       public Guid             IntakeId       { get; set; }
       public Guid             PatientId      { get; set; }
       public IntakeMethod     IntakeMethod   { get; set; }
       public DemographicsDto  Demographics   { get; set; } = default!;
       public MedicalHistoryDto MedicalHistory { get; set; } = default!;
       public MedicationsDto   Medications    { get; set; } = default!;
       public AllergiesDto     Allergies      { get; set; } = default!;
       public string           ChiefComplaint { get; set; } = string.Empty;  // encrypted plain text
       public DateTimeOffset   SubmittedAt    { get; set; }
       public DateTimeOffset   UpdatedAt      { get; set; }
   }
   ```

5. **Create `PatientNotFoundException.cs`** and **`PayloadTooLargeException.cs`** (EC-1, EC-3):
   ```csharp
   // /api/Features/Intake/Exceptions/PatientNotFoundException.cs
   namespace Api.Features.Intake.Exceptions;

   /// <summary>
   /// Thrown when an intake INSERT/UPDATE fails because patient_id does not exist in users.
   /// Wraps DbUpdateException — no DB internals exposed (OWASP A05).
   /// </summary>
   public sealed class PatientNotFoundException : Exception
   {
       public PatientNotFoundException(Guid patientId)
           : base($"Patient {patientId} was not found.")
       {
       }
   }

   // /api/Features/Intake/Exceptions/PayloadTooLargeException.cs
   /// <summary>
   /// Thrown when a serialised PHI field exceeds 64 KB before encryption.
   /// Enforced at service boundary — not at the database layer (EC-1).
   /// </summary>
   public sealed class PayloadTooLargeException : Exception
   {
       public PayloadTooLargeException(string fieldName)
           : base($"The '{fieldName}' field payload exceeds the maximum allowed size of 64 KB.")
       {
       }
   }
   ```

6. **Create `IPatientIntakeRepository.cs`** and `PatientIntakeRepository.cs` stub:
   ```csharp
   // Interface
   using Api.Features.Intake.Entities;

   namespace Api.Features.Intake.Services;

   public interface IPatientIntakeRepository
   {
       Task<PatientIntake>              CreateAsync(PatientIntake intake, CancellationToken ct = default);
       Task<PatientIntake>              UpdateAsync(PatientIntake intake, CancellationToken ct = default);

       /// <summary>
       /// Returns the most recent intake for the patient (highest submitted_at).
       /// Uses the composite index (patient_id, submitted_at DESC) for efficient lookup (AC-5).
       /// </summary>
       Task<PatientIntake?>             GetLatestByPatientAsync(Guid patientId, CancellationToken ct = default);

       Task<IReadOnlyList<PatientIntake>> GetAllByPatientAsync(Guid patientId, CancellationToken ct = default);
   }
   ```

   `PatientIntakeRepository.cs` key implementation details:
   ```csharp
   private const int MaxPayloadBytes = 64 * 1024;   // EC-1: 64 KB limit per PHI field

   private static void ValidatePayloadSizes(PatientIntake intake)
   {
       // Serialize each PHI field to JSON and check byte size BEFORE encryption
       CheckField(intake.Demographics,   nameof(intake.Demographics));
       CheckField(intake.MedicalHistory, nameof(intake.MedicalHistory));
       CheckField(intake.Medications,    nameof(intake.Medications));
       CheckField(intake.Allergies,      nameof(intake.Allergies));
       if (System.Text.Encoding.UTF8.GetByteCount(intake.ChiefComplaint) > MaxPayloadBytes)
           throw new PayloadTooLargeException(nameof(intake.ChiefComplaint));
   }

   private static void CheckField<T>(T dto, string name)
   {
       var json = System.Text.Json.JsonSerializer.Serialize(dto);
       if (System.Text.Encoding.UTF8.GetByteCount(json) > MaxPayloadBytes)
           throw new PayloadTooLargeException(name);
   }

   public async Task<PatientIntake> CreateAsync(PatientIntake intake, CancellationToken ct = default)
   {
       ValidatePayloadSizes(intake);    // EC-1: reject before hitting EF Core
       try
       {
           intake.SubmittedAt = DateTimeOffset.UtcNow;   // set once at creation; interceptor will not change it
           _db.PatientIntakes.Add(intake);
           await _db.SaveChangesAsync(ct);
           return intake;
       }
       catch (DbUpdateException ex)
           when (ex.InnerException?.Message.Contains("patient_intakes_patient_id_fkey",
                     StringComparison.Ordinal) == true)
       {
           throw new PatientNotFoundException(intake.PatientId);   // EC-3
       }
   }

   public Task<PatientIntake?> GetLatestByPatientAsync(Guid patientId, CancellationToken ct = default)
       => _db.PatientIntakes
             .Where(i => i.PatientId == patientId)
             .OrderByDescending(i => i.SubmittedAt)   // AC-5: latest first
             .FirstOrDefaultAsync(ct);
   ```

7. **Modify `ApplicationDbContext.cs`** — add DbSet and OnModelCreating config:
   ```csharp
   // DbSet:
   public DbSet<PatientIntake> PatientIntakes => Set<PatientIntake>();

   // In OnModelCreating:
   modelBuilder.Entity<PatientIntake>(entity =>
   {
       entity.ToTable("patient_intakes");
       entity.HasKey(i => i.IntakeId);
       entity.Property(i => i.IntakeId).HasColumnName("intake_id").HasDefaultValueSql("gen_random_uuid()");
       entity.Property(i => i.PatientId).HasColumnName("patient_id").IsRequired();
       entity.Property(i => i.IntakeMethod)
             .HasColumnName("intake_method")
             .IsRequired()
             .HasConversion(v => v.ToString(), v => Enum.Parse<IntakeMethod>(v));

       // PHI columns — each individually encrypted with AES-256 via PhiJsonEncryptionConverter<T>
       entity.Property(i => i.Demographics)
             .HasColumnName("demographics").IsRequired()
             .HasColumnType("text")
             .HasConversion(new PhiJsonEncryptionConverter<DemographicsDto>());

       entity.Property(i => i.MedicalHistory)
             .HasColumnName("medical_history").IsRequired()
             .HasColumnType("text")
             .HasConversion(new PhiJsonEncryptionConverter<MedicalHistoryDto>());

       entity.Property(i => i.Medications)
             .HasColumnName("medications").IsRequired()
             .HasColumnType("text")
             .HasConversion(new PhiJsonEncryptionConverter<MedicationsDto>());

       entity.Property(i => i.Allergies)
             .HasColumnName("allergies").IsRequired()
             .HasColumnType("text")
             .HasConversion(new PhiJsonEncryptionConverter<AllergiesDto>());

       entity.Property(i => i.ChiefComplaint)
             .HasColumnName("chief_complaint").IsRequired()
             .HasColumnType("text")
             .HasConversion(new PhiTextEncryptionConverter());   // plain string — no JSON wrapping

       entity.Property(i => i.SubmittedAt).HasColumnName("submitted_at").IsRequired();
       entity.Property(i => i.UpdatedAt).HasColumnName("updated_at").IsRequired();

       // FK: patient_id → users.user_id (RESTRICT)
       entity.HasOne<User>().WithMany().HasForeignKey(i => i.PatientId)
             .OnDelete(DeleteBehavior.Restrict);

       // Composite index for latest-intake query (AC-5)
       entity.HasIndex(i => new { i.PatientId, i.SubmittedAt })
             .HasDatabaseName("ix_patient_intakes_patient_submitted");
   });
   ```

8. **Extend `AuditTimestampInterceptor`** to cover `PatientIntake` (AC-3 — `updated_at` only; `submitted_at` never touched by interceptor):
   ```csharp
   // Add to the SetTimestamps foreach block:
   else if (entry.Entity is PatientIntake intake)
   {
       // AC-3: interceptor sets updated_at on modification only.
       // submitted_at is set once in the repository CreateAsync and must never be overwritten here.
       if (entry.State == EntityState.Modified)
           intake.UpdatedAt = now;

       if (entry.State == EntityState.Added)
           intake.UpdatedAt = now;
           // submitted_at is intentionally NOT set here — repository sets it explicitly before Add()
   }
   ```

## Current Project State
```
/api/
├── Infrastructure/Security/               # NOT YET CREATED — created by this task (moved from Features/Users/Security)
├── Features/
│   ├── Users/Security/
│   │   └── PhiEmailEncryptionConverter.cs # us_007: WILL BE MOVED/RENAMED
│   └── Intake/                            # NOT YET CREATED — created by this task
├── Data/ApplicationDbContext.cs           # us_007/us_008/us_009: WILL BE MODIFIED
└── Infrastructure/Interceptors/
    └── AuditTimestampInterceptor.cs       # us_007: WILL BE MODIFIED
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| MOVE + RENAME | `/api/Infrastructure/Security/PhiTextEncryptionConverter.cs` | Renamed from `PhiEmailEncryptionConverter`; namespace updated to `Api.Infrastructure.Security`; algorithm unchanged |
| CREATE | `/api/Infrastructure/Security/PhiJsonEncryptionConverter.cs` | Generic `ValueConverter<T, string>`: `T → JSON.Serialize → AES.Encrypt → TEXT`; reverse on read |
| CREATE | `/api/Features/Intake/Entities/PatientIntake.cs` | Entity with 10 columns; `IntakeMethod` enum; PHI properties typed as DTOs |
| CREATE | `/api/Features/Intake/DTOs/IntakeDtos.cs` | `DemographicsDto`, `MedicalHistoryDto`, `MedicationsDto`, `MedicationEntry`, `AllergiesDto` records |
| CREATE | `/api/Features/Intake/Exceptions/PatientNotFoundException.cs` | Safe message with patientId; wraps `DbUpdateException` |
| CREATE | `/api/Features/Intake/Exceptions/PayloadTooLargeException.cs` | Enforced at service boundary; message names the field exceeding 64 KB |
| CREATE | `/api/Features/Intake/Services/IPatientIntakeRepository.cs` | `CreateAsync`, `UpdateAsync`, `GetLatestByPatientAsync`, `GetAllByPatientAsync` |
| CREATE | `/api/Features/Intake/Services/PatientIntakeRepository.cs` | 64 KB guard via `ValidatePayloadSizes`; catches FK violation → `PatientNotFoundException`; `GetLatestByPatientAsync` uses `OrderByDescending(SubmittedAt)` |
| MODIFY | `/api/Data/ApplicationDbContext.cs` | `DbSet<PatientIntake>`; `OnModelCreating` with `PhiJsonEncryptionConverter<T>` on 4 JSONB columns + `PhiTextEncryptionConverter` on `chief_complaint`; FK RESTRICT; composite index |
| MODIFY | `/api/Infrastructure/Interceptors/AuditTimestampInterceptor.cs` | Extend `SetTimestamps` to set `PatientIntake.UpdatedAt` on Added/Modified; never touch `SubmittedAt` |
| MODIFY | `/api/Program.cs` | Register `services.AddScoped<IPatientIntakeRepository, PatientIntakeRepository>()` |

## External References
- EF Core value converters with generics: https://learn.microsoft.com/en-us/ef/core/modeling/value-conversions
- `System.Text.Json` serialisation: https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/how-to
- AES-256-CBC in .NET (`System.Security.Cryptography`): https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.aes
- DR-005: `.propel/context/docs/design.md#DR-005`
- TR-006 (PHI key management): `.propel/context/docs/design.md#TR-006`

## Build Commands
```bash
# Build to confirm entity, converter, context compile
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
dotnet build api/Api.csproj --configuration Debug

# Scaffold migration (review before applying — task_002 applies it)
dotnet ef migrations add PatientIntakes --project api/Api.csproj --no-build
```

## Implementation Validation Strategy
- [ ] `PhiJsonEncryptionConverter<DemographicsDto>` round-trip: `Encrypt(dto)` → `Decrypt(result)` returns original DTO with all fields intact
- [ ] `ValidatePayloadSizes` throws `PayloadTooLargeException` for a `DemographicsDto` JSON string exceeding 64 KB; does NOT throw for a 1 KB payload
- [ ] `PatientIntakeRepository.CreateAsync` with a non-existent `PatientId` throws `PatientNotFoundException` (not `DbUpdateException`)
- [ ] `GetLatestByPatientAsync` returns the intake with the highest `SubmittedAt` when a patient has multiple records
- [ ] `AuditTimestampInterceptor` sets `PatientIntake.UpdatedAt` on `SaveChangesAsync`; `SubmittedAt` value is unchanged after an update
- [ ] `dotnet build api/Api.csproj` succeeds; EF Core migration scaffold reflects all 10 columns as TEXT/TIMESTAMPTZ

## Implementation Checklist
- [ ] Move and rename `PhiEmailEncryptionConverter` → `PhiTextEncryptionConverter` in `/api/Infrastructure/Security/`; update `users.email` `HasConversion` call in `ApplicationDbContext`
- [ ] Create `PhiJsonEncryptionConverter<T>.cs`: `T → JsonSerializer.Serialize → PhiTextEncryptionConverter.Encrypt` (write); reverse on read
- [ ] Create `IntakeDtos.cs`: `DemographicsDto`, `MedicalHistoryDto`, `MedicationsDto`, `MedicationEntry`, `AllergiesDto` records
- [ ] Create `PatientIntake.cs`: 10 columns, `IntakeMethod` enum, PHI properties typed as DTOs + `ChiefComplaint` as `string`
- [ ] Create `PatientNotFoundException.cs` + `PayloadTooLargeException.cs`: safe messages, no DB internals
- [ ] Create `IPatientIntakeRepository.cs` + `PatientIntakeRepository.cs`: `ValidatePayloadSizes` (64 KB), FK catch → `PatientNotFoundException`, `OrderByDescending(SubmittedAt)` for latest query
- [ ] Modify `ApplicationDbContext.cs`: DbSet, `PhiJsonEncryptionConverter<T>` on 4 JSONB columns, `PhiTextEncryptionConverter` on `chief_complaint`, FK RESTRICT, composite index
- [ ] Modify `AuditTimestampInterceptor.cs`: `PatientIntake.UpdatedAt` on Added/Modified; never set `SubmittedAt`
- [ ] Register `IPatientIntakeRepository` → `PatientIntakeRepository` in `Program.cs`
