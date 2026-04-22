---
title: "Task — BE AI Operational Reliability: TokenBudgetEnforcer (4,096-Token Batch Splitting) & OllamaCircuitBreakerPolicy (Polly 3-Failure / 5-Minute Cool-Down)"
task_id: task_001
story_id: us_050
epic: EP-008-II
layer: Backend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — BE AI Operational Reliability: TokenBudgetEnforcer (4,096-Token Batch Splitting) & OllamaCircuitBreakerPolicy (Polly 3-Failure / 5-Minute Cool-Down)

## Requirement Reference

- **User Story**: us_050
- **Story Location**: .propel/context/tasks/EP-008-II/us_050/us_050.md
- **Acceptance Criteria**:
  - AC-1: `TokenBudgetEnforcer` service counts input tokens using character-count heuristic (`total_characters / 4`) as Phase 1 acceptable approximation; if ≤ 4,096 tokens → pass prompt unchanged to LLM; if > 4,096 → split RAG context chunks into batches such that each batch (system prompt + query + context) ≤ 4,096 tokens; invoke LLM once per batch; merge results from multiple batches (union of extracted fields, highest-confidence per field type); write `audit_logs (action=TokenBudgetEnforced, entity_id=job_id, change_summary="prompt_tokens=N split_into=M batches")` whenever splitting occurs; maximum 10 batches — if 10 batches insufficient, remaining lower-ranked chunks skipped and flagged `NeedsReview` (AIR-O01, NFR-001, NFR-016)
  - AC-2: When a single large PDF produces > 10 × 4,096-token batches of RAG chunks, process first 10 batches (highest-similarity top-5-ranked by retrieval step); skip remaining lower-ranked chunks (not an extraction failure — these did not meet top-5 cutoff); write `audit_logs (action=TokenBudgetExceeded, job_id, change_summary="processed=10 batches skipped=N additional chunks")`; 30-second p90 SLA (AIR-Q02) maintained because skipping lower-ranked chunks adds no latency (AIR-O01)
  - AC-3: `OllamaCircuitBreakerPolicy` (Polly `CircuitBreakerAsyncPolicy`): records failure on HTTP 5xx, connection timeout (> 30s), `HttpRequestException`, `SocketException`; after 3 consecutive failures within 60-second sampling window → circuit transitions to `Open`; while `Open`: new LLM call immediately throws `BrokenCircuitException` without contacting Ollama; Hangfire catches `BrokenCircuitException` → marks job `Failed` → writes `audit_logs (action=CircuitBreakerOpen, change_summary="ollama circuit open after 3 failures within 60s")`; `Open` state persists for cool-down period (default 300s, overridable via `OLLAMA_CIRCUIT_BREAKER_COOLDOWN_SECONDS` env var) before transitioning to `HalfOpen` (AIR-O02, NFR-011, NFR-014)
  - AC-4: `HalfOpen` state allows one trial LLM call; success (HTTP 200) → circuit transitions to `Closed`; write `audit_logs (action=CircuitBreakerClosed, change_summary="ollama circuit closed after successful probe")`; trial call failure → circuit returns to `Open` for another cool-down; Hangfire jobs `Failed` while circuit was `Open` are automatically retried by Hangfire's built-in retry scheduler (3 automatic retries: 1 min, 5 min, 15 min exponential backoff); Hangfire retry and circuit breaker cool-down work independently — Hangfire may retry before circuit closes but `BrokenCircuitException` causes immediate re-fail and reschedule (AIR-O02, NFR-014, NFR-011)
  - AC-5: When circuit is `Open` and Staff requests code suggestions via `POST /api/patients/{id}/coding/request` or document uploaded triggering extraction: job enqueued normally (202 Accepted returned — API layer does NOT check circuit state); job fails immediately with `BrokenCircuitException` on first Hangfire dequeue; `GET /api/patients/{id}/coding/suggestions` returns `{ "status": "generating" }` up to 30 seconds, then `{ "status": "failed", "error": "AI service temporarily unavailable — please retry in a few minutes" }` based on Hangfire job `Failed` state; Staff UI (SCR-018) shows existing error state with "Retry code generation" CTA (re-enqueues job); core non-AI workflows (booking, queue management, patient dashboard) unaffected by circuit state (NFR-014, AIR-O02)

