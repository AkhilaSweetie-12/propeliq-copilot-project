---
title: "Task — BE Waitlist API, WaitlistNotificationJob & WaitlistExpiryJob"
task_id: task_002
story_id: us_029
epic: EP-003
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE Waitlist API, WaitlistNotificationJob & WaitlistExpiryJob

## Requirement Reference

- **User Story**: us_029
- **Story Location**: .propel/context/tasks/EP-003/us_029/us_029.md
- **Acceptance Criteria**:
  - AC-1: `POST /api/waitlist { patient_id, preferred_time_window? }`; INSERT `waitlist_entries { status=Waiting, requested_at=NOW(), queue_position=COUNT(Waiting)+1 }`; HTTP 201 `{ waitlist_position }`; INSERT `audit_logs (action=JoinedWaitlist)` in same transaction
  - AC-2: HTTP 409 if `waitlist_entries` with `status IN ('Waiting','Notified')` already exists for patient; message "You are already on the waitlist"
  - AC-3: `WaitlistNotificationJob` triggered by `SlotReleasedEvent` (same event as us_028); `SELECT waitlist_entries WHERE slot_id IS NULL AND status='Waiting' ORDER BY requested_at ASC LIMIT 1 FOR UPDATE`; send email with slot details; UPDATE `status=Notified, notified_at=NOW()`; slot NOT pre-reserved
  - AC-4: `WaitlistExpiryJob` (Hangfire recurring, every 15 min): UPDATE `waitlist_entries SET status='Expired' WHERE status='Notified' AND notified_at < NOW()-INTERVAL '2 hours'`; re-run `WaitlistNotificationJob` for next-in-queue; INSERT `audit_logs (action=WaitlistEntryExpired)`
  - AC-5: On booking confirmation (us_027 AC-4), UPDATE `waitlist_entries SET status='Cancelled' WHERE patient_id=X AND status IN ('Waiting','Notified')`; INSERT `audit_logs (action=WaitlistCancelledOnBooking)`
  - Edge Case: Email delivery failure → retry ×3; skip `NotificationFailed` entries for next job run; log to `audit_logs`
  - Edge Case: Multiple slots released simultaneously → separate `WaitlistNotificationJob` per slot; `FOR UPDATE` ensures one patient per slot

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
| Background Jobs | Hangfire | latest compatible with .NET 9 |
| ORM | Entity Framework Core | 9 (Npgsql) |
| Database | PostgreSQL 16 | `FOR UPDATE`, `INTERVAL` expressions |
| Email | SMTP / MailKit | — |
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

Implement `POST /api/waitlist` endpoint with a duplicate-guard query (HTTP 409) and a transactional INSERT + audit log. Implement three Hangfire components: `WaitlistNotificationJob` (triggered on `SlotReleasedEvent`; general-queue FOR UPDATE selection); `WaitlistExpiryJob` (recurring every 15 min; marks `Notified` → `Expired` after 2 hours, re-triggers notification); and cascade-cancel logic called from `AppointmentsService.BookAppointmentAsync`. All failure paths log to `audit_logs`.

---

## Dependent Tasks

