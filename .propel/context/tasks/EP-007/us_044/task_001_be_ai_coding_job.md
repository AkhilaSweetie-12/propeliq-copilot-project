---
title: "Task — BE/AI CodingJob — ICD-10 & CPT RAG Pipeline, PII Redaction, pgvector Retrieval, LLM Inference, Schema Validation & medical_code_suggestions INSERT"
task_id: task_001
story_id: us_044
epic: EP-007
layer: Backend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — BE/AI CodingJob — ICD-10 & CPT RAG Pipeline, PII Redaction, pgvector Retrieval, LLM Inference, Schema Validation & medical_code_suggestions INSERT

## Requirement Reference

- **User Story**: us_044
- **Story Location**: .propel/context/tasks/EP-007/us_044/us_044.md
- **Acceptance Criteria**:
  - AC-1: `POST /api/patients/{id}/coding/request` [Authorize(Roles="Staff,Admin")]: validate `patient_view_360 WHERE patient_id=X AND is_verified=true`; if not verified or no row → HTTP 400 `{ error: "PatientViewNotVerified" }`; if verified → enqueue `CodingJob(patient_id)` in Hangfire; return HTTP 202; INSERT `audit_logs (action=CodingRequested, actor_id, patient_id)`; if `aggregated_data` empty → HTTP 400 `{ error: "InsufficientPatientData" }` (FR-031, FR-032)
  - AC-2: `CodingJob` — ICD-10 pipeline: read + decrypt `patient_view_360.aggregated_data`; construct patient context string (diagnoses, medications, allergies, vitals — max 3,072 tokens); apply PII redaction (name → `[PATIENT-NAME]`, DOB → `[DOB-REDACTED]`, address → `[ADDR-REDACTED]`); embed via `nomic-embed-text` (POST `http://localhost:11434/api/embeddings`); cosine similarity search against pre-indexed ICD-10 reference vector store (`LIMIT 5, score >= 0.65`); pass top-5 candidates + redacted context to `llama3.2:3b-instruct-q8_0` via Ollama; validate JSON response per ICD-10 schema; INSERT `medical_code_suggestions` per code (AIR-004, FR-031)
  - AC-3: CPT pipeline: same RAG pattern as AC-2 applied to pre-indexed CPT reference vector store; embedding computed once and reused for both ICD-10 and CPT queries (no second embedding call); LLM invoked a second time with CPT candidates + same redacted context; JSON schema validation per CPT code; INSERT `medical_code_suggestions` per CPT code (AIR-005, FR-032)
  - AC-4: Per-code persistence: INSERT `medical_code_suggestions { patient_id, code, code_type(ICD10|CPT), description, source_evidence, confidence, status=Pending, needs_review=(confidence<0.6), model_name="llama3.2:3b-instruct-q8_0", model_version="Ollama 0.5", reviewed_by=null, final_code=null, finalised=false, created_at=NOW() }`; INSERT `audit_logs (action=CodeSuggestionGenerated, patient_id, code, code_type, confidence)` per code (AIR-O03, AIR-004)
  - AC-5: `GET /api/patients/{id}/coding/suggestions` [Authorize(Roles="Staff,Admin")]: if job running → HTTP 202 `{ status: "generating" }`; if rows exist → HTTP 200 with list ordered: ICD-10 DESC confidence then CPT DESC confidence; if job failed → HTTP 200 `{ status: "failed", suggestions: [] }`; `PATCH /api/coding/suggestions/{suggestion_id} { status, final_code? }` updates `status` + `reviewed_by=staff_id` + `final_code`; `POST /api/patients/{id}/coding/finalise` → check all rows not Pending → compute agreement_rate = Accepted count / total count → UPDATE `finalised=true` all rows → INSERT `audit_logs (action=CodingFinalised, agreement_rate)` → return `{ agreement_rate }` (NFR-004, AIR-Q01)

