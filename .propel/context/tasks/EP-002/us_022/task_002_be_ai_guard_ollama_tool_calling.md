---
title: "Task — BE AI Guard Layer + Ollama Tool Calling Intake API"
task_id: task_002
story_id: us_022
epic: EP-002
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE AI Guard Layer + Ollama Tool Calling Intake API

## Requirement Reference

- **User Story**: us_022
- **Story Location**: .propel/context/tasks/EP-002/us_022/us_022.md
- **Acceptance Criteria**:
  - AC-1: `GET /api/intake/status` returns existing `patient_intakes` row (field presence map) or empty state
  - AC-2: `POST /api/intake/chat {message, session_id}` → AI Guard Layer redacts PII (name/DOB → `[PATIENT-ID]`/`[DOB-REDACTED]`) → invoke Ollama `llama3.2:3b-instruct-q8_0` with tool definitions (`save_demographic`, `save_medication`, `save_allergy`, `save_chief_complaint`) → on tool call, UPSERT `patient_intakes` partial JSONB field → return `{next_prompt, extracted_fields_so_far}`
  - AC-4: Input token count > 4,096 → truncate conversation history from oldest turn first until ≤ 4,096; log Serilog `WARN` "token budget enforced"; transparent to patient
  - AC-5: Ollama 3 consecutive failures within 60 s → circuit breaker opens → HTTP 503 "AI intake is temporarily unavailable — please switch to the manual form"; re-closes after 5-min cool-down
  - AC-6: `POST /api/intake/submit` → set `submitted_at = NOW()`; write `audit_logs` entry `action_type = IntakeSubmitted`; HTTP 200
- **Edge Cases**:
  - LLM returns malformed tool call (missing args) → Guard Layer catches JSON schema failure, logs Serilog `WARN`, does NOT persist, returns fallback prompt to patient
  - Browser closes mid-conversation → incremental UPSERTs already persisted; `GET /api/intake/status` resumes from last saved field
  - Guard Layer regex misses PHI → secondary NER pass in .NET; redaction event logged at `DEBUG`

---

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

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | ASP.NET Core Web API | .NET 9 |
| ORM | Entity Framework Core | 9 (Npgsql provider) |
| Database | PostgreSQL | 16 |
| AI/ML | Ollama (llama3.2:3b-instruct-q8_0) | local |
| Logging | Serilog | latest |
| Auth | JWT Bearer | ASP.NET Core |

---

## AI References (AI Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | Yes |
| **AIR Requirements** | AIR-001 (conversational NLU intake pipeline), AIR-006 (Tool Calling: save_demographic, save_medication, save_allergy, save_chief_complaint), AIR-O01 (4,096 token budget), AIR-O02 (circuit breaker: 3 failures / 60 s, 5-min cool-down), AIR-S02 (redact patient identifiers before LLM invocation), AIR-S03 (log every LLM prompt/response excl. PHI) |
| **AI Pattern** | Tool Calling |
| **Prompt Template Path** | Server/Features/Intake/Prompts/ |
| **Guardrails Config** | Server/Features/Intake/Guards/AiGuardLayer.cs |
| **Model Provider** | Ollama (local, on-premise) |

### CRITICAL: AI Implementation Requirements

- **MUST** redact patient identifiers (name, DOB, address, insurance ID) from LLM prompts before invocation (AIR-S02)
- **MUST** enforce 4,096 input token budget; truncate from oldest history turn first (AIR-O01)
- **MUST** implement circuit breaker: 3 failures / 60 s → open → HTTP 503 → reclose after 5 min (AIR-O02)
- **MUST** validate all LLM tool call outputs against JSON schema before persisting (AIR-Q03)
- **MUST** log every prompt/response payload (excl. direct PHI) to audit log with actor ID, timestamp, model name, token counts (AIR-S03)
- **MUST** handle model failures gracefully: timeout, rate limit, malformed output → fallback prompt to patient

---

