---
title: "Task — BE POST /api/documents Upload API — MIME Validation, /uploads Storage, clinical_documents, Hangfire Enqueue & RBAC"
task_id: task_002
story_id: us_039
epic: EP-006-I
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE POST /api/documents Upload API — MIME Validation, /uploads Storage, clinical_documents, Hangfire Enqueue & RBAC

## Requirement Reference

- **User Story**: us_039
- **Story Location**: .propel/context/tasks/EP-006-I/us_039/us_039.md
- **Acceptance Criteria**:
  - AC-3: `POST /api/documents` accepts `multipart/form-data` with PDF binary + `patient_id`; server-side validates MIME type (`application/pdf`) AND magic-byte prefix (`%PDF-`) as defence-in-depth; on failure HTTP 400 "Only PDF files are supported"; on pass: save file to `/uploads/{patient_id}/{document_id}.pdf`; INSERT `clinical_documents (document_id, patient_id, file_name, file_path, upload_status=Pending, uploaded_by, uploaded_at)`; INSERT `audit_logs (action=DocumentUploaded, entity_type=clinical_documents, entity_id=document_id, actor_id, ip_address)` (FR-026, TR-009)
  - AC-4: After successful INSERT, enqueue `BackgroundJob.Enqueue<IExtractionJobService>(j => j.ProcessDocument(document_id))` on the dedicated AI processing queue (TR-008); return HTTP 202 Accepted `{ "document_id": "...", "status": "Processing" }`; API response time does NOT include LLM latency (NFR-016)
  - AC-1 (GET): `GET /api/documents?patient_id=X` returns document list with current `upload_status`; used by FE polling
  - AC-5: Patient role → JWT `sub` claim must match `patient_id`; else HTTP 403 Forbidden; Staff role → may access any patient profile; verified via JWT `role` claim (NFR-008, FR-026)
  - Edge Case: `/uploads` directory unavailable (IOException) → HTTP 500 "Document storage unavailable"; no `clinical_documents` row inserted; no Hangfire job enqueued; INSERT `audit_logs (action=DocumentUploadFailed, error_message)`
  - Edge Case: `.pdf` extension but non-PDF binary (e.g., renamed .exe) → magic-byte check (`%PDF-` prefix on first 5 bytes) catches it; HTTP 400; no file written

- **Edge Cases**:
  - Edge Case: Same PDF uploaded twice → system creates new `document_id` each time (no deduplication at upload time — intentional)
  - Edge Case: Multi-file upload → FE sends one POST per file sequentially; each is independent; API treats each as a separate document

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
| ORM | Entity Framework Core | 9 (Npgsql) |
| Database | PostgreSQL | 16 |
| Background Jobs | Hangfire + Hangfire.PostgreSql | 1.8.x |
| File I/O | System.IO | built-in |
| Auth | JWT Bearer (Microsoft.AspNetCore.Authentication.JwtBearer) | .NET 9 |
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

Implement the document upload API: `POST /api/documents` validates the uploaded file (MIME type + magic-byte check), saves it to the access-controlled `/uploads/{patient_id}/{document_id}.pdf` directory, creates a `clinical_documents` record with `upload_status=Pending`, writes an `audit_logs` entry, enqueues the `ExtractionJob` on the dedicated AI processing queue, and returns HTTP 202. A companion `GET /api/documents?patient_id=X` endpoint supports the FE polling loop. RBAC enforces that patients can only upload to their own profile; Staff can upload for any patient.

---

## Dependent Tasks

