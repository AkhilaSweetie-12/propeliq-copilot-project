---
title: "Task — BE Patient Search & Staff-Initiated Patient Creation API"
task_id: task_002
story_id: us_032
epic: EP-004
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE Patient Search & Staff-Initiated Patient Creation API

## Requirement Reference

- **User Story**: us_032
- **Story Location**: .propel/context/tasks/EP-004/us_032/us_032.md
- **Acceptance Criteria**:
  - AC-1: `GET /api/patients/search?query=X [Authorize(Roles = "Staff")]`; search by name or DOB using parameterised `ILIKE`; returns list of patient cards (name, DOB, MRN, last visit); HTTP 403 for non-Staff
  - AC-4: `POST /api/patients { first_name, last_name, dob, phone, email?, role=Patient, status=Active }`; INSERT `users`; INSERT `audit_logs (action=PatientCreatedByStaff, actor_id=staff_id)`; HTTP 201 `{ patient_id, name, dob, mrn }`; no email verification required; atomic transaction
  - Edge Case: `POST /api/patients` failure → full rollback; no partial record in DB

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
| Backend | ASP.NET Core Web API | .NET 9 |
| ORM | Entity Framework Core | 9 (Npgsql) |
| Database | PostgreSQL 16 | `ILIKE` parameterised |
| Auth | JWT Bearer RBAC | `[Authorize(Roles = "Staff")]` |
| Logging | Serilog | latest |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |

---

## Mobile References

| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |

---

## Task Overview

Implement two Staff-only endpoints in `PatientsController`. `GET /api/patients/search` performs a parameterised `ILIKE` search on name and DOB fields. `POST /api/patients` creates a new patient account (role=Patient, status=Active, no email verification) in an atomic transaction with an audit log entry. Both endpoints are `[Authorize(Roles = "Staff")]`.

---

## Dependent Tasks

- US_007 (Foundational) — `users` entity with `role`, `status`, `dob`, `phone`, `email`, `mrn`, `first_name`, `last_name`
- US_018 (Foundational) — JWT middleware
- US_015 / US_021 task_001 — `audit_logs` entity and `AuditDbContext`

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Patients/PatientsController.cs` | CREATE | `GET /api/patients/search`; `POST /api/patients` |
| `Server/Features/Patients/PatientsService.cs` | CREATE | `SearchPatientsAsync(query)`; `CreatePatientAsync(request, staffId)` |
| `Server/Features/Patients/Dtos/PatientSearchResult.cs` | CREATE | `patient_id`, `name`, `dob`, `mrn`, `last_visit_date` |
| `Server/Features/Patients/Dtos/CreatePatientRequest.cs` | CREATE | `first_name`, `last_name`, `dob`, `phone`, `email?` |
| `Server/Features/Patients/Dtos/CreatePatientResponse.cs` | CREATE | `patient_id`, `name`, `dob`, `mrn` |

---

## Implementation Checklist

- [ ] `GET /api/patients/search?query=X [Authorize(Roles="Staff")]`: validate `query` is not null/empty; perform `EF.Functions.ILike(u.FirstName + " " + u.LastName, $"%{query}%") OR EF.Functions.ILike(u.Dob.ToString(), $"%{query}%")` — use parameterised values, never string-format query into SQL; return `IEnumerable<PatientSearchResult>` with HTTP 200; non-Staff → HTTP 403
- [ ] `POST /api/patients [Authorize(Roles="Staff")]`: validate required fields (first_name, last_name, dob, phone) with `[Required]` / FluentValidation; BEGIN TRANSACTION; generate new `Guid` for `patient_id`; auto-generate MRN (`MRN-{timestamp}`); set `role=Patient`, `status=Active`, `email_verified=true` (Staff-created — no verification); INSERT `users`; INSERT `audit_logs { action_type="PatientCreatedByStaff", entity_type="User", entity_id=patient_id, actor_id=staffId, actor_role="Staff" }`; COMMIT; return HTTP 201 with `CreatePatientResponse`
- [ ] Wrap creation in `try-catch`; on any exception ROLLBACK transaction; return HTTP 500 (surface as "Unable to create account" to client — no internal details exposed)
- [ ] Add `[Route("api/patients")]` with `[Authorize(Roles="Staff")]` at controller level; all child routes inherit RBAC
- [ ] Limit search results to 20 rows maximum; add `AsNoTracking()` on search query; do not return password hash or any sensitive internal field

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] `GET /api/patients/search?query=john` with Staff JWT → HTTP 200, filtered results
- [ ] `GET /api/patients/search?query=john` with Patient JWT → HTTP 403
- [ ] `POST /api/patients` with valid data → HTTP 201; `users` row inserted; `audit_logs PatientCreatedByStaff` written; MRN auto-generated
- [ ] `POST /api/patients` missing required field → HTTP 400 validation error
- [ ] DB failure during creation → ROLLBACK; no partial `users` row
- [ ] Search result does not include password hash or internal tokens
- [ ] ILIKE pattern uses parameterised values (no SQL injection vector)
