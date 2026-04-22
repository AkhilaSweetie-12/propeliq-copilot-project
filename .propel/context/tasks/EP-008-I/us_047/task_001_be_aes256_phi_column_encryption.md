---
title: "Task — BE AES-256 Column-Level PHI Encryption via EF Core ValueConverter, HMAC-SHA-256 Email Hash & Startup Key Validation"
task_id: task_001
story_id: us_047
epic: EP-008-I
layer: Backend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — BE AES-256 Column-Level PHI Encryption via EF Core ValueConverter, HMAC-SHA-256 Email Hash & Startup Key Validation

## Requirement Reference

- **User Story**: us_047
- **Story Location**: .propel/context/tasks/EP-008-I/us_047/us_047.md
- **Acceptance Criteria**:
  - AC-1: 8 PHI columns encrypted with AES-256 application-layer encryption via EF Core `ValueConverter<string, string>`: `users.email` (encrypted + parallel deterministic `email_hash` via HMAC-SHA-256 for unique-constraint lookup), `patient_intakes.demographics` (JSONB), `patient_intakes.medical_history` (JSONB), `patient_intakes.medications` (JSONB), `patient_intakes.allergies` (JSONB), `patient_intakes.chief_complaint` (TEXT), `extracted_clinical_data.field_value` (TEXT), `patient_view_360.aggregated_data` (JSONB); `PHI_ENCRYPTION_KEY` from env (base64-encoded 256-bit); fresh IV per encryption op prepended to ciphertext; stored as Base64 TEXT (not BYTEA) (FR-037, NFR-007)
  - AC-2: Encryption transparent to application; all repository/service classes operate on plaintext; `ValueConverter<string, string>` auto-encrypts on EF Core write and decrypts on read; no direct `Aes.Encrypt()` / `Aes.Decrypt()` calls in service/controller code; unit test per entity: (a) write + read back = original plaintext, (b) raw DB column ≠ plaintext, (c) same plaintext produces different ciphertext on repeated calls (fresh IV) (FR-037, NFR-007)
  - AC-3: `users.email` lookup via HMAC-SHA-256 of input email using `EMAIL_HMAC_KEY` env var; `WHERE email_hash = computed_hmac` (O(1) indexed, UNIQUE constraint); `email_hash` is NOT PHI, NOT encrypted; `EMAIL_HMAC_KEY` stored separately from AES key (NFR-007, FR-037, NFR-005)
  - AC-4: EF Core migration encrypts existing rows in batches of 1,000; verifies pre/post row count match; compensating rollback migration provided but does NOT decrypt (restoring from backup required); application startup validates `PHI_ENCRYPTION_KEY` exactly 32 bytes (256 bits): absent or wrong length → log `"Fatal: PHI_ENCRYPTION_KEY must be 32 bytes — application cannot start without valid encryption configuration"` + refuse to start (FR-037, NFR-007, NFR-005)
  - AC-5: CI security test connects to PostgreSQL test instance with read-only DB user; queries `users`, `patient_intakes`, `extracted_clinical_data`, `patient_view_360`, `clinical_documents` (sample row); asserts no returned column value matches known test fixture PHI values (no plaintext patient name, email, demographics, clinical data visible in raw DB); test runs on every merge to main (FR-035, FR-037, NFR-005, NFR-007)

- **Edge Cases**:
  - Edge Case: Key rotation (Phase 2 only) — Phase 1 key is set once at deployment and immutable; rotation requires full re-encryption migration; documented in security runbook
  - Edge Case: Decryption failure (ciphertext corruption) → `AesValueConverter` catches `CryptographicException`; returns `null` for affected field; writes `audit_logs (action=DecryptionFailure, entity_type, entity_id, column_name)` synchronously; does NOT surface raw ciphertext to client; logs Error to Serilog
  - Edge Case: Large JSONB ciphertext size → PostgreSQL `TEXT` has no max length (up to 1 GB); Base64 adds ~33% overhead; 500 KB JSONB → ~670 KB Base64 — within PostgreSQL limits; no truncation risk for Phase 1 data volumes
  - Edge Case: Non-deterministic IV for email query — ONLY `email_hash` HMAC is used for query-time matching; all other PHI columns are never queried by value (always fetched by `patient_id`/`document_id` FK); fresh IV is safe for all non-email PHI columns
  - Edge Case: Test fixtures + in-memory EF Core — in-memory EF Core provider does NOT apply value converters; encryption only activates with real Npgsql provider; integration tests use real PostgreSQL test instance; raw-DB CI test (AC-5) uses read-only user