- **Edge Cases**:
  - Edge Case: All codes confidence < 0.6 → `needs_review=true` on all; job completes normally; GET returns all with `needs_review=true`
  - Edge Case: ICD-10 or CPT vector store returns 0 candidates ≥ 0.65 → no LLM call for that type; INSERT `audit_logs (action=NoCandidatesAboveThreshold, code_type)`; GET returns empty array for that type; other type proceeds normally
  - Edge Case: Ollama embedding or LLM call fails → retry once immediate; second failure → job `Failed`; INSERT `audit_logs (action=CodingJobFailed, step=Embedding|LLMInference)`; GET returns `{ status: "failed" }`; partial suggestions from completed type retained
  - Edge Case: Elapsed time > 12 s after ICD-10 pipeline → CPT pipeline skipped; INSERT `audit_logs (action=CodingBudgetExceeded, skipped=CPT)`; GET returns ICD-10 only; Staff re-triggers via SCR-018

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
| Background Jobs | Hangfire + Hangfire.PostgreSql | 1.8.x |
| Embedding Model | Ollama `nomic-embed-text` (local) | TR-007 |
| LLM | Ollama `llama3.2:3b-instruct-q8_0` (local) | TR-007 |
| Vector Store | pgvector extension (PostgreSQL 16) | latest |
| ORM | Entity Framework Core | 9 (Npgsql) |
| Encryption | System.Security.Cryptography.Aes (AES-256-GCM) | built-in .NET 9 |
| Auth | JWT Bearer | .NET 9 |
| Logging | Serilog | latest |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | Yes |
| **AIR Requirements** | AIR-004 (ICD-10 RAG: embed → pgvector cosine ≥ 0.65 → LLM confirm top-5), AIR-005 (CPT RAG: same pattern, separate index, embedding reuse), AIR-O03 (model_name + model_version stored per suggestion row), AIR-Q01 (Agreement Rate = Accepted / total; computed server-side on finalise) |
| **AI Pattern** | RAG — embed patient summary → cosine similarity (ICD-10 ref store) → LLM confirm → schema validate; repeat for CPT ref store reusing same embedding |
| **Prompt Template Path** | `Server/Features/Coding/Prompts/icd10-coding-prompt.txt`, `Server/Features/Coding/Prompts/cpt-coding-prompt.txt` |
| **Guardrails Config** | Patient context max: 3,072 tokens; candidate threshold: 0.65; LLM candidates per type: top-5; 12 s CPT skip trip-wire (NFR-004 15 s p90); PII redaction before any LLM call; never log PHI in error_message |
| **Model Provider** | Ollama local (`nomic-embed-text` + `llama3.2:3b-instruct-q8_0`); PHI never leaves deployment boundary |

> **CRITICAL — AI Implementation Requirements:**
> - **MUST** apply PII redaction (name, DOB, address) before constructing patient context string passed to LLM (AIR-S02 pattern from EP-006)
> - **MUST** enforce `patient_id` WHERE clause on all pgvector similarity queries — no cross-patient code suggestions (AIR-S04 pattern)
> - **MUST** compute embedding once and reuse for both ICD-10 and CPT queries (AIR-005)
> - **MUST** cap patient context at 3,072 tokens before embedding; truncate if over limit
> - **MUST** validate each LLM response against code-type JSON schema before INSERT
> - **MUST** store `model_name` and `model_version` on every row (AIR-O03)
> - **MUST** monitor elapsed time; skip CPT pipeline if > 12 s elapsed (NFR-004 15 s p90 guard)
> - **MUST NOT** log PII in `audit_logs.error_message` or Serilog output

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

Implement the medical coding AI pipeline: `POST /coding/request` validates the verified 360° view and enqueues `CodingJob`. The job decrypts the patient summary, applies PII redaction, generates one `nomic-embed-text` embedding (reused for both code type queries), performs cosine similarity retrieval against the ICD-10 and CPT reference vector stores in pgvector (0.65 threshold), invokes `llama3.2:3b-instruct-q8_0` once per code type with the top-5 candidates, validates the JSON responses, and inserts `medical_code_suggestions` rows with `model_name/version`, `source_evidence`, `confidence`, and `needs_review` flags. A 12-second elapsed-time guard skips the CPT pipeline if the ICD-10 pipeline consumed too much of the 15-second p90 budget. Three supporting endpoints complete the API: `GET /suggestions`, `PATCH /suggestions/{id}`, and `POST /finalise` (Agreement Rate).

---

## Dependent Tasks

