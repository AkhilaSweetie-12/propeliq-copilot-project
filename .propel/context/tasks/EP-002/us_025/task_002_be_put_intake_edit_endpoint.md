---
title: "Task — BE PUT Intake Edit Endpoint + Hangfire View360 Enqueue"
task_id: task_002
story_id: us_025
epic: EP-002
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE PUT Intake Edit Endpoint + Hangfire View360 Enqueue

## Requirement Reference

- **User Story**: us_025
- **Story Location**: .propel/context/tasks/EP-002/us_025/us_025.md
- **Acceptance Criteria**:
  - AC-2: `PUT /api/intake/{intake_id} {updated_fields, updated_at}` → update `patient_intakes SET updated_at = NOW()` (preserves `submitted_at`); write `audit_logs { action_type = "IntakeUpdated", change_summary = field names that changed }`; return HTTP 200
  - AC-3: Only the owning patient (`patient_id == actor_id`) can call this endpoint → HTTP 403 if caller's `user_id ≠ row's `patient_id`
  - AC-4: On successful PUT → enqueue Hangfire `RefreshPatientView360Job` (async; does NOT block patient response); patient save confirmation is not delayed
  - AC-5: Auto-save `POST /api/intake/draft` during edit mode → UPSERT partial fields (same as new intake); no audit log for draft saves
  - Edge Case: Concurrent edit → optimistic concurrency check via `updated_at` in PUT payload; if client's `updated_at ≠ DB value → HTTP 409 "Your intake was updated in another session — please refresh"
  - Edge Case: Clearing `chief_complaint` → NOT NULL constraint → HTTP 400 if empty on PUT

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
| Background Jobs | Hangfire | latest compatible with .NET 9 |
| Auth | JWT Bearer | ASP.NET Core |
| Logging | Serilog | latest |

---

## AI References (AI Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |
| **AI Pattern** | N/A |
| **Prompt Template Path** | N/A |
| **Guardrails Config** | N/A |
| **Model Provider** | N/A |

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

Implement `PUT /api/intake/{intake_id}` in the existing `IntakeController`. The endpoint enforces patient ownership (RBAC ownership guard: `patient_id == actor_id`), performs an optimistic concurrency check on `updated_at`, updates all supplied JSONB fields, preserves `submitted_at`, writes an `audit_logs` entry listing changed field names in `change_summary`, and enqueues a Hangfire `RefreshPatientView360Job` to re-aggregate the 360-degree patient view asynchronously. The endpoint returns HTTP 200 before the Hangfire job completes.

---

## Dependent Tasks

- US_010 (`patient_intakes` entity) — must be migrated
- US_015 (`audit_logs` entity) — must be available
- us_023 task_002 — `IntakeController` and `IntakeService` must exist; this task adds the PUT endpoint
- US_021 task_001 (`AuditMiddleware` with `[AuditAction]`) — intake controller should use `[AuditAction]` attribute for consistent audit behaviour; alternatively write audit log directly in service

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Intake/IntakeController.cs` | MODIFY | Add `PUT /api/intake/{id}` endpoint |
| `Server/Features/Intake/IntakeService.cs` | MODIFY | Add `UpdateIntakeAsync(...)` with ownership guard, concurrency check, field diff, audit log, Hangfire enqueue |
| `Server/Features/Intake/Jobs/RefreshPatientView360Job.cs` | CREATE | Hangfire job: re-aggregate `patient_view_360.aggregated_data` from updated `patient_intakes` |
| `Server/Features/Intake/Dtos/UpdateIntakeRequest.cs` | CREATE | PUT request DTO: all nullable fields + `updated_at` for concurrency check |
| `Server/Program.cs` | MODIFY | Register `RefreshPatientView360Job` with Hangfire if not already present |

---

## Implementation Plan

1. **Endpoint** — `[HttpPut("{id:guid}")]` in `IntakeController`. `[Authorize(Roles = "Patient")]`.

2. **Ownership guard** — Load `patient_intakes WHERE intake_id = @id`. If not found → HTTP 404. If `row.PatientId != actorId` → HTTP 403 "Access denied."

3. **Optimistic concurrency** — Compare `request.UpdatedAt` with `row.UpdatedAt` (UTC). If they differ → HTTP 409 "Your intake was updated in another session — please refresh to see the latest version."

4. **Field-level change diff** — Before applying update, compute `changedFields = List<string>` by comparing each supplied field value against the existing row value. Build `change_summary = $"Fields updated: {string.Join(", ", changedFields)}"` (max 4,000 chars; truncation handled by AuditMiddleware or manually here).

5. **Apply update** — Update only provided (non-null) fields in `patient_intakes`. Set `updated_at = NOW()`. Do NOT change `submitted_at`. Encrypt any PHI JSONB fields before write. Call `SaveChangesAsync()`.

6. **`chief_complaint` NOT NULL guard** — If `request.ChiefComplaint` is explicitly set to empty string or null → HTTP 400 "Chief complaint is required."

7. **Audit log** — Write directly (not via middleware for precision on field names): `AuditLogs.Add(new AuditLog { action_type = "IntakeUpdated", entity_type = "PatientIntake", entity_id = intake_id, actor_id, actor_role = "Patient", change_summary, ip_address, occurred_at = DateTimeOffset.UtcNow })`. Use the `AuditDbContext` (separate context from us_021).

8. **Hangfire enqueue** — `BackgroundJob.Enqueue<RefreshPatientView360Job>(j => j.Execute(actorId))`. Fire after `SaveChangesAsync()` succeeds. Do not await.

9. **`RefreshPatientView360Job`** — Reads full `patient_intakes` for `patientId`; re-aggregates data into `patient_view_360.aggregated_data`; sets `is_verified = false` (Staff re-verification required); sets `last_updated_at = NOW()`. Implements `[AutomaticRetry(Attempts = 3)]`.

10. **HTTP 200 response** — Return `{ intake_id, updated_at }` immediately after DB save + Hangfire enqueue, before job completes.

---

## Current Project State

```
Server/
  Features/
    Intake/
      IntakeController.cs     # exists
      IntakeService.cs        # exists
      Dtos/
        IntakeDraftRequest.cs
        IntakeStatusResponse.cs
        IntakeCurrentDataResponse.cs
  Data/
    AuditDbContext.cs         # from us_021
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | Server/Features/Intake/IntakeController.cs | Add PUT /api/intake/{id} with ownership + concurrency guards |
| MODIFY | Server/Features/Intake/IntakeService.cs | Add UpdateIntakeAsync: diff, update, audit log, Hangfire enqueue |
| CREATE | Server/Features/Intake/Jobs/RefreshPatientView360Job.cs | Hangfire job: re-aggregate patient_view_360 from updated intake |
| CREATE | Server/Features/Intake/Dtos/UpdateIntakeRequest.cs | PUT DTO with nullable fields + updated_at timestamp |
| MODIFY | Server/Program.cs | Register RefreshPatientView360Job with Hangfire if not present |

