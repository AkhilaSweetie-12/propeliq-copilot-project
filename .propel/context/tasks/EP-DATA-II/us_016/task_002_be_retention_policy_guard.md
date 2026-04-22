---
title: "Task — RetentionPolicyViolationException & Application-Layer 6-Year Hard-Delete Guard"
task_id: task_002
story_id: us_016
epic: EP-DATA-II
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_016] — PHI 6-Year Data Retention Policy & Automated Backup with WAL PITR
- Story Location: `.propel/context/tasks/EP-DATA-II/us_016/us_016.md`
- Acceptance Criteria:
  - AC-6: Any repository method that would hard-DELETE a PHI table row with a timestamp column value less than 6 years ago raises `RetentionPolicyViolationException("Record is within the 6-year HIPAA retention window — deletion is prohibited")`; the deletion is blocked before any DB call is made
- Edge Cases:
  - EC-1 (implied by AC-6): Records older than 6 years MAY be archived/deleted after explicit retention policy review; the guard only blocks deletions within the 6-year window

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
Define `RetentionPolicyViolationException` and a shared `RetentionGuard` static helper that checks whether a given timestamp falls within the 6-year HIPAA retention window. Apply `RetentionGuard.AssertDeletable()` in all 5 PHI repository implementations (`PatientIntakeRepository`, `ClinicalDocumentRepository`, `ExtractedClinicalDataRepository`, `PatientView360Repository`, `AuditLogRepository`) wherever a hard-delete path could be exposed — confirming each either raises `RetentionPolicyViolationException` unconditionally (for append-only tables) or validates the record timestamp before allowing deletion.

## Dependent Tasks
- `us_010 task_001_be_patient_intake_entity_converters.md` — `PatientIntakeRepository` must exist
- `us_012 task_001_be_clinical_document_entity.md` — `ClinicalDocumentRepository` must exist
- `us_013 task_001_be_extracted_clinical_data_entity.md` — `ExtractedClinicalDataRepository` must exist
- `us_014 task_001_be_patient_view_360_medical_code_entities.md` — `PatientView360Repository` must exist
- `us_015 task_001_be_audit_log_entity_repository.md` — `AuditLogRepository` already raises `InvalidOperationException` on `Remove()`; extend to use `RetentionPolicyViolationException` message instead (or keep as-is — both block deletion)

## Impacted Components
- `/api/Domain/Exceptions/RetentionPolicyViolationException.cs` — CREATE: domain exception with mandatory HIPAA message
- `/api/Domain/Services/RetentionGuard.cs` — CREATE: static helper `AssertDeletable(DateTime recordTimestamp)` that throws if within 6 years
- `/api/Infrastructure/Persistence/Repositories/PatientIntakeRepository.cs` — MODIFY: add `DeleteAsync` method that calls `RetentionGuard.AssertDeletable()` (or confirm no delete method exists and add a guard-throwing stub)
- `/api/Infrastructure/Persistence/Repositories/ClinicalDocumentRepository.cs` — MODIFY: same pattern
- `/api/Infrastructure/Persistence/Repositories/ExtractedClinicalDataRepository.cs` — MODIFY: same pattern
- `/api/Infrastructure/Persistence/Repositories/PatientView360Repository.cs` — MODIFY: same pattern
- `/api/Infrastructure/Persistence/Repositories/AuditLogRepository.cs` — MODIFY: align `Remove()` exception with `RetentionPolicyViolationException`

## Implementation Plan

1. **Define `RetentionPolicyViolationException`** (AC-6):
   ```csharp
   // /api/Domain/Exceptions/RetentionPolicyViolationException.cs
   namespace Api.Domain.Exceptions;

   public sealed class RetentionPolicyViolationException : Exception
   {
       public RetentionPolicyViolationException()
           : base("Record is within the 6-year HIPAA retention window — deletion is prohibited.") { }

       public RetentionPolicyViolationException(string message) : base(message) { }
   }
   ```

2. **Define `RetentionGuard` static helper** (AC-6) — centralises the 6-year window check so all repositories share the same logic (DRY):
   ```csharp
   // /api/Domain/Services/RetentionGuard.cs
   namespace Api.Domain.Services;

   public static class RetentionGuard
   {
       private const int RetentionYears = 6;

       /// <summary>
       /// Throws <see cref="RetentionPolicyViolationException"/> if the given record timestamp
       /// is within the HIPAA 6-year retention window (i.e., less than 6 years old).
       /// </summary>
       public static void AssertDeletable(DateTime recordTimestamp)
       {
           var retentionCutoff = DateTime.UtcNow.AddYears(-RetentionYears);
           if (recordTimestamp > retentionCutoff)
               throw new RetentionPolicyViolationException();
       }

       /// <summary>
       /// Returns true if the record is past the retention window and may be deleted or archived.
       /// </summary>
       public static bool IsEligibleForDeletion(DateTime recordTimestamp)
       {
           var retentionCutoff = DateTime.UtcNow.AddYears(-RetentionYears);
           return recordTimestamp <= retentionCutoff;
       }
   }
   ```
   Design decisions:
   - `RetentionYears = 6` is a named constant — changing the retention period requires a single edit.
   - Comparison is `recordTimestamp > retentionCutoff` (strictly within window) so records EXACTLY 6 years old are considered eligible for deletion (boundary inclusive of expiry date).
   - `IsEligibleForDeletion()` is the non-throwing counterpart, useful for archival batch jobs that need to check without catching exceptions.