---

## Design References

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

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | ASP.NET Core | .NET 9 |
| ORM | EF Core with Npgsql | 9.x |
| Database | PostgreSQL 16 | — |
| Crypto | `System.Security.Cryptography.Aes` | Built-in .NET 9 |
| Logging | Serilog | latest |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |
| **AI Pattern** | N/A |
| **Prompt Template Path** | N/A |
| **Guardrails Config** | N/A |
| **Model Provider** | N/A |

---

## Mobile References

| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |
| **Platform Target** | N/A |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Implement application-layer AES-256-GCM column encryption for all 8 PHI columns across 4 PostgreSQL entities via EF Core `ValueConverter<string, string>`. The `AesValueConverter` generates a fresh 12-byte IV per encryption call (GCM) and prepends it to the ciphertext before Base64 encoding. The `PHI_ENCRYPTION_KEY` (32-byte base64 env var) is loaded once on application startup and validated; the application refuses to start without it. A separate `HMAC-SHA-256` of `users.email` is stored in the parallel `email_hash` column (NOT encrypted) to allow O(1) unique-constraint login lookups. An EF Core data migration encrypts all existing rows in batches of 1,000. A CI security test asserts raw DB columns contain only ciphertext.

---

## Dependent Tasks

- US_007 (Foundational EP-DATA-I) — `users`, `patient_intakes`, `notifications` entities migrated
- US_012 (Foundational EP-DATA-II) — `extracted_clinical_data`, `patient_view_360`, `medical_code_suggestions` entities migrated
- us_048 task_001 — `AuditLogger` must exist for `DecryptionFailure` audit write in edge case handler

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Infrastructure/Encryption/AesValueConverter.cs` | CREATE | AES-256-GCM encrypt/decrypt; fresh IV per call; Base64 TEXT storage |
| `Server/Infrastructure/Encryption/PhiEncryptionService.cs` | CREATE OR REUSE | Wraps `Aes.Create()`; provides `Encrypt(string)` + `Decrypt(string)` |
| `Server/Infrastructure/Encryption/HmacEmailHasher.cs` | CREATE | HMAC-SHA-256 of email using `EMAIL_HMAC_KEY` env var |
| `Server/Data/AppDbContext.cs` | MODIFY | Register `AesValueConverter` for all 8 PHI columns in `OnModelCreating` |
| `Server/Data/Entities/User.cs` | MODIFY | Add `email_hash` property (`string`) |
| `Server/Data/Migrations/...EncryptPhiColumns.cs` | CREATE | Batch-1000 migration; row count validation; compensating rollback (no decrypt) |
| `Server/Program.cs` | MODIFY | Startup key validation: validate `PHI_ENCRYPTION_KEY` 32 bytes before `builder.Build()` |
| `Server/Features/Auth/Services/AuthService.cs` | MODIFY | Replace plaintext email query with HMAC hash lookup (`WHERE email_hash = hmac`) |
| `Server/Tests/Unit/Encryption/AesValueConverterTests.cs` | CREATE | Per-entity encrypt/decrypt round-trip; ciphertext ≠ plaintext; different IV per call |
| `Server/Tests/Integration/CiPhiColumnSecurityTests.cs` | CREATE | AC-5: raw DB read-only user; assert no fixture PHI in raw column values |

---

## Implementation Plan

1. Create `PhiEncryptionService` reading `PHI_ENCRYPTION_KEY` from `IConfiguration`; expose `Encrypt(string plaintext): string` (AES-256-GCM, fresh 12-byte IV, prepend IV to ciphertext, return Base64) and `Decrypt(string ciphertext): string?` (split IV prefix, decrypt GCM, catch `CryptographicException` → audit + return null)
2. Create `HmacEmailHasher` reading `EMAIL_HMAC_KEY` from `IConfiguration`; expose `Hash(string email): string` (HMAC-SHA-256 keyed hash, return Base64)
3. Create `AesValueConverter` — a `ValueConverter<string, string>` wrapping `PhiEncryptionService.Encrypt` and `PhiEncryptionService.Decrypt`; register as a singleton keyed converter in DI
4. Register `AesValueConverter` for all 8 PHI columns in `AppDbContext.OnModelCreating`:
   - `users.email` → `AesValueConverter`; `users.email_hash` → no converter (plain string); UNIQUE constraint on `email_hash`
   - `patient_intakes.demographics`, `medical_history`, `medications`, `allergies`, `chief_complaint` → `AesValueConverter`
   - `extracted_clinical_data.field_value` → `AesValueConverter`
   - `patient_view_360.aggregated_data` → `AesValueConverter`
5. Add `email_hash` column to `User` entity; update EF Core migration scaffold
6. In `Program.cs`: before `builder.Build()`, read `PHI_ENCRYPTION_KEY` from config; if null or `Convert.FromBase64String(key).Length != 32` → `Log.Fatal("Fatal: PHI_ENCRYPTION_KEY must be 32 bytes — application cannot start without valid encryption configuration"); return;`
7. Update `AuthService.LoginAsync`: compute HMAC of provided email → query `WHERE email_hash = hmacValue`; on registration: compute HMAC + store alongside encrypted email
8. Write EF Core migration `EncryptPhiColumns`: iterate each encrypted table in batches of 1,000 rows; for each batch: read rows, apply `PhiEncryptionService.Encrypt` to each PHI field, `UPDATE` batch; validate post-migration row count matches pre-count; provide compensating rollback migration that NOPs (add comment: "Rollback requires restore from backup — decryption intentionally omitted to prevent PHI exposure")
9. Write unit tests in `AesValueConverterTests.cs`: for each of the 8 columns, assert (a) encrypt(plaintext) → decrypt → equals original plaintext; (b) raw encrypted string ≠ plaintext; (c) encrypt(same plaintext, call 1) ≠ encrypt(same plaintext, call 2) (IV randomness)
10. Write CI security test `CiPhiColumnSecurityTests.cs`: connect to PostgreSQL test instance with read-only DB user; SELECT raw column values from each encrypted table; for each known test fixture PHI value, assert raw column value does NOT contain the plaintext fixture value

---

## Current Project State

```
Server/
├── Program.cs                          ← MODIFY (startup key validation)
├── Data/
│   ├── AppDbContext.cs                 ← MODIFY (register ValueConverter)
│   ├── Entities/User.cs                ← MODIFY (add email_hash)
│   └── Migrations/                     ← ADD EncryptPhiColumns migration
├── Features/
│   └── Auth/Services/AuthService.cs    ← MODIFY (HMAC email lookup)
├── Infrastructure/
│   └── Encryption/                     ← CREATE AesValueConverter, PhiEncryptionService, HmacEmailHasher
└── Tests/
    ├── Unit/Encryption/                 ← CREATE AesValueConverterTests
    └── Integration/                     ← CREATE CiPhiColumnSecurityTests
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `Server/Infrastructure/Encryption/PhiEncryptionService.cs` | AES-256-GCM encrypt/decrypt; `CryptographicException` → null + audit log |
| CREATE | `Server/Infrastructure/Encryption/AesValueConverter.cs` | EF Core `ValueConverter<string, string>` backed by `PhiEncryptionService` |
| CREATE | `Server/Infrastructure/Encryption/HmacEmailHasher.cs` | HMAC-SHA-256 of email using `EMAIL_HMAC_KEY` |
| MODIFY | `Server/Data/AppDbContext.cs` | Register converters for 8 PHI columns; UNIQUE constraint on `email_hash` |
| MODIFY | `Server/Data/Entities/User.cs` | Add `string EmailHash` property |
| CREATE | `Server/Data/Migrations/..._EncryptPhiColumns.cs` | Batch-1000 encryption migration; compensating rollback NOP |
| MODIFY | `Server/Program.cs` | Validate `PHI_ENCRYPTION_KEY` 32 bytes on startup; fatal log + exit if invalid |
| MODIFY | `Server/Features/Auth/Services/AuthService.cs` | HMAC email hash for login/registration lookup |
| CREATE | `Server/Tests/Unit/Encryption/AesValueConverterTests.cs` | Round-trip, ciphertext ≠ plaintext, IV randomness per entity |
| CREATE | `Server/Tests/Integration/CiPhiColumnSecurityTests.cs` | AC-5: raw DB user; assert ciphertext in all PHI columns |

