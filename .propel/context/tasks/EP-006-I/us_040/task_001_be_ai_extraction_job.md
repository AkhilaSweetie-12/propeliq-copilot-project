---
title: "Task — BE/AI ExtractionJob — PdfPig Extraction, Token Chunking, Ollama LLM, JSON Schema Validation, AES-256 PHI Encryption & extracted_clinical_data INSERT"
task_id: task_001
story_id: us_040
epic: EP-006-I
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — BE/AI ExtractionJob — PdfPig Extraction, Token Chunking, Ollama LLM, JSON Schema Validation, AES-256 PHI Encryption & extracted_clinical_data INSERT

## Requirement Reference

- **User Story**: us_040
- **Story Location**: .propel/context/tasks/EP-006-I/us_040/us_040.md
- **Acceptance Criteria**:
  - AC-1: `ExtractionJob(document_id)` dequeued from the dedicated Hangfire AI processing queue (`ai-processing`); job updates `clinical_documents SET upload_status=Processing` if not already set; uses PdfPig (TR-009) to extract full text from the PDF at the stored file path (`/uploads/{patient_id}/{document_id}.pdf`); does NOT run on the default Hangfire queue (TR-008, NFR-016)
  - AC-2: Extracted raw text passed to Ollama `llama3.2:3b-instruct-q8_0` via `POST http://localhost:11434/api/generate`; prompt template requests JSON output for 5 field types: `vitals`, `medications`, `allergies`, `diagnoses`, `surgical_history`; PII tokens (patient name, DOB, address, insurance ID) substituted with opaque tokens before sending (AIR-S02); input token count validated ≤ 4,096 before submission; documents exceeding limit split into segments of ≤ 3,500 tokens with 200-token overlap (AIR-O01, FR-027, TR-007)
  - AC-3: For each extracted field type: INSERT `extracted_clinical_data (extract_id=UUID, document_id, patient_id, field_type, field_value [AES-256 encrypted], source_text, extracted_at, embedding=NULL)`; `field_value` encrypted with AES-256 before INSERT (NFR-007, PHI protection); after all rows inserted UPDATE `clinical_documents SET upload_status=Extracted`; INSERT `audit_logs (action=ExtractionCompleted, entity_type=clinical_documents, entity_id=document_id)`; entire job completes within 30 s at p90 (NFR-003)
  - AC-4: Failure at any step → UPDATE `clinical_documents SET upload_status=Failed`; INSERT `audit_logs (action=ExtractionFailed, error_message=ex.Message)`; job transitions to Hangfire `Failed` state; NO auto-retry (extraction failure = permanent, requires manual fallback from SCR-015 "Enter data manually" CTA — us_039); `upload_status=Failed` persists until user acts (FR-027, UC-007 extension 3a)
  - AC-5: Job scope ends at persisting `extracted_clinical_data` rows + `upload_status=Extracted`; does NOT aggregate into `patient_view_360` (that is EP-006-II scope) (FR-027 scoped)