3. **Add `DeleteAsync` guard stubs to PHI repositories** — each repository currently exposes no delete method (by design from prior stories). Add a guard-throwing `DeleteAsync` to each interface and implementation to make the "no deletion" contract explicit and testable (AC-6):

   **`IPatientIntakeRepository`** — add:
   ```csharp
   // Raises RetentionPolicyViolationException unconditionally or after timestamp check.
   Task DeleteAsync(Guid intakeId, CancellationToken ct = default);
   ```

   **`PatientIntakeRepository.DeleteAsync`**:
   ```csharp
   public async Task DeleteAsync(Guid intakeId, CancellationToken ct = default)
   {
       var intake = await _db.PatientIntakes.AsNoTracking()
           .FirstOrDefaultAsync(i => i.IntakeId == intakeId, ct)
           ?? throw new KeyNotFoundException($"PatientIntake '{intakeId}' not found.");
       // AC-6: block deletion if within 6-year retention window
       RetentionGuard.AssertDeletable(intake.SubmittedAt);
       // If past retention window — allowed; physical deletion or archival proceeds
       _db.PatientIntakes.Remove(await _db.PatientIntakes.FindAsync([intakeId], ct)!);
       await _db.SaveChangesAsync(ct);
   }
   ```

   Apply the same pattern to `ClinicalDocumentRepository`, `ExtractedClinicalDataRepository`, and `PatientView360Repository`:
   - `ClinicalDocumentRepository.DeleteAsync` → `RetentionGuard.AssertDeletable(document.UploadedAt)`
   - `ExtractedClinicalDataRepository.DeleteAsync` → `RetentionGuard.AssertDeletable(extract.ExtractedAt)`
   - `PatientView360Repository.DeleteAsync` → `RetentionGuard.AssertDeletable(view.LastUpdatedAt)` (or `created_at` if added later; use `LastUpdatedAt` as the most conservative bound)

4. **Align `AuditLogRepository.Remove()`** with `RetentionPolicyViolationException` (AC-6):
   ```csharp
   // In AuditLogRepository — replace InvalidOperationException with RetentionPolicyViolationException
   // for semantic consistency: audit logs are both immutable AND within retention window
   public void Remove(AuditLog entry)
       => throw new RetentionPolicyViolationException(
           "Audit log entries are immutable and within the 6-year HIPAA retention window — deletion is prohibited.");
   ```
   Note: `AuditLog.Remove()` always throws regardless of timestamp (audit logs are never eligible for deletion per HIPAA §164.312(b) — they must be retained; even post-6-year audit logs should be archived rather than deleted). This is a stricter policy than the timestamp-based check.

5. **Register `RetentionGuard` availability** — `RetentionGuard` is a static class; no DI registration needed. It is importable wherever the `Api.Domain.Services` namespace is referenced.

6. **Verify timestamp columns used in each `AssertDeletable` call** — confirm which column maps to the "creation timestamp" for retention purposes:
   | PHI Table | Retention Timestamp Column | Entity Property |
   |-----------|---------------------------|-----------------|
   | `patient_intakes` | `submitted_at` | `PatientIntake.SubmittedAt` |
   | `clinical_documents` | `uploaded_at` | `ClinicalDocument.UploadedAt` |
   | `extracted_clinical_data` | `extracted_at` | `ExtractedClinicalData.ExtractedAt` |
   | `patient_view_360` | `last_updated_at` | `PatientView360.LastUpdatedAt` |
   | `audit_logs` | `occurred_at` | `AuditLog.OccurredAt` — always protected |