---

## External References

- [HIPAA Security Rule — Encryption and Decryption Standard (45 CFR § 164.312(a)(2)(iv))](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [NIST SP 800-111 — Guide to Storage Encryption Technologies for End User Devices](https://csrc.nist.gov/publications/detail/sp/800-111/final)
- [EF Core Value Conversions Documentation](https://learn.microsoft.com/en-us/ef/core/modeling/value-conversions)
- [System.Security.Cryptography.AesGcm — .NET 9](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.aesgcm)

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`
- `cd Server && dotnet ef migrations add EncryptPhiColumns`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] `PhiEncryptionService.Encrypt("test plaintext")` → Base64 string; `Decrypt(result)` → `"test plaintext"`
- [ ] `PhiEncryptionService.Encrypt("test")` called twice → two different ciphertext strings (IV randomness confirmed)
- [ ] Raw DB query on `users` table → `email` column contains Base64 ciphertext, not plaintext email
- [ ] `email_hash` column → UNIQUE constraint present in migration; login via HMAC lookup succeeds
- [ ] Application startup with `PHI_ENCRYPTION_KEY` absent → logs fatal + exits; does NOT start
- [ ] Application startup with 31-byte key → logs fatal + exits; does NOT start
- [ ] `EncryptPhiColumns` migration runs without error on test DB with seed data; row count matches pre/post
- [ ] CI security test (`CiPhiColumnSecurityTests`): 0 known PHI fixture values found in raw DB columns
- [ ] No `Aes.Create()` / `Aes.Encrypt()` / `Aes.Decrypt()` direct calls in any service, controller, or handler class (only in `PhiEncryptionService`)

---

## Implementation Checklist

- [ ] Create `PhiEncryptionService`: AES-256-GCM; fresh 12-byte IV per call; Base64 TEXT output; `CryptographicException` catch → null return + `DecryptionFailure` audit log
- [ ] Create `AesValueConverter`: `ValueConverter<string, string>` wrapping `PhiEncryptionService.Encrypt` / `Decrypt`
- [ ] Create `HmacEmailHasher`: HMAC-SHA-256 keyed with `EMAIL_HMAC_KEY`; Base64 output
- [ ] Register `AesValueConverter` on all 8 PHI columns in `AppDbContext.OnModelCreating`; add UNIQUE constraint on `email_hash`
- [ ] Add `EmailHash` property to `User` entity; scaffold EF Core migration for `email_hash` column
- [ ] Add startup validation in `Program.cs`: validate `PHI_ENCRYPTION_KEY` = 32 bytes; fatal log + return on failure
- [ ] Update `AuthService`: login = HMAC hash lookup; registration = compute HMAC + store alongside encrypted email
- [ ] Write `EncryptPhiColumns` EF Core migration: batch-1000 rows per table; pre/post count validation; compensating rollback NOP
- [ ] Write `AesValueConverterTests.cs`: per-entity round-trip, ciphertext ≠ plaintext, IV randomness assertions
- [ ] Write `CiPhiColumnSecurityTests.cs`: read-only DB connection; assert no plaintext PHI in 5 table columns
- [ ] Verify no direct `Aes.Create()` usage outside `PhiEncryptionService` (grep or architecture test)