- US_009 (Foundational) — `waitlist_entries` entity: `patient_id`, `slot_id` (nullable), `status`, `requested_at`, `queue_position`, `notified_at`
- US_006 (Foundational) — Hangfire registration
- us_027 task_002 — `BookAppointmentAsync` must call cascade-cancel (AC-5) after successful booking commit
- us_028 task_001 — `SlotReleasedEvent` must also trigger `WaitlistNotificationJob` (not only `PreferredSlotSwapJob`)

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Waitlist/WaitlistController.cs` | CREATE | `POST /api/waitlist` |
| `Server/Features/Waitlist/WaitlistService.cs` | CREATE | `JoinWaitlistAsync`, `CancelWaitlistEntriesForPatientAsync` |
| `Server/Features/Waitlist/Jobs/WaitlistNotificationJob.cs` | CREATE | General-queue `FOR UPDATE` select + email; `[AutomaticRetry(Attempts=3)]` |
| `Server/Features/Waitlist/Jobs/WaitlistExpiryJob.cs` | CREATE | Recurring Hangfire job every 15 min; Notified→Expired; re-trigger notification |
| `Server/Features/Appointments/AppointmentsService.cs` | MODIFY | Call `WaitlistService.CancelWaitlistEntriesForPatientAsync(patientId)` after booking commit |
| `Server/Features/Slots/SlotEventDispatcher.cs` | MODIFY | Also enqueue `WaitlistNotificationJob(slotId)` alongside `PreferredSlotSwapJob` on `SlotReleasedEvent` |
| `Server/Program.cs` | MODIFY | Register `WaitlistNotificationJob`, `WaitlistExpiryJob`; register recurring `WaitlistExpiryJob` via `RecurringJob.AddOrUpdate` |

---

## Implementation Checklist

- [ ] Implement `POST /api/waitlist [Authorize(Roles="Patient")]`; check `waitlist_entries WHERE patient_id=X AND status IN ('Waiting','Notified')` before insert; return HTTP 409 "You are already on the waitlist" if found
- [ ] Transaction: compute `queue_position = SELECT COUNT(*)+1 FROM waitlist_entries WHERE status='Waiting'`; INSERT `waitlist_entries`; INSERT `audit_logs { action_type='JoinedWaitlist' }`; COMMIT; return HTTP 201 `{ waitlist_position }`
- [ ] Implement `WaitlistNotificationJob [AutomaticRetry(Attempts=3)]`: general-queue `SELECT … WHERE slot_id IS NULL AND status='Waiting' ORDER BY requested_at ASC LIMIT 1 FOR UPDATE`; send email with slot date/time/provider + CTA booking link; UPDATE `status='Notified', notified_at=NOW()` in same tx; on email failure log `audit_logs { action_type='NotificationFailed' }` and re-throw for retry
- [ ] Implement `WaitlistExpiryJob`: `UPDATE waitlist_entries SET status='Expired' WHERE status='Notified' AND notified_at < NOW()-INTERVAL '2 hours'`; for each expired row INSERT `audit_logs { action_type='WaitlistEntryExpired' }`; for each newly-expired slot that is still `is_available=true`, enqueue a new `WaitlistNotificationJob(slotId)` to notify next-in-queue
- [ ] Register `WaitlistExpiryJob` as recurring: `RecurringJob.AddOrUpdate<WaitlistExpiryJob>("waitlist-expiry", j => j.Execute(), "*/15 * * * *")`
- [ ] In `AppointmentsService.BookAppointmentAsync`, after successful commit call `CancelWaitlistEntriesForPatientAsync(patientId)`: UPDATE `waitlist_entries SET status='Cancelled' WHERE patient_id=X AND status IN ('Waiting','Notified')`; INSERT `audit_logs { action_type='WaitlistCancelledOnBooking' }`
- [ ] In `SlotEventDispatcher`, enqueue both `PreferredSlotSwapJob(slotId)` and `WaitlistNotificationJob(slotId)` on `SlotReleasedEvent`; order: preferred-swap first (FIFO preference), then general-queue notification
- [ ] Skip `WaitlistNotificationJob` processing for entries with `status='NotificationFailed'` (max retries exhausted); move to next `Waiting` entry in FIFO order

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] `POST /api/waitlist` → HTTP 201 with `waitlist_position`; `waitlist_entries` row with `status=Waiting`; `audit_logs JoinedWaitlist` entry
- [ ] Second join by same patient → HTTP 409 "You are already on the waitlist"
- [ ] `SlotReleasedEvent` fired → `WaitlistNotificationJob` enqueued; first `Waiting` FIFO patient email sent; `status=Notified`
- [ ] 2-hour TTL expiry → `WaitlistExpiryJob` sets `status=Expired`; `audit_logs WaitlistEntryExpired`; next-in-queue notification job re-enqueued
- [ ] Successful booking via us_027 → patient's `waitlist_entries` set to `status=Cancelled`; `audit_logs WaitlistCancelledOnBooking`
- [ ] Email delivery failure in `WaitlistNotificationJob` → retry ×3; `audit_logs NotificationFailed`; next `Waiting` patient served on next job run
- [ ] Multiple simultaneous `SlotReleasedEvent` → each slot notifies a separate patient (no duplicate notifications via `FOR UPDATE`)
