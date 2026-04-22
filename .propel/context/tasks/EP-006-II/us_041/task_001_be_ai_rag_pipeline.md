---
title: "Task — BE/AI RAG Pipeline — Overlapping Chunking, nomic-embed-text Embeddings, pgvector Retrieval, MMR Re-ranking & Confidence Gating"
task_id: task_001
story_id: us_041
epic: EP-006-II
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — BE/AI RAG Pipeline — Overlapping Chunking, nomic-embed-text Embeddings, pgvector Retrieval, MMR Re-ranking & Confidence Gating

## Requirement Reference

- **User Story**: us_041
- **Story Location**: .propel/context/tasks/EP-006-II/us_041/us_041.md
- **Acceptance Criteria**:
  - AC-1: Raw text from PdfPig (us_040) split into ≈512-token segments with 51-token (10%) overlap; token counting consistent with nomic-embed-text tokenizer; chunk boundaries avoid mid-sentence splits where possible; text < 512 tokens treated as single chunk; chunks held in memory only — NOT persisted as separate DB records (AIR-R01)
  - AC-2: Job calls Ollama `nomic-embed-text` via `POST http://localhost:11434/api/embeddings` per chunk; produces 768-dim vector; stored in memory alongside source text; after `extracted_clinical_data` rows are persisted, truncate vector to first 384 dims and write to `extracted_clinical_data.embedding` (vector(384) — DR-007); all embedding calls within 30 s p90 budget (AIR-002, AIR-Q02)
  - AC-3: For each of 5 field types: generate field-specific query embedding; execute pgvector cosine similarity `SELECT chunk_text, 1 - (embedding <=> query_vector) AS score FROM chunk_store WHERE patient_id = {patient_id} ORDER BY score DESC LIMIT 5`; only chunks with `score >= 0.65` included; if < 2 chunks meet threshold → INSERT `audit_logs (action=LowConfidenceRetrieval, field_type, chunk_count)` and mark field as `_NeedsReview` rather than proceeding with LLM call (AIR-003, AIR-R02, AIR-S04 — `patient_id` WHERE enforced on all pgvector queries)
  - AC-4: Top-5 retrieved chunks re-ranked using MMR with diversity factor 0.3; `MMR_score = 0.7 × similarity(chunk, query) - 0.3 × max_similarity(chunk, already_selected)`; iteratively select until 5 chunks chosen or set exhausted; assembled as LLM context for that field type; LLM invoked once per field type with MMR-ranked context (AIR-R03)
  - AC-5: Raw LLM response validated against field-type JSON schema (TR-017); schema-invalid → field flagged `Extraction Failed`; schema-valid but `confidence_score < 0.6` → INSERT `extracted_clinical_data` with `field_type={type}_NeedsReview` (AIR-Q03, AIR-Q04)