## Current Project State
```
/api/
├── Domain/
│   ├── Exceptions/
│   │   ├── InvalidStatusTransitionException.cs  # us_012: exists
│   │   ├── DocumentNotFoundException.cs         # us_012: exists
│   │   ├── InvalidConfidenceScoreException.cs   # us_014: exists
│   │   └── RetentionPolicyViolationException.cs # NOT YET CREATED — this task
│   └── Services/
│       └── RetentionGuard.cs                    # NOT YET CREATED — this task
├── Infrastructure/Persistence/Repositories/
│   ├── PatientIntakeRepository.cs               # WILL BE MODIFIED — add DeleteAsync guard
│   ├── ClinicalDocumentRepository.cs            # WILL BE MODIFIED — add DeleteAsync guard
│   ├── ExtractedClinicalDataRepository.cs       # WILL BE MODIFIED — add DeleteAsync guard
│   ├── PatientView360Repository.cs              # WILL BE MODIFIED — add DeleteAsync guard
│   └── AuditLogRepository.cs                    # WILL BE MODIFIED — align Remove() exception type
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/api/Domain/Exceptions/RetentionPolicyViolationException.cs` | Domain exception with standard HIPAA retention message |
| CREATE | `/api/Domain/Services/RetentionGuard.cs` | Static `AssertDeletable(DateTime)` + `IsEligibleForDeletion(DateTime)` helpers; 6-year constant |
| MODIFY | `/api/Domain/Repositories/IPatientIntakeRepository.cs` | Add `Task DeleteAsync(Guid intakeId, CancellationToken ct)` |
| MODIFY | `/api/Infrastructure/Persistence/Repositories/PatientIntakeRepository.cs` | `DeleteAsync`: load record, call `RetentionGuard.AssertDeletable(SubmittedAt)`, proceed only if past retention window |
| MODIFY | `/api/Domain/Repositories/IClinicalDocumentRepository.cs` | Add `Task DeleteAsync(Guid documentId, CancellationToken ct)` |
| MODIFY | `/api/Infrastructure/Persistence/Repositories/ClinicalDocumentRepository.cs` | `DeleteAsync` with `RetentionGuard.AssertDeletable(UploadedAt)` |
| MODIFY | `/api/Domain/Repositories/IExtractedClinicalDataRepository.cs` | Add `Task DeleteAsync(Guid extractId, CancellationToken ct)` |
| MODIFY | `/api/Infrastructure/Persistence/Repositories/ExtractedClinicalDataRepository.cs` | `DeleteAsync` with `RetentionGuard.AssertDeletable(ExtractedAt)` |
| MODIFY | `/api/Domain/Repositories/IPatientView360Repository.cs` | Add `Task DeleteAsync(Guid patientId, CancellationToken ct)` |
| MODIFY | `/api/Infrastructure/Persistence/Repositories/PatientView360Repository.cs` | `DeleteAsync` with `RetentionGuard.AssertDeletable(LastUpdatedAt)` |
| MODIFY | `/api/Infrastructure/Persistence/Repositories/AuditLogRepository.cs` | Replace `InvalidOperationException` in `Remove()` with `RetentionPolicyViolationException` |

## External References
- HIPAA 45 CFR § 164.530(j) — 6-year retention: https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html
- DR-012: PHI 6-year retention mandate — `.propel/context/docs/design.md#DR-012`
- OWASP A01 (Broken Access Control — unauthorised data deletion): https://owasp.org/Top10/A01_2021-Broken_Access_Control/

## Build Commands
```bash
DATABASE_URL="Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword" \
PHI_ENCRYPTION_KEY="dev-only-phi-key-change-in-production-32chars" \
JWT_SIGNING_KEY="dev-only-signing-key-change-in-production-min-32chars" \
UPLOADS_ROOT="/tmp/uploads" \
dotnet build api/Api.csproj --configuration Debug
```

## Implementation Validation Strategy
- [ ] `RetentionGuard.AssertDeletable(DateTime.UtcNow)` throws `RetentionPolicyViolationException` (record is 0 years old — within window)
- [ ] `RetentionGuard.AssertDeletable(DateTime.UtcNow.AddYears(-7))` does NOT throw (record is 7 years old — past window)
- [ ] `RetentionGuard.IsEligibleForDeletion(DateTime.UtcNow.AddYears(-6).AddDays(-1))` returns `true`
- [ ] `PatientIntakeRepository.DeleteAsync(id)` for a record with `SubmittedAt = DateTime.UtcNow.AddYears(-1)` throws `RetentionPolicyViolationException` before any DB call (AC-6)
- [ ] `AuditLogRepository.Remove(entry)` throws `RetentionPolicyViolationException` (always — audit logs are never deletable)
- [ ] `dotnet build` passes — all 5 repository interfaces updated with `DeleteAsync` signature

## Implementation Checklist
- [ ] Create `RetentionPolicyViolationException.cs` with default constructor using standard HIPAA message
- [ ] Create `RetentionGuard.cs` with `AssertDeletable(DateTime)` and `IsEligibleForDeletion(DateTime)` static methods; 6-year constant named `RetentionYears`
- [ ] Add `DeleteAsync` to all 5 PHI repository interfaces (`IPatientIntakeRepository`, `IClinicalDocumentRepository`, `IExtractedClinicalDataRepository`, `IPatientView360Repository`; `IAuditLogRepository` already has `Remove()`)
- [ ] Implement `DeleteAsync` in each PHI repository: load record by ID → call `RetentionGuard.AssertDeletable(timestampProperty)` → physical delete only if past window
- [ ] Modify `AuditLogRepository.Remove()` to throw `RetentionPolicyViolationException` instead of `InvalidOperationException`
- [ ] Verify `RetentionGuard` boundary: record exactly at 6-year cutoff (`DateTime.UtcNow.AddYears(-6)`) returns `IsEligibleForDeletion = true` (boundary inclusive)
- [ ] Run `dotnet build` — confirm no compilation errors
