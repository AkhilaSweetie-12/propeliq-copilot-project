---
title: "Task — BE GoogleCalendarSyncJob & GoogleCalendarUpdateJob with Advisory Lock & Retry"
task_id: task_001
story_id: us_037
epic: EP-005
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — BE GoogleCalendarSyncJob & GoogleCalendarUpdateJob with Advisory Lock & Retry

## Requirement Reference

- **User Story**: us_037
- **Story Location**: .propel/context/tasks/EP-005/us_037/us_037.md
- **Acceptance Criteria**:
  - AC-1: `GoogleCalendarSyncJob(appointment_id)` enqueued via Hangfire immediately after booking commit (us_027 + us_033); fire-and-forget; booking does NOT wait for job (NFR-014, TR-014)
  - AC-2: Job calls Google Calendar API v3 `events.insert`; OAuth 2.0 token from env secrets (never source code); event fields: `summary`, `start/end.dateTime`, `location`, `description`; on HTTP 200/201 UPDATE `appointments SET calendar_event_id_google=event_id`; INSERT `audit_logs (action=GoogleCalendarSynced)` (FR-022, TR-013)
  - AC-3: Transient failure (HTTP 429/500/503) → Hangfire retry ×3 with exponential backoff 15s/30s/60s; after 3 failures → `Failed` state; INSERT `audit_logs (action=CalendarSyncFailed, provider=Google)`; booking status remains `Confirmed` (NFR-014)
  - AC-4: All 3 retries exhausted → FE failure toast surfaced (handled in us_037 task_002); job does not notify patient directly
  - AC-5: Slot swap (us_028) → enqueue `GoogleCalendarUpdateJob(appointment_id)`; calls `events.patch` on `calendar_event_id_google`; if NULL → fallback to `events.insert`; same retry + failure audit pattern
  - Edge Case: `calendar_event_id_google` already populated → advisory lock + idempotency exit; no duplicate event
  - Edge Case: HTTP 403/404 (no account / access denied) → permanent failure; no retry; INSERT `audit_logs (action=CalendarSyncFailed_Permanent, provider=Google)`; no toast shown
  - Edge Case: Token refresh fails → INSERT `audit_logs (action=CalendarSyncFailed_TokenExpired, provider=Google)`; job transitions to `Failed`

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
| Background Jobs | Hangfire + Hangfire.PostgreSql | 1.8.x |
| Google Calendar | Google.Apis.Calendar.v3 | latest stable |
| ORM | Entity Framework Core | 9 (Npgsql) |
| Database | PostgreSQL 16 | Advisory locks |
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

Implement `GoogleCalendarSyncJob` (insert on booking) and `GoogleCalendarUpdateJob` (patch/insert on slot swap). Both use the `Google.Apis.Calendar.v3` SDK with OAuth 2.0 credentials from environment secrets. Idempotency is enforced via a PostgreSQL advisory lock on the appointment row before calling the API. Transient failures (HTTP 429/500/503) trigger Hangfire exponential-backoff retries (×3). Permanent failures (HTTP 4xx except 429) complete without retry. All outcomes are written to `audit_logs`. Booking status is never affected.

---

## Dependent Tasks

