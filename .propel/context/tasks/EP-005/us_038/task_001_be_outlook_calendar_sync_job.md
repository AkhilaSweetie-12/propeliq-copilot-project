---
title: "Task — BE OutlookCalendarSyncJob & OutlookCalendarUpdateJob with Retry-After, Advisory Lock & Retry"
task_id: task_001
story_id: us_038
epic: EP-005
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — BE OutlookCalendarSyncJob & OutlookCalendarUpdateJob with Retry-After, Advisory Lock & Retry

## Requirement Reference

- **User Story**: us_038
- **Story Location**: .propel/context/tasks/EP-005/us_038/us_038.md
- **Acceptance Criteria**:
  - AC-1: `OutlookCalendarSyncJob(appointment_id)` enqueued via Hangfire immediately after booking commit (us_027 + us_033); fire-and-forget; independent of `GoogleCalendarSyncJob`; booking does NOT wait for job (NFR-014, TR-014)
  - AC-2: Job calls Microsoft Graph API `POST /me/events` (or `POST /users/{id}/events`); OAuth 2.0 application permissions token from env secrets; `Event` fields: `subject`, `start.dateTime` (UTC), `end.dateTime` (UTC), `start.timeZone="UTC"`, `end.timeZone="UTC"`, `body.content` (HTML), `location.displayName`; on HTTP 201 UPDATE `appointments SET calendar_event_id_outlook=event_id`; INSERT `audit_logs (action=OutlookCalendarSynced)` (FR-023, TR-013)
  - AC-3: Transient failure (HTTP 429/500/503) → Hangfire retry ×3 with backoff 15s/30s/60s; on HTTP 429 READ `Retry-After` header — if value > backoff interval, reschedule using `Retry-After` value (capped at 120 s); after 3 failures → INSERT `audit_logs (action=CalendarSyncFailed, provider=Outlook)`
  - AC-4: All retries exhausted → FE failure toast surfaced via `calendarSyncFailed=['Microsoft']` in booking confirmation response (reuses us_037 task_002 component — pass `provider="Microsoft"` prop)
  - AC-5: Slot swap (us_028) → enqueue `OutlookCalendarUpdateJob(appointment_id)`; calls `PATCH /me/events/{calendar_event_id_outlook}`; if NULL → fallback to `POST /me/events`; same retry + failure audit pattern
  - Edge Case: `calendar_event_id_outlook` already populated → advisory lock + idempotency exit; no duplicate event
  - Edge Case: HTTP 4xx except 429 (including 403/404) → permanent failure; no retry; no toast shown; INSERT `audit_logs (action=CalendarSyncFailed_Permanent, provider=Outlook)`
  - Edge Case: Token expiry → Microsoft.Graph SDK attempts automatic refresh; if refresh fails → INSERT `audit_logs (action=CalendarSyncFailed_TokenExpired, provider=Outlook)`; job transitions to `Failed`

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
| **UXR Requirements** | UXR-602 (toast handled by us_037 task_002) |
| **Design Tokens** | N/A |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | ASP.NET Core | .NET 9 |
| Background Jobs | Hangfire + Hangfire.PostgreSql | 1.8.x |
| Microsoft Calendar | Microsoft.Graph NuGet SDK | latest stable |
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

Implement `OutlookCalendarSyncJob` (insert on booking) and `OutlookCalendarUpdateJob` (patch/insert on slot swap) using the `Microsoft.Graph` SDK. OAuth 2.0 application-permission credentials are loaded exclusively from environment secrets. Idempotency is enforced via a PostgreSQL advisory lock before any API call. Transient failures trigger up to 3 Hangfire retries with exponential backoff (15s/30s/60s); HTTP 429 additionally reads the `Retry-After` header and schedules the next attempt at `max(backoff, Retry-After)` capped at 120 s. Permanent 4xx failures complete without retry or toast. The FE toast (us_037 task_002) handles `provider="Microsoft"` transparently — no new FE work required.

---

## Dependent Tasks