- **Edge Cases**:
  - Edge Case: `nomic-embed-text` error for a chunk → retry once; second failure → entire document `upload_status=Failed`; `audit_logs (action=EmbeddingFailed, chunk_index=N)`; no partial embeddings persisted
  - Edge Case: pgvector returns 0 chunks ≥ 0.65 for all 5 field types → all flagged `_NeedsReview`; `upload_status=Extracted` (pipeline ran); `extracted_clinical_data` rows inserted with empty `field_value` and `_NeedsReview` types
  - Edge Case: MMR produces < 2 chunks after diversity filtering → LLM invoked with available chunks (even 1); confidence threshold in AC-5 gates quality
  - Edge Case: Total budget approaches 25 s → skip remaining field types; mark as `_NeedsReview`; `audit_logs (action=ExtractionBudgetExceeded, processed_field_types=[...])`; NFR-003 honoured
  - Edge Case: `extracted_clinical_data.embedding` is vector(384) but nomic returns 768 dims → truncate to first 384 dims consistently; same truncation applied to query vectors

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
| PDF Extraction | PdfPig (MIT) | TR-009 latest stable |
| Embedding Model | Ollama `nomic-embed-text` (local) | TR-007 |
| Vector Store | pgvector extension (PostgreSQL 16) | latest |
| ORM | Entity Framework Core + Npgsql.EntityFrameworkCore.PostgreSQL | 9 |
| JSON Validation | System.Text.Json + JsonSchema.Net | latest |
| Logging | Serilog | latest |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | Yes |
| **AIR Requirements** | AIR-R01 (512-token chunks, 51-token overlap), AIR-002 (nomic-embed-text embeddings), AIR-003 (cosine similarity ≥ 0.65, top-5 retrieval), AIR-R02 (pgvector top-5 retrieval), AIR-R03 (MMR re-ranking diversity=0.3), AIR-Q02 (embed+retrieve+generate within 30 s p90), AIR-Q03 (JSON schema validation), AIR-Q04 (confidence < 0.6 → NeedsReview), AIR-S04 (patient_id ACL on all pgvector queries) |
| **AI Pattern** | RAG — chunk → embed → retrieve (pgvector cosine) → MMR re-rank → LLM generate → schema validate → confidence gate |
| **Prompt Template Path** | `Server/Features/Documents/Prompts/extraction-prompt.txt` (per-field-type prompts with MMR context injection) |
| **Guardrails Config** | Chunk size: 512 tokens; overlap: 51 tokens; similarity threshold: 0.65; min chunks: 2; MMR diversity: 0.3; confidence threshold: 0.6; budget cap: 25 s; segment cap: single doc |
| **Model Provider** | Ollama local (`nomic-embed-text` for embeddings; `llama3.2:3b-instruct-q8_0` for generation); PHI never leaves deployment boundary |

> **CRITICAL — AI Implementation Requirements:**
> - **MUST** enforce `patient_id` WHERE clause on ALL pgvector queries (AIR-S04) — cross-patient data leakage via vector similarity is a PHI security violation
> - **MUST** truncate 768-dim embeddings to 384 dims consistently for both stored vectors and query vectors
> - **MUST** implement time-budget monitoring; skip remaining field types and mark `_NeedsReview` if approaching 25 s
> - **MUST** validate all LLM responses against JSON schema before INSERT (AIR-Q03)
> - **MUST** apply confidence gating: `confidence_score < 0.6` → `{type}_NeedsReview` (AIR-Q04)
> - **MUST** retry embedding calls once; permanent failure on second attempt → fail document
> - **MUST** log prompts/responses without PHI (PII-scrubbed from Serilog output)

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

Upgrade the `ExtractionJob` (us_040) with a full RAG retrieval layer. The pipeline: (1) chunks PdfPig text into 512-token overlapping segments, (2) generates 768-dim vector embeddings via Ollama `nomic-embed-text` (truncated to 384 dims for pgvector storage), (3) retrieves the top-5 most similar chunks per field type via pgvector cosine similarity with a 0.65 threshold, (4) re-ranks retrieved chunks using MMR (diversity=0.3), and (5) invokes the LLM once per field type with the re-ranked context. Schema validation (TR-017) and confidence gating (AIR-Q04) follow. The entire pipeline must stay within the 30 s p90 SLA (NFR-003) with a 25 s internal trip-wire that marks remaining fields as `_NeedsReview` rather than timing out.

---

## Dependent Tasks

