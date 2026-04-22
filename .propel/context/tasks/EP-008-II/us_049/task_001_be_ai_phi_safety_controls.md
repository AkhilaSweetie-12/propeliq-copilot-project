---
title: "Task — BE AI PHI Safety Controls: OllamaHttpClient Local-Only Enforcement, PiiRedactionMiddleware, AiAuditInterceptor & pgvector Patient ACL"
task_id: task_001
story_id: us_049
epic: EP-008-II
layer: Backend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — BE AI PHI Safety Controls: OllamaHttpClient Local-Only Enforcement, PiiRedactionMiddleware, AiAuditInterceptor & pgvector Patient ACL

## Requirement Reference

- **User Story**: us_049
- **Story Location**: .propel/context/tasks/EP-008-II/us_049/us_049.md
- **Acceptance Criteria**:
  - AC-1: `OllamaHttpClient` registered as a singleton in DI with `BaseAddress = "http://localhost:11434"` (or `OLLAMA_HOST` env var override); no other `HttpClient` with external AI endpoint base address (`openai.com`, `anthropic.com`, `googleapis.com`, `azure.com`, `cohere.ai`) registered in `Clinical`, `Coding`, or `Intake` feature assemblies; startup `IHostedService` verifies `GET http://{OLLAMA_HOST}/api/tags` on boot → logs reachability or fatal; architecture fitness test (NetArchTest / reflection scan) asserts 0 external AI endpoint registrations in scoped assemblies — fails CI build on violation (NFR-010, AIR-S01)
  - AC-2: `PiiRedactionMiddleware` strips 5 PII pattern types from prompt string before LLM call: patient legal name (first + last) → `[PATIENT-NAME]`, DOB (ISO 8601 + `MM/DD/YYYY` + `DD/MM/YYYY`) → `[DOB-REDACTED]`, street address (street-number + street-name or "Address:" prefix) → `[ADDR-REDACTED]`, insurance/member ID (`[A-Z]{2,5}-?[0-9]{6,10}` or "Insurance:|Member ID:|Policy:" prefix) → `[INS-REDACTED]`, email → `[EMAIL-REDACTED]`; redacted prompt contains only clinical content (vitals, medications, diagnoses, chief complaint); redaction in-memory only — redacted string never persisted; original unredacted context sourced from decrypted `patient_view_360.aggregated_data` only within calling process (TR-016, AIR-S02, NFR-005)
  - AC-3: `AiAuditInterceptor` — `HttpMessageHandler` decorator wrapping `OllamaHttpClient`; captures per-LLM-call: redacted prompt string (post-PII-redaction), full LLM response text, `actor_id`, `occurred_at` (UTC), `model_name` (from request body `"model"` field), `token_count_input` (Ollama response `"prompt_eval_count"`), `token_count_output` (Ollama response `"eval_count"`); writes one `audit_logs` row synchronously per call: `action_type=LLMInvoked`, `entity_type=ai_inference`, `entity_id=job_id` (Hangfire job ID), `change_summary="model={model_name} tokens_in={N} tokens_out={M} pipeline={ExtractionJob|CodingJob|IntakePipeline}"`; audit write synchronous (blocks LLM response return until row committed, per us_048 audit policy); 6-year retention (AIR-S03, NFR-017, DR-010)
  - AC-4: Every `SELECT` against `extracted_clinical_data` or patient document embedding tables from `VectorSearchService` includes explicit `WHERE patient_id = @patientId`; `VectorSearchService` constructor requires `patientId` as mandatory parameter — no overload omitting it; `Guard.Against.NullOrEmpty(patientId, nameof(patientId))` guard clause throws `ArgumentException` before any DB call on null/empty; repository-layer unit test inspects `FormattedCommandText` or mock calls to assert `WHERE patient_id` present; multi-patient ACL integration test seeds two patients' embeddings → asserts search for patient A returns 0 chunks belonging to patient B (AIR-S04, NFR-008, DR-007)
  - AC-5: Full AI pipeline integration test assertions: (a) extraction for patient A → 0 HTTP calls to non-localhost endpoints; (b) `audit_logs` LLM prompt does NOT contain test patient name, DOB, or address literals; (c) pgvector query for patient A chunks → 0 rows belonging to patient B; (d) `audit_logs` contains 1 `LLMInvoked` row per LLM call (count matches mock count); (e) architecture fitness test passes with 0 violations (NFR-010, AIR-S01, AIR-S02, AIR-S03, AIR-S04)

