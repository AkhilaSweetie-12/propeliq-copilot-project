---
title: "Task — BE Queue Reorder & Mark Arrived APIs (PATCH /api/queue/reorder + PATCH /api/appointments/{id}/arrive)"
task_id: task_002
story_id: us_034
epic: EP-004
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE Queue Reorder & Mark Arrived APIs

## Requirement Reference

- **User Story**: us_034
- **Story Location**: .propel/context/tasks/EP-004/us_034/us_034.md
- **Acceptance Criteria**:
  - AC-2: `PATCH /api/queue/reorder { ordered_appointment_ids: [uuid, ...] }`; update each `appointments.queue_position` in order atomically; INSERT `audit_logs (action=QueueReordered, actor=staff_id, change_summary="positions updated for N appointments")`
  - AC-3: `PATCH /api/appointments/{id}/arrive`; validate `appointments.slot_date = CURRENT_DATE`; UPDATE `appointments SET status=Arrived, arrived_at=NOW()`; INSERT `audit_logs (action=PatientArrived, actor=staff_id, occurred_at=NOW())`; HTTP 200
  - AC-4: `slot_date ≠ CURRENT_DATE` → HTTP 400 "Appointment not scheduled for today"; `?override=true` → proceed + INSERT `audit_logs (action=PatientArrivedOverride, override_reason=NotScheduledToday)`
  - AC-5: Non-Staff JWT → HTTP 403 on both endpoints
  - Edge Case: Double-arrive (already `status=Arrived`) → HTTP 409 "Patient has already been marked arrived"; no duplicate audit log

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
| Database | PostgreSQL 16 | — |
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

Implement two PATCH endpoints in `QueueController` (existing) and `AppointmentsController`. `PATCH /api/queue/reorder` processes an ordered array of appointment IDs and updates `queue_position` values in a single atomic transaction with an audit log. `PATCH /api/appointments/{id}/arrive` validates date constraint, checks for double-arrive (HTTP 409), and updates status to Arrived with audit log. Override flag bypasses date constraint.

---

## Dependent Tasks

- US_008 (Foundational) — `appointments` entity with `queue_position`, `status`, `arrived_at`, `slot_date`
- US_018 (Foundational) — JWT middleware
- us_031 task_002 — `QueueController` exists here; this task adds the reorder PATCH

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Queue/QueueController.cs` | MODIFY | Add `PATCH /api/queue/reorder` |
| `Server/Features/Queue/QueueService.cs` | MODIFY | Add `ReorderQueueAsync(orderedIds, staffId)` |
| `Server/Features/Queue/Dtos/ReorderQueueRequest.cs` | CREATE | `OrderedAppointmentIds: List<Guid>` |
| `Server/Features/Appointments/AppointmentsController.cs` | MODIFY | Add `PATCH /api/appointments/{id}/arrive` |
| `Server/Features/Appointments/AppointmentsService.cs` | MODIFY | Add `MarkArrivedAsync(appointmentId, staffId, override)` |

---

## Implementation Checklist

- [ ] `PATCH /api/queue/reorder [Authorize(Roles="Staff")]`: validate `OrderedAppointmentIds` is non-empty; BEGIN TRANSACTION; for each ID at index `i`, `UPDATE appointments SET queue_position=i+1 WHERE appointment_id=id`; INSERT `audit_logs { action_type='QueueReordered', actor_id=staffId, actor_role='Staff', change_summary=$"positions updated for {count} appointments" }`; COMMIT; return HTTP 200; non-Staff → HTTP 403
- [ ] Validate all IDs in `OrderedAppointmentIds` belong to today's appointments before updating; IDs not found or belonging to other dates → HTTP 400 "Invalid appointment IDs in reorder request"
- [ ] `PATCH /api/appointments/{id}/arrive [Authorize(Roles="Staff")]`: load appointment; if not found → HTTP 404; if `status = Arrived` → HTTP 409 "Patient has already been marked arrived" (no duplicate audit log)
- [ ] Date validation: if `appointment.slot_date ≠ CURRENT_DATE` AND `override != true` → HTTP 400 "Appointment not scheduled for today"
- [ ] If `override=true` AND `slot_date ≠ CURRENT_DATE`: UPDATE `appointments SET status=Arrived, arrived_at=NOW()`; INSERT `audit_logs { action_type='PatientArrivedOverride', actor_id=staffId, actor_role='Staff', change_summary='override_reason=NotScheduledToday' }`; return HTTP 200
- [ ] Standard arrive (today's appointment): UPDATE `appointments SET status=Arrived, arrived_at=NOW()`; INSERT `audit_logs { action_type='PatientArrived', actor_id=staffId, actor_role='Staff', entity_id=appointmentId, occurred_at=NOW() }`; return HTTP 200
- [ ] All mutations use atomic transactions; no partial updates on failure; non-Staff → HTTP 403 on both endpoints

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] `PATCH /api/queue/reorder` with ordered IDs → `queue_position` updated in order; `audit_logs QueueReordered` written
- [ ] Invalid IDs in reorder request → HTTP 400
- [ ] `PATCH /api/appointments/{id}/arrive` today's appointment → HTTP 200; `status=Arrived`; `audit_logs PatientArrived`
- [ ] Same request when already `status=Arrived` → HTTP 409; no second audit log entry
- [ ] Future appointment arrive without override → HTTP 400 "Appointment not scheduled for today"
- [ ] Future appointment arrive with `?override=true` → HTTP 200; `audit_logs PatientArrivedOverride`
- [ ] Non-Staff JWT on both endpoints → HTTP 403
