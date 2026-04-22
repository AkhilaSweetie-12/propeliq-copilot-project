---
title: "Task — BE AggregatePatientViewJob — Aggregation, De-duplication, Conflict Detection & 360° View API Endpoints"
task_id: task_001
story_id: us_042
epic: EP-006-II
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — BE AggregatePatientViewJob — Aggregation, De-duplication, Conflict Detection & 360° View API Endpoints

## Requirement Reference

- **User Story**: us_042
- **Story Location**: .propel/context/tasks/EP-006-II/us_042/us_042.md
- **Acceptance Criteria**:
  - AC-1: `AggregatePatientViewJob(patient_id)` enqueued by `ExtractionJob` on successful completion; queries `extracted_clinical_data` rows for `patient_id` where `field_type` NOT a `_NeedsReview` variant; groups by `field_type`; builds aggregated JSONB with source attribution (`document_id`, `extracted_at`, `source_text`); UPSERTS `patient_view_360 (patient_id, aggregated_data [AES-256 encrypted], last_updated_at=NOW(), is_verified=false)`; `is_verified=false` on EVERY aggregation run (FR-028)
  - AC-2: De-duplication: case-insensitive, whitespace-trimmed comparison of core value string per field type; retain most-recently-extracted occurrence; merge all source attributions from duplicate group; INSERT `audit_logs (action=DeduplicationApplied, patient_id, field_type, duplicate_count=N)` per field type with removed duplicates (FR-029)
  - AC-3: Conflict detection per field type deterministic rules — Medications: same name, dosage differs > 10%; Allergies: listed in one doc + "No Known Allergies" in another; Vitals: same vital type, BP ≥ 20 mmHg systolic or Weight ≥ 10 kg within same 30-day window; Diagnoses/SurgicalHistory: contradictory presence/absence; for each conflict append `{ conflict_id: UUID, field_type, field_name, values:[{document_id, value, extracted_at}], acknowledged: false }` to `patient_view_360.conflict_flags` JSONB; INSERT `audit_logs (action=ConflictDetected, patient_id, field_type, conflict_id)` (FR-030)
  - AC-4: `GET /api/patients/{id}/view360` returns `{ aggregated_data [decrypted], conflict_flags, is_verified, verified_by, verified_at, last_updated_at }`; RBAC: `role=Staff` or `role=Admin` only; Patient → HTTP 403; HTTP 404 with `{ status: "no_data" }` when no `patient_view_360` row exists; INSERT `audit_logs (action=PatientView360Accessed, actor_id, patient_id)` on every successful read (NFR-017 PHI access log)
  - AC-5: `POST /api/patients/{id}/view360/verify`: check `conflict_flags` for `acknowledged=false`; any remaining → HTTP 400 `{ error: "AllConflictsMustBeAcknowledged" }`; all acknowledged (or no conflicts) → SET `is_verified=true, verified_by=staff_id, verified_at=NOW()`; INSERT `audit_logs (action=ViewVerified, actor_id, patient_id)`; return HTTP 200 `{ is_verified: true, verified_at }` (FR-030)
  - `POST /api/patients/{id}/view360/acknowledge { conflict_id }`: find conflict in `conflict_flags` by `conflict_id`; SET `acknowledged=true`; if already acknowledged → return 200 idempotently; UPSERT via JSONB patch (optimistic concurrency — version check prevents duplicate writes); INSERT `audit_logs (action=ConflictAcknowledged, actor_id=staff_id, patient_id, conflict_id)`; return HTTP 200

- **Edge Cases**:
  - Edge Case: New document uploaded while view is `is_verified=true` → `AggregatePatientViewJob` re-runs; `is_verified` reset to `false`; INSERT `audit_logs (action=ViewResetUnverified, patient_id, triggered_by=document_id)`
  - Edge Case: Concurrent `AggregatePatientViewJob` for same patient → PostgreSQL advisory lock `pg_try_advisory_lock(patient_id_hash)`; if lock unavailable → reschedule 5 s delay, retry up to 3×; after 3 failed lock attempts → job → `Failed`
  - Edge Case: All extracted values are `_NeedsReview` → aggregation query returns 0 rows; `aggregated_data={}` (empty JSONB); `patient_view_360` UPSERTED with empty data; `GET` returns HTTP 200 with empty payload (not 404)
  - Edge Case: De-duplication — brand/generic synonyms (e.g., "Metformin" vs "Glucophage") → treated as different; Phase 1 limitation; both retained

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No (data consumed by us_043 FE) |
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
| Background Jobs | Hangfire + Hangfire.PostgreSql | 1.8.x |
| ORM | Entity Framework Core | 9 (Npgsql) |
| Database | PostgreSQL 16 | Advisory locks, JSONB |
| Encryption | System.Security.Cryptography.Aes (AES-256-GCM) | built-in .NET 9 |
| Auth | JWT Bearer | .NET 9 |
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