- **Edge Cases**:
  - Edge Case: PII false negative (pattern miss) → primary containment is local-only inference (AC-1); LLM runs locally so PHI never reaches external endpoint even on miss; false negatives addressed by expanding pattern list; `AiAuditInterceptor` logs redacted prompt for retrospective review; unit tests cover 100+ name/DOB/address/insurance variants
  - Edge Case: `AiAuditInterceptor` audit DB write fails → retry once (immediate); on second fail → overflow to `/logs/audit-overflow-{Date}.log`; LLM call response returned to pipeline (AI job NOT aborted); same overflow policy as us_048 AC-2
  - Edge Case: `VectorSearchService` called with null/empty `patientId` → `Guard.Against.NullOrEmpty` throws `ArgumentException` before any DB call; Hangfire job marks as `Failed`; writes `audit_logs (action=ExtractionFailed|CodingJobFailed, error=MissingPatientId)`; no pgvector query executed
  - Edge Case: Architecture fitness test false positive on Google Calendar `HttpClient` in `googleapis.com` → fitness test scoped to `Clinical`, `Coding`, `Intake` assemblies only; `Notifications`/`Booking` assemblies explicitly excluded; no false positives on calendar/SMS clients
  - Edge Case: Ollama model name changes → `model_name` in `audit_logs` sourced from request body `"model"` field at call time (reflects actual model used, not config constant); historical records accurate; AIR-O03 model version tracking handled separately in `medical_code_suggestions` (us_044)

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
| AI Inference | Ollama (local) | `llama3.2:3b-instruct-q8_0` |
| HTTP Client | `IHttpClientFactory` / `HttpClient` | .NET 9 |
| Resilience | Polly | 8.x |
| Database | PostgreSQL 16 + pgvector | via EF Core 9 |
| Logging / Audit | Serilog + `AuditLogger` (us_048) | — |
| Fitness Testing | NetArchTest / reflection | — |
| Guard Clauses | Ardalis.GuardClauses | — |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | Yes — cross-cutting control over all 3 AI pipelines (ExtractionJob, CodingJob, IntakePipeline) |
| **AIR Requirements** | AIR-S01, AIR-S02, AIR-S03, AIR-S04 |
| **AI Pattern** | HttpMessageHandler decorator chain; prompt pre-processing middleware; post-response audit capture |
| **Prompt Template Path** | N/A (middleware wraps existing prompt construction — no new prompt template) |
| **Guardrails Config** | `PiiRedactionMiddleware` pattern list (name, DOB, address, insurance ID, email); `OllamaHttpClient` host validation |
| **Model Provider** | Ollama local — `http://localhost:11434` (or `OLLAMA_HOST` env var) |

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

Implement four defence-in-depth AI safety controls as a handler decorator chain around the existing `OllamaHttpClient`: (1) enforce local-only inference with startup reachability validation and architecture fitness test; (2) strip 5 PII pattern types from prompts before LLM dispatch via `PiiRedactionMiddleware`; (3) capture redacted prompt + response + token counts in a synchronous `audit_logs` row per call via `AiAuditInterceptor`; (4) enforce mandatory `patient_id` ACL in all pgvector queries via `VectorSearchService`. Wire all four controls into the existing `ExtractionJob`, `CodingJob`, and `IntakePipeline` Hangfire pipelines via DI decorator registration.

---

## Dependent Tasks

