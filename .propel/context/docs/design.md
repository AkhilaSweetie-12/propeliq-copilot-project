---
title: Architecture Design — Unified Patient Access & Clinical Intelligence Platform
version: 1.0.0
date: 2026-04-17
status: Draft
source: .propel/context/docs/spec.md
workflow: design-architecture
---

# Architecture Design

## Project Overview

The Unified Patient Access & Clinical Intelligence Platform is a Phase 1 standalone healthcare web application serving Patients, Staff (front desk / call centre), and Admin users. Its two pillars are: (1) a patient-centric appointment booking system with intelligent no-show reduction capabilities, and (2) a Trust-First clinical intelligence engine that extracts structured data from uploaded PDF clinical documents, surfaces a de-duplicated 360-Degree Patient View, and suggests ICD-10 / CPT codes for Staff verification. The system is built entirely on free and open-source technology, hosted on GitHub Codespaces, and must be fully HIPAA-compliant.

## Architecture Goals

- Architecture Goal 1: Enforce strict HIPAA compliance — all PHI processing occurs within the deployment boundary (no data leaves to external paid services); TLS 1.2+ in transit, column-level encryption at rest.
- Architecture Goal 2: Deliver a Trust-First AI design — every AI output (extracted fields, code suggestions, conversational intake) requires explicit Staff verification before finalisation; no AI decision is acted upon silently.
- Architecture Goal 3: Use exclusively free and open-source tools across all layers — runtime, AI inference, storage, job scheduling, PDF generation, and notifications — with no dependency on paid cloud infrastructure.
- Architecture Goal 4: Support exactly-once semantics for critical state mutations — preferred slot swap, waitlist promotion, and arrival marking — via database-level row locking.
- Architecture Goal 5: Maintain a complete, immutable, tamper-evident audit trail for all PHI-touching actions to satisfy HIPAA audit requirements.
- Architecture Goal 6: Achieve 99.9% platform uptime through graceful degradation — external integrations (Google Calendar, SMS gateway, Outlook) must fail silently without blocking core booking workflows.

## Non-Functional Requirements

### Performance

- NFR-001: System MUST respond to all synchronous REST API requests (read and write) with a p95 latency of 2 seconds or less under normal operating load.
- NFR-002: System MUST serve the initial React SPA shell (HTML + critical CSS) with a Time-to-Interactive below 3 seconds on a standard broadband connection.
- NFR-003: System MUST complete AI-driven clinical document extraction (per uploaded PDF) and return structured field results within 30 seconds at the p90 percentile.
- NFR-004: System MUST complete AI-driven ICD-10 and CPT code suggestion generation for a fully aggregated patient view within 15 seconds at the p90 percentile.

### Security

- NFR-005: System MUST handle, transmit, and store all Protected Health Information (PHI) in full compliance with HIPAA Privacy and Security Rules.
- NFR-006: System MUST encrypt all network traffic using TLS 1.2 or higher; plaintext HTTP connections MUST be rejected or redirected.
- NFR-007: System MUST enforce column-level or table-level encryption for all PHI fields stored in PostgreSQL, using AES-256 or equivalent.
- NFR-008: System MUST enforce Role-Based Access Control (RBAC) with three roles — Patient, Staff, Admin — and reject any request that attempts to access resources outside the caller's role boundary.
- NFR-009: System MUST automatically expire authenticated sessions after 15 consecutive minutes of inactivity and require re-authentication.
- NFR-010: System MUST store all PHI solely on the platform's local infrastructure; no PHI MUST be transmitted to any external third-party AI or cloud service.

### Reliability & Availability

- NFR-011: System MUST target 99.9% monthly uptime (measured as HTTP 2xx / 3xx availability on the health endpoint), equating to fewer than 45 minutes of unplanned downtime per month.
- NFR-012: System MUST implement at least one retry attempt (with a minimum 5-minute delay) for failed SMS and email notification deliveries, and log each failure to the audit trail.
- NFR-013: System MUST implement exactly-once processing for preferred-slot swap assignments using PostgreSQL advisory locks or SELECT FOR UPDATE, preventing double-assignment under concurrent load.
- NFR-014: System MUST degrade gracefully when external integrations (Google Calendar, Outlook, SMS, email) are unavailable — core booking and queue workflows MUST continue operating without depending on these services.

### Scalability

