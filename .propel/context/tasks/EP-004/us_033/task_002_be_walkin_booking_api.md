---
title: "Task — BE Walk-In Booking Transaction, Override & Conditional Email (POST /api/appointments/walkin)"
task_id: task_002
story_id: us_033
epic: EP-004
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE Walk-In Booking Transaction, Override & Conditional Email

## Requirement Reference

- **User Story**: us_033
- **Story Location**: .propel/context/tasks/EP-004/us_033/us_033.md
- **Acceptance Criteria**:
  - AC-3: `POST /api/appointments/walkin [Authorize(Roles="Staff")]`; `BEGIN TRANSACTION`; `SELECT appointment_slots FOR UPDATE`; INSERT `appointments (booking_type=WalkIn, status=Confirmed, created_by=staff_id)`; UPDATE `appointment_slots SET is_available=false`; INSERT `audit_logs (action=WalkInBooked, actor=staff_id)`; COMMIT; HTTP 201; enqueue `AppointmentRiskScoringJob`
  - AC-4: `slot_override=true` flag → proceed even when `is_available=false`; INSERT `audit_logs (action=WalkInSlotOverride, actor=staff_id, note=auto-logged override justification)` in same transaction
  - AC-5: If patient has non-null `email`, enqueue `send_walkin_confirmation_job(appointment_id)` after commit; if `guest_profile=true` or no email, INSERT `audit_logs (action=ConfirmationSkipped_NoEmail)` — booking NOT affected
  - Edge Case: Non-Staff JWT → HTTP 403; `patient_id=null` only valid when `booking_type=WalkIn` AND `guest_profile=true`; concurrent slot taken → HTTP 409

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
| Database | PostgreSQL 16 | `FOR UPDATE` row locking |
| Auth | JWT Bearer RBAC | `[Authorize(Roles = "Staff")]` |
| Background Jobs | Hangfire | `.Enqueue` fire-and-forget |
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

Implement `POST /api/appointments/walkin` in `AppointmentsController` (or a new `WalkInController` under the same feature folder). Validates Staff RBAC and guest-profile rules. Executes the serialisable transaction with `SELECT FOR UPDATE`, handles override flag, inserts appointment + audit log entries. After commit, conditionally enqueues email confirmation job and always enqueues `AppointmentRiskScoringJob`. Also adds `GET /api/providers/available-today` for the provider dropdown.

---

## Dependent Tasks

- US_008 (Foundational) — `appointments`, `appointment_slots` entities; `booking_type` enum extension (WalkIn)
- US_018 (Foundational) — JWT auth middleware
- us_030 task_002 — `AppointmentConfirmationDocument` QuestPDF template reused by `send_walkin_confirmation_job`
- us_035 task_002 — `AppointmentRiskScoringJob` must be registered before enqueue here

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Appointments/AppointmentsController.cs` | MODIFY | Add `POST /api/appointments/walkin` |
| `Server/Features/Appointments/AppointmentsService.cs` | MODIFY | Add `BookWalkInAsync(WalkInBookingRequest, staffId)` |
| `Server/Features/Appointments/Dtos/WalkInBookingRequest.cs` | CREATE | `patient_id?`, `guest_profile?`, `slot_id`, `chief_complaint`, `provider_id`, `urgency_level`, `notes?`, `slot_override?` |
| `Server/Features/Appointments/Jobs/SendWalkInConfirmationJob.cs` | CREATE | Wraps existing QuestPDF template; skips if no email |
| `Server/Features/Providers/ProvidersController.cs` | CREATE | `GET /api/providers/available-today [Authorize(Roles="Staff")]` |

---

## Implementation Checklist

- [ ] `POST /api/appointments/walkin [Authorize(Roles="Staff")]`: validate `patient_id=null` is only accepted when `guest_profile=true` AND `booking_type=WalkIn`; all other combinations with null `patient_id` → HTTP 400
- [ ] `BEGIN TRANSACTION (Serializable)`; `SELECT appointment_slots WHERE slot_id=X FOR UPDATE`; if `is_available=false` AND `slot_override=false` → ROLLBACK → HTTP 409 "That slot was just taken — please select another"
- [ ] If `slot_override=true` (Staff confirmed override dialog): proceed regardless of `is_available` state; INSERT `audit_logs { action_type='WalkInSlotOverride', actor_id=staffId, actor_role='Staff', change_summary='Override: no available slot selected — Staff-confirmed' }` within same transaction
- [ ] INSERT `appointments { slot_id, patient_id?, guest_profile?, booking_type='WalkIn', status='Confirmed', chief_complaint, provider_id, urgency_level, notes?, created_by=staffId, created_at=NOW() }`; UPDATE `appointment_slots SET is_available=false`; INSERT `audit_logs { action_type='WalkInBooked', actor_id=staffId, actor_role='Staff' }`; COMMIT
- [ ] After commit: load patient email from `users WHERE user_id=patient_id`; if non-null email → `BackgroundJob.Enqueue<SendWalkInConfirmationJob>(j => j.Execute(appointmentId))`; if no email / guest profile → INSERT `audit_logs { action_type='ConfirmationSkipped_NoEmail' }`
- [ ] Always enqueue `BackgroundJob.Enqueue<AppointmentRiskScoringJob>(j => j.Execute(appointmentId))` after commit — same as online booking path
- [ ] `GET /api/providers/available-today [Authorize(Roles="Staff")]`: query providers who have at least one `is_available=true` slot for `slot_date = CURRENT_DATE`; return `{ provider_id, full_name, specialty }`; `AsNoTracking()`
- [ ] HTTP 403 for non-Staff on both endpoints; HTTP 201 `{ appointment_id }` on success

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] `POST /api/appointments/walkin` Staff JWT + available slot → HTTP 201; appointment row `booking_type=WalkIn`; slot `is_available=false`; `audit_logs WalkInBooked`
- [ ] Same request with `slot_override=true` on unavailable slot → HTTP 201; `audit_logs WalkInSlotOverride` written
- [ ] `patient_id=null` without `guest_profile=true` → HTTP 400
- [ ] Concurrent slot taken → HTTP 409 (simulate two concurrent requests)
- [ ] Patient has email → `SendWalkInConfirmationJob` enqueued
- [ ] Guest / no email → `audit_logs ConfirmationSkipped_NoEmail`; no job enqueued
- [ ] `AppointmentRiskScoringJob` enqueued for all walk-in bookings
- [ ] Patient/Admin JWT → HTTP 403
- [ ] `GET /api/providers/available-today` → returns only providers with today's available slots