Implement the `AggregatePatientViewJob` Hangfire job triggered at the end of each successful `ExtractionJob`. The job groups `extracted_clinical_data` rows (excluding `_NeedsReview` types) by field type, applies case-insensitive de-duplication (retaining most recent, merging sources), runs deterministic conflict detection rules per field type, encrypts the aggregated payload with AES-256, and UPSERTs `patient_view_360`. A PostgreSQL advisory lock prevents concurrent aggregation corruption. Three REST endpoints expose the view: `GET /view360` (Staff/Admin only, PHI access log), `POST /view360/verify` (all-conflicts-acknowledged guard), and `POST /view360/acknowledge { conflict_id }` (idempotent JSONB patch).

---

## Dependent Tasks

- us_040 task_001 — `ExtractionJob` must enqueue `AggregatePatientViewJob` after successful extraction
- us_041 task_001 — `ExtractionJob` with RAG pipeline produces `extracted_clinical_data` rows that this job aggregates
- US_016 (Foundational EP-DATA-II) — `patient_view_360` entity (`patient_id`, `aggregated_data` encrypted JSONB, `conflict_flags` JSONB, `is_verified`, `verified_by`, `verified_at`, `last_updated_at`) migrated

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Documents/Jobs/AggregatePatientViewJob.cs` | CREATE | Hangfire job; advisory lock; aggregation; de-dup; conflict detection; UPSERT |
| `Server/Features/Documents/Services/ConflictDetectionService.cs` | CREATE | Deterministic rule set per field type; returns `List<ConflictFlag>` |
| `Server/Features/Documents/PatientView360Controller.cs` | CREATE | `GET /view360`, `POST /verify`, `POST /acknowledge`; RBAC; PHI audit log |
| `Server/Features/Documents/Jobs/ExtractionJob.cs` | MODIFY | Enqueue `AggregatePatientViewJob(patient_id)` after successful `upload_status=Extracted` update |

---

## Implementation Plan

1. Implement `AggregatePatientViewJob(Guid patientId)`:
   a. Acquire advisory lock: `SELECT pg_try_advisory_lock({hash(patientId)})`; if false → `BackgroundJob.Schedule<AggregatePatientViewJob>(5s)` up to 3 retries; on 3rd failure → throw
   b. Query: `extracted_clinical_data WHERE patient_id=X AND field_type NOT LIKE '%_NeedsReview'`; group by `field_type`
   c. Per group: sort by `extracted_at DESC`; de-duplicate by normalised value (`.Trim().ToLowerInvariant()`); retain first (most recent); merge `source_attribution` from all duplicates; log `DeduplicationApplied` if duplicates removed
   d. Build aggregated JSONB: `{ vitals:[...], medications:[...], allergies:[...], diagnoses:[...], surgical_history:[...] }` with per-entry source attribution
   e. Call `ConflictDetectionService.Detect(aggregatedData)` → `List<ConflictFlag>`
   f. `PhiEncryptionService.Encrypt(aggregatedJson)` → ciphertext
   g. UPSERT `patient_view_360 SET aggregated_data=ciphertext, conflict_flags=conflictJsonb, last_updated_at=NOW(), is_verified=false`; if row already existed with `is_verified=true` → INSERT `audit_logs(ViewResetUnverified, triggered_by=document_id)`
   h. INSERT `audit_logs(ConflictDetected)` per new conflict; release advisory lock

2. Implement `ConflictDetectionService.Detect(aggregatedData)`:
   - **Medications**: group by name (normalised); if multiple dosage values differ > 10% of max → conflict
   - **Allergies**: if allergy present in any doc AND another doc contains "No Known Allergies" (case-insensitive) as an allergy entry → conflict
   - **Vitals**: group by vital type + 30-day window; if BP systolic values differ ≥ 20 mmHg or Weight values differ ≥ 10 kg → conflict
   - **Diagnoses/SurgicalHistory**: if same condition name present in `field_value` of one entry and explicitly negated (contains "no " or "denies") in another → conflict

3. Implement `GET /api/patients/{id}/view360` [Authorize(Roles="Staff,Admin")]:
   - Query `patient_view_360 WHERE patient_id=X`; if not found → 404 `{status:"no_data"}`
   - Decrypt `aggregated_data` via `PhiEncryptionService.Decrypt()`
   - INSERT `audit_logs(PatientView360Accessed, actor_id, patient_id)`
   - Return `{ aggregated_data, conflict_flags, is_verified, verified_by, verified_at, last_updated_at }`

4. Implement `POST /api/patients/{id}/view360/verify` [Authorize(Roles="Staff,Admin")]:
   - Check `conflict_flags` JSONB array; if any `acknowledged=false` → HTTP 400 `{error:"AllConflictsMustBeAcknowledged"}`
   - UPDATE `is_verified=true, verified_by=staffId, verified_at=NOW()`
   - INSERT `audit_logs(ViewVerified, actor_id=staffId, patient_id)`
   - Return HTTP 200 `{is_verified: true, verified_at}`

5. Implement `POST /api/patients/{id}/view360/acknowledge` [Authorize(Roles="Staff,Admin")] body `{ conflict_id }`:
   - Load `patient_view_360.conflict_flags`; find entry with matching `conflict_id`
   - If not found → HTTP 404; if already `acknowledged=true` → return HTTP 200 (idempotent)
   - JSONB patch: SET `conflict_flags[i].acknowledged=true`; UPSERT with PostgreSQL `jsonb_set`
   - INSERT `audit_logs(ConflictAcknowledged, actor_id=staffId, patient_id, conflict_id)`
   - Return HTTP 200 `{conflict_id, acknowledged: true, acknowledged_by, acknowledged_at}`

---

## Current Project State

```
Server/Features/Documents/
├── DocumentsController.cs
├── DocumentUploadService.cs
├── IExtractionJobService.cs
├── Jobs/
│   ├── ExtractionJob.cs            ← MODIFY (add enqueue)
│   └── AggregatePatientViewJob.cs  ← TO CREATE
├── Services/
│   ├── PdfTextExtractorService.cs
│   ├── ChunkingService.cs
│   ├── EmbeddingService.cs
│   ├── PgVectorRetrievalService.cs
│   ├── MmrRerankingService.cs
│   ├── ExtractionBudgetMonitor.cs
│   ├── PiiRedactionService.cs
│   ├── OllamaExtractionService.cs
│   ├── ExtractionSchemaValidator.cs
│   └── PhiEncryptionService.cs
└── Prompts/
    └── extraction-prompt.txt
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `Server/Features/Documents/Jobs/AggregatePatientViewJob.cs` | Advisory lock + aggregate + de-dup + conflict detect + UPSERT |
| CREATE | `Server/Features/Documents/Services/ConflictDetectionService.cs` | Deterministic conflict rules per field type |
| CREATE | `Server/Features/Documents/PatientView360Controller.cs` | GET view360 + POST verify + POST acknowledge; Staff/Admin RBAC |
| MODIFY | `Server/Features/Documents/Jobs/ExtractionJob.cs` | Enqueue `AggregatePatientViewJob(patientId)` after `upload_status=Extracted` |