- **Edge Cases**:
  - Edge Case: `OLLAMA_CIRCUIT_BREAKER_COOLDOWN_SECONDS` = 0 or missing → `OllamaCircuitBreakerPolicy` validates on startup; invalid/missing → default 300s; log `"Warning: OLLAMA_CIRCUIT_BREAKER_COOLDOWN_SECONDS invalid or missing — using default 300s"`; application does not fail to start; default prevents infinite Open/HalfOpen cycling
  - Edge Case: Slow Ollama (25s response, HTTP 200) does NOT trigger circuit → circuit breaker fires only on hard failures (5xx, timeout > 30s, socket exception); slow-but-successful responses do NOT increment failure counter; p90 30-second budget monitored independently by job elapsed-time tracker (us_041/us_044); slow responses logged as performance degradation, not circuit events
  - Edge Case: Token heuristic over-estimates (batches prompt that would have fit) → safe failure direction (unnecessary batching, not context overflow); worse performance but never malformed/truncated LLM response; Phase 2 can replace heuristic with exact `Microsoft.ML.Tokenizers` tokenizer
  - Edge Case: Multi-batch coding result contradiction (two batches return different ICD-10 codes for same diagnosis) → merger keeps highest-confidence result per code type; different codes for same presentation → both inserted as separate `medical_code_suggestions` rows for Staff review on SCR-018; de-duplication is NOT performed by merger (Staff review resolves contradictions)
  - Edge Case: Polly `CircuitBreakerAsyncPolicy` thread-safety across concurrent Hangfire workers → Polly's `CircuitBreakerAsyncPolicy` is thread-safe and designed for concurrent callers; `OllamaCircuitBreakerPolicy` registered as singleton in DI so all Hangfire worker threads share same circuit state; Polly uses atomic state transitions; no additional locking required in calling code

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No — error state on SCR-018 is propagated from existing Hangfire job `Failed` status (defined in us_045); no new UI component |
| **Figma URL** | N/A |
| **Wireframe Status** | N/A |
| **Wireframe Type** | N/A |
| **Wireframe Path/URL** | N/A |
| **Screen Spec** | N/A (SCR-018 error state handled by us_045) |
| **UXR Requirements** | N/A |
| **Design Tokens** | N/A |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | ASP.NET Core | .NET 9 |
| AI Inference | Ollama (local) | `llama3.2:3b-instruct-q8_0` |
| Resilience | Polly | 8.x (`CircuitBreakerAsyncPolicy`) |
| Background Jobs | Hangfire | `[AutomaticRetry]`; exponential backoff |
| Logging / Audit | Serilog + `AuditLogger` (us_048) | — |
| Tokenizer (Phase 2) | `Microsoft.ML.Tokenizers` | (Phase 1: character-count heuristic) |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | Yes — wraps `OllamaHttpClient` (from us_049) with operational resilience controls |
| **AIR Requirements** | AIR-O01 (token budget), AIR-O02 (circuit breaker) |
| **AI Pattern** | Pre-call token counting + batch splitting; Polly circuit breaker as `HttpMessageHandler` in `OllamaHttpClient` handler chain |
| **Prompt Template Path** | N/A (controls applied at infrastructure level, not prompt template level) |
| **Guardrails Config** | `OLLAMA_CIRCUIT_BREAKER_COOLDOWN_SECONDS` env var (default 300); max batch count = 10; token budget = 4,096 |
| **Model Provider** | Ollama local (same client from us_049) |

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

Add two Polly-based operational resilience controls to the `OllamaHttpClient` handler chain established in us_049: (1) `TokenBudgetEnforcer` service that counts tokens via `characters / 4` heuristic, splits over-budget prompts into batches of ≤ 4,096 tokens (max 10), invokes LLM once per batch, and merges results (highest-confidence per field type); (2) `OllamaCircuitBreakerPolicy` Polly singleton that opens after 3 consecutive failures within 60s, waits for configurable cool-down (default 300s), and probes with a single trial call in `HalfOpen`. Both controls write targeted audit log entries. The `GET /coding/suggestions` polling endpoint's failed-state response body is updated to surface the "AI service temporarily unavailable" message when the Hangfire job status is `Failed` due to `BrokenCircuitException`.