- NFR-015: System MUST support at least 100 concurrent authenticated users during Phase 1 without exceeding the p95 API latency defined in NFR-001.
- NFR-016: System MUST design the AI pipeline as an asynchronously queued background job (not inline with API requests), so that high extraction volumes do not block user-facing API endpoints.

### Maintainability & Compliance

- NFR-017: System MUST maintain a complete, append-only, immutable audit log of all PHI-touching create, read, update, and delete operations, retaining records for a minimum of 6 years per HIPAA requirements.
- NFR-018: System MUST apply all database schema changes through versioned migration scripts (using a migration tool), with no manual schema alterations permitted in any environment.

## Data Requirements

- DR-001: System MUST define a `users` entity with fields: `user_id` (UUID PK), `email` (unique, encrypted), `password_hash`, `role` (enum: Patient | Staff | Admin), `status` (enum: Active | Inactive), `created_at`, `updated_at`.
- DR-002: System MUST define an `appointment_slots` entity with fields: `slot_id` (UUID PK), `slot_date`, `slot_time`, `duration_minutes`, `is_available` (boolean), `created_at`.
- DR-003: System MUST define an `appointments` entity with fields: `appointment_id` (UUID PK), `patient_id` (FK → users), `slot_id` (FK → appointment_slots), `status` (enum: Confirmed | Arrived | Cancelled | NoShow), `preferred_slot_id` (FK → appointment_slots, nullable), `booking_type` (enum: Online | WalkIn), `created_by` (FK → users), `created_at`, `updated_at`.
- DR-004: System MUST define a `waitlist_entries` entity with fields: `entry_id` (UUID PK), `patient_id` (FK → users), `slot_id` (FK → appointment_slots), `position` (integer), `requested_at`, `status` (enum: Waiting | Fulfilled | Cancelled).
- DR-005: System MUST define a `patient_intakes` entity with fields: `intake_id` (UUID PK), `patient_id` (FK → users), `intake_method` (enum: AI | Manual), `demographics` (encrypted JSONB), `medical_history` (encrypted JSONB), `medications` (encrypted JSONB), `allergies` (encrypted JSONB), `chief_complaint` (encrypted TEXT), `submitted_at`, `updated_at`.
- DR-006: System MUST define a `clinical_documents` entity with fields: `document_id` (UUID PK), `patient_id` (FK → users), `file_name` (TEXT), `file_path` (TEXT, server-side storage path), `upload_status` (enum: Pending | Extracted | Failed), `uploaded_by` (FK → users), `uploaded_at`.
- DR-007: System MUST define a `extracted_clinical_data` entity with fields: `extract_id` (UUID PK), `document_id` (FK → clinical_documents), `patient_id` (FK → users), `field_type` (enum: Vital | Medication | Allergy | Diagnosis | SurgicalHistory), `field_value` (encrypted TEXT), `source_text` (TEXT), `extracted_at`, `embedding` (vector(384), nullable — for pgvector similarity).
- DR-008: System MUST define a `patient_view_360` entity with fields: `view_id` (UUID PK), `patient_id` (FK → users, unique), `aggregated_data` (encrypted JSONB), `conflict_flags` (JSONB), `is_verified` (boolean), `verified_by` (FK → users, nullable), `verified_at` (nullable), `last_updated_at`.
- DR-009: System MUST define a `medical_code_suggestions` entity with fields: `suggestion_id` (UUID PK), `patient_id` (FK → users), `code_type` (enum: ICD10 | CPT), `suggested_code` (TEXT), `code_description` (TEXT), `source_evidence` (TEXT), `confidence_score` (DECIMAL), `status` (enum: Pending | Accepted | Modified | Rejected), `reviewed_by` (FK → users, nullable), `reviewed_at` (nullable), `final_code` (TEXT, nullable).
- DR-010: System MUST define an `audit_logs` entity with fields: `log_id` (UUID PK), `actor_id` (FK → users), `actor_role` (TEXT), `action_type` (TEXT), `entity_type` (TEXT), `entity_id` (UUID), `change_summary` (TEXT), `ip_address` (TEXT), `occurred_at` (TIMESTAMPTZ). This table MUST be append-only with no UPDATE or DELETE permissions granted.
- DR-011: System MUST define a `notifications` entity tracking reminder delivery: `notification_id` (UUID PK), `appointment_id` (FK → appointments), `channel` (enum: SMS | Email), `status` (enum: Pending | Sent | Failed), `attempt_count` (integer), `scheduled_at`, `sent_at` (nullable), `error_message` (nullable).
- DR-012: System MUST retain all PHI-related records (patient intakes, clinical documents, extracted data, audit logs) for a minimum of 6 years from the date of creation, with controlled archival after retention expiry.
- DR-013: System MUST implement daily automated database backups with a minimum 7-day retention window and point-in-time recovery capability via PostgreSQL WAL archiving.
- DR-014: System MUST manage all database schema changes via sequential, versioned migration scripts (using Entity Framework Core migrations) executed automatically on application startup in all environments.

