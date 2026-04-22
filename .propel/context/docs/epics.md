---
title: Epic Backlog — Unified Patient Access & Clinical Intelligence Platform
version: 1.0.0
date: 2026-04-20
status: Draft
source: spec.md, design.md, figma_spec.md
workflow: create-epics
---

# Epic - Unified Patient Access & Clinical Intelligence Platform

## Epic Summary Table

| Epic ID | Epic Title | Mapped Requirement IDs |
|---------|------------|------------------------|
| EP-TECH | Project Foundation & Development Environment | TR-001, TR-002, TR-003, TR-004, TR-005, TR-006, NFR-001, NFR-011, NFR-015, NFR-018 |
| EP-DATA-I | Core Domain Entities & Schema Foundation | DR-001, DR-002, DR-003, DR-004, DR-005, DR-011, DR-014 |
| EP-DATA-II | Clinical & Analytics Entity Schema | DR-006, DR-007, DR-008, DR-009, DR-010, DR-012, DR-013 |
| EP-001 | User Authentication & Account Management | FR-001, FR-002, FR-003, FR-004, FR-005, UC-001, UC-010, NFR-008, NFR-009, UXR-503 |
| EP-002 | Patient Intake (AI-Assisted & Manual) | FR-006, FR-007, FR-008, FR-009, UC-002, AIR-001, AIR-006, UXR-004, UXR-504 |
| EP-003 | Appointment Booking & Preferred Slot Swap | FR-010, FR-011, FR-012, FR-013, FR-016, FR-017, FR-024, FR-025, UC-003, NFR-013, TR-010, UXR-101 |
| EP-004 | Staff Queue & Walk-In Management | FR-014, FR-015, FR-018, FR-019, FR-034, UC-004, UC-005, UC-009, UXR-102 |
| EP-005 | Notifications & Calendar Integration | FR-020, FR-021, FR-022, FR-023, UC-006, NFR-012, NFR-014, TR-011, TR-012, TR-013, TR-014 |
| EP-006-I | Clinical Document Upload & AI Extraction Pipeline | FR-026, FR-027, UC-007, NFR-003, NFR-016, TR-007, TR-008, TR-009, UXR-103 |
| EP-006-II | RAG Pipeline, 360° Patient View & Quality Controls | FR-028, FR-029, FR-030, AIR-002, AIR-003, AIR-Q02, AIR-Q03, AIR-Q04, AIR-R01, AIR-R02, AIR-R03, TR-017, UXR-403 |
| EP-007 | Medical Coding (ICD-10 & CPT) with Trust-First Verification | FR-031, FR-032, FR-033, UC-008, NFR-004, AIR-004, AIR-005, AIR-Q01, AIR-O03, UXR-104 |
| EP-008-I | HIPAA Security & Compliance Controls | FR-035, FR-036, FR-037, FR-038, NFR-005, NFR-006, NFR-007, NFR-017, TR-015 |
| EP-008-II | AI Safety & Operational Guardrails | NFR-010, AIR-S01, AIR-S02, AIR-S03, AIR-S04, AIR-O01, AIR-O02, TR-016 |
| EP-009 | Platform UX Foundation (Accessibility & Responsive Design) | NFR-002, UXR-201, UXR-202, UXR-203, UXR-204, UXR-301, UXR-302, UXR-303, UXR-401, UXR-402 |
| EP-010 | Platform Interaction Design & Navigation | UXR-001, UXR-002, UXR-003, UXR-501, UXR-502, UXR-601, UXR-602, UXR-603, UXR-604 |

## Epic Description

### EP-TECH: Project Foundation & Development Environment

**Business Value**: Enables all subsequent development by establishing the project scaffold, CI/CD pipeline, core technology stack configuration, and base architecture — without this epic, no feature work can begin.

**Description**: Bootstraps the full monorepo structure for the Unified Patient Access & Clinical Intelligence Platform. Covers React 18 + TypeScript SPA scaffolding, ASP.NET Core 9 Web API project setup with modular feature folder layout, PostgreSQL 16 + pgvector database configuration, Entity Framework Core 9 with Npgsql provider, JWT authentication infrastructure (ASP.NET Core Identity + BCrypt), Upstash Redis session management, and GitHub Codespaces devcontainer setup. Targets performance baselines of p95 API latency ≤ 2 s, 100 concurrent users, and 99.9% uptime defined upfront.

**UI Impact**: No

**Screen References**: N/A

**Key Deliverables**:

- React 18 + TypeScript + TailwindCSS SPA project scaffold (`/client`) with Vite build tooling
- ASP.NET Core 9 Web API project scaffold (`/api`) with modular feature folders: Booking, Intake, Clinical, Coding, Notifications, Admin
- PostgreSQL 16 + pgvector devcontainer service via docker-compose
- Entity Framework Core 9 + Npgsql provider configured; initial migration scaffold in place
- ASP.NET Core Identity with BCrypt password hashing; JWT Bearer token issuance (15-minute TTL)
- Upstash Redis integration for JWT blocklist and session token storage (no PHI)
- GitHub Codespaces devcontainer (`/.devcontainer/devcontainer.json`) with all service definitions
- Swagger / Scalar OpenAPI documentation enabled
- xUnit + Moq test project scaffolds; Playwright E2E project scaffold
- Platform-level NFR baselines documented: p95 ≤ 2 s (NFR-001), 100 concurrent users (NFR-015), 99.9% uptime target (NFR-011), versioned migrations enforced (NFR-018)