- US_040 (EP-006-I) — `ExtractionJob` Hangfire pipeline must exist for `PiiRedactionMiddleware` + `AiAuditInterceptor` to wrap
- US_044 (EP-007) — `CodingJob` Hangfire pipeline must exist for the same decorator chain
- us_048 task_001 (EP-008-I) — `AuditLogger` service + `audit_logs` table with `LLMInvoked` action type must be in place before `AiAuditInterceptor` can write audit rows
- us_050 task_001 (EP-008-II) — `OllamaCircuitBreakerPolicy` from us_050 will be added as an additional handler in the same decorator chain; us_049 can deploy first; us_050 adds Polly policy additively

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Infrastructure/AI/OllamaHttpClient.cs` | CREATE OR MODIFY | Singleton `HttpClient`; `BaseAddress` = `OLLAMA_HOST` or `localhost:11434`; handler chain: `PiiRedactionMiddleware` → `AiAuditInterceptor` → (us_050 adds `OllamaCircuitBreakerPolicy` here) |
| `Server/Infrastructure/AI/PiiRedactionMiddleware.cs` | CREATE | `HttpMessageHandler`; 5 compiled regexes; in-memory redaction; never persist redacted string |
| `Server/Infrastructure/AI/AiAuditInterceptor.cs` | CREATE | `DelegatingHandler`; parse request body for `model`; parse response body for `prompt_eval_count`/`eval_count`; call `AuditLogger.Write(LLMInvoked)` synchronously |
| `Server/Infrastructure/AI/OllamaStartupValidator.cs` | CREATE | `IHostedService`; `GET {OLLAMA_HOST}/api/tags` on `StartAsync`; log reachability |
| `Server/Infrastructure/AI/OllamaArchitectureFitnessTest.cs` | CREATE | Build-time test; reflection scan `Clinical`/`Coding`/`Intake` assemblies; assert no external AI `HttpClient` base addresses |
| `Server/Features/Documents/Services/VectorSearchService.cs` | MODIFY | Make `patientId` mandatory constructor parameter; add `Guard.Against.NullOrEmpty(patientId)`; confirm all SQL queries include `WHERE patient_id = @patientId` |
| `Server/Features/Coding/Services/CodeSuggestionService.cs` | MODIFY | Ensure LLM calls routed through `OllamaHttpClient` (with decorator chain) |
| `Server/Features/Intake/Services/IntakePipeline.cs` | MODIFY | Ensure LLM calls routed through `OllamaHttpClient` (with decorator chain) |
| `Server/Infrastructure/Audit/AuditActionType.cs` | MODIFY | Add `LLMInvoked` action type (if not already added by us_048) |
| `Server/Tests/Integration/AiSafetyIntegrationTests.cs` | CREATE | AC-5 assertions: local-only, PII not in audit logs, cross-patient ACL, LLMInvoked count, fitness test |

---

## Implementation Plan

1. Register `OllamaHttpClient` as singleton in `Program.cs` via `services.AddHttpClient<OllamaHttpClient>()` with `BaseAddress` read from `OLLAMA_HOST` env var (default `http://localhost:11434`); add `PiiRedactionMiddleware` and `AiAuditInterceptor` as `DelegatingHandler`s in the handler pipeline via `.AddHttpMessageHandler<PiiRedactionMiddleware>().AddHttpMessageHandler<AiAuditInterceptor>()`

2. Create `OllamaStartupValidator : IHostedService`: in `StartAsync`, call `GET {OLLAMA_HOST}/api/tags` with 5-second timeout; log `"AI Safety: Ollama reachable at {host}"` on success or `"Fatal: Ollama endpoint unreachable — AI jobs will fail until resolved"` on failure; application continues to start (non-fatal) — reachability failure does not block app startup (Ollama may start later)

3. Implement `PiiRedactionMiddleware` (inherits `DelegatingHandler`): override `SendAsync`; extract prompt string from request body JSON (`request.Content.ReadAsStringAsync()`); apply 5 compiled `Regex` substitutions: (a) `@"\b[A-Z][a-z]+ [A-Z][a-z]+\b"` → `[PATIENT-NAME]`, (b) date patterns (ISO + US + UK) → `[DOB-REDACTED]`, (c) `@"\d{1,5}\s+\w+\s+(Street|St|Avenue|Ave|Drive|Dr|Road|Rd|Lane|Ln|Blvd)\b"` + "Address:" prefix → `[ADDR-REDACTED]`, (d) `@"[A-Z]{2,5}-?[0-9]{6,10}|(?:Insurance:|Member ID:|Policy:)\s*\S+"` → `[INS-REDACTED]`, (e) email pattern → `[EMAIL-REDACTED]`; rebuild request body with redacted prompt; call `base.SendAsync(request, ct)`; redacted string NEVER stored or logged