### Domain Entities

- **User**: Represents a platform actor (Patient, Staff, or Admin). Holds authentication credentials, role assignment, and account status. Soft-delete only (status = Inactive).
- **AppointmentSlot**: Represents a schedulable time block. Tracks availability and is the target of booking, waitlist, and preferred-swap operations.
- **Appointment**: Represents a confirmed booking linking a patient to a slot. Holds booking type, arrival status, and preferred swap target.
- **WaitlistEntry**: Represents a patient's queue position for a specific slot. Ordered by `requested_at` for fair assignment.
- **PatientIntake**: Stores all structured intake data submitted by the patient (AI-assisted or manual). JSONB fields for flexibility; all PHI fields encrypted.
- **ClinicalDocument**: Metadata record for each uploaded PDF. References server-side file storage path. Tracks extraction processing status.
- **ExtractedClinicalData**: Normalized structured field extracted from a clinical document by the AI pipeline. Includes source text and optional vector embedding for RAG retrieval.
- **PatientView360**: Aggregated, de-duplicated patient health summary. Single record per patient. Holds conflict flags and verification state.
- **MedicalCodeSuggestion**: AI-generated ICD-10 or CPT code suggestion linked to a patient. Stores source evidence, confidence score, and Staff review decision for agreement-rate tracking.
- **AuditLog**: Immutable append-only log of all PHI-touching actions. No UPDATE or DELETE operations permitted on this table.
- **Notification**: Tracks all scheduled and delivered reminder messages (SMS and email) for retry and delivery-failure auditing.

## AI Consideration

**Status:** Applicable

**Rationale:** The upstream spec.md contains 6 `[AI-CANDIDATE]` and 5 `[HYBRID]` tagged functional requirements across three AI-driven capabilities: (1) AI-assisted conversational patient intake (FR-006, FR-008), (2) clinical document extraction and 360-Degree Patient View aggregation (FR-027, FR-030), and (3) ICD-10 / CPT medical code mapping (FR-031, FR-032, FR-033). All AI processing MUST occur on-premise using free, open-source models to preserve HIPAA compliance per FR-035 and NFR-010.

**GenAI Fit Classification:**

| Feature | AI Fit Score (1-5) | Classification | Rationale |
|---|---|---|---|
| Conversational Patient Intake (FR-006) | 5 | HIGH-FIT | Natural language dialogue to collect structured health fields — canonical NLU + extraction task |
| Intake Method Switch Data Preservation (FR-008) | 2 | HYBRID | AI assists collection; rule-based logic handles field mapping and preservation |
| Clinical Document Structured Extraction (FR-027) | 5 | HIGH-FIT | Unstructured PDF text → structured clinical fields — RAG extraction over document chunks |
| Data Conflict Detection (FR-030) | 3 | HYBRID | AI flags potential conflicts; deterministic rules surface them; Staff confirms |
| ICD-10 Code Mapping (FR-031) | 4 | HIGH-FIT | Classification over clinical text against a known code taxonomy — RAG retrieval pattern |
| CPT Code Mapping (FR-032) | 4 | HIGH-FIT | Procedure code extraction from clinical narrative — same RAG pattern as ICD-10 |
| Trust-First Code Verification (FR-033) | 3 | HYBRID | AI suggests with evidence; Staff verifies — agreement rate tracked |
| No-Show Risk Scoring (FR-034) | 2 | HYBRID | Weighted rule engine; AI not required; deterministic scoring from historical features |

## AI Requirements

### AI Functional Requirements