- US_005 (Foundational EP-TECH) — Hangfire job store registered; dedicated AI processing queue configured
- US_016 (Foundational EP-DATA-II) — `clinical_documents` entity migrated; `audit_logs` entity available
- us_040 task_001 — `IExtractionJobService.ProcessDocument(document_id)` interface must be defined so this task can compile the Hangfire enqueue call (interface can be defined here and implemented in us_040)

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Documents/DocumentsController.cs` | CREATE | `POST /api/documents` + `GET /api/documents`; RBAC guards |
| `Server/Features/Documents/DocumentUploadService.cs` | CREATE | MIME + magic-byte validation; file save to /uploads; clinical_documents INSERT; audit_logs INSERT; Hangfire enqueue |
| `Server/Features/Documents/IExtractionJobService.cs` | CREATE | Interface defining `ProcessDocument(Guid documentId)` — consumed by us_040 task_001 implementation |
| `Server/Program.cs` | MODIFY | Register `DocumentsController`; configure uploads directory path from `IConfiguration["Storage:UploadsPath"]`; ensure Hangfire AI queue name constant defined |

---

## Implementation Plan

1. Define `IExtractionJobService` interface with `Task ProcessDocument(Guid documentId)` to enable the enqueue call to compile before us_040 implements it
2. Implement `DocumentUploadService.ValidatePdf(IFormFile file)`: check `file.ContentType == "application/pdf"`; read first 5 bytes and verify `%PDF-` magic bytes; if either fails → throw `InvalidPdfException` (HTTP 400)
3. Implement `DocumentUploadService.SaveFile(IFormFile file, Guid patientId, Guid documentId)`: `Directory.CreateDirectory(Path.Combine(uploadsPath, patientId.ToString()))` (idempotent); `using (var stream = File.Create(targetPath)) await file.CopyToAsync(stream)`; catch `IOException` → throw `StorageUnavailableException` (HTTP 500)
4. Implement `POST /api/documents` controller action: validate JWT claims (Patient→own, Staff→any); call ValidatePdf; call SaveFile; INSERT `clinical_documents`; INSERT `audit_logs`; enqueue `BackgroundJob.Enqueue<IExtractionJobService>(j => j.ProcessDocument(documentId), queue: "ai-processing")`; return HTTP 202 with `{ document_id, status: "Processing" }`; on `StorageUnavailableException` → INSERT `audit_logs(DocumentUploadFailed)` + HTTP 500
5. Implement `GET /api/documents?patient_id=X` controller action: verify RBAC (same Patient/Staff rules); query `clinical_documents WHERE patient_id=X ORDER BY uploaded_at DESC`; return document list with `upload_status`
6. Bind uploads path from `IConfiguration["Storage:UploadsPath"]` (never hardcode path); add to `appsettings.json` with default `./uploads` for development

---

## Current Project State

```
Server/
└── Features/
    ├── Booking/          # Existing
    ├── Notifications/    # Existing (EP-005)
    └── Documents/        # TO CREATE — this task
```

> Update this tree during implementation to reflect new files created.

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `Server/Features/Documents/DocumentsController.cs` | `POST /api/documents` + `GET /api/documents`; RBAC |
| CREATE | `Server/Features/Documents/DocumentUploadService.cs` | Validation, file save, DB insert, Hangfire enqueue |
| CREATE | `Server/Features/Documents/IExtractionJobService.cs` | Interface; enables enqueue without us_040 completing first |
| MODIFY | `Server/Program.cs` | Register Documents feature; uploads path config; AI queue constant |
| MODIFY | `Server/appsettings.json` | Add `"Storage": { "UploadsPath": "./uploads" }` |

---

## External References

- [RFC 2388 — multipart/form-data](https://datatracker.ietf.org/doc/html/rfc2388)
- [ASP.NET Core — File uploads](https://learn.microsoft.com/en-us/aspnet/core/mvc/models/file-uploads)
- [Hangfire — Enqueueing jobs to specific queues](https://docs.hangfire.io/en/latest/background-processing/configuring-queues.html)

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] `POST /api/documents` with valid PDF → HTTP 202; `clinical_documents` row created with `upload_status=Pending`; file exists at `/uploads/{patient_id}/{document_id}.pdf`; `audit_logs DocumentUploaded` inserted; Hangfire job enqueued on `ai-processing` queue
- [ ] `POST /api/documents` with `.docx` file → HTTP 400 "Only PDF files are supported"; no file written; no `clinical_documents` row
- [ ] `POST /api/documents` with renamed `.exe` (has `.pdf` extension, non-PDF bytes) → magic-byte check fails; HTTP 400; no file written
- [ ] `/uploads` directory unavailable → HTTP 500 "Document storage unavailable"; no row; `audit_logs DocumentUploadFailed`
- [ ] Patient uploading to own `patient_id` → HTTP 202 (JWT `sub` matches)
- [ ] Patient uploading to different `patient_id` → HTTP 403 Forbidden
- [ ] Staff uploading to any `patient_id` → HTTP 202
- [ ] `GET /api/documents?patient_id=X` returns current `upload_status` for all documents
- [ ] Uploads path loaded from `IConfiguration["Storage:UploadsPath"]`; not hardcoded in source

---

## Implementation Checklist

- [ ] Define `IExtractionJobService` with `Task ProcessDocument(Guid documentId)` method signature
- [ ] Implement MIME + magic-byte PDF validation; reject non-PDF before any file I/O
- [ ] Implement file save to `/uploads/{patient_id}/{document_id}.pdf` with directory-create guard; catch `IOException` → HTTP 500
- [ ] INSERT `clinical_documents` with `upload_status=Pending` after successful file write
- [ ] INSERT `audit_logs` with `action=DocumentUploaded, actor_id, ip_address` (OWASP A09 — security logging)
- [ ] Enqueue `IExtractionJobService.ProcessDocument(documentId)` on `ai-processing` Hangfire queue; return HTTP 202 immediately
- [ ] Implement RBAC guard: Patient → `sub == patient_id`, else 403; Staff → `role == "Staff"`, allowed any patient
- [ ] Implement `GET /api/documents?patient_id=X` with same RBAC guard; ordered by `uploaded_at DESC`
- [ ] Bind uploads path from `IConfiguration` section; never hardcode `/uploads` as a literal path