**Dependent EPICs**:

- None

---

### EP-DATA-I: Core Domain Entities & Schema Foundation

**Business Value**: Delivers the relational schema for user accounts, appointment slots, bookings, waitlist, patient intakes, and notifications — the data backbone required by all patient-facing and staff-facing booking features.

**Description**: Defines and migrates the core transactional entities: `users`, `appointment_slots`, `appointments`, `waitlist_entries`, `patient_intakes`, and `notifications`. Applies PHI encryption constraints on sensitive JSONB fields. Establishes EF Core migrations as the single source of schema truth and enforces the notifications retention structure needed for reminder retry logic.

**UI Impact**: No

**Screen References**: N/A

**Key Deliverables**:

- `users` entity: UUID PK, encrypted email, password_hash, role enum (Patient | Staff | Admin), status enum (Active | Inactive), timestamps (DR-001)
- `appointment_slots` entity: UUID PK, slot_date, slot_time, duration_minutes, is_available, created_at (DR-002)
- `appointments` entity: UUID PK, patient_id FK, slot_id FK, status enum, preferred_slot_id FK (nullable), booking_type enum, created_by FK, timestamps (DR-003)
- `waitlist_entries` entity: UUID PK, patient_id FK, slot_id FK, position, requested_at, status enum (DR-004)
- `patient_intakes` entity: UUID PK, patient_id FK, intake_method enum, encrypted JSONB fields (demographics, medical_history, medications, allergies), encrypted chief_complaint, timestamps (DR-005)
- `notifications` entity: UUID PK, appointment_id FK, channel enum, status enum, attempt_count, scheduled_at, sent_at, error_message (DR-011)
- EF Core versioned migration scripts applied on startup (DR-014)
- Seed data: insurance dummy records for pre-check validation

**Dependent EPICs**:

- EP-TECH — Foundational — Requires EF Core, PostgreSQL, and project scaffold from EP-TECH

---

### EP-DATA-II: Clinical & Analytics Entity Schema

**Business Value**: Provides the persistence layer for clinical documents, AI-extracted data, the 360-Degree Patient View, medical code suggestions, and the immutable audit log — enabling the clinical intelligence and compliance pillars of the platform.

**Description**: Defines and migrates the clinical and analytics entities: `clinical_documents`, `extracted_clinical_data` (with pgvector embedding column), `patient_view_360`, `medical_code_suggestions`, and `audit_logs` (append-only). Implements the 6-year PHI data retention policy, daily automated backup configuration, and point-in-time recovery via PostgreSQL WAL archiving. All PHI fields are encrypted at the column level.

**UI Impact**: No

**Screen References**: N/A

**Key Deliverables**:

- `clinical_documents` entity: UUID PK, patient_id FK, file_name, file_path, upload_status enum (Pending | Extracted | Failed), uploaded_by FK, uploaded_at (DR-006)
- `extracted_clinical_data` entity: UUID PK, document_id FK, patient_id FK, field_type enum, encrypted field_value, source_text, extracted_at, embedding vector(384) (DR-007)
- `patient_view_360` entity: UUID PK, patient_id FK (unique), encrypted aggregated_data JSONB, conflict_flags JSONB, is_verified bool, verified_by FK, verified_at, last_updated_at (DR-008)
- `medical_code_suggestions` entity: UUID PK, patient_id FK, code_type enum (ICD10 | CPT), suggested_code, code_description, source_evidence, confidence_score, status enum, reviewed_by FK, reviewed_at, final_code (DR-009)
- `audit_logs` entity: UUID PK, actor_id FK, actor_role, action_type, entity_type, entity_id, change_summary, ip_address, occurred_at; table is append-only — no UPDATE or DELETE permissions granted (DR-010)
- PHI retention policy: minimum 6-year retention enforced on clinical tables (DR-012)
- Daily automated database backup configuration with 7-day retention and WAL-based PITR (DR-013)
- pgvector extension enabled and index created on `extracted_clinical_data.embedding` column

**Dependent EPICs**:

- EP-DATA-I — Decomposed — This is Part II of the EP-DATA epic; clinical entities reference user and appointment entities defined in EP-DATA-I

---

### EP-001: User Authentication & Account Management

**Business Value**: Provides the secure entry point for all three user roles (Patient, Staff, Admin), enabling role-based access control that gates every feature on the platform. Without authenticated sessions, no other feature is accessible.

**Description**: Implements the complete user authentication and account management lifecycle. Covers patient self-registration with email verification and password complexity validation, role-based access control (Patient | Staff | Admin), 15-minute session inactivity timeout with automatic re-authentication, Admin CRUD operations on Staff and Patient accounts (soft-delete only), and immutable audit logging for all user and appointment record mutations. Includes the session expiry warning UX (UXR-503) to prevent data loss during active sessions.