- us_040 task_001 — `ExtractionJob` base pipeline (PdfPig text extraction, Ollama LLM call, `extracted_clinical_data` INSERT); this task adds the RAG layer between the PdfPig step and the LLM call
- US_016 (Foundational EP-DATA-II) — `extracted_clinical_data.embedding` (vector(384)) column must exist; pgvector extension enabled on PostgreSQL 16

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Documents/Services/ChunkingService.cs` | CREATE | 512-token split; 51-token overlap; sentence-boundary respect |
| `Server/Features/Documents/Services/EmbeddingService.cs` | CREATE | Ollama `nomic-embed-text` HTTP call; 768→384 dim truncation; single-retry on failure |
| `Server/Features/Documents/Services/PgVectorRetrievalService.cs` | CREATE | pgvector cosine query per field type; 0.65 threshold; patient_id ACL; `_NeedsReview` path |
| `Server/Features/Documents/Services/MmrRerankingService.cs` | CREATE | MMR algorithm; diversity factor 0.3; iterative selection |
| `Server/Features/Documents/Services/ExtractionBudgetMonitor.cs` | CREATE | Tracks elapsed ms since job start; returns `bool IsBudgetExceeded(int warningThresholdMs=25000)` |
| `Server/Features/Documents/Jobs/ExtractionJob.cs` | MODIFY | Insert RAG steps between PdfPig extraction and LLM invocation; integrate budget monitor; update per-field-type embedding INSERT |

---

## Implementation Plan

1. Implement `ChunkingService.Split(text, chunkTokens=512, overlapTokens=51)`: use whitespace + sentence-end heuristic (`[.!?]\s`) to avoid mid-sentence splits; if total < 512 tokens return single chunk; return `List<string>`
2. Implement `EmbeddingService.GetEmbeddingAsync(text)`: POST `{ "model": "nomic-embed-text", "prompt": text }` to `{OllamaBaseUrl}/api/embeddings`; parse `response.embedding` float array; truncate to first 384 elements; on `HttpRequestException` retry once (immediate); second failure → throw `EmbeddingFailedException`
3. Implement `PgVectorRetrievalService.RetrieveAsync(queryEmbedding, patientId, fieldType)`: execute raw SQL via `DbContext.Database.ExecuteSqlRawAsync` with parameterised query: `SELECT chunk_text, 1 - (embedding <=> @queryVector) AS score FROM extracted_clinical_data WHERE patient_id = @patientId AND score >= 0.65 ORDER BY score DESC LIMIT 5`; if result count < 2 → INSERT `audit_logs { action='LowConfidenceRetrieval', field_type, chunk_count }`; return empty list to trigger `_NeedsReview` path
4. Implement `MmrRerankingService.Rerank(chunks, queryVector, diversityFactor=0.3)`: iterate candidate set; score each as `0.7 × cosine(chunk, query) - 0.3 × max cosine(chunk, already_selected)`; append highest scorer to selected list; repeat until 5 selected or candidates exhausted; return ordered selected list
5. Implement `ExtractionBudgetMonitor`: wrap `Stopwatch`; expose `ElapsedMs` and `IsApproachingBudget(25000)`
6. Modify `ExtractionJob.Execute()` to insert RAG steps after `PdfTextExtractorService.ExtractText()`:
   a. `ChunkingService.Split(rawText)` → memory-only list
   b. For each chunk: `EmbeddingService.GetEmbeddingAsync(chunk)` → store `(chunk_text, vector[384])` in memory list; on `EmbeddingFailedException` → fail document (us_040 fail path)
   c. Generate per-field-type query embedding (5 field-query strings: e.g., `"patient vital signs blood pressure pulse temperature"`)
   d. Per field type: `PgVectorRetrievalService.RetrieveAsync(queryVector, patientId, fieldType)` → if empty (< 2 threshold) → mark `_NeedsReview`; else → `MmrRerankingService.Rerank(chunks, queryVector)` → assemble LLM context
   e. `ExtractionBudgetMonitor.IsApproachingBudget()` check before each field type; if true → mark remaining as `_NeedsReview`; `audit_logs ExtractionBudgetExceeded`
   f. After all `extracted_clinical_data` rows inserted: UPDATE each row's `.embedding` with the truncated 384-dim vector from memory
7. Ensure `patient_id` is passed as SQL parameter (never interpolated) on all pgvector queries (AIR-S04)

---

## Current Project State

```
Server/Features/Documents/
├── DocumentsController.cs
├── DocumentUploadService.cs
├── IExtractionJobService.cs
├── Jobs/
│   └── ExtractionJob.cs           ← MODIFY (us_040 base)
├── Services/
│   ├── PdfTextExtractorService.cs
│   ├── TokenBudgetService.cs      ← replaced by ChunkingService (RAG version)
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
| CREATE | `Server/Features/Documents/Services/ChunkingService.cs` | 512-token overlap chunking; sentence-boundary heuristic |
| CREATE | `Server/Features/Documents/Services/EmbeddingService.cs` | Ollama nomic-embed-text HTTP; 768→384 truncation; single retry |
| CREATE | `Server/Features/Documents/Services/PgVectorRetrievalService.cs` | pgvector cosine query; patient_id ACL; 0.65 threshold; LowConfidenceRetrieval audit |
| CREATE | `Server/Features/Documents/Services/MmrRerankingService.cs` | MMR re-ranking; diversity=0.3 |
| CREATE | `Server/Features/Documents/Services/ExtractionBudgetMonitor.cs` | Stopwatch wrapper; 25 s trip-wire |
| MODIFY | `Server/Features/Documents/Jobs/ExtractionJob.cs` | Insert RAG pipeline steps; integrate budget monitor |