- AIR-001: System MUST implement a conversational intake NLU pipeline that accepts free-text patient responses, extracts structured intake fields (demographics, medical history, medications, allergies, chief complaint), and returns a structured JSON payload to the backend for persistence. Traces to: FR-006, NFR-010.
- AIR-002: System MUST extract full text from uploaded PDF clinical documents using a PDF parsing library, chunk the text into overlapping segments of approximately 512 tokens with 10% overlap, and generate vector embeddings for each chunk using a locally-hosted embedding model. Traces to: FR-027, DR-007.
- AIR-003: System MUST retrieve the top-5 most semantically relevant document chunks via cosine similarity search in pgvector for each target extraction field type (vitals, medications, allergies, diagnoses, surgical history), and pass those chunks as context to the local LLM for structured field extraction. Traces to: FR-027, NFR-003.
- AIR-004: System MUST map ICD-10 diagnostic codes from aggregated patient clinical data by embedding the patient summary, performing cosine similarity search against a pre-indexed ICD-10 reference vector store, and using the local LLM to confirm or refine the top-5 candidate codes with supporting source evidence. Traces to: FR-031, NFR-004.
- AIR-005: System MUST map CPT procedure codes from aggregated patient clinical data using the same RAG pipeline as AIR-004 applied to a pre-indexed CPT reference vector store. Traces to: FR-032, NFR-004.
- AIR-006: System MUST implement a Tool Calling pattern for the conversational intake flow, where the LLM invokes pre-defined tools (`save_demographic`, `save_medication`, `save_allergy`, `save_chief_complaint`) to incrementally persist structured fields as the conversation progresses. Traces to: FR-006, FR-008.

### AI Quality Requirements

- AIR-Q01: System MUST track and report an AI-Human Agreement Rate metric for ICD-10 and CPT code suggestions, defined as the percentage of AI-suggested codes accepted by Staff without modification. This metric MUST be stored per verification session and reported in aggregate. The target is >98%. Traces to: FR-033, NFR-001.
- AIR-Q02: System MUST complete the RAG extraction pipeline (embed → retrieve → generate) for a single document chunk set within 30 seconds at the p90 percentile, as measured from document queuing to structured field availability. Traces to: NFR-003.
- AIR-Q03: System MUST validate all LLM-generated extraction outputs against a defined JSON schema before persisting to the database; responses failing schema validation MUST be flagged as "Extraction Failed" and require manual Staff entry. Traces to: FR-027, NFR-010.
- AIR-Q04: System MUST reject LLM extraction responses where the model returns a confidence indicator below 0.6, flagging the affected field as "Needs Review" rather than auto-populating the patient view. Traces to: FR-030, FR-033.

### AI Safety Requirements

- AIR-S01: System MUST ensure that all LLM inference — for intake, extraction, and coding — is performed exclusively via a locally-hosted model server (Ollama) running within the platform's deployment boundary. No PHI or patient data MUST be transmitted to any external API endpoint. Traces to: NFR-010, NFR-005.
- AIR-S02: System MUST redact patient identifiers (name, date of birth, address, insurance ID) from LLM prompts before invocation, substituting them with opaque internal identifiers (`[PATIENT-ID]`, `[DOB-REDACTED]`). Traces to: NFR-005, NFR-007.
- AIR-S03: System MUST log every LLM prompt and response payload — excluding direct PHI per AIR-S02 — to the audit log with actor ID, timestamp, model name, and token counts, retaining logs for the HIPAA-mandated 6-year period. Traces to: NFR-017, DR-010.
- AIR-S04: System MUST enforce document ACL filtering in pgvector retrieval queries, ensuring that only chunks belonging to the target patient's documents are returned in similarity search results. Traces to: NFR-008, DR-007.

### AI Operational Requirements

- AIR-O01: System MUST enforce a maximum token budget of 4,096 input tokens per LLM inference request. Requests exceeding this limit MUST be split into smaller chunk batches before invocation. Traces to: NFR-001, NFR-016.
- AIR-O02: System MUST implement a circuit breaker for the Ollama inference endpoint: after 3 consecutive failures within a 60-second window, the circuit MUST open and all queued AI jobs MUST be retried after a configurable cool-down period of 5 minutes. Traces to: NFR-014, NFR-011.
- AIR-O03: System MUST record the model name and version used for each AI inference call in the extraction and coding result records, enabling reproducibility and model-version rollback analysis. Traces to: AIR-Q01, NFR-017.

### RAG Pipeline Requirements

- AIR-R01: System MUST chunk each extracted PDF document text into segments of approximately 512 tokens with a 51-token (10%) overlap to preserve sentence context at chunk boundaries. Traces to: AIR-002.
- AIR-R02: System MUST retrieve the top-5 document chunks with a cosine similarity score of 0.65 or higher from pgvector for each extraction query. If fewer than 2 chunks meet the threshold, the extraction job MUST be flagged as low-confidence. Traces to: AIR-003.
- AIR-R03: System MUST re-rank retrieved chunks using Maximal Marginal Relevance (MMR) with a diversity factor of 0.3 to reduce redundant context before LLM invocation. Traces to: AIR-003.

