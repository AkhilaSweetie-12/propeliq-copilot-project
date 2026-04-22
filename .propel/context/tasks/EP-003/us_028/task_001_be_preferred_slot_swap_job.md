---
title: "Task — BE PreferredSlotSwapJob — Hangfire Atomic Swap & Notification Dispatch"
task_id: task_001
story_id: us_028
epic: EP-003
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — BE PreferredSlotSwapJob — Hangfire Atomic Swap & Notification Dispatch

## Requirement Reference

- **User Story**: us_028
- **Story Location**: .propel/context/tasks/EP-003/us_028/us_028.md
- **Acceptance Criteria**:
  - AC-1: `SlotReleasedEvent` detected (whenever `appointment_slots.is_available` transitions to `true`) → Hangfire enqueues `PreferredSlotSwapJob(released_slot_id)`; exactly-once via Hangfire state machine
  - AC-2: `PreferredSlotSwapJob` executes `BEGIN TRANSACTION`; `SELECT waitlist_entries WHERE slot_id=preferred_slot AND status=Waiting ORDER BY requested_at ASC LIMIT 1 FOR UPDATE` (NFR-013); no-op COMMIT if no rows match
  - AC-3: Atomic swap in single transaction: UPDATE `appointments.slot_id`, set `preferred_slot_id = NULL`; UPDATE original slot `is_available = true`; UPDATE preferred slot `is_available = false`; UPDATE `waitlist_entries SET status = Fulfilled`; INSERT `audit_logs (action=PreferredSlotSwapped)`
  - AC-4: Post-commit: enqueue `SendSwapNotificationJob(patient_id)` — sends email + non-blocking SMS; notification failures retry ×3 with exponential backoff; notification failure does NOT roll back swap
  - AC-5: Transaction failure → ROLLBACK; Hangfire retries job ×3 exponential backoff; INSERT `audit_logs (action=PreferredSlotSwapFailed)`
  - Edge Case: Patient's `appointment.slot_date < CURRENT_DATE` → skip swap; set `waitlist_entries.status = Expired`; log `PreferredSlotSwapSkipped`
  - Edge Case: `waitlist_entries.status != Waiting` at `FOR UPDATE` read (e.g., patient cancelled) → no-op COMMIT

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No |
| **Figma URL** | N/A |
| **Wireframe Status** | N/A — Background job |
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
| Background Jobs | Hangfire | latest compatible with .NET 9 |
| ORM | Entity Framework Core | 9 (Npgsql) |
| Database | PostgreSQL 16 | `FOR UPDATE` row locking |
| Email | SMTP / MailKit | — |
| SMS | Configured SMS gateway | — |
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

Implement two Hangfire jobs: `PreferredSlotSwapJob` and `SendSwapNotificationJob`. `PreferredSlotSwapJob` is triggered by a `SlotReleasedEvent` (raised inside `AppointmentsController` or a domain event handler when `is_available` transitions to `true`). It acquires a `SELECT FOR UPDATE` lock on the FIFO-first `waitlist_entries` row for the released slot, executes an atomic multi-table swap, then enqueues `SendSwapNotificationJob`. `SendSwapNotificationJob` delivers email + SMS asynchronously; failure retries without rolling back the swap.

---

## Dependent Tasks

- US_009 (Foundational) — `waitlist_entries` entity; `appointments.preferred_slot_id` column
- US_006 (Foundational) — Hangfire job queue registration
- us_027 task_002 — `waitlist_entries` rows are created here; `SlotReleasedEvent` is also fired here when a slot is released

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Slots/Jobs/PreferredSlotSwapJob.cs` | CREATE | Main swap Hangfire job |
| `Server/Features/Slots/Jobs/SendSwapNotificationJob.cs` | CREATE | Email + SMS notification job; [AutomaticRetry(Attempts = 3)] |
| `Server/Features/Slots/Events/SlotReleasedEvent.cs` | CREATE | Domain event raised when `is_available` transitions to `true` |
| `Server/Features/Slots/SlotEventDispatcher.cs` | CREATE | Handles `SlotReleasedEvent`; enqueues `PreferredSlotSwapJob` |
| `Server/Program.cs` | MODIFY | Register both Hangfire jobs |

---

## Implementation Checklist

- [ ] Create `SlotReleasedEvent` and `SlotEventDispatcher`; dispatch event and enqueue `PreferredSlotSwapJob(slotId)` whenever `appointment_slots.is_available` transitions to `true` (covers both cancellation releases and admin releases)
- [ ] In `PreferredSlotSwapJob.Execute(Guid slotId)`: `BEGIN TRANSACTION (Serializable)`; execute `SELECT waitlist_entries WHERE slot_id=@slotId AND status='Waiting' ORDER BY requested_at ASC LIMIT 1 FOR UPDATE` via raw SQL; if no row → COMMIT no-op; log `PreferredSlotSwapNoOp`
- [ ] Before proceeding with swap: validate `appointment.slot_date >= CURRENT_DATE`; if historical → UPDATE `waitlist_entries SET status='Expired'`; COMMIT; log `PreferredSlotSwapSkipped`
- [ ] Atomic swap in single transaction: UPDATE `appointments SET slot_id=preferredSlotId, preferred_slot_id=NULL, updated_at=NOW()`; UPDATE `appointment_slots SET is_available=true WHERE slot_id=originalSlotId`; UPDATE `appointment_slots SET is_available=false WHERE slot_id=preferredSlotId`; UPDATE `waitlist_entries SET status='Fulfilled'`; INSERT `audit_logs { action_type='PreferredSlotSwapped', original_slot_id, new_slot_id, appointment_id, patient_id, swapped_at=NOW() }`; COMMIT
- [ ] On swap transaction failure: catch exception; INSERT `audit_logs { action_type='PreferredSlotSwapFailed', error_message }` (outside the rolled-back tx); re-throw to trigger Hangfire retry with exponential backoff ×3
- [ ] After successful COMMIT: enqueue `BackgroundJob.Enqueue<SendSwapNotificationJob>(j => j.Execute(patientId, newSlotId))` — fire-and-forget; does NOT block response
- [ ] In `SendSwapNotificationJob [AutomaticRetry(Attempts = 3)]`: send email (new date/time, provider, cancellation policy); send SMS via gateway; on per-delivery failure INSERT `audit_logs { action_type='NotificationFailed' }`; notification failure does NOT trigger swap rollback
- [ ] Register both jobs in `Program.cs`; configure Hangfire retry policy: exponential backoff intervals 15 s / 30 s / 60 s; failed state after all retries exhausted

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Trigger `SlotReleasedEvent` for a slot with a `Waiting` `waitlist_entries` row → `PreferredSlotSwapJob` enqueued
- [ ] Swap executes atomically: `appointments.slot_id` updated; original slot `is_available=true`; preferred slot `is_available=false`; `waitlist_entries.status=Fulfilled`; `audit_logs` entry with `PreferredSlotSwapped`
- [ ] Concurrent workers for same slot → only one proceeds (verify `FOR UPDATE` prevents double-swap)
- [ ] `appointment.slot_date` in the past → `waitlist_entries.status=Expired`; `audit_logs PreferredSlotSwapSkipped`; no appointment update
- [ ] `waitlist_entries.status != Waiting` at lock time → no-op COMMIT; no audit log
- [ ] Transaction failure → ROLLBACK; `audit_logs PreferredSlotSwapFailed`; Hangfire retries ×3
- [ ] `SendSwapNotificationJob` runs after swap; notification failure does not roll back swap