**UI Impact**: Yes

**Screen References**: SCR-001, SCR-002, SCR-003, SCR-019, SCR-020, SCR-021

**Key Deliverables**:

- Patient self-registration: email verification flow, password complexity enforcement (8+ chars, upper, lower, digit, symbol) (FR-001)
- RBAC enforcement: middleware/policy rejecting requests outside caller's role boundary (FR-002, NFR-008)
- Session inactivity timeout: 15-minute automatic expiry with JWT TTL and Redis blocklist; re-authentication prompt (FR-003, NFR-009)
- Admin user management: create/update/deactivate Staff and Patient accounts; no hard-deletes; soft-delete (status = Inactive) (FR-004)
- Immutable audit log entries: every create, update, delete on patient and appointment records captures actor ID, role, action type, affected entity, and timestamp (FR-005)
- Session expiry warning modal: rendered 2 minutes before timeout; session extension resets inactivity timer (UXR-503)
- Admin Panel: User Management List (SCR-019), User Detail/Edit (SCR-020), Audit Log Viewer (SCR-021)
- Login page (SCR-001): shared across Patient, Staff, Admin; error state on invalid credentials (no field disambiguation)
- Registration (SCR-002): patient-only; inline validation on blur; single column on mobile (UXR-303 via EP-009)
- Email Verification (SCR-003): verification link activation; resend flow on expiry

**Dependent EPICs**:

- EP-TECH — Foundational — Requires JWT auth infrastructure, ASP.NET Core Identity, and Redis session setup
- EP-DATA-I — Foundational — Requires `users` entity and `audit_logs` table

---

### EP-002: Patient Intake (AI-Assisted & Manual)

**Business Value**: Removes the friction of traditional intake forms by offering an AI-assisted conversational option alongside a manual fallback, enabling patients to complete pre-appointment health history collection digitally — reducing administrative burden at check-in.

**Description**: Implements the dual-mode patient intake flow. The AI-assisted path uses a locally-hosted LLM (Ollama + Llama 3.2) with Tool Calling to collect structured demographics, medical history, medications, allergies, and chief complaint through natural language dialogue. The manual path provides a traditional form. Patients can switch between modes at any time without data loss, and can edit previously submitted intake data independently. Auto-save every 60 seconds (UXR-004) protects against session timeout data loss.

**UI Impact**: Yes

**Screen References**: SCR-004, SCR-005, SCR-006, SCR-007, SCR-007b

**Key Deliverables**:

- AI-assisted conversational intake: NLU pipeline (AIR-001) using Ollama + Llama 3.2; Tool Calling pattern with pre-defined tools (`save_demographic`, `save_medication`, `save_allergy`, `save_chief_complaint`) for incremental field persistence (AIR-006) (FR-006)
- Manual intake form: all required fields directly editable; same data schema as AI path (FR-007)
- Mode switching: patient can freely switch AI ↔ Manual at any point; all captured data preserved and pre-filled in the target mode (FR-008)
- Patient-initiated edit: patients can edit any previously submitted intake field without staff intervention (FR-009)
- Auto-save: intake form state persisted to server every 60 seconds; auto-save indicator visible (UXR-004)
- Typing indicator: 3-dot animation displayed while LLM generates response in AI chat (UXR-504)
- Intake Method Selection screen (SCR-005): clear choice between AI Chat and Manual Form
- AI-Assisted Intake Chat screen (SCR-006): conversational UI with message history
- Manual Intake Form screen (SCR-007): structured form layout; inline validation on field blur
- Intake Review & Summary screen (SCR-007b): review all captured data before submission

**Dependent EPICs**:

- EP-TECH — Foundational — Requires Ollama integration, ASP.NET Core API scaffolding
- EP-DATA-I — Foundational — Requires `patient_intakes` entity

---

### EP-003: Appointment Booking & Preferred Slot Swap

**Business Value**: Delivers the core patient scheduling capability that directly reduces no-show rates through intelligent preferred slot automation, waitlist management, and PDF confirmation — targeting measurable reduction from the 15% baseline.

**Description**: Implements the full appointment booking lifecycle for authenticated patients: browsing available slots, booking a slot, registering a preferred unavailable slot for automatic swap, and joining waitlists. Includes a soft insurance pre-check against internal dummy records (advisory, non-blocking). Auto-swap uses PostgreSQL SELECT FOR UPDATE row locking for exactly-once guarantee. PDF appointment confirmation (generated via QuestPDF) is sent by email immediately on booking. Patients cannot self-check-in through any interface.

**UI Impact**: Yes

**Screen References**: SCR-008, SCR-009, SCR-010

**Key Deliverables**:

- Available slot browsing and booking: patients can view and book one slot per session (FR-010)
- Preferred slot designation: patients select one preferred (currently unavailable) slot at booking time (FR-011)
- Automatic preferred-slot swap: when preferred slot opens, system swaps appointment, releases original slot, notifies patient via email and SMS; SELECT FOR UPDATE ensures exactly-once assignment (FR-012, NFR-013)
- Waitlist queue: FIFO ordering by request timestamp; next-in-queue notified when slot opens (FR-013)
- PDF appointment confirmation: generated via QuestPDF (TR-010) containing date, time, location, provider details, and cancellation policy; emailed immediately on booking (FR-016)
- No self-check-in: all web, mobile, and QR code self-check-in pathways are blocked; arrival is Staff-only (FR-017)
- Insurance pre-check: soft validation of insurance name + ID against internal dummy records; result (matched / unmatched / not found) displayed to Staff; booking is never blocked (FR-024, FR-025)
- Booking Calendar screen (SCR-008): colour-coded slot legend — Available (green), Unavailable (grey), Preferred-waitlisted (amber); colour-blind-safe (icon + colour) (UXR-101)
- Booking & Insurance Form screen (SCR-009): insurance input with inline validation; slot confirmation
- Appointment Confirmation screen (SCR-010): post-booking summary with calendar sync status

**Dependent EPICs**:

- EP-TECH — Foundational — Requires API scaffolding and QuestPDF integration
- EP-DATA-I — Foundational — Requires `appointment_slots`, `appointments`, `waitlist_entries`, `notifications` entities

---

### EP-004: Staff Queue & Walk-In Management

**Business Value**: Centralises daily operational control for front-desk staff — managing same-day queues, processing walk-in patients, confirming arrivals, and surfacing no-show risk indicators — directly reducing administrative time per appointment.

**Description**: Implements all Staff-exclusive operational features. Staff can book walk-in appointments (optionally creating a new patient account or recording a guest profile), view and reorder the same-day queue, and mark patients as Arrived. All arrival and walk-in actions are logged to the immutable audit trail. A rule-based no-show risk scoring engine evaluates each appointment using prior no-show history, booking lead time, and insurance validation status, surfacing a Low / Medium / High risk badge on the queue view.

**UI Impact**: Yes

**Screen References**: SCR-011, SCR-012, SCR-013, SCR-014

**Key Deliverables**:

- Walk-in booking restricted to Staff: patients cannot initiate walk-in bookings through any interface (FR-014)
- Staff walk-in flow: search for existing patient by name/DOB; optionally create new patient account; fall back to guest profile if no account created (FR-015)
- Same-day queue management: Staff can view, reorder, and add walk-in entries to the queue (FR-018)
- Mark patient Arrived: Staff-only action; logged to audit trail with Staff ID and timestamp (FR-019)
- No-show risk scoring: rule-based engine evaluates prior no-shows, booking lead time, insurance status, and intake completion; assigns Low / Medium / High; new patients default to Medium (FR-034, UC-009)
- Staff Home Dashboard (SCR-011): overview cards for today's queue count, arrivals, walk-ins
- Walk-In Booking Panel (SCR-012): same-day slot selection; walk-in override confirm dialog if no slots available
- Patient Search / Create screen (SCR-013): search by name or DOB; inline patient creation form
- Same-Day Queue View (SCR-014): ordered appointment list with no-show risk badges (colour-coded with text label — not tooltip-only) (UXR-102); arrival override confirm dialog

**Dependent EPICs**:

- EP-TECH — Foundational — Requires ASP.NET Core API and audit middleware
- EP-DATA-I — Foundational — Requires `appointments`, `waitlist_entries`, `users`, `audit_logs` entities

---

### EP-005: Notifications & Calendar Integration

**Business Value**: Automates multi-channel patient reminders and calendar synchronisation, directly reducing no-show rates by ensuring patients receive timely, actionable appointment notifications without requiring staff manual outreach.

**Description**: Implements automated SMS and email appointment reminders at configurable intervals (e.g., 48 hours and 2 hours before appointment) using Hangfire recurring jobs. Integrates Google Calendar API v3 and Microsoft Graph API for confirmed appointment event creation/sync. All notification delivery failures are logged with retry (minimum one retry after 5-minute delay). External integration failures degrade gracefully without blocking core booking or queue workflows.

**UI Impact**: Yes

**Screen References**: SCR-010 (calendar sync toast), SCR-008, SCR-014 (non-critical failure toasts)

**Key Deliverables**:

- SMS reminders: automated Twilio SMS (free trial) at configurable intervals before appointment (FR-020, TR-012)
- Email reminders: automated MailKit email via configurable SMTP relay at same intervals as SMS (FR-021, TR-011)
- Google Calendar sync: OAuth 2.0 event creation/update for confirmed appointments; exponential backoff, max 3 retries (FR-022, TR-013)
- Microsoft Outlook Calendar sync: Microsoft Graph API event creation/update; same retry policy (FR-023, TR-013)
- Hangfire job scheduler: recurring reminder jobs and event-triggered notification retry (TR-014); at least one retry after 5-minute minimum delay; failure logged to audit trail (NFR-012)
- Graceful degradation: calendar, SMS, and email failures do not block booking or queue workflows; non-critical failure toast (UXR-602 via EP-010) displayed and dismissed after 5 seconds (NFR-014)
- Notification status tracking via `notifications` entity: attempt_count, sent_at, error_message