### AI Architecture Pattern

**Selected Pattern:** Hybrid — RAG + Tool Calling

**Rationale:**

| Workflow | Pattern | Justification |
|---|---|---|
| Clinical Document Extraction (AIR-002, AIR-003) | RAG | Unstructured PDF text requires grounding against retrieved document chunks; citation/source attribution is mandatory per FR-027 |
| ICD-10 / CPT Code Mapping (AIR-004, AIR-005) | RAG | Code suggestions must be grounded in indexed ICD-10/CPT reference taxonomy; similarity retrieval prevents hallucinated codes |
| Conversational Patient Intake (AIR-001, AIR-006) | Tool Calling | Multi-turn conversation requires the model to call structured save tools; pure generation would miss the persistence requirement |
| Data Conflict Detection (FR-030) | Deterministic | Contradiction detection across structured fields is a rule-based comparison, not an AI problem |
| No-Show Risk Scoring (FR-034) | Deterministic | Weighted rule engine over numeric features; AI adds no value at this scoring complexity |

## Architecture and Design Decisions

- **Decision 1 — N-Tier Monolith with Modular Boundaries**: Adopt a structured N-Tier monolith (React SPA → .NET ASP.NET Core API → PostgreSQL) rather than microservices for Phase 1. GitHub Codespaces imposes container resource limits; a single deployable API unit reduces operational overhead. Module boundaries (Booking, Intake, Clinical, Coding, Notifications) are enforced through feature folders and internal service interfaces, enabling future extraction to microservices if needed.

- **Decision 2 — Local LLM via Ollama (No External AI APIs)**: All AI inference runs through an Ollama server co-hosted within the deployment environment, serving Llama 3.2 3B Instruct. This is the only HIPAA-safe path given the prohibition on paid external cloud services; PHI never leaves the boundary. Ollama exposes an OpenAI-compatible REST API, enabling straightforward .NET HttpClient integration.

- **Decision 3 — pgvector for Vector Storage**: Rather than introducing a separate vector database (e.g., Chroma, Pinecone), the PostgreSQL pgvector extension is used for embedding storage and cosine similarity search. This eliminates an additional infrastructure dependency, allows vector queries to be joined with relational patient data in a single SQL query, and applies PostgreSQL's row-level security for ACL filtering (AIR-S04).

- **Decision 4 — Asynchronous AI Pipeline via Hangfire**: All AI extraction and code-mapping jobs are processed asynchronously using Hangfire (PostgreSQL backend) to prevent long-running LLM calls from blocking user-facing API endpoints (NFR-016). Jobs are enqueued on document upload or code request and processed by a dedicated background worker queue.

- **Decision 5 — JWT + Upstash Redis for Session Management**: Short-lived JWT access tokens (15-minute TTL, matching NFR-009) paired with rotating refresh tokens stored in Upstash Redis. A Redis blocklist ensures revoked tokens cannot be replayed. PHI is never placed in JWT claims or Redis values.

- **Decision 6 — Prefer Slot Swap via PostgreSQL SELECT FOR UPDATE**: The preferred-slot swap operation acquires a row-level lock on the target `appointment_slots` record before executing the swap transaction, preventing double-assignment under concurrent requests (NFR-013). Hangfire ensures exactly-once job execution for the swap trigger.

- **Decision 7 — QuestPDF for Appointment Confirmation Generation**: PDF appointment confirmations are generated using QuestPDF Community (MIT licence), a fluent .NET PDF library requiring no external processes. This avoids Wkhtmltopdf binary dependencies that are incompatible with GitHub Codespaces container constraints.

- **Decision 8 — nomic-embed-text Embeddings via Ollama**: The `nomic-embed-text` embedding model (768-dimension) is served by Ollama alongside the LLM. This keeps the entire AI stack within a single process with no separate Python service, simplifying GitHub Codespaces deployment.

## Technology Stack