- US_006 (Foundational) — Hangfire registration; `Microsoft.Graph` NuGet package installed; OAuth 2.0 app-registration config
- US_008 (Foundational) — `appointments.calendar_event_id_outlook` column (nullable varchar)
- us_027 task_002 — booking commit must also enqueue `OutlookCalendarSyncJob` alongside `GoogleCalendarSyncJob`
- us_033 task_002 — walk-in booking commit also enqueues `OutlookCalendarSyncJob`
- us_028 task_001 — swap commit enqueues `OutlookCalendarUpdateJob`
- us_037 task_001 — GoogleCalendarSyncJob pattern is the reference implementation; Outlook follows the same advisory lock + retry structure
- us_037 task_002 — FE toast component already handles `provider="Microsoft"`; no additional FE code needed here

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Notifications/Jobs/OutlookCalendarSyncJob.cs` | CREATE | Insert Graph event on booking |
| `Server/Features/Notifications/Jobs/OutlookCalendarUpdateJob.cs` | CREATE | PATCH (or fallback POST) on slot swap |
| `Server/Features/Notifications/Services/OutlookCalendarService.cs` | CREATE | Wraps `Microsoft.Graph`; advisory lock; `Retry-After` header; permanent vs transient classifier |
| `Server/Program.cs` | MODIFY | Register both Hangfire jobs; bind Microsoft Graph OAuth 2.0 config section |

---

## Implementation Checklist

- [ ] Implement `OutlookCalendarService.AcquireAdvisoryLock(appointmentId)`: same PostgreSQL advisory lock pattern as `GoogleCalendarService`; exit if `calendar_event_id_outlook` already populated to prevent duplicate events
- [ ] Implement `OutlookCalendarSyncJob [AutomaticRetry(Attempts=3, DelaysInSeconds=[15,30,60])]`: load appointment + patient + provider; acquire advisory lock; call `OutlookCalendarService.CreateEventAsync(appointmentDetails)`; on HTTP 201 UPDATE `appointments SET calendar_event_id_outlook=event_id`; INSERT `audit_logs { action_type='OutlookCalendarSynced', appointment_id }`; release lock
- [ ] In `OutlookCalendarService.CreateEventAsync`: build `Microsoft.Graph.Models.Event` with `Subject="Appointment at PropelIQ Health"`, `Start={ DateTime=slotDatetime.ToString("o"), TimeZone="UTC" }`, `End={ DateTime=(slotDatetime+duration).ToString("o"), TimeZone="UTC" }`, `Body={ Content="<p>Provider: {name}<br/>Type: {type}</p>", ContentType=BodyType.Html }`, `Location={ DisplayName=clinicAddress }`; call `graphClient.Me.Events.PostAsync(event)` or `graphClient.Users[userId].Events.PostAsync(event)`
- [ ] Implement `Retry-After` header handling: on `ODataError` with HTTP 429, extract `response.Headers["Retry-After"]` integer value (seconds); compute `delay = Max(backoffForAttempt, retryAfterValue)`; cap at 120 s; re-schedule Hangfire job with `BackgroundJob.Schedule<OutlookCalendarSyncJob>(j => j.Execute(appointmentId), TimeSpan.FromSeconds(delay))` — NOTE: this means the current attempt must SUCCEED (not throw) and the rescheduled attempt is a new job; decrement attempt counter tracking accordingly
- [ ] In `OutlookCalendarService`: classify response codes — `ODataError` with status 4xx except 429 → throw `PermanentCalendarSyncException`; `ServiceException` with token expiry → throw `CalendarSyncTokenExpiredException`; 429/5xx → re-throw standard exception for Hangfire retry
- [ ] On `PermanentCalendarSyncException` caught in job: INSERT `audit_logs { action_type='CalendarSyncFailed_Permanent', provider='Outlook', error_message }`; do NOT re-throw; job completes gracefully
- [ ] On `CalendarSyncTokenExpiredException`: INSERT `audit_logs { action_type='CalendarSyncFailed_TokenExpired', provider='Outlook' }`; re-throw to mark job `Failed`
- [ ] Implement `OutlookCalendarUpdateJob [AutomaticRetry(Attempts=3, DelaysInSeconds=[15,30,60])]`: load `appointments.calendar_event_id_outlook`; if not NULL → call `graphClient.Me.Events[calendar_event_id_outlook].PatchAsync(updatedEvent)` with updated start/end; if NULL → fallback to `CreateEventAsync`; same error classification and advisory lock pattern
- [ ] Register both jobs in `Program.cs`; load OAuth 2.0 credentials from `IConfiguration["MicrosoftGraph:TenantId"]`, `["MicrosoftGraph:ClientId"]`, `["MicrosoftGraph:ClientSecret"]` — NEVER hardcode or log credential values; use `ClientSecretCredential` from `Azure.Identity`

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Booking commit → `OutlookCalendarSyncJob` enqueued independently of Google job; both run without blocking each other
- [ ] Concurrent job for same appointment → advisory lock prevents duplicate API call; second job exits as no-op
- [ ] Graph API 500 → Hangfire retries ×3 (15s/30s/60s); after 3rd → `audit_logs CalendarSyncFailed provider=Outlook`
- [ ] Graph API 429 with `Retry-After: 90` header → retry delay = max(backoffInterval, 90) capped at 120 → 90 s used; not raw 15s backoff
- [ ] Graph API 429 with `Retry-After: 150` → capped to 120 s
- [ ] Graph API 403 → `PermanentCalendarSyncException`; job completes; `audit_logs CalendarSyncFailed_Permanent`; no retry; no toast signal
- [ ] Token refresh failure → `audit_logs CalendarSyncFailed_TokenExpired`; job `Failed`
- [ ] Slot swap → `OutlookCalendarUpdateJob` enqueued; PATCH existing event when `calendar_event_id_outlook` set
- [ ] Slot swap with null `calendar_event_id_outlook` → fallback to `PostAsync`
- [ ] Booking status `Confirmed` after any Outlook failure path (NFR-014)
- [ ] No credentials present in source code or logs; token never written to `audit_logs.error_message`
- [ ] Two calendar failure toasts (Google + Outlook) stack independently on FE when both fail (validated by us_037 task_002 tests)