- **Edge Cases**:
  - Edge Case: PdfPig throws `PdfDocumentFormatException` (password-protected / corrupt) → catch; UPDATE `upload_status=Failed`; INSERT `audit_logs (action=ExtractionFailed, error_message="PDF is encrypted or password-protected")`; NO LLM call made on empty/null text
  - Edge Case: PdfPig returns empty string (scanned image PDF with no text layer) → guard: if `text.IsNullOrWhiteSpace()` → treat same as PdfDocumentFormatException; UPDATE `upload_status=Failed`; INSERT `audit_logs`; NO LLM call
  - Edge Case: Ollama server unavailable / `HttpRequestException` → catch; UPDATE `upload_status=Failed`; INSERT `audit_logs (action=ExtractionFailed_OllamaUnavailable)`; job → `Failed`; no retry (deployment issue, not transient)
  - Edge Case: PDF text exceeds 4,096 tokens → split into ≤ 3,500-token segments with 200-token overlap; cap at 5 segments (≈17,500 tokens / ~70 pages); log warning if > 5 segments needed; process only first 5 segments; merge results per field type (most recent value wins on duplicate field)
  - Edge Case: LLM returns JSON failing schema validation → UPDATE `upload_status=Failed`; INSERT `audit_logs (action=ExtractionFailed_SchemaValidation)`; job → `Failed`; manual fallback CTA shown on SCR-015
  - Edge Case: Hangfire job store unavailable mid-execution → Hangfire retries state transition on reconnect; `clinical_documents.upload_status` converges to final state; status polling on FE reflects persisted state once restored

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No (SCR-015 badge states driven by `upload_status` written by this job, but UI implemented in us_039 task_001) |
| **Figma URL** | N/A |
| **Wireframe Status** | N/A |
| **Wireframe Type** | N/A |
| **Wireframe Path/URL** | N/A |
| **Screen Spec** | SCR-015 (status outcome only) |
| **UXR Requirements** | UXR-103 (Extracted/Failed badge outcome driven by this job's upload_status update) |
| **Design Tokens** | N/A |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | ASP.NET Core | .NET 9 |
| Background Jobs | Hangfire + Hangfire.PostgreSql | 1.8.x |
| PDF Extraction | PdfPig (MIT) | TR-009 latest stable |
| LLM Inference | Ollama HTTP API (`llama3.2:3b-instruct-q8_0`) | TR-007 |
| JSON Schema Validation | `System.Text.Json` + `JsonSchema.Net` | latest |
| Encryption | `System.Security.Cryptography.Aes` (AES-256-CBC/GCM) | built-in .NET 9 |
| ORM | Entity Framework Core | 9 (Npgsql) |
| Database | PostgreSQL | 16 |
| Logging | Serilog | latest |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | Yes |
| **AIR Requirements** | AIR-S02 (PII redaction before LLM prompt), AIR-O01 (token budget ≤ 4,096; chunking to ≤ 3,500 with 200-token overlap), AIR-Q03 (JSON schema validation of LLM response; shared validation infrastructure with EP-008-II) |
| **AI Pattern** | Document Extraction Pipeline (PdfPig → token budget check → PII redaction → Ollama prompt → JSON schema validation → INSERT) |
| **Prompt Template Path** | `Server/Features/Documents/Prompts/extraction-prompt.txt` |
| **Guardrails Config** | Token budget: 4,096 input max; chunk size: 3,500 tokens; overlap: 200 tokens; segment cap: 5; PII substitution: opaque tokens for name/DOB/address/insurance ID |
| **Model Provider** | Ollama (local; `llama3.2:3b-instruct-q8_0`; PHI never leaves deployment boundary) |

> **CRITICAL — AI Implementation Requirements:**
> - **MUST** implement PII redaction (AIR-S02) before any LLM call — patient name, DOB, address, insurance ID replaced with opaque tokens (e.g., `[PATIENT_NAME]`, `[DOB]`, `[ADDRESS]`, `[INSURANCE_ID]`)
> - **MUST** enforce token budget (AIR-O01): count tokens before sending; split at ≤ 3,500; cap at 5 segments
> - **MUST** validate LLM JSON response against extraction schema (AIR-Q03) before any INSERT
> - **MUST** encrypt `field_value` with AES-256 before INSERT (NFR-007)
> - **MUST** log all prompts sent to Ollama and responses received — redact PII from logs (PHI must not appear in audit_logs or Serilog output)
> - **MUST** handle Ollama timeout and unavailability gracefully (update_status=Failed; no retry)
> - **MUST** verify token budget enforcement: no document chunk > 4,096 tokens sent to Ollama

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

Implement `ExtractionJob` as a Hangfire job running exclusively on the `ai-processing` queue (prevents LLM jobs from starving user-facing queues). The job uses PdfPig to extract raw text from the stored PDF, enforces a token budget (≤ 4,096 per segment), applies PII redaction, sends the structured extraction prompt to the local Ollama `llama3.2:3b-instruct-q8_0` model, validates the JSON response against the extraction schema, encrypts each `field_value` with AES-256, and inserts `extracted_clinical_data` rows before updating `clinical_documents.upload_status=Extracted`. Any failure at any step updates `upload_status=Failed`, writes to `audit_logs`, and moves the job to Hangfire `Failed` state with no auto-retry. The entire job must complete within 30 seconds at p90 (NFR-003).

---

## Dependent Tasks

- us_039 task_002 — `IExtractionJobService` interface; `clinical_documents` record with `file_path` and `upload_status=Pending` must exist before this job dequeues
- US_005 (Foundational EP-TECH) — Hangfire AI queue (`ai-processing`) registered; `PdfPig` NuGet package installed
- US_016 (Foundational EP-DATA-II) — `extracted_clinical_data` entity migrated: `extract_id`, `document_id`, `patient_id`, `field_type` (enum), `field_value` (varchar — stores AES-256 ciphertext), `source_text`, `extracted_at`, `embedding` (nullable)

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Documents/Jobs/ExtractionJob.cs` | CREATE | Hangfire job; `[Queue("ai-processing")]`; `[AutomaticRetry(Attempts=0)]`; orchestrates the full pipeline |
| `Server/Features/Documents/Services/PdfTextExtractorService.cs` | CREATE | Wraps PdfPig; returns raw text string; throws on password-protection or empty result |
| `Server/Features/Documents/Services/TokenBudgetService.cs` | CREATE | Token count estimation; text splitting into ≤ 3,500-token segments with 200-token overlap; enforces 5-segment cap |
| `Server/Features/Documents/Services/PiiRedactionService.cs` | CREATE | Replaces name/DOB/address/insurance ID with opaque tokens before LLM prompt (AIR-S02) |
| `Server/Features/Documents/Services/OllamaExtractionService.cs` | CREATE | `HttpClient` POST to `http://localhost:11434/api/generate`; passes prompt template + text segment; returns raw JSON string |
| `Server/Features/Documents/Services/ExtractionSchemaValidator.cs` | CREATE | Validates Ollama JSON response against extraction schema (5 field types); AIR-Q03; shared with EP-008-II |
| `Server/Features/Documents/Services/PhiEncryptionService.cs` | CREATE | AES-256 encrypt/decrypt for `field_value`; key from `IConfiguration["Encryption:AES256Key"]` (env secret only, never source code) |
| `Server/Features/Documents/ExtractionJob.cs` (implements) | CREATE | Implements `IExtractionJobService.ProcessDocument(Guid documentId)` |
| `Server/Features/Documents/Prompts/extraction-prompt.txt` | CREATE | Prompt template: instructs LLM to return JSON with keys `vitals`, `medications`, `allergies`, `diagnoses`, `surgical_history` |
| `Server/Program.cs` | MODIFY | Register all new services; bind AES key + Ollama base URL from `IConfiguration` |

---

## Implementation Plan

1. Implement `PdfTextExtractorService.ExtractText(filePath)`: open PDF with `PdfDocument.Open(filePath)`; iterate pages; concatenate `page.GetWords()`; throw `PdfExtractionException` on `PdfDocumentFormatException` or if result `IsNullOrWhiteSpace()`
2. Implement `TokenBudgetService.Split(text)`: estimate tokens (~1 token ≈ 4 chars for English); split at ≤ 3,500-token boundaries; add 200-token overlap at end of each segment except last; if total segments > 5, log warning, cap at 5 (Phase 1 limit); return `IEnumerable<string>`
3. Implement `PiiRedactionService.Redact(text, patientContext)`: regex-replace known PII patterns and patient-record values with opaque tokens; never pass real PHI to Ollama (AIR-S02)
4. Implement `OllamaExtractionService.ExtractAsync(segment)`: read `extraction-prompt.txt` template; inject segment text; POST to `{OllamaBaseUrl}/api/generate` with `{ "model": "llama3.2:3b-instruct-q8_0", "prompt": "...", "stream": false }`; `HttpClient` timeout: 25 s (leaving 5 s buffer for DB operations within 30 s NFR-003); catch `HttpRequestException` → throw `OllamaUnavailableException`
5. Implement `ExtractionSchemaValidator.Validate(json)`: parse JSON; verify presence of all 5 keys (`vitals`, `medications`, `allergies`, `diagnoses`, `surgical_history`); verify value types; throw `SchemaValidationException` on failure (AIR-Q03)
6. Implement `PhiEncryptionService.Encrypt(plaintext)`: AES-256-GCM; key from `IConfiguration["Encryption:AES256Key"]` (Base64 32-byte key); return Base64-encoded ciphertext + nonce; NEVER log the key or plaintext
7. Implement `ExtractionJob.Execute(documentId)` decorated `[Queue("ai-processing")] [AutomaticRetry(Attempts=0)]`:
   a. UPDATE `clinical_documents.upload_status = Processing` (if Pending)
   b. `PdfTextExtractorService.ExtractText(filePath)` — catch → fail path
   c. `TokenBudgetService.Split(text)` — get segments
   d. For each segment: `PiiRedactionService.Redact(segment)` → `OllamaExtractionService.ExtractAsync(redactedSegment)` — catch → fail path; `ExtractionSchemaValidator.Validate(json)` — catch → fail path
   e. Merge segment results per field type (most recent value wins on duplicate)
   f. For each of 5 field types: `PhiEncryptionService.Encrypt(field_value)` → INSERT `extracted_clinical_data` row
   g. UPDATE `clinical_documents.upload_status = Extracted`
   h. INSERT `audit_logs (action=ExtractionCompleted)`
8. Fail path (catches from any step): UPDATE `upload_status=Failed`; INSERT `audit_logs (action=ExtractionFailed / ExtractionFailed_OllamaUnavailable / ExtractionFailed_SchemaValidation, error_message=ex.Message [PII-scrubbed])`; re-throw to move job to Hangfire `Failed` state

---

## Current Project State

```
Server/
└── Features/
    ├── Booking/
    ├── Notifications/
    └── Documents/
        ├── DocumentsController.cs        ← created in us_039 task_002
        ├── DocumentUploadService.cs       ← created in us_039 task_002
        └── IExtractionJobService.cs       ← created in us_039 task_002 (interface only)
            Jobs/                          ← TO CREATE — this task
            Services/                      ← TO CREATE — this task
            Prompts/                       ← TO CREATE — this task
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `Server/Features/Documents/Jobs/ExtractionJob.cs` | Main job; `[Queue("ai-processing")]`; `[AutomaticRetry(Attempts=0)]`; implements IExtractionJobService |
| CREATE | `Server/Features/Documents/Services/PdfTextExtractorService.cs` | PdfPig wrapper; exception on empty/corrupt |
| CREATE | `Server/Features/Documents/Services/TokenBudgetService.cs` | Token counting + chunking; 5-segment cap |
| CREATE | `Server/Features/Documents/Services/PiiRedactionService.cs` | AIR-S02 PII opaque-token substitution |
| CREATE | `Server/Features/Documents/Services/OllamaExtractionService.cs` | HTTP POST to Ollama; 25 s timeout |
| CREATE | `Server/Features/Documents/Services/ExtractionSchemaValidator.cs` | JSON schema validation; AIR-Q03 |
| CREATE | `Server/Features/Documents/Services/PhiEncryptionService.cs` | AES-256-GCM; key from IConfiguration |
| CREATE | `Server/Features/Documents/Prompts/extraction-prompt.txt` | LLM prompt template for JSON extraction |
| MODIFY | `Server/Program.cs` | Register all new services; bind Encryption + Ollama config |
| MODIFY | `Server/appsettings.json` | Add `"Ollama": { "BaseUrl": "http://localhost:11434" }` (key loaded from env only) |

---

## External References

- [PdfPig GitHub — MIT PDF library for .NET](https://github.com/UglyToad/PdfPig)
- [Ollama REST API — /api/generate](https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-completion)
- [NFR-003 — 30s p90 extraction SLA traceability](.propel/context/docs/design.md)
- [AES-GCM in .NET — System.Security.Cryptography.AesGcm](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.aesgcm)

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] **[AI Tasks]** Prompt template validated with test PDF inputs; LLM returns valid JSON for all 5 field types
- [ ] **[AI Tasks]** Guardrails tested: PII tokens present in prompt input to Ollama (not real PHI); real PHI values absent from Serilog logs and audit_logs
- [ ] **[AI Tasks]** Fallback logic tested: PdfPig failure → `upload_status=Failed`; Ollama 503 → `upload_status=Failed`; schema invalid → `upload_status=Failed`
- [ ] **[AI Tasks]** Token budget enforcement: document > 4,096 tokens is chunked into ≤ 3,500-token segments; no single Ollama call receives > 4,096 tokens
- [ ] **[AI Tasks]** Audit logging verified: `ExtractionCompleted` and `ExtractionFailed` variants all written; PII absent from `error_message` field
- [ ] Successful extraction: `extracted_clinical_data` has 5 rows (one per field type); `field_value` is AES-256 ciphertext (not plaintext); `upload_status=Extracted`
- [ ] Password-protected PDF → `upload_status=Failed`; `audit_logs ExtractionFailed`; no LLM call made
- [ ] Empty text result from PdfPig → `upload_status=Failed`; no LLM call made
- [ ] Ollama unavailable → `upload_status=Failed`; `audit_logs ExtractionFailed_OllamaUnavailable`; Hangfire job in `Failed` state; no auto-retry
- [ ] LLM JSON missing expected keys → `upload_status=Failed`; `audit_logs ExtractionFailed_SchemaValidation`
- [ ] Document > 17,500 tokens → only first 5 segments processed; warning logged
- [ ] AES-256 key loaded from `IConfiguration["Encryption:AES256Key"]`; not hardcoded; not logged
- [ ] Job decorated `[Queue("ai-processing")]` and `[AutomaticRetry(Attempts=0)]`
- [ ] Job execution time logged; NFR-003 30 s p90 SLA achievable under test load

---

## Implementation Checklist

- [ ] Create `extraction-prompt.txt` template: instruct model to return ONLY valid JSON with exactly 5 keys (`vitals`, `medications`, `allergies`, `diagnoses`, `surgical_history`); each value is a string or array; no surrounding prose; include example output format
- [ ] Implement `PdfTextExtractorService`; throw on empty text or `PdfDocumentFormatException`; dispose `PdfDocument` in finally block
- [ ] Implement `TokenBudgetService` with character-based token approximation (4 chars ≈ 1 token for English text); split at word boundaries; 200-token overlap; enforce 5-segment cap + warn
- [ ] Implement `PiiRedactionService`: redact patient name, DOB, address, insurance ID using regex + patient context fields; use stable opaque tokens per field (same placeholder every occurrence for consistency)
- [ ] Implement `OllamaExtractionService`: `HttpClient` with 25 s timeout; `POST {OllamaBaseUrl}/api/generate`; `stream=false`; parse `.response` field from Ollama JSON wrapper
- [ ] Implement `ExtractionSchemaValidator`: use `JsonDocument.Parse(json)` + check all 5 required keys exist; throw `SchemaValidationException` on mismatch
- [ ] Implement `PhiEncryptionService` using `AesGcm`; 32-byte key; 12-byte random nonce per encrypt; return `Base64(nonce + ciphertext + tag)` as stored value; NEVER log key or plaintext value
- [ ] Implement `ExtractionJob` with full pipeline; all service calls within single try-catch; fail path updates DB and re-throws
- [ ] Register all services in DI container; bind `Ollama:BaseUrl` from `IConfiguration` + `Encryption:AES256Key` from env-only secret
- [ ] **[AI Tasks - MANDATORY]** Reference prompt templates from AI References table during implementation
- [ ] **[AI Tasks - MANDATORY]** Implement and test guardrails (PII redaction, token budget, schema validation) before marking task complete
- [ ] **[AI Tasks - MANDATORY]** Verify AIR-S02 (PII redaction), AIR-O01 (token budget), AIR-Q03 (schema validation) requirements are met