| Layer | Technology | Version | Justification (NFR/DR/AIR) |
|---|---|---|---|
| Frontend | React + TypeScript + TailwindCSS | React 18, TypeScript 5 | BRD mandate; TypeScript enforces type safety (NFR-008); Tailwind enables accessible, responsive UI (NFR-002) |
| Mobile | N/A | — | Out of scope for Phase 1 |
| Backend | ASP.NET Core Web API (.NET 9) | .NET 9 LTS | BRD mandate; Minimal API / Controller hybrid; built-in RBAC middleware (NFR-008); high throughput (NFR-001) |
| Database | PostgreSQL 16 + pgvector | PostgreSQL 16, pgvector 0.7 | BRD mandate; pgvector for RAG (AIR-002); row-level locking for swap (NFR-013); JSONB for clinical data (DR-005, DR-008) |
| Caching | Upstash Redis | Latest (Serverless Redis) | BRD mandate; JWT blocklist and session cache (NFR-009); free tier sufficient for Phase 1 (NFR-015) |
| AI / ML | Ollama + Llama 3.2 3B Instruct + nomic-embed-text | Ollama 0.5, Llama 3.2:3b-instruct-q8_0, nomic-embed-text | Free, open-source, local (NFR-010, AIR-S01); OpenAI-compatible REST API; 4K context window (AIR-O01) |
| PDF Parsing | PdfPig | 0.1.9 | MIT licence; pure .NET; no native binary dependencies; compatible with Codespaces (AIR-002) |
| PDF Generation | QuestPDF Community | 2024.x | MIT community licence; fluent .NET API; no binary dependencies; supports complex layouts (FR-016) |
| Background Jobs | Hangfire + Hangfire.PostgreSql | 1.8.x | Free; PostgreSQL job store (reuses existing DB); dashboard UI; reliable retry (NFR-012, NFR-016) |
| Email | MailKit + SMTP | 4.x | MIT licence; full MIME and attachment support; SMTP relay compatible (FR-016, FR-021) |
| SMS | Twilio SDK (free trial) | 7.x | Free trial sufficient for Phase 1 volume; official .NET SDK; fallback logging on failure (FR-020, NFR-012) |
| Calendar | Google.Apis.Calendar.v3 + Microsoft.Graph | Latest stable | Free API tiers; official SDKs; exponential backoff built-in (FR-022, FR-023, NFR-014) |
| Testing | xUnit + Moq + Playwright | xUnit 2.x, Playwright 1.x | xUnit for .NET unit/integration; Moq for mocking; Playwright for E2E (NFR-011) |
| Security | ASP.NET Core Identity + JWT Bearer | .NET 9 built-in | RBAC, password hashing (BCrypt), JWT issuance (NFR-008, NFR-009) |
| Encryption | .NET AES-256 + npgsql pgcrypto | .NET built-in + pgcrypto | Column-level PHI encryption (NFR-007, DR-001) |
| Infrastructure | GitHub Codespaces (devcontainer) | Latest | BRD mandate; free hosting; docker-compose for local parity |
| Monitoring | Serilog + Seq Community | Serilog 3.x, Seq free | Structured logging; free Seq community server; HIPAA-compliant local log storage (NFR-017) |
| Documentation | Swagger / Scalar (OpenAPI) | .NET 9 built-in | API documentation; free; no external dependency |

### Alternative Technology Options

- **Chroma (vector DB)** considered instead of pgvector: Rejected because it introduces a separate Python service and independent persistence layer, adding infrastructure complexity incompatible with GitHub Codespaces resource constraints. pgvector achieves the same result with zero additional services.
- **Quartz.NET** considered instead of Hangfire: Rejected because Hangfire provides a built-in Web dashboard for job monitoring and its PostgreSQL storage driver integrates cleanly with the existing DB. Quartz.NET requires more configuration for the same reliability guarantees.
- **iTextSharp** considered instead of QuestPDF: Rejected because iTextSharp LGPL licence terms require careful attribution and PdfPig (MIT) + QuestPDF (Community MIT) together cover both parsing and generation more cleanly under permissive licences.
- **HuggingFace Transformers (Python)** considered instead of Ollama: Rejected because it requires a separate Python service, complicates the deployment topology, and increases Codespaces resource consumption. Ollama's OpenAI-compatible API allows the .NET backend to call it directly.

### AI Component Stack