**Dependent EPICs**:

- EP-TECH — Foundational — Requires Hangfire, MailKit, Twilio, and calendar SDK project setup
- EP-DATA-I — Foundational — Requires `notifications` and `appointments` entities

---

### EP-006-I: Clinical Document Upload & AI Extraction Pipeline

**Business Value**: Initiates the clinical intelligence pillar by enabling patients and staff to upload PDF clinical records and triggering the AI extraction pipeline, transforming a 20-minute manual data extraction task into an automated background process.

**Description**: Implements clinical PDF document upload for authenticated patients and staff. Each uploaded document is queued as an asynchronous Hangfire job, preventing long-running LLM calls from blocking user-facing APIs. The AI extraction pipeline uses PdfPig for server-side PDF text extraction. Documents are stored in an access-controlled local directory. Extraction status (Processing / Extracted / Failed) is surfaced to the user via a real-time progress indicator. Manual data entry fallback is provided when extraction fails.

**UI Impact**: Yes

**Screen References**: SCR-015

**Key Deliverables**:

- Clinical document upload: patients and staff can upload one or more PDF files to the patient profile; non-PDF files rejected with supported format message (FR-026)
- AI extraction pipeline trigger: each uploaded PDF queued as a Hangfire background job on the dedicated AI processing queue (NFR-016, TR-008)
- PdfPig PDF text extraction: server-side text extraction from uploaded PDFs; file storage in access-controlled uploads directory (TR-009)
- Ollama + Llama 3.2 3B Instruct model: local LLM server configured and co-deployed in Codespaces for extraction tasks (TR-007)
- Structured field extraction: AI pipeline extracts vitals, medication history, allergy list, past diagnoses, and surgical history from unstructured PDF text (FR-027)
- Extraction status indicator: Processing / Extracted / Failed states displayed with progress indicator; "Extraction Failed" badge with "Enter data manually" fallback CTA (UXR-103)
- Clinical Documents Upload screen (SCR-015): document list with upload button, status badges, PDF preview overlay; empty state with "Upload your first document" CTA
- Extraction latency SLA: AI pipeline must complete within 30 seconds at p90 (NFR-003)

**Dependent EPICs**:

- EP-TECH — Foundational — Requires Hangfire, Ollama, PdfPig, and ASP.NET Core API scaffolding
- EP-DATA-II — Foundational — Requires `clinical_documents` and `extracted_clinical_data` entities

---

### EP-006-II: RAG Pipeline, 360° Patient View & Quality Controls

**Business Value**: Converts raw AI-extracted clinical data into a de-duplicated, conflict-surfaced 360-Degree Patient View verified by staff — the core clinical intelligence deliverable that reduces clinical prep time from 20 minutes to ~2 minutes.

**Description**: Implements the full RAG retrieval pipeline for clinical field extraction, the 360-Degree Patient View aggregation layer, de-duplication, conflict detection, and staff verification flow. Applies Maximal Marginal Relevance re-ranking to reduce redundant context. JSON schema validation and confidence thresholds gate LLM outputs before persistence. Conflict flags require explicit Staff acknowledgement before the view is marked verified.

**UI Impact**: Yes

**Screen References**: SCR-015, SCR-016, SCR-017

**Key Deliverables**:

- PDF text chunking: 512-token segments with 51-token (10%) overlap to preserve sentence context at chunk boundaries (AIR-R01)
- Vector embeddings: nomic-embed-text model via Ollama generates embeddings for each chunk; stored in `extracted_clinical_data.embedding` column (AIR-002)
- RAG retrieval: top-5 semantically relevant chunks per target field type via cosine similarity ≥ 0.65 in pgvector; if fewer than 2 chunks meet threshold, job flagged as low-confidence (AIR-003, AIR-R02)
- MMR re-ranking: Maximal Marginal Relevance (diversity factor 0.3) applied to retrieved chunks before LLM invocation to reduce redundancy (AIR-R03)
- Structured extraction: LLM extracts vitals, medications, allergies, diagnoses, and surgical history from re-ranked context chunks (AIR-002)
- JSON schema validation: all LLM extraction outputs validated against target schema before persistence; schema-invalid responses flagged as "Extraction Failed" (AIR-Q03)
- Confidence threshold: LLM responses with confidence < 0.6 flagged as "Needs Review" rather than auto-populated (AIR-Q04)
- RAG pipeline latency SLA: embed → retrieve → generate within 30 seconds p90 (AIR-Q02)
- 360° Patient View aggregation: extracted data from all documents aggregated into single unified view accessible to authorised Staff (FR-028)
- De-duplication: repeated data values (e.g., same medication from multiple documents) de-duplicated; most recent verified value retained with source attribution (FR-029)
- Conflict detection and acknowledgement: critical data conflicts (e.g., contradictory medication dosages, conflicting allergy records) surfaced in the 360° view; Staff must explicitly acknowledge each conflict before view is marked verified (FR-030)
- Trust-First visual hierarchy: AI-suggested fields visually distinguished from human-verified data with "AI Suggested" badge and muted background; verified items with solid border (UXR-403)
- 360-Degree Patient View screen (SCR-016): unified patient data summary; loading skeleton during data fetch
- Conflict Acknowledgement Panel screen (SCR-017): conflict items highlighted; acknowledgement dialog before marking verified

