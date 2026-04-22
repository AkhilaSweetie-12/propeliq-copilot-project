---
title: "Task — BE Booking Transaction, Insurance Pre-Check & SELECT FOR UPDATE (POST /api/appointments/book)"
task_id: task_002
story_id: us_027
epic: EP-003
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE Booking Transaction, Insurance Pre-Check & SELECT FOR UPDATE

## Requirement Reference

- **User Story**: us_027
- **Story Location**: .propel/context/tasks/EP-003/us_027/us_027.md
- **Acceptance Criteria**:
  - AC-2: `POST /api/appointments/book`; query `insurance_records` for `(name, member_id)` match; result (`Matched` / `Unmatched` / `Not Found`) stored on appointment; never blocks booking
  - AC-3: Optional `preferred_slot_id` included in payload; stored on appointment; `INSERT waitlist_entries` when provided; API validates `preferred_slot_id != slot_id` and preferred slot `is_available = false`
  - AC-4: Full transaction: `BEGIN` → `SELECT appointment_slots FOR UPDATE` → INSERT `appointments (status=Confirmed)` → UPDATE `appointment_slots SET is_available=false` → `INSERT audit_logs (action=AppointmentBooked)` → `INSERT waitlist_entries` (if preferred slot provided) → COMMIT → HTTP 201 `{ appointment_id }`
  - AC-5: If slot already taken on `FOR UPDATE` check → ROLLBACK → HTTP 409 Conflict
  - Edge Case: `preferred_slot_id == slot_id` → HTTP 400 "Invalid preferred slot selection"
  - Edge Case: Insurance query timeout > 500 ms → record `Not Found`; proceed with booking

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
| Auth | JWT Bearer RBAC | `[Authorize(Roles = "Patient")]` |
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

Implement `POST /api/appointments/book` in `AppointmentsController`. The endpoint executes a serialisable transaction: acquires a row-level `FOR UPDATE` lock on the target slot, handles the taken-slot 409 path, inserts the appointment, marks the slot unavailable, optionally inserts a `waitlist_entries` row for the preferred slot, writes an audit log entry, and commits. The insurance pre-check is a non-blocking synchronous DB query with a 500 ms timeout — its result is stored on the appointment but never gates the transaction. On successful commit, enqueues `send_confirmation_job` via Hangfire.

---

## Dependent Tasks

- US_008 (Foundational) — `appointments`, `appointment_slots`, `insurance_records`, `waitlist_entries` entities
- US_009 (Foundational) — `waitlist_entries` entity schema
- US_018 (Foundational) — JWT auth middleware
- us_030 task_002 — `send_confirmation_job` Hangfire job must be registered before this enqueue

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Appointments/AppointmentsController.cs` | CREATE | `POST /api/appointments/book` |
| `Server/Features/Appointments/AppointmentsService.cs` | CREATE | `BookAppointmentAsync(BookingRequest, actorId)` with full transaction logic |
| `Server/Features/Appointments/Dtos/BookingRequest.cs` | CREATE | `slot_id`, `preferred_slot_id?`, `insurance_name`, `insurance_id` |
| `Server/Features/Appointments/Dtos/BookingResponse.cs` | CREATE | `appointment_id`, `insurance_status` |
| `Server/Features/Insurance/InsuranceService.cs` | CREATE | `CheckInsuranceAsync(name, memberId)` — query `insurance_records`; 500 ms timeout |

---

## Implementation Checklist

- [ ] Add `[Authorize(Roles = "Patient")]` `[HttpPost("book")]` endpoint; validate `preferred_slot_id != slot_id` (HTTP 400 if equal); validate preferred slot `is_available = false` (HTTP 400 if available or same as booked slot)
- [ ] Use `await _dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable)` (or `RepeatableRead`); execute `SELECT … FROM appointment_slots WHERE slot_id=X FOR UPDATE` via raw SQL / `ExecuteSqlAsync`
- [ ] If `FOR UPDATE` result shows `is_available = false` → ROLLBACK → return HTTP 409 "That slot was just taken — please choose another"
- [ ] Insert `appointments { slot_id, patient_id = actorId, status = "Confirmed", preferred_slot_id?, insurance_name, insurance_id, insurance_status, created_at = NOW() }`; UPDATE `appointment_slots SET is_available = false WHERE slot_id = X`
- [ ] Run `InsuranceService.CheckInsuranceAsync` with a `CancellationToken` that cancels after 500 ms; result is `Matched` / `Unmatched` / `Not Found`; set `appointments.insurance_status`; this query executes outside the locked transaction to avoid extending the lock window
- [ ] If `preferred_slot_id` is provided: INSERT `waitlist_entries { patient_id, slot_id = preferred_slot_id, status = "Waiting", requested_at = NOW() }` within the same transaction
- [ ] INSERT `audit_logs { action_type = "AppointmentBooked", entity_type = "Appointment", entity_id = appointment_id, actor_id, actor_role = "Patient", occurred_at = NOW() }` within transaction; COMMIT
- [ ] After successful commit, call `BackgroundJob.Enqueue<SendConfirmationJob>(j => j.Execute(appointmentId))`; return HTTP 201 `{ appointment_id, insurance_status }`

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Successful booking → HTTP 201 with `appointment_id`; `appointment_slots.is_available = false`; `audit_logs` entry present
- [ ] Second booking request for same slot (concurrent) → HTTP 409 (test with two simultaneous requests)
- [ ] `preferred_slot_id == slot_id` → HTTP 400
- [ ] `preferred_slot_id` points to available slot → HTTP 400 "Invalid preferred slot selection"
- [ ] Insurance timeout (mock > 500 ms) → `Not Found` stored; booking still succeeds (HTTP 201)
- [ ] `waitlist_entries` row inserted when `preferred_slot_id` provided
- [ ] Hangfire `SendConfirmationJob` enqueued after commit (verify via Hangfire dashboard)
- [ ] Non-Patient JWT → HTTP 403