| Component | Technology | Purpose |
|---|---|---|
| Model Provider | Ollama 0.5 + Llama 3.2 3B Instruct (Q8_0) | LLM inference for extraction, coding, and conversational intake — runs locally in Codespaces |
| Embedding Model | nomic-embed-text (via Ollama) | 768-dim embeddings for document chunks and ICD-10/CPT reference index (AIR-002, AIR-004) |
| Vector Store | pgvector 0.7 (PostgreSQL extension) | Embedding storage and cosine similarity retrieval with SQL-based ACL filtering (AIR-S04) |
| AI Gateway | None (direct Ollama REST API via .NET HttpClient) | Phase 1 volume does not justify a gateway; circuit breaker implemented in .NET (AIR-O02) |
| Guardrails | Custom JSON Schema Validator (.NET) + PII redaction middleware | Output schema validation (AIR-Q03) and PHI scrubbing from prompts (AIR-S02) |

### Technology Decision

| Metric (from NFR/DR/AIR) | Ollama + Llama 3.2 | HuggingFace Local | GPT4All | Winner |
|---|---|---|---|---|
| HIPAA local-only processing (NFR-010) | 5 — fully local | 5 — fully local | 5 — fully local | Tie |
| GitHub Codespaces compatibility (NFR-011) | 5 — single binary | 3 — pip + CUDA deps | 3 — installer required | Ollama |
| .NET integration (NFR-001) | 5 — REST API | 2 — Python SDK only | 4 — REST API | Ollama |
| Free / open-source (BRD constraint) | 5 — MIT | 5 — Apache 2 | 5 — MIT | Tie |
| Model quality for extraction (AIR-Q01) | 4 — Llama 3.2 3B | 4 — various models | 3 — Phi-3 Mini | Ollama |
| Operational simplicity (NFR-018) | 5 — `ollama run` | 2 — multi-step setup | 3 — GUI installer | Ollama |
| **Weighted Total** | **29** | **21** | **23** | **Ollama** |

| Metric (from DR/AIR) | pgvector | Chroma | FAISS | Winner |
|---|---|---|---|---|
| Zero additional services (NFR-011) | 5 — PostgreSQL ext | 1 — separate service | 3 — file-based | pgvector |
| SQL ACL filtering (AIR-S04) | 5 — native WHERE | 2 — limited | 1 — none | pgvector |
| Production maturity (NFR-011) | 5 — GA, widely used | 3 — evolving | 4 — stable library | pgvector |
| Hybrid relational + vector queries (DR-007) | 5 — single JOIN | 1 — separate query | 1 — separate query | pgvector |
| **Weighted Total** | **20** | **7** | **9** | **pgvector** |

## Technical Requirements

- TR-001: System MUST use React 18 with TypeScript as the frontend framework, implementing the React SPA as a separate build artifact served as static files, justified by NFR-002 (sub-3s TTI) and the BRD technology mandate.
- TR-002: System MUST implement the backend as an ASP.NET Core 9 Web API using the controller-based pattern, with modular feature folders (Booking, Intake, Clinical, Coding, Notifications, Admin) enforcing bounded-context separation. Justified by NFR-001, NFR-008.
- TR-003: System MUST use PostgreSQL 16 with the pgvector extension as the sole primary data store for all relational and vector data, justified by DR-007, AIR-002, NFR-013.
- TR-004: System MUST use Entity Framework Core 9 with Npgsql provider for all relational database access, with all schema changes managed via versioned EF Core migration scripts. Justified by DR-014, NFR-018.
- TR-005: System MUST implement authentication using ASP.NET Core Identity with BCrypt password hashing, issuing short-lived JWT access tokens (15-minute TTL) and rotating refresh tokens stored in Upstash Redis. Justified by NFR-008, NFR-009.
- TR-006: System MUST implement the JWT blocklist and session revocation using Upstash Redis with a TTL matching the token expiry. PHI MUST NOT be stored in any Redis value. Justified by NFR-009, FR-038.
- TR-007: System MUST run all LLM inference via an Ollama server instance co-deployed in the GitHub Codespaces environment, using the `llama3.2:3b-instruct-q8_0` model for extraction and coding tasks and `nomic-embed-text` for embeddings. Justified by NFR-010, AIR-S01.
- TR-008: System MUST implement the AI extraction and coding pipelines as Hangfire background jobs with a dedicated processing queue, preventing LLM latency from blocking user-facing API responses. Justified by NFR-016, AIR-O01.
- TR-009: System MUST use PdfPig (MIT) for server-side PDF text extraction from uploaded clinical documents, with file storage in the local file system under an access-controlled uploads directory. Justified by AIR-002, NFR-010.
- TR-010: System MUST use QuestPDF Community for server-side generation of appointment confirmation PDFs, which are then attached to outbound confirmation emails. Justified by FR-016.
- TR-011: System MUST use MailKit with a configurable SMTP relay (e.g., Gmail SMTP or SMTP2GO free tier) for all transactional email delivery, including appointment confirmations (PDF attachment) and reminder emails. Justified by FR-016, FR-021, NFR-012.
- TR-012: System MUST integrate with the Twilio SMS API (free trial tier) for SMS reminder delivery, with the Twilio Account SID and Auth Token stored as environment secrets, never in source code. Justified by FR-020, NFR-012.
- TR-013: System MUST integrate with Google Calendar API v3 and Microsoft Graph API using free-tier OAuth 2.0 credentials, implementing exponential backoff and a maximum of 3 retry attempts on transient failures. Justified by FR-022, FR-023, NFR-014.
- TR-014: System MUST use Hangfire (PostgreSQL job store) for scheduling recurring reminder jobs and event-triggered jobs (slot swap evaluation, notification retry). Justified by NFR-012, NFR-013, NFR-016.
- TR-015: System MUST use Serilog with a Seq community server as the structured logging sink for application and audit log output, with log entries written synchronously for audit events and asynchronously for application diagnostics. Justified by NFR-017, DR-010.
- TR-016: System MUST implement a PII redaction middleware in the AI pipeline that strips patient-identifiable fields from LLM prompts before invocation, substituting opaque internal reference identifiers. Justified by AIR-S02, NFR-005.
- TR-017: System MUST implement an output JSON schema validator in the AI pipeline that validates all LLM responses against the target extraction schema before database persistence, rejecting malformed outputs. Justified by AIR-Q03.