---

## Dependent Tasks

- us_049 task_001 (EP-008-II) — `OllamaHttpClient` singleton with `PiiRedactionMiddleware` + `AiAuditInterceptor` handler chain must exist; `OllamaCircuitBreakerPolicy` is added as an additional handler in that chain
- us_048 task_001 (EP-008-I) — `AuditLogger` with `TokenBudgetEnforced`, `TokenBudgetExceeded`, `CircuitBreakerOpen`, `CircuitBreakerClosed` action types required
- US_040 (EP-006-I) / US_044 (EP-007) — `ExtractionJob` and `CodingJob` must exist to receive `TokenBudgetEnforcer` integration

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Infrastructure/AI/TokenBudgetEnforcer.cs` | CREATE | Characters/4 token count; batch split at 4,096; max 10 batches; `NeedsReview` flag; audit write on split/exceeded |
| `Server/Infrastructure/AI/TokenBatchMerger.cs` | CREATE | Merges LLM results from N batches; highest-confidence per field type; contradicting codes → both retained as separate rows |
| `Server/Infrastructure/AI/OllamaCircuitBreakerPolicy.cs` | CREATE | Polly `CircuitBreakerAsyncPolicy`; singleton; 3 failures / 60s → Open; cool-down from `OLLAMA_CIRCUIT_BREAKER_COOLDOWN_SECONDS`; `CircuitBreakerOpen`/`CircuitBreakerClosed` audit writes |
| `Server/Infrastructure/AI/OllamaHttpClient.cs` | MODIFY | Add `OllamaCircuitBreakerPolicy` as `DelegatingHandler` in handler chain (after `AiAuditInterceptor`) |
| `Server/Features/Documents/Services/ExtractionJob.cs` | MODIFY | Inject `TokenBudgetEnforcer`; wrap prompt construction + LLM call loop with budget enforcement; handle `NeedsReview` fields |
| `Server/Features/Coding/Services/CodingJob.cs` | MODIFY | Inject `TokenBudgetEnforcer`; wrap coding prompt with budget enforcement; inject `TokenBatchMerger` for multi-batch merge |
| `Server/Features/Coding/Controllers/CodingController.cs` | MODIFY | `GET /api/patients/{id}/coding/suggestions`: on Hangfire job `Failed` state → return `{ "status": "failed", "error": "AI service temporarily unavailable — please retry in a few minutes" }` |
| `Server/Infrastructure/Audit/AuditActionType.cs` | MODIFY | Add `TokenBudgetEnforced`, `TokenBudgetExceeded`, `CircuitBreakerOpen`, `CircuitBreakerClosed` action types |
| `Server/Tests/Unit/AI/TokenBudgetEnforcerTests.cs` | CREATE | Token count accuracy; batch split boundaries; max-10 enforcement; `NeedsReview` flagging |
| `Server/Tests/Unit/AI/OllamaCircuitBreakerPolicyTests.cs` | CREATE | State transitions: 3 failures → Open; cool-down → HalfOpen; success probe → Closed; failed probe → Open again |

---

## Implementation Plan

1. Create `TokenBudgetEnforcer` service:
   - Constructor: inject `AuditLogger`, `ILogger<TokenBudgetEnforcer>`
   - `CountTokens(string prompt): int` → `prompt.Length / 4` (Phase 1 heuristic; document Phase 2 upgrade path to `Microsoft.ML.Tokenizers`)
   - `EnforceAndSplit(string systemPrompt, string query, IList<string> contextChunks): IList<TokenBatch>`:
     - Attempt single batch: if `CountTokens(systemPrompt + query + all_chunks)` ≤ 4,096 → return single `TokenBatch`
     - Otherwise: iterate chunks greedily; start new batch when adding next chunk would exceed 4,096; cap at 10 batches; mark remaining chunks as skipped
     - Write `audit_logs(TokenBudgetEnforced, ...)` if batches > 1
     - Write `audit_logs(TokenBudgetExceeded, ...)` if remaining chunks skipped beyond batch 10
     - Return `IList<TokenBatch>` (each batch: `systemPrompt`, `query`, `IList<string> chunks`, `bool hasSkippedChunks`)

2. Create `TokenBatchMerger` service:
   - `MergeExtractionResults(IList<ExtractionResult> batchResults): ExtractionResult` → union all extracted fields; for duplicate field types, retain highest-confidence value
   - `MergeCodingResults(IList<CodingSuggestion> batchResults): IList<CodingSuggestion>` → for same code, retain highest-confidence; for different codes on same clinical presentation, retain both (Staff review resolves contradiction)

3. Implement `OllamaCircuitBreakerPolicy`:
   - Read `OLLAMA_CIRCUIT_BREAKER_COOLDOWN_SECONDS` from `IConfiguration`; validate > 0; default 300 on invalid/missing with Warning log
   - Build Polly policy: `Policy.Handle<HttpRequestException>().Or<SocketException>().OrResult<HttpResponseMessage>(r => (int)r.StatusCode >= 500).AdvancedCircuitBreakerAsync(failureThreshold: 1.0, samplingDuration: TimeSpan.FromSeconds(60), minimumThroughput: 3, durationOfBreak: TimeSpan.FromSeconds(cooldownSeconds), onBreak: (ex, duration) => { auditLogger.Write(CircuitBreakerOpen, ...); }, onReset: () => { auditLogger.Write(CircuitBreakerClosed, ...); })`
   - Alternatively use `CircuitBreakerAsync(3, TimeSpan.FromSeconds(cooldownSeconds))` with `onBreak`/`onReset` callbacks
   - Register as singleton in DI
   - 30-second `HttpClient` timeout configured separately (connection timeout that feeds the circuit breaker)

4. Add `OllamaCircuitBreakerPolicy` to `OllamaHttpClient` handler chain in `Program.cs`: wrap `HttpClient.SendAsync` calls through Polly policy; catch `BrokenCircuitException` in `ExtractionJob`/`CodingJob` Hangfire job — log + rethrow to let Hangfire mark job as `Failed`

5. Integrate `TokenBudgetEnforcer` into `ExtractionJob.cs`:
   - Before LLM call: call `_tokenBudgetEnforcer.EnforceAndSplit(systemPrompt, query, ragChunks)`
   - Iterate each `TokenBatch`; invoke LLM once per batch
   - Pass all batch results to `_tokenBatchMerger.MergeExtractionResults()`
   - Mark fields flagged `NeedsReview` on merged result

6. Integrate `TokenBudgetEnforcer` into `CodingJob.cs`:
   - Same pattern as step 5; use `_tokenBatchMerger.MergeCodingResults()` for multi-batch coding merging

7. Update `CodingController.GET /api/patients/{id}/coding/suggestions`: check Hangfire job state from `IBackgroundJobClient` / monitoring API; on `Failed` state → inspect `FailedException` message for `BrokenCircuitException` signature → return `{ "status": "failed", "error": "AI service temporarily unavailable — please retry in a few minutes" }`

8. Add `TokenBudgetEnforced`, `TokenBudgetExceeded`, `CircuitBreakerOpen`, `CircuitBreakerClosed` to `AuditActionType` enum

9. Write unit tests for `TokenBudgetEnforcer`: (a) prompt ≤ 4,096 chars / 4 → single batch returned; (b) prompt splitting boundary at exactly 4,096 tokens; (c) 11 chunks worth of content → 10 batches + skipped flag + `TokenBudgetExceeded` audit; (d) `CountTokens("a" * 4096 * 4)` → 4096

10. Write unit tests for `OllamaCircuitBreakerPolicy`: (a) 3 consecutive `HttpRequestException` → `BrokenCircuitException` on 4th call; (b) after cool-down → single trial call allowed (`HalfOpen`); (c) trial call success → subsequent calls proceed (`Closed`); (d) trial call fails → immediate `BrokenCircuitException` again; (e) `OLLAMA_CIRCUIT_BREAKER_COOLDOWN_SECONDS=0` → defaults to 300 + Warning logged

---

## Current Project State

```
Server/
├── Program.cs                                 ← MODIFY (register OllamaCircuitBreakerPolicy singleton)
├── Features/
│   ├── Documents/Services/ExtractionJob.cs    ← MODIFY (TokenBudgetEnforcer loop)
│   ├── Coding/Services/CodingJob.cs           ← MODIFY (TokenBudgetEnforcer + merger)
│   └── Coding/Controllers/CodingController.cs ← MODIFY (failed-state error message)
├── Infrastructure/
│   └── AI/                                    ← EXISTING from us_049
│       ├── OllamaHttpClient.cs               ← MODIFY (add OllamaCircuitBreakerPolicy to handler chain)
│       ├── TokenBudgetEnforcer.cs            ← CREATE
│       ├── TokenBatchMerger.cs               ← CREATE
│       └── OllamaCircuitBreakerPolicy.cs     ← CREATE
└── Tests/
    └── Unit/AI/
        ├── TokenBudgetEnforcerTests.cs        ← CREATE
        └── OllamaCircuitBreakerPolicyTests.cs ← CREATE
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `Server/Infrastructure/AI/TokenBudgetEnforcer.cs` | `characters/4` token count; batch split at 4,096; max 10 batches; `NeedsReview` flag; `TokenBudgetEnforced` + `TokenBudgetExceeded` audit writes |
| CREATE | `Server/Infrastructure/AI/TokenBatchMerger.cs` | Merge extraction results (highest-confidence per field); merge coding results (same code → highest-confidence; different codes → both retained) |
| CREATE | `Server/Infrastructure/AI/OllamaCircuitBreakerPolicy.cs` | Polly `CircuitBreakerAsyncPolicy`; 3 failures / 60s → Open; configurable cool-down; `CircuitBreakerOpen`/`CircuitBreakerClosed` audit writes; singleton |
| MODIFY | `Server/Infrastructure/AI/OllamaHttpClient.cs` | Add `OllamaCircuitBreakerPolicy` to `DelegatingHandler` chain |
| MODIFY | `Server/Features/Documents/Services/ExtractionJob.cs` | Inject + use `TokenBudgetEnforcer`; batch LLM invocation loop; `TokenBatchMerger` merge; `NeedsReview` flag handling |
| MODIFY | `Server/Features/Coding/Services/CodingJob.cs` | Inject + use `TokenBudgetEnforcer`; batch coding loop; `TokenBatchMerger.MergeCodingResults()` |
| MODIFY | `Server/Features/Coding/Controllers/CodingController.cs` | Failed-state response: `"AI service temporarily unavailable — please retry in a few minutes"` on `BrokenCircuitException` |
| MODIFY | `Server/Infrastructure/Audit/AuditActionType.cs` | Add `TokenBudgetEnforced`, `TokenBudgetExceeded`, `CircuitBreakerOpen`, `CircuitBreakerClosed` |
| MODIFY | `Server/Program.cs` | Register `TokenBudgetEnforcer`, `TokenBatchMerger`, `OllamaCircuitBreakerPolicy` in DI |
| CREATE | `Server/Tests/Unit/AI/TokenBudgetEnforcerTests.cs` | Token count accuracy; batch boundaries; max-10 cap; `NeedsReview` flag; audit assertions |
| CREATE | `Server/Tests/Unit/AI/OllamaCircuitBreakerPolicyTests.cs` | State transition: 3 failures → Open; HalfOpen probe; Closed on success; cool-down default fallback |