## Mobile References (Mobile Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |
| **Platform Target** | N/A |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Implement the intake AI backend pipeline in `Server/Features/Intake/`. The `IntakeChatController` exposes `GET /api/intake/status` and `POST /api/intake/chat`. The `AiGuardLayer` service handles PII redaction, token budget enforcement, and the Ollama HTTP call via `HttpClient`. Tool call responses are dispatched to `IntakeToolExecutor` which UPSERTs the corresponding `patient_intakes` JSONB field. A `CircuitBreakerPolicy` (Polly) wraps the Ollama HttpClient. Conversation history (turn list) is stored in a per-patient in-memory or Redis session keyed by `session_id`.

---

## Dependent Tasks

- US_003 (Ollama devcontainer running `llama3.2:3b-instruct-q8_0`) — must be reachable at `http://localhost:11434`
- US_010 (`patient_intakes` EF Core entity with encrypted JSONB) — must be migrated

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Intake/IntakeChatController.cs` | CREATE | `GET /api/intake/status`, `POST /api/intake/chat`, `POST /api/intake/submit` |
| `Server/Features/Intake/AiGuardLayer.cs` | CREATE | PII redaction (regex + NER fallback), token counting, history truncation, Ollama invocation |
| `Server/Features/Intake/IntakeToolExecutor.cs` | CREATE | Dispatches tool calls to UPSERT patient_intakes JSONB columns |
| `Server/Features/Intake/Prompts/intake-system-prompt.txt` | CREATE | System prompt template with tool definitions |
| `Server/Features/Intake/IntakeChatService.cs` | CREATE | Orchestrates guard, LLM call, tool execution, conversation history management |
| `Server/Data/AppDbContext.cs` | MODIFY | Ensure PatientIntakes DbSet registered |
| `Server/Program.cs` | MODIFY | Register HttpClient for Ollama with Polly circuit breaker; register services |

---

## Implementation Plan

1. **`GET /api/intake/status`** — Load `patient_intakes` row for `actor_id`; return `{ hasIntake, capturedSections: { demographics, medical_history, medications, allergies, chief_complaint } }` (boolean map). Return empty map if no row.

2. **Conversation history** — Maintain `List<ChatMessage>` (role + content) per `session_id` in `IMemoryCache` (or Redis session if available). Prepend system prompt on first turn.

3. **Token budget** — Before Ollama invocation, count tokens (approximate: `string.Length / 4` or tiktoken-compatible count). If > 4,096, remove oldest non-system turns until within budget. Log Serilog `WARN` with truncated count.

4. **PII redaction in `AiGuardLayer`**:
   - Pass 1: Regex patterns for common name formats, ISO date formats, Medicare/insurance IDs → replace with `[PATIENT-ID]`/`[DOB-REDACTED]`
   - Pass 2: NER-based pattern matcher (entity recognition using Microsoft.ML or simple rule patterns) as defence-in-depth. Log redaction events at `DEBUG`.

5. **Ollama call** — POST to `http://localhost:11434/v1/chat/completions` (OpenAI-compatible) with tools payload. Model: `llama3.2:3b-instruct-q8_0`. Wrapped in Polly `CircuitBreakerPolicy(3, TimeSpan.FromSeconds(60), TimeSpan.FromMinutes(5))`.

6. **Tool execution in `IntakeToolExecutor`** — Map tool name to JSONB column: `save_demographic → demographics`, `save_medication → medications`, `save_allergy → allergies`, `save_chief_complaint → chief_complaint`. Each call: validate args against schema (`JsonSchema.Net` or `System.Text.Json`); on failure log `WARN` and return fallback prompt. On success: `UPSERT patient_intakes SET {column} = @value, updated_at = NOW() WHERE patient_id = @actorId`.

7. **Circuit breaker → HTTP 503** — When Polly circuit is open, catch `BrokenCircuitException` and return `HTTP 503 { message: "AI intake is temporarily unavailable — please switch to the manual form" }`.

8. **`POST /api/intake/submit`** — Set `submitted_at = NOW()` on the patient's `patient_intakes` row. Write `audit_logs { action_type = "IntakeSubmitted", entity_type = "PatientIntake", entity_id, actor_id, actor_role, change_summary = "Intake submitted via AI-assisted path" }`. Return HTTP 200.

9. **Audit logging of LLM calls** — Per AIR-S03: after each inference, log to `audit_logs` or Serilog structured log: `actor_id`, `occurred_at`, `model_name = "llama3.2:3b-instruct-q8_0"`, `input_tokens`, `output_tokens` (no raw PHI in payload).