## Technical Constraints & Assumptions

- The platform is hosted exclusively on GitHub Codespaces (free tier); total container resources are limited (typically 4–8 vCPUs, 8–16 GB RAM). Ollama with Llama 3.2 3B Q8_0 requires approximately 3.5 GB RAM; this must be accounted for in the deployment devcontainer configuration.
- All AI models (Llama 3.2, nomic-embed-text) must be pulled into the Codespaces container on first startup via `ollama pull`; cold-start time may be 2–5 minutes. This is acceptable for Phase 1 non-production deployments.
- The Twilio free trial provides $15 in SMS credit with a verified test number, which is sufficient for Phase 1 demonstration volume. Production scale would require a paid Twilio account.
- Google Calendar and Microsoft Graph API integrations use free-tier credentials subject to daily/monthly quota limits. For Phase 1 patient volumes (estimated < 200 appointments/day), these limits are not expected to be exceeded.
- The ICD-10 and CPT reference code databases must be pre-indexed into pgvector as a one-time setup step during database seeding. The 2026 ICD-10-CM (approximately 70,000 codes) and CPT (approximately 10,000 codes) datasets are publicly available for free from CMS.gov.
- All environment secrets (Twilio, Google, Microsoft, SMTP, JWT signing key, database connection strings) are stored as GitHub Codespaces secrets or `.env` file (excluded from source control via `.gitignore`). No secrets are committed to the repository.
- HIPAA compliance in Phase 1 is achieved through technical controls (encryption, audit logging, access control) and assumes a Business Associate Agreement (BAA) is not required with free-tier tool providers since PHI does not leave the local deployment environment.

## Development Workflow

1. **Environment Setup**: Clone repository into GitHub Codespaces; devcontainer starts PostgreSQL 16 (with pgvector), Ollama (with Llama 3.2 + nomic-embed-text), Upstash Redis (local emulator or remote free tier), and the Seq logging server via docker-compose.
2. **Database Initialisation**: Run `dotnet ef database update` to apply all EF Core migrations, seed the insurance dummy records, and execute the ICD-10 / CPT code vector indexing seed script (one-time, approximately 5–10 minutes for full embedding).
3. **Backend Development**: Implement and test .NET API feature modules using xUnit unit tests (mock Ollama, mock DB) and integration tests against the Codespaces-local PostgreSQL and Hangfire instances.
4. **AI Pipeline Development**: Implement and validate RAG extraction and coding pipelines using isolated integration tests that call the local Ollama server with sample clinical PDF fixtures; validate JSON schema compliance and agreement rate tracking.
5. **Frontend Development**: Develop React components using a local dev server (`npm run dev`) proxying API calls to the .NET backend; use Playwright for E2E testing of critical booking, intake, and queue management flows against the full stack.