4. Implement `AiAuditInterceptor` (inherits `DelegatingHandler`): override `SendAsync`; capture: redacted prompt from request body (already redacted by `PiiRedactionMiddleware` upstream); call `base.SendAsync()`; on response: parse `"prompt_eval_count"` and `"eval_count"` from Ollama response JSON; read `"model"` from request body; read `actor_id` from `IHttpContextAccessor` JWT `sub` (or `System` UUID for Hangfire background jobs); call `_auditLogger.Write(new AuditEvent { ActionType = LLMInvoked, EntityType = "ai_inference", EntityId = jobId, ChangeSummary = $"model={model} tokens_in={N} tokens_out={M} pipeline={pipeline}", ... })` synchronously

5. Update `VectorSearchService`: add `patientId` as constructor parameter; call `Guard.Against.NullOrEmpty(patientId, nameof(patientId))`; for ALL pgvector SQL queries, add `AND patient_id = @patientId` clause (both `extracted_clinical_data` and any patient chunk queries); ICD-10/CPT reference index queries excluded (no PHI)

6. Route all `ExtractionJob`, `CodingJob`, `IntakePipeline` LLM HTTP calls through the decorated `OllamaHttpClient` (replace any direct `HttpClient` injections in these services with `OllamaHttpClient`)

7. Create `OllamaArchitectureFitnessTest` as a test project class: use reflection to enumerate all `IHttpClient` / `HttpClient` registrations or instances in `Clinical`, `Coding`, `Intake` feature assemblies; assert `BaseAddress` does NOT contain `openai.com|anthropic.com|googleapis.com|azure.com|cohere.ai`; wire test to run in CI build pipeline

8. Write integration tests in `AiSafetyIntegrationTests.cs` covering all 5 AC-5 assertions; use `HttpClient` outbound request log to verify no external calls; substring scan `audit_logs.change_summary` for test patient literals; count `LLMInvoked` rows; seed two-patient pgvector fixture and assert cross-patient isolation

---

## Current Project State