---

## External References

- [Ollama REST API — /api/embeddings](https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings)
- [pgvector — cosine distance operator `<=>`](https://github.com/pgvector/pgvector)
- [Maximal Marginal Relevance — original Carbonell & Goldstein paper](https://dl.acm.org/doi/10.1145/290941.291025)
- [AIR-R01/R02/R03 traceability](.propel/context/docs/design.md)

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] **[AI Tasks]** Chunking produces ≈512-token segments with 51-token overlap; single-chunk path for < 512-token documents
- [ ] **[AI Tasks]** Embedding call returns 768-dim vector; truncated to 384 before INSERT; query vectors also truncated consistently
- [ ] **[AI Tasks]** All pgvector queries include `patient_id = @patientId` parameter — no cross-patient data returned
- [ ] **[AI Tasks]** Cosine score ≥ 0.65 filter applied; < 2 qualifying chunks → `_NeedsReview` + `LowConfidenceRetrieval` audit log
- [ ] **[AI Tasks]** MMR re-ranking produces diversity; identical-content chunks not selected twice
- [ ] **[AI Tasks]** 25 s budget trip-wire fires; remaining fields marked `_NeedsReview`; `ExtractionBudgetExceeded` audit log written
- [ ] **[AI Tasks]** `confidence_score < 0.6` in LLM response → `{type}_NeedsReview` field_type in `extracted_clinical_data`
- [ ] **[AI Tasks]** nomic-embed-text failure retry: single retry fires; second failure → document `upload_status=Failed`
- [ ] **[AI Tasks]** Audit logging verified — PHI absent from Serilog output and `audit_logs.error_message`
- [ ] EmbeddingService, ChunkingService, MmrRerankingService registered in DI; ExtractionJob successfully resolves all new dependencies

---

## Implementation Checklist

- [ ] Implement `ChunkingService`: token count by char/4 approximation consistent with nomic-embed-text; sentence-boundary split; 51-token overlap append; return `List<string>`
- [ ] Implement `EmbeddingService`: POST `{OllamaBaseUrl}/api/embeddings`; parse `response.embedding[]`; truncate `[..384]`; single retry on `HttpRequestException`; throw `EmbeddingFailedException` on second failure
- [ ] Implement `PgVectorRetrievalService`: parameterised SQL (`@patientId`, `@queryVector` — never interpolated); cosine distance `<=>` operator; threshold 0.65; return empty list + audit log when < 2 results (AIR-S04 enforced)
- [ ] Implement `MmrRerankingService`: static `CosineSimilarity(float[], float[])` helper; MMR loop with diversity=0.3; handle edge case of < 2 candidates
- [ ] Implement `ExtractionBudgetMonitor`: `Stopwatch.StartNew()` in constructor; `IsApproachingBudget(int ms)` returns `ElapsedMilliseconds >= ms`
- [ ] Modify `ExtractionJob`: insert RAG steps (chunk → embed → retrieve → MMR → LLM per field type); budget check before each field; post-INSERT embedding column update; maintain us_040 fail path for EmbeddingFailedException
- [ ] Register all new services in `Program.cs` DI container
- [ ] **[AI Tasks - MANDATORY]** Reference prompt templates from AI References table during implementation
- [ ] **[AI Tasks - MANDATORY]** Implement and test all guardrails (patient_id ACL, threshold, budget, confidence gating) before marking task complete
- [ ] **[AI Tasks - MANDATORY]** Verify AIR-S04 (no cross-patient vector queries), AIR-Q02 (30 s p90), AIR-Q03/Q04 (schema + confidence) requirements are met