- US_006 (Foundational) — Hangfire registration; `Google.Apis.Calendar.v3` NuGet package installed; OAuth 2.0 credential configuration
- US_008 (Foundational) — `appointments.calendar_event_id_google` column (nullable varchar)
- us_027 task_002 — booking commit already contains `BackgroundJob.Enqueue<GoogleCalendarSyncJob>(...)`
- us_033 task_002 — walk-in booking commit also enqueues `GoogleCalendarSyncJob`
- us_028 task_001 — swap commit enqueues `GoogleCalendarUpdateJob`

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Notifications/Jobs/GoogleCalendarSyncJob.cs` | CREATE | Insert calendar event on booking |
| `Server/Features/Notifications/Jobs/GoogleCalendarUpdateJob.cs` | CREATE | Patch (or fallback insert) on slot swap |
| `Server/Features/Notifications/Services/GoogleCalendarService.cs` | CREATE | Wraps `Google.Apis.Calendar.v3`; advisory lock; permanent vs transient classifier |
| `Server/Program.cs` | MODIFY | Register both Hangfire jobs; bind Google OAuth 2.0 config section |

---

## Implementation Checklist

- [ ] Implement `GoogleCalendarService.AcquireAdvisoryLock(appointmentId)`: execute `SELECT pg_try_advisory_lock(hashcode)` before any API call; if lock fails or `calendar_event_id_google` already populated → log no-op and return; release lock after job completes (advisory lock is session-scoped — release in finally block)
- [ ] Implement `GoogleCalendarSyncJob [AutomaticRetry(Attempts=3, DelaysInSeconds=[15,30,60])]`: load appointment + patient + provider; acquire advisory lock; call `GoogleCalendarService.InsertEventAsync(appointmentDetails)`; on HTTP 200/201 UPDATE `appointments SET calendar_event_id_google=event_id`; INSERT `audit_logs { action_type='GoogleCalendarSynced', appointment_id }`; release lock
- [ ] In `GoogleCalendarService`: classify response codes — 4xx except 429 → throw `PermanentCalendarSyncException` (custom non-retryable exception caught in job); 429/5xx → throw standard exception to trigger Hangfire retry; catch `TokenResponseException` from Google SDK → throw with `CalendarSyncFailed_TokenExpired` log and re-throw as permanent
- [ ] On `PermanentCalendarSyncException` caught in `GoogleCalendarSyncJob`: INSERT `audit_logs { action_type='CalendarSyncFailed_Permanent', provider='Google', error_message }`; do NOT re-throw (job completes gracefully, no retry)
- [ ] After all 3 retries exhausted (Hangfire `OnStateElection` or `Failed` state filter): INSERT `audit_logs { action_type='CalendarSyncFailed', provider='Google', appointment_id, error_message }`; set a flag in `appointments` table or publish to a notification channel so the FE toast can be served (see us_037 task_002)
- [ ] Implement `GoogleCalendarUpdateJob [AutomaticRetry(Attempts=3, DelaysInSeconds=[15,30,60])]`: load `appointments.calendar_event_id_google`; if not NULL → call `events.patch` with updated `start.dateTime` + `end.dateTime`; if NULL → fallback to `events.insert` (same as `GoogleCalendarSyncJob` insert path); apply same error classification and audit log pattern
- [ ] Construct `Google.Apis.Calendar.v3.Data.Event` with: `Summary="Appointment at PropelIQ Health"`, `Start.DateTime=slotDatetime (UTC)`, `End.DateTime=slotDatetime+duration`, `Location=clinicAddress`, `Description=$"Provider: {providerName}\nType: {appointmentType}"` (HTML format)
- [ ] Register both jobs in `Program.cs`; load OAuth 2.0 credentials from `IConfiguration["GoogleCalendar:CredentialsJson"]` path or env var — NEVER hardcode; never log credential values

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Booking commit → `GoogleCalendarSyncJob` enqueued; runs; Google API called; `calendar_event_id_google` updated; `audit_logs GoogleCalendarSynced`
- [ ] Concurrent job for same appointment → advisory lock prevents duplicate API call; second job exits as no-op
- [ ] Google HTTP 500 → Hangfire retries ×3 (15s/30s/60s); after 3rd failure → `audit_logs CalendarSyncFailed`
- [ ] Google HTTP 403 → `PermanentCalendarSyncException`; job completes without retry; `audit_logs CalendarSyncFailed_Permanent`
- [ ] Token refresh failure → `audit_logs CalendarSyncFailed_TokenExpired`; job fails
- [ ] Slot swap → `GoogleCalendarUpdateJob` enqueued; patches existing event when `calendar_event_id_google` set
- [ ] Slot swap with null `calendar_event_id_google` → fallback to `events.insert`
- [ ] Booking status remains `Confirmed` after any failure path
- [ ] No credentials present in source code or logs