- US_016 (Foundational EP-DATA-II) — `medical_code_suggestions` entity migrated; ICD-10 and CPT reference vector stores seeded in pgvector
- us_041 task_001 — `EmbeddingService` and `PgVectorRetrievalService` from EP-006-II RAG pipeline reusable here; import or reference the same service pattern
- us_042 task_001 — `PhiEncryptionService.Decrypt()` used to decrypt `aggregated_data` before context construction

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Coding/CodingController.cs` | CREATE | `POST /request`, `GET /suggestions`, `PATCH /suggestions/{id}`, `POST /finalise`; Staff/Admin RBAC |
| `Server/Features/Coding/Jobs/CodingJob.cs` | CREATE | Hangfire job; `[AutomaticRetry(Attempts=1)]`; ICD-10 + CPT RAG pipelines; budget monitor |
| `Server/Features/Coding/Services/PatientContextBuilder.cs` | CREATE | Decrypts + flattens `aggregated_data` to context string; PII redaction; 3,072-token cap |
| `Server/Features/Coding/Services/CodeSuggestionService.cs` | CREATE | pgvector cosine query against ICD-10/CPT reference stores; reuses `EmbeddingService` from EP-006-II |
| `Server/Features/Coding/Services/CodingSchemaValidator.cs` | CREATE | JSON schema validation for ICD-10 and CPT LLM responses |
| `Server/Features/Coding/Prompts/icd10-coding-prompt.txt` | CREATE | LLM prompt for ICD-10 code selection with JSON output format |
| `Server/Features/Coding/Prompts/cpt-coding-prompt.txt` | CREATE | LLM prompt for CPT code selection with JSON output format |

---

## Implementation Plan

1. Implement `PatientContextBuilder.Build(patientId)`: decrypt `patient_view_360.aggregated_data` via `PhiEncryptionService.Decrypt()`; flatten to string: `"Diagnoses: ... Medications: ... Allergies: ... Vitals: ..."`; apply PII regex redaction (name/DOB/address → opaque tokens); token-count estimate; if > 3,072 tokens → truncate at word boundary; return `(redactedContext, tokenCount)`

2. Implement `CodeSuggestionService.RetrieveCandidates(queryEmbedding, codeType, patientId)`: parameterised pgvector query against the appropriate reference table (`icd10_reference_vectors` or `cpt_reference_vectors`); `WHERE score >= 0.65 ORDER BY score DESC LIMIT 5`; no `patient_id` filter on reference stores (they are global reference data — not patient data); return `List<CodeCandidate { code, description, reference_text }>`; if empty → log `NoCandidatesAboveThreshold` + return empty

3. Implement `CodingJob [AutomaticRetry(Attempts=1)]`:
   a. Acquire `ExtractionBudgetMonitor` (reuse from EP-006-II) with 12 s CPT trip-wire
   b. `PatientContextBuilder.Build(patientId)` → redacted context string
   c. `EmbeddingService.GetEmbeddingAsync(redactedContext)` → `queryVector` (384 dims); catch failure → retry once; second failure → job `Failed`
   d. **ICD-10 pipeline**: `CodeSuggestionService.RetrieveCandidates(queryVector, "ICD10")` → candidates; if empty → audit log, skip LLM; else → POST Ollama with `icd10-coding-prompt.txt` + candidates + context; parse JSON array `[{ code, description, source_evidence, confidence }]`; `CodingSchemaValidator.Validate(json, "ICD10")`; foreach code: INSERT `medical_code_suggestions`
   e. **Budget check**: `budgetMonitor.ElapsedMs > 12000` → skip CPT; audit log `CodingBudgetExceeded`; complete job
   f. **CPT pipeline**: same pattern with `cpt-coding-prompt.txt` and `cpt_reference_vectors`
   g. On any step failure (schema invalid, Ollama fail after retry): INSERT `audit_logs(CodingJobFailed, step=..., error_message [PII-scrubbed])`; re-throw to Hangfire `Failed`; partial suggestions for completed code type are retained in DB

4. Implement `GET /api/patients/{id}/coding/suggestions`: check Hangfire job state by querying `medical_code_suggestions WHERE patient_id=X AND created_at > {last_request_at}`; if no rows and job in `Processing` → HTTP 202 `{ status: "generating" }`; if rows → HTTP 200 ordered list; if job `Failed` → HTTP 200 `{ status: "failed", suggestions: partial_rows }`

5. Implement `PATCH /api/coding/suggestions/{suggestion_id}` body `{ status, final_code? }`: UPDATE `status`, `reviewed_by=staffId`, `final_code` (nullable), `finalised=false`; INSERT `audit_logs(CodeReviewed, status, final_code)` 

6. Implement `POST /api/patients/{id}/coding/finalise`: check `medical_code_suggestions WHERE patient_id=X AND status='Pending'` → if any → HTTP 400 `{ error: "AllCodesMustBeReviewed" }`; compute `agreement_rate = (Accepted count * 100) / total count`; UPDATE all rows `finalised=true`; INSERT `audit_logs(CodingFinalised, agreement_rate)`; return HTTP 200 `{ agreement_rate }`

---

## Current Project State

```
Server/
└── Features/
    ├── Booking/
    ├── Notifications/
    ├── Documents/              # EP-006-I/II services (EmbeddingService, PhiEncryptionService, etc.)
    └── Coding/                 # TO CREATE — this task
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `Server/Features/Coding/CodingController.cs` | 4 endpoints: request, suggestions, patch, finalise |
| CREATE | `Server/Features/Coding/Jobs/CodingJob.cs` | ICD-10 + CPT RAG pipeline; budget monitor |
| CREATE | `Server/Features/Coding/Services/PatientContextBuilder.cs` | Decrypt, flatten, PII-redact, cap 3,072 tokens |
| CREATE | `Server/Features/Coding/Services/CodeSuggestionService.cs` | pgvector query against ICD-10/CPT reference indexes |
| CREATE | `Server/Features/Coding/Services/CodingSchemaValidator.cs` | JSON schema validation per code type |
| CREATE | `Server/Features/Coding/Prompts/icd10-coding-prompt.txt` | ICD-10 selection prompt; JSON output format |
| CREATE | `Server/Features/Coding/Prompts/cpt-coding-prompt.txt` | CPT selection prompt; JSON output format |
| MODIFY | `Server/Program.cs` | Register Coding feature services; Hangfire job type |