**Dependent EPICs**:

- EP-006-I — Decomposed — This is Part II of the EP-006 epic; requires document upload, text extraction, and AI infrastructure from EP-006-I

---

### EP-007: Medical Coding (ICD-10 & CPT) with Trust-First Verification

**Business Value**: Transforms the 360-Degree Patient View into actionable, verified billing codes — directly preventing claim denials and targeting an AI-Human Agreement Rate > 98%, which quantifies the platform's clinical accuracy impact.

**Description**: Implements the ICD-10 diagnostic and CPT procedure code mapping pipeline using RAG over pre-indexed code reference vector stores. Each suggested code is presented alongside the supporting source clinical text excerpt for Staff review. Staff can accept, modify, or reject each suggestion. The AI-Human Agreement Rate metric is tracked per verification session and stored for aggregate reporting. AI operational requirements (model version tracking, token budget) are also implemented here.

**UI Impact**: Yes

**Screen References**: SCR-018

**Key Deliverables**:

- ICD-10 code mapping: embed patient summary, cosine similarity search against pre-indexed ICD-10 reference vector store, LLM confirms/refines top-5 candidate codes with source evidence (FR-031, AIR-004)
- CPT code mapping: same RAG pipeline applied to pre-indexed CPT reference vector store (FR-032, AIR-005)
- Trust-First code presentation: each suggested code shown with supporting source-text excerpt visually highlighted and collapsed by default, expandable on demand (FR-033, UXR-104)
- Staff verification workflow: Staff accepts, modifies, or rejects each code suggestion; Code Finalise Confirm dialog before finalising; rejected codes recorded with Staff-supplied replacement (UC-008)
- AI-Human Agreement Rate metric: percentage of AI codes accepted without modification tracked per session and reported in aggregate; target > 98%; stored in `medical_code_suggestions` (AIR-Q01)
- Code suggestion latency SLA: ICD-10 + CPT code suggestion generation within 15 seconds p90 (NFR-004)
- Model version tracking: model name and version recorded per inference call in `medical_code_suggestions` for reproducibility and rollback analysis (AIR-O03)
- Medical Coding Panel screen (SCR-018): code suggestion list with expand/collapse source evidence; acceptance/rejection controls; empty state with "Generating suggestions…" skeleton

**Dependent EPICs**:

- EP-TECH — Foundational — Requires Ollama, pgvector, and ASP.NET Core API scaffolding
- EP-DATA-II — Foundational — Requires `medical_code_suggestions` and `extracted_clinical_data` entities

---

### EP-008-I: HIPAA Security & Compliance Controls

**Business Value**: Ensures the platform is legally deployable in healthcare by satisfying HIPAA Privacy and Security Rule technical safeguards — a non-negotiable compliance prerequisite for any clinical data processing system.

**Description**: Implements all HIPAA-required technical controls at the data and transport layers: TLS 1.2+ enforcement for all in-transit traffic, AES-256 column-level encryption for all PHI stored in PostgreSQL, strict prohibition on PHI in Redis cache, and an immutable 6-year audit log via Serilog + Seq. These controls are cross-cutting — they apply to every module that handles PHI.

**UI Impact**: No

**Screen References**: N/A

**Key Deliverables**:

- HIPAA-compliant PHI handling: all PHI processed, transmitted, and stored per HIPAA Privacy and Security Rules (FR-035, NFR-005)
- TLS 1.2+ enforcement: all API endpoints reject plaintext HTTP; redirect or reject with 301/400 (FR-036, NFR-006)
- PHI column-level encryption: AES-256 (or equivalent via npgsql pgcrypto) applied to all PHI fields in PostgreSQL (`email`, JSONB intake fields, clinical extracted data, patient view aggregated data) (FR-037, NFR-007)
- Redis PHI prohibition: Upstash Redis stores only JWT tokens and non-PHI transient data; PHI values are never cached in Redis (FR-038)
- Structured audit logging: Serilog + Seq community server as the structured logging sink; audit events written synchronously; application diagnostics asynchronously (TR-015)
- 6-year immutable audit log retention: append-only `audit_logs` table with no UPDATE or DELETE permissions; records retained for minimum 6 years per HIPAA mandate (NFR-017)

**Dependent EPICs**:

- EP-TECH — Foundational — Requires ASP.NET Core API, PostgreSQL, and Serilog/Seq infrastructure from EP-TECH

---

### EP-008-II: AI Safety & Operational Guardrails

**Business Value**: Ensures the AI pipeline operates safely and within HIPAA boundaries — protecting patient data from exposure to external services, enforcing reliability via circuit breakers, and maintaining full auditability of AI inference — enabling the platform to deploy AI without trust deficit.