---

## External References

- [Polly — Circuit Breaker documentation](https://www.thepollyproject.org/2019/12/04/polly-circuit-breaker-v8/)
- [Polly GitHub — CircuitBreakerAsyncPolicy](https://github.com/App-vNext/Polly/wiki/Circuit-Breaker)
- [ASP.NET Core — HttpClient with Polly resilience](https://learn.microsoft.com/en-us/dotnet/core/resilience/http-resilience)
- [Hangfire — Automatic Retries with exponential backoff](https://docs.hangfire.io/en/latest/background-processing/dealing-with-exceptions.html)
- [Microsoft.ML.Tokenizers — BPE tokenizer (Phase 2 reference)](https://learn.microsoft.com/en-us/dotnet/api/microsoft.ml.tokenizers)

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] `TokenBudgetEnforcer.CountTokens("a" * 400)` → 100 (characters / 4)
- [ ] Prompt ≤ 4,096 tokens → single batch returned; no `TokenBudgetEnforced` audit log written
- [ ] Prompt > 4,096 tokens → multiple batches returned; `audit_logs` contains `TokenBudgetEnforced` row with `split_into=N batches`
- [ ] 11 chunks worth of content → exactly 10 batches returned; remaining chunks flagged as skipped; `audit_logs` contains `TokenBudgetExceeded` row
- [ ] 3 consecutive HTTP 5xx Ollama responses → 4th call immediately throws `BrokenCircuitException`; no HTTP request sent
- [ ] Hangfire job with `BrokenCircuitException` → job status = `Failed`; `audit_logs` contains `CircuitBreakerOpen` row
- [ ] After cool-down, single trial call with HTTP 200 → circuit transitions to `Closed`; `audit_logs` contains `CircuitBreakerClosed` row
- [ ] `OLLAMA_CIRCUIT_BREAKER_COOLDOWN_SECONDS` absent → Warning logged; 300s cool-down applied; application starts normally
- [ ] `GET /api/patients/{id}/coding/suggestions` when job `Failed` (BrokenCircuitException) → `{ "status": "failed", "error": "AI service temporarily unavailable — please retry in a few minutes" }`
- [ ] Non-AI endpoints (booking, queue management) respond normally regardless of circuit state
- [ ] `TokenBatchMerger`: two batches with same field type, confidence 0.94 and 0.87 → 0.94 result retained
- [ ] `TokenBatchMerger`: two batches with different ICD-10 codes → both rows present in `medical_code_suggestions`

---

## Implementation Checklist

- [ ] Create `TokenBudgetEnforcer`: `CountTokens(string): int` heuristic (`length / 4`); `EnforceAndSplit()` batch iterator; max 10 batches; `NeedsReview` flag on skipped chunks; `TokenBudgetEnforced` + `TokenBudgetExceeded` audit writes
- [ ] Create `TokenBatchMerger`: `MergeExtractionResults()` (highest-confidence per field); `MergeCodingResults()` (highest-confidence per code + retain contradictions as separate rows)
- [ ] Create `OllamaCircuitBreakerPolicy`: Polly `CircuitBreakerAsyncPolicy`; read + validate `OLLAMA_CIRCUIT_BREAKER_COOLDOWN_SECONDS` (default 300 + Warning log); `onBreak` → `CircuitBreakerOpen` audit write; `onReset` → `CircuitBreakerClosed` audit write; register as singleton
- [ ] Add `OllamaCircuitBreakerPolicy` to `OllamaHttpClient` `DelegatingHandler` chain in `Program.cs`
- [ ] Add `TokenBudgetEnforced`, `TokenBudgetExceeded`, `CircuitBreakerOpen`, `CircuitBreakerClosed` to `AuditActionType` enum
- [ ] Update `ExtractionJob`: inject `TokenBudgetEnforcer` + `TokenBatchMerger`; implement batch LLM loop; handle `NeedsReview` fields
- [ ] Update `CodingJob`: inject `TokenBudgetEnforcer` + `TokenBatchMerger`; implement batch coding loop; handle contradictions
- [ ] Update `CodingController.GET /coding/suggestions`: detect `BrokenCircuitException` in Hangfire job failure reason → return `"AI service temporarily unavailable"` message
- [ ] Write `TokenBudgetEnforcerTests.cs`: count accuracy; single batch boundary; batch split; max-10 cap; audit assertions
- [ ] Write `OllamaCircuitBreakerPolicyTests.cs`: Open after 3 failures; HalfOpen probe; Closed on success; Open on failed probe; default cool-down fallback