---

## External References

- [ICD-10-CM Official Guidelines for Coding and Reporting](https://www.cdc.gov/nchs/icd/icd10cm.htm)
- [CPT Code Set — AMA overview](https://www.ama-assn.org/practice-management/cpt/cpt-overview-and-code-approval)
- [AIR-O03 / NFR-004 traceability](.propel/context/docs/design.md)

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] **[AI Tasks]** `POST /coding/request` with verified view → HTTP 202; `CodingRequested` audit log
- [ ] **[AI Tasks]** `POST /coding/request` with `is_verified=false` → HTTP 400 `PatientViewNotVerified`
- [ ] **[AI Tasks]** `POST /coding/request` with empty `aggregated_data` → HTTP 400 `InsufficientPatientData`
- [ ] **[AI Tasks]** CodingJob: embedding computed once; reused for both ICD-10 and CPT pgvector queries
- [ ] **[AI Tasks]** ICD-10 candidates retrieved from `icd10_reference_vectors`; CPT from `cpt_reference_vectors`; no cross-patient data (reference stores are global, not patient-scoped)
- [ ] **[AI Tasks]** 0 candidates above 0.65 for ICD-10 → no LLM call; `NoCandidatesAboveThreshold` audit log; CPT still runs
- [ ] **[AI Tasks]** `confidence < 0.6` → `needs_review=true` on that row
- [ ] **[AI Tasks]** `model_name` and `model_version` present on every `medical_code_suggestions` row (AIR-O03)
- [ ] **[AI Tasks]** Elapsed > 12 s after ICD-10 → CPT skipped; `CodingBudgetExceeded` audit log; ICD-10 suggestions returned by GET
- [ ] **[AI Tasks]** Ollama LLM failure → retry once; second failure → job `Failed`; GET returns `{ status: "failed" }`; partial ICD-10 rows retained
- [ ] **[AI Tasks]** PII absent from Serilog output and `audit_logs.error_message`
- [ ] `PATCH /suggestions/{id}` updates status + reviewed_by; `CodeReviewed` audit log
- [ ] `POST /finalise` with Pending rows → HTTP 400; all reviewed → `agreement_rate` computed correctly; `CodingFinalised` audit log
- [ ] Patient JWT on any endpoint → HTTP 403

---

## Implementation Checklist

- [ ] Implement `PatientContextBuilder`: decrypt, flatten, PII-redact, 3,072-token cap
- [ ] Implement `CodeSuggestionService`: parameterised pgvector query against separate ICD-10 and CPT reference tables; return empty + audit on < 1 result
- [ ] Implement `CodingSchemaValidator`: validate `[{ code: string, description: string, source_evidence: string, confidence: float }]` array for both ICD-10 and CPT responses
- [ ] Create prompt templates: instruct LLM to return ONLY a JSON array with the required 4 fields per code; include example; specify no surrounding prose
- [ ] Implement `CodingJob`: embed once → ICD-10 retrieve → ICD-10 LLM → validate → INSERT; budget check; CPT retrieve → CPT LLM → validate → INSERT; all in one try-catch with step-tagged audit on failure
- [ ] INSERT per-code: `needs_review = confidence < 0.6`; `model_name` + `model_version` on every row (AIR-O03)
- [ ] Implement `POST /finalise`: Pending-guard; `agreement_rate = (Accepted / total) * 100`; bulk `finalised=true` UPDATE
- [ ] Register all services in `Program.cs`; `[Authorize(Roles="Staff,Admin")]` on all 4 endpoints
- [ ] **[AI Tasks - MANDATORY]** Reference prompt templates from AI References table during implementation
- [ ] **[AI Tasks - MANDATORY]** Implement and test PII redaction, schema validation, budget trip-wire guardrails before marking complete
- [ ] **[AI Tasks - MANDATORY]** Verify AIR-O03 (model tracking), AIR-004/005 (RAG per code type), AIR-Q01 (agreement rate) requirements are met