---

## External References

- [PostgreSQL — pg_try_advisory_lock](https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
- [PostgreSQL — jsonb_set function](https://www.postgresql.org/docs/16/functions-json.html)
- [NFR-017 — PHI access audit logging traceability](.propel/context/docs/design.md)

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] `ExtractionJob` enqueues `AggregatePatientViewJob` on successful extraction
- [ ] `AggregatePatientViewJob` acquires advisory lock; concurrent runs for same patient serialise correctly
- [ ] De-duplication retains most-recently-extracted value; merges source attributions; `DeduplicationApplied` audit log written per de-duplicated field type
- [ ] Medication dosage conflict (> 10%) → `conflict_flags` entry created; `ConflictDetected` audit log
- [ ] "No Known Allergies" contradiction → allergy conflict created
- [ ] Vital threshold conflict (BP ≥ 20 mmHg within 30-day window) → conflict created
- [ ] `aggregated_data` stored as AES-256 ciphertext; decrypted correctly on `GET /view360`
- [ ] `GET /view360` with `role=Patient` JWT → HTTP 403
- [ ] `GET /view360` with `role=Staff` JWT → HTTP 200; `PatientView360Accessed` audit log
- [ ] `GET /view360` with no `patient_view_360` row → HTTP 404 `{status:"no_data"}`
- [ ] `POST /verify` with unacknowledged conflicts → HTTP 400 `{error:"AllConflictsMustBeAcknowledged"}`
- [ ] `POST /verify` with all acknowledged → HTTP 200; `is_verified=true`; `ViewVerified` audit log
- [ ] `POST /acknowledge` same `conflict_id` twice → HTTP 200 idempotent; single `ConflictAcknowledged` audit log
- [ ] New document extraction after `is_verified=true` → `is_verified` reset to `false`; `ViewResetUnverified` audit log

---

## Implementation Checklist

- [ ] Implement `AggregatePatientViewJob` with advisory lock acquisition + 3-retry rescheduling pattern
- [ ] Implement de-duplication: normalise by `.Trim().ToLowerInvariant()`; retain `extracted_at DESC` winner; merge source arrays; log `DeduplicationApplied`
- [ ] Implement `ConflictDetectionService` with all 4 field-type rule sets; return `List<ConflictFlag>` with UUID `conflict_id`
- [ ] AES-256 encrypt `aggregated_data` JSONB before UPSERT using existing `PhiEncryptionService`
- [ ] UPSERT `patient_view_360` with `is_verified=false` on every run; log `ViewResetUnverified` when previous `is_verified=true`
- [ ] Implement `PatientView360Controller` with `[Authorize(Roles="Staff,Admin")]` on all three endpoints
- [ ] `GET /view360`: decrypt + return; INSERT `PatientView360Accessed` audit log (every successful read, NFR-017)
- [ ] `POST /verify`: check `acknowledged=false` in `conflict_flags`; 400 or 200 path; `ViewVerified` audit log
- [ ] `POST /acknowledge`: idempotent JSONB patch with `jsonb_set`; INSERT `ConflictAcknowledged` audit log only on first acknowledgement
- [ ] Modify `ExtractionJob` to enqueue `AggregatePatientViewJob(patientId)` after `upload_status=Extracted` update