---

## External References

- EF Core optimistic concurrency with `updated_at` timestamp: https://learn.microsoft.com/en-us/ef/core/saving/concurrency
- Hangfire `BackgroundJob.Enqueue` fire-and-forget: https://docs.hangfire.io/en/latest/background-methods/calling-methods-in-background.html
- Hangfire `[AutomaticRetry]`: https://docs.hangfire.io/en/latest/background-processing/dealing-with-exceptions.html
- EF Core partial update (only changed columns): https://learn.microsoft.com/en-us/ef/core/saving/disconnected-entities
- ASP.NET Core ownership/resource guard pattern: https://learn.microsoft.com/en-us/aspnet/core/security/authorization/resourcebased

---

## Build Commands

- `cd Server && dotnet build` — C# compile check
- `cd Server && dotnet test` — Run unit/integration tests
- `cd Server && dotnet run` — Start server for integration testing

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] PUT with `patient_id == actor_id` → updates fields + `updated_at`; preserves `submitted_at`; HTTP 200
- [ ] PUT with `patient_id ≠ actor_id` → HTTP 403
- [ ] PUT with stale `updated_at` (concurrent edit simulation) → HTTP 409 with prescribed message
- [ ] Empty `chief_complaint` in PUT body → HTTP 400 "Chief complaint is required"
- [ ] Audit log entry written with correct `change_summary` listing changed field names
- [ ] Hangfire `RefreshPatientView360Job` enqueued after successful save (verify job in Hangfire dashboard)
- [ ] `RefreshPatientView360Job` sets `patient_view_360.is_verified = false` after re-aggregation
- [ ] HTTP 200 returned immediately; job completion does NOT block response
- [ ] PHI JSONB columns encrypted before persistence

---

## Implementation Checklist

- [ ] Add `[HttpPut("{id:guid}")]` endpoint to `IntakeController.cs`
- [ ] Implement ownership guard: load row by `intake_id`; HTTP 404 if not found; HTTP 403 if `PatientId ≠ actorId`
- [ ] Implement optimistic concurrency check: compare `request.UpdatedAt` vs `row.UpdatedAt`; HTTP 409 if mismatch
- [ ] Implement field-level diff to produce `changedFields` list for `change_summary`
- [ ] Validate `chief_complaint` not empty on PUT; return HTTP 400 if blank
- [ ] Apply partial JSONB field updates (only non-null supplied fields); encrypt PHI fields
- [ ] Set `updated_at = NOW()`; preserve `submitted_at`; call `SaveChangesAsync()`
- [ ] Write `AuditLog { action_type = "IntakeUpdated" }` with field-level `change_summary`
- [ ] Create `UpdateIntakeRequest.cs` DTO with all nullable fields + `UpdatedAt`
- [ ] Create `RefreshPatientView360Job.cs` with re-aggregation logic and `[AutomaticRetry(Attempts = 3)]`
- [ ] Call `BackgroundJob.Enqueue<RefreshPatientView360Job>(...)` after save; return HTTP 200 immediately
- [ ] Register job type in `Program.cs`