```
Server/
├── Program.cs                                ← MODIFY (register OllamaHttpClient with handler chain)
├── Features/
│   ├── Documents/Services/
│   │   ├── ExtractionJob.cs                  ← MODIFY (use OllamaHttpClient)
│   │   └── VectorSearchService.cs            ← MODIFY (mandatory patientId ACL)
│   ├── Coding/Services/
│   │   └── CodingJob.cs                      ← MODIFY (use OllamaHttpClient)
│   └── Intake/Services/
│       └── IntakePipeline.cs                 ← MODIFY (use OllamaHttpClient)
├── Infrastructure/
│   ├── AI/                                   ← CREATE all AI safety infra
│   │   ├── OllamaHttpClient.cs
│   │   ├── PiiRedactionMiddleware.cs
│   │   ├── AiAuditInterceptor.cs
│   │   └── OllamaStartupValidator.cs
│   └── Audit/AuditActionType.cs             ← MODIFY (add LLMInvoked)
└── Tests/
    ├── Integration/
    │   └── AiSafetyIntegrationTests.cs       ← CREATE
    └── Architecture/
        └── OllamaArchitectureFitnessTest.cs  ← CREATE
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `Server/Infrastructure/AI/OllamaHttpClient.cs` | Singleton `HttpClient`; `OLLAMA_HOST` config; handler chain registration |
| CREATE | `Server/Infrastructure/AI/PiiRedactionMiddleware.cs` | `DelegatingHandler`; 5 compiled PII regexes; in-memory substitution; no persistence |
| CREATE | `Server/Infrastructure/AI/AiAuditInterceptor.cs` | `DelegatingHandler`; token count capture from Ollama response; synchronous `LLMInvoked` audit write |
| CREATE | `Server/Infrastructure/AI/OllamaStartupValidator.cs` | `IHostedService`; startup reachability check; log reachable/unreachable |
| MODIFY | `Server/Features/Documents/Services/VectorSearchService.cs` | Mandatory `patientId` ctor param; `Guard.Against.NullOrEmpty`; `WHERE patient_id = @patientId` in all patient queries |
| MODIFY | `Server/Features/Documents/Services/ExtractionJob.cs` | Replace direct `HttpClient` with `OllamaHttpClient` |
| MODIFY | `Server/Features/Coding/Services/CodingJob.cs` | Replace direct `HttpClient` with `OllamaHttpClient` |
| MODIFY | `Server/Features/Intake/Services/IntakePipeline.cs` | Replace direct `HttpClient` with `OllamaHttpClient` |
| MODIFY | `Server/Infrastructure/Audit/AuditActionType.cs` | Add `LLMInvoked` action type |
| MODIFY | `Server/Program.cs` | Register `OllamaHttpClient` with `PiiRedactionMiddleware` + `AiAuditInterceptor` handler chain; register `OllamaStartupValidator` as hosted service |
| CREATE | `Server/Tests/Integration/AiSafetyIntegrationTests.cs` | AC-5 five-assertion integration test suite |
| CREATE | `Server/Tests/Architecture/OllamaArchitectureFitnessTest.cs` | Reflection-based AI endpoint fitness test; CI gate |

---

## External References

- [HIPAA Security Rule — Access Control & Audit Controls (45 CFR § 164.312)](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [ASP.NET Core — HttpMessageHandler / DelegatingHandler](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/http-requests#outgoing-request-middleware)
- [Ollama REST API — /api/generate response fields](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [NetArchTest — Architecture fitness testing for .NET](https://github.com/BenMorris/NetArchTest)
- [Ardalis.GuardClauses — Guard.Against.NullOrEmpty](https://github.com/ardalis/GuardClauses)

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] `OllamaHttpClient` `BaseAddress` resolves to `localhost:11434` when `OLLAMA_HOST` absent
- [ ] `OllamaStartupValidator` logs `"AI Safety: Ollama reachable at {host}"` on successful `GET /api/tags`; application starts regardless of reachability result
- [ ] `PiiRedactionMiddleware`: prompt containing `"John Smith"` → `[PATIENT-NAME]` present in outgoing request body; original unredacted prompt never logged
- [ ] `PiiRedactionMiddleware`: prompt containing `"1990-05-15"` → `[DOB-REDACTED]` present
- [ ] `PiiRedactionMiddleware`: prompt containing `"john.smith@email.com"` → `[EMAIL-REDACTED]` present
- [ ] `PiiRedactionMiddleware`: prompt containing `"AB-123456"` (insurance ID) → `[INS-REDACTED]` present
- [ ] `AiAuditInterceptor`: after LLM call, `audit_logs` contains 1 `LLMInvoked` row with correct `model_name`, `token_count_input`, `token_count_output`
- [ ] `AiAuditInterceptor`: `audit_logs.change_summary` does NOT contain test patient name, DOB, or address literals
- [ ] `VectorSearchService` with `patientId = null` → `ArgumentException` thrown; no DB query executed
- [ ] pgvector query for patient A → 0 rows with patient B's `patient_id` returned
- [ ] Architecture fitness test: 0 violations on `Clinical`/`Coding`/`Intake` assemblies; test passes in CI
- [ ] Architecture fitness test: `Notifications` assembly with `googleapis.com` Calendar client → no false positive violation

---

## Implementation Checklist

- [ ] Register `OllamaHttpClient` singleton in DI with `OLLAMA_HOST` env var; add `PiiRedactionMiddleware` + `AiAuditInterceptor` as `DelegatingHandler`s in handler pipeline
- [ ] Create `OllamaStartupValidator : IHostedService`; ping `GET {OLLAMA_HOST}/api/tags`; log reachability result; non-fatal on failure
- [ ] Implement `PiiRedactionMiddleware`: 5 compiled regex substitutions; in-memory only; never persist or log redacted string
- [ ] Implement `AiAuditInterceptor`: capture model name + token counts from Ollama response JSON; call `AuditLogger.Write(LLMInvoked)` synchronously before returning response
- [ ] Add `LLMInvoked` to `AuditActionType` enum (coordinate with us_048 to avoid duplication)
- [ ] Update `VectorSearchService`: mandatory `patientId` ctor param; `Guard.Against.NullOrEmpty`; add `WHERE patient_id = @patientId` to all patient chunk queries
- [ ] Route all `ExtractionJob`, `CodingJob`, `IntakePipeline` LLM calls through decorated `OllamaHttpClient`
- [ ] Create `OllamaArchitectureFitnessTest`: reflection scan scoped to `Clinical`/`Coding`/`Intake` assemblies; assert no external AI `HttpClient` base addresses; wire to CI
- [ ] Write `AiSafetyIntegrationTests.cs`: seed two-patient fixture; run extraction pipeline; assert all 5 AC-5 conditions