---

## Current Project State

```
Server/
  Features/
    Intake/        # (to be created)
  Data/
    AppDbContext.cs
  Program.cs
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/Features/Intake/IntakeChatController.cs | GET status, POST chat, POST submit endpoints |
| CREATE | Server/Features/Intake/IntakeChatService.cs | Orchestration: history management, guard invocation, tool dispatch, response assembly |
| CREATE | Server/Features/Intake/AiGuardLayer.cs | PII redaction (regex + NER), token budget enforcement, Ollama HttpClient call |
| CREATE | Server/Features/Intake/IntakeToolExecutor.cs | Tool call validation + JSONB UPSERT per tool name |
| CREATE | Server/Features/Intake/Prompts/intake-system-prompt.txt | System prompt with tool definitions for all 4 intake tools |
| MODIFY | Server/Data/AppDbContext.cs | Confirm PatientIntakes DbSet registered with encrypted JSONB columns |
| MODIFY | Server/Program.cs | Register Ollama HttpClient with Polly circuit breaker; register Intake services |

---

## External References

- Ollama OpenAI-compatible API (tool calling): https://github.com/ollama/ollama/blob/main/docs/openai.md
- Polly circuit breaker .NET 9: https://www.pollydocs.org/strategies/circuit-breaker
- ASP.NET Core `HttpClientFactory` with Polly: https://learn.microsoft.com/en-us/dotnet/core/resilience/http-resilience
- EF Core JSONB UPSERT with Npgsql: https://www.npgsql.org/efcore/mapping/json.html
- `JsonSchema.Net` for tool call output validation: https://json-everything.net/json-schema
- AIR-S02 redaction requirement; AIR-O01 token budget 4,096; AIR-O02 circuit breaker thresholds
- Serilog structured logging: https://serilog.net/

---

## Build Commands

- `cd Server && dotnet build` — C# compile check
- `cd Server && dotnet test` — Run unit/integration tests
- `cd Server && dotnet run` — Start server for integration testing

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `GET /api/intake/status` returns correct section presence map
- [ ] PII redaction: name/DOB replaced with tokens before Ollama invocation (verify via Serilog DEBUG log)
- [ ] Token budget: conversation history truncated at 4,096; Serilog WARN emitted
- [ ] Ollama tool call dispatched; `save_demographic` UPSERTs `demographics` JSONB column
- [ ] Malformed tool call: fallback prompt returned; no DB write; Serilog WARN logged
- [ ] Circuit breaker: 3 failures → HTTP 503 returned; closes after 5-min cool-down
- [ ] `POST /api/intake/submit`: `submitted_at` set; audit log `IntakeSubmitted` written; HTTP 200
- [ ] AIR-S03: LLM call metadata logged (model name, token counts, no raw PHI)
- [ ] Non-Patient JWT on `/api/intake/chat` → HTTP 403

---

## Implementation Checklist

- [ ] Create `IntakeChatController.cs` with `[Authorize(Roles = "Patient")]` on all endpoints
- [ ] Implement `GET /api/intake/status` returning section presence map from `patient_intakes`
- [ ] Create `AiGuardLayer.cs` with regex PII redaction (Pass 1) and NER fallback (Pass 2)
- [ ] Implement token counting and oldest-turn truncation at 4,096 limit; Serilog WARN
- [ ] Configure Ollama `HttpClient` in `Program.cs` with Polly `CircuitBreakerPolicy(3, 60s, 5min)`
- [ ] Create `intake-system-prompt.txt` with tool definitions for all 4 save tools
- [ ] Implement `IntakeToolExecutor.cs`: validate tool args schema; UPSERT correct JSONB column
- [ ] Handle `BrokenCircuitException` → return HTTP 503 with prescribed message
- [ ] Implement malformed tool call handling: log WARN; return fallback prompt string
- [ ] Implement `POST /api/intake/submit`: set `submitted_at`, write audit log, HTTP 200
- [ ] Log every LLM call metadata (model, tokens, actor_id, timestamp) per AIR-S03
- [ ] Register all services as scoped in `Program.cs`