**Description**: Implements cross-cutting AI safety and operational reliability controls: local-only LLM inference enforcement (PHI never leaves the Codespaces boundary), PII redaction middleware in the AI pipeline (patient identifiers substituted with opaque tokens before LLM invocation), full LLM prompt/response audit logging (excluding direct PHI), document ACL filtering in pgvector retrieval (only patient-owned document chunks returned), token budget enforcement (4,096 input tokens per request), and Ollama circuit breaker (3 failures in 60 seconds → open circuit with 5-minute cool-down).

**UI Impact**: No

**Screen References**: N/A

**Key Deliverables**:

- Local-only PHI enforcement: all LLM inference runs exclusively via locally-hosted Ollama server; no PHI transmitted to any external API endpoint (NFR-010, AIR-S01)
- PII redaction middleware: strips patient identifiers (name, DOB, address, insurance ID) from LLM prompts before invocation; substitutes opaque reference tokens (`[PATIENT-ID]`, `[DOB-REDACTED]`) (AIR-S02, TR-016)
- LLM audit logging: every LLM prompt and response payload (excluding direct PHI per AIR-S02) logged to audit log with actor ID, timestamp, model name, and token counts; retained for 6 years (AIR-S03)
- pgvector ACL filtering: all pgvector similarity search queries include a patient_id WHERE clause to ensure only that patient's document chunks are returned (AIR-S04)
- Token budget enforcement: maximum 4,096 input tokens per LLM inference request; requests exceeding limit split into smaller batches before invocation (AIR-O01)
- Ollama circuit breaker: after 3 consecutive failures within 60 seconds, circuit opens; all queued AI jobs retried after configurable 5-minute cool-down (AIR-O02)

**Dependent EPICs**:

- EP-TECH — Foundational — Requires Ollama integration and ASP.NET Core middleware pipeline from EP-TECH

---

### EP-009: Platform UX Foundation (Accessibility & Responsive Design)

**Business Value**: Ensures the platform is legally accessible (WCAG 2.2 AA) and usable across all device types (mobile, tablet, desktop) — expanding the potential user base and reducing compliance risk, while delivering the sub-3-second initial load time required for patient adoption.

**Description**: Implements all cross-cutting accessibility, responsive design, and visual design system requirements. Covers WCAG 2.2 AA compliance (colour contrast, keyboard navigation, ARIA labels, form field associations), three-breakpoint responsive layout (4/8/12-column grid), hamburger navigation on mobile, single-column form stacking on mobile, and strict design token adherence with a consistent page header pattern. These requirements apply to all 21 screens in the platform.

**UI Impact**: Yes

**Screen References**: All SCR (SCR-001 through SCR-021)

**Key Deliverables**:

- React SPA TTI < 3 seconds on standard broadband; critical CSS inlined; SPA shell served as static files (NFR-002)
- WCAG 2.2 AA compliance: colour contrast ≥ 4.5:1 for body text, ≥ 3:1 for UI components across all screens; zero critical violations on WAVE/axe automated audit (UXR-201)
- Keyboard-navigable focus order: logical Tab order; visible focus ring on every focused element at all zoom levels (UXR-202)
- ARIA labels: descriptive ARIA labels on all icon-only buttons, status badges, and progress indicators (UXR-203)
- Form field accessibility: every form field associated with a visible label; descriptive error messages linked via aria-describedby (UXR-204)
- Responsive layout: 4-column (mobile) / 8-column (tablet) / 12-column (desktop) CSS grid; no horizontal scroll on any screen (UXR-301)
- Hamburger navigation: sidebar navigation replaced with collapsible hamburger menu on screens < 768px; slide-over drawer pattern (UXR-302)
- Mobile form stacking: multi-column form layouts collapse to single column on mobile < 768px (UXR-303)
- Design token system: all colour, spacing, and typography values sourced exclusively from designsystem.md tokens; zero hard-coded values (UXR-401)
- Consistent page header: logo, role label, user avatar, logout rendered on all authenticated screens (SCR-003 onwards) (UXR-402)

**Dependent EPICs**:

- EP-TECH — Foundational — Requires React + TailwindCSS scaffold and design system token configuration from EP-TECH

---

### EP-010: Platform Interaction Design & Navigation

**Business Value**: Delivers the cross-cutting interaction quality that drives platform adoption — fast visual feedback, loading skeletons, clear navigation paths, and comprehensive error handling that guides users rather than blocking them, directly reducing support burden and abandonment rates.

**Description**: Implements all cross-cutting navigation, interaction feedback, and error handling UX patterns across all authenticated screens. Covers 3-click navigation from dashboard to any feature, breadcrumb navigation on screens deeper than the dashboard, role-sensitive top navigation bar, visual feedback within 200ms for all actions, skeleton loading states, inline validation errors on blur, and contextual empty states with CTA for all data-free views.

**UI Impact**: Yes

**Screen References**: All SCR (SCR-001 through SCR-021)

**Key Deliverables**:

- 3-click navigation: any primary feature reachable within 3 clicks from role-specific dashboard; click-path audit for each persona's top 3 tasks (UXR-001)
- Breadcrumb navigation: contextual breadcrumbs on all screens deeper than the dashboard (depth ≥ 2); shortened to last 2 levels on mobile (UXR-002)
- Role-sensitive top navigation bar: renders correct links per role (Patient, Staff, Admin); inaccessible sections hidden; consistent across all screens (UXR-003)
- Visual feedback within 200ms: button press state renders ≤ 200ms; spinner appears within 500ms for async operations > 500ms (UXR-501)
- Skeleton loading state: skeleton renders on all data-fetching screens (SCR-008, SCR-014, SCR-016, SCR-018, SCR-019); no blank flash > 200ms (UXR-502)
- Inline validation errors: rendered on field blur (not only on submit); red border + error icon + descriptive message beneath field (UXR-601)
- Non-critical failure toast: bottom-right toast for calendar sync / SMS delivery failures; auto-dismisses after 5 seconds; does not block primary flow (UXR-602)
- Full-page error state: descriptive error with retry CTA when critical API calls fail (patient view load, queue load, login failure) (UXR-603)
- Empty-state illustrations: contextual CTA displayed when list/data views have no records (no appointments, no documents, no users, no code suggestions) (UXR-604)

**Dependent EPICs**:

- EP-TECH — Foundational — Requires React SPA scaffold and component library setup from EP-TECH

---

## Backlog Refinement Required

No `[UNCLEAR]` tagged requirements were identified in spec.md, design.md, or figma_spec.md. All 143 requirements have been mapped to epics.

---

## Dependency Validation Report

```text
Dependency Validation Report: create-epics
-------------------------------------------------
Source: EP-DATA-I
Target: EP-TECH
Result: [VALID] — Foundational dependency

Source: EP-DATA-II
Target: EP-DATA-I
Result: [VALID] — Decomposed part dependency (sequential: Part II → Part I)

Source: EP-001
Target: EP-TECH, EP-DATA-I
Result: [VALID] — Foundational dependencies

Source: EP-002
Target: EP-TECH, EP-DATA-I
Result: [VALID] — Foundational dependencies

Source: EP-003
Target: EP-TECH, EP-DATA-I
Result: [VALID] — Foundational dependencies

Source: EP-004
Target: EP-TECH, EP-DATA-I
Result: [VALID] — Foundational dependencies

Source: EP-005
Target: EP-TECH, EP-DATA-I
Result: [VALID] — Foundational dependencies

Source: EP-006-I
Target: EP-TECH, EP-DATA-II
Result: [VALID] — Foundational dependencies

Source: EP-006-II
Target: EP-006-I
Result: [VALID] — Decomposed part dependency (sequential: Part II → Part I)

Source: EP-007
Target: EP-TECH, EP-DATA-II
Result: [VALID] — Foundational dependencies

Source: EP-008-I
Target: EP-TECH
Result: [VALID] — Foundational dependency

Source: EP-008-II
Target: EP-TECH
Result: [VALID] — Foundational dependency

Source: EP-009
Target: EP-TECH
Result: [VALID] — Foundational dependency

Source: EP-010
Target: EP-TECH
Result: [VALID] — Foundational dependency
-------------------------------------------------
Summary: 15 Valid, 0 Invalid
Parallel Execution: After EP-TECH + EP-DATA-I resolve, the following epics can execute simultaneously:
  EP-001, EP-002, EP-003, EP-004, EP-005, EP-008-I, EP-008-II, EP-009, EP-010
  (9 epics in parallel — satisfies ≥3 parallel execution requirement)
```

---

## Pre-Delivery Quality Checklist

- [x] **Project Type Detected**: Green-field — no existing codebase, no codeanalysis.md; EP-TECH created as first epic
- [x] **EP-TECH Included**: First epic; all foundational TR and platform NFRs mapped
- [x] **EP-DATA Included**: design.md contains 14 DR-XXX requirements and entity definitions; decomposed into EP-DATA-I (7 reqs) and EP-DATA-II (7 reqs)
- [x] **Requirement Coverage**: All FR (38), UC (10), NFR (18), TR (17), DR (14), UXR (26), AIR (20) = 143 requirements mapped to exactly one epic
- [x] **No Orphans**: Zero requirements without epic assignment
- [x] **No Duplicates**: Each requirement appears in exactly one epic
- [x] **Epic Sizing**: EP-006-II has 13 requirements (tightly coupled RAG + aggregation); all other epics are within the ~12 requirement guideline
- [x] **Dependency Validation**: Feature epics depend ONLY on EP-TECH / EP-DATA foundations; decomposed parts follow sequential pattern
- [x] **Decomposition Validation**: EP-DATA-II → EP-DATA-I (sequential); EP-006-II → EP-006-I (sequential); max 2 parts per decomposed epic
- [x] **Parallel Execution Enabled**: 9 feature epics can execute simultaneously after foundational epics resolve
- [x] **UNCLEAR Handling**: No [UNCLEAR] requirements found; Backlog Refinement section included and confirmed empty
- [x] **Priority Ordering**: Epics ordered by business value then dependency: Foundations → Auth → Booking/Intake/Staff → Notifications → Clinical AI → Security/UX
- [x] **Template Adherence**: Output follows epics-template.md structure
