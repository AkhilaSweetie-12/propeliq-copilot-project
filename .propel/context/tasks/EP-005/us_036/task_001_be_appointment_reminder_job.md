---
title: "Task — BE AppointmentReminderJob — SMS (Twilio) & Email (MailKit) with Idempotency & Retry"
task_id: task_001
story_id: us_036
epic: EP-005
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — BE AppointmentReminderJob — SMS (Twilio) & Email (MailKit) with Idempotency & Retry

## Requirement Reference

- **User Story**: us_036
- **Story Location**: .propel/context/tasks/EP-005/us_036/us_036.md
- **Acceptance Criteria**:
  - AC-1: Hangfire recurring CRON every 15 min; two queries: 48-hour window (`slot_datetime BETWEEN NOW()+48h AND NOW()+49h AND status=Confirmed`) and 2-hour window (`slot_datetime BETWEEN NOW()+2h AND NOW()+2h15m AND status=Confirmed`); idempotency check against `notifications` table prevents duplicate delivery per channel per appointment per window (TR-014)
  - AC-2: For each appointment in window: INSERT `notifications (channel=SMS, status=Pending)`; call Twilio `POST /Messages`; credentials from env secrets (TR-012); on success UPDATE `notifications SET status=Sent, sent_at=NOW()`; on failure UPDATE `status=Failed` + INSERT `audit_logs (action=SMSDeliveryFailed)`
  - AC-3: SMS failure → enqueue `NotificationRetryJob(notification_id)` with 5-min delay; retry once; second failure → `notifications.status=PermanentFail` + `audit_logs (action=SMSPermanentFailure)`; no further retries (NFR-012)
  - AC-4: Same window → INSERT `notifications (channel=Email, status=Pending)`; MailKit HTML+plain-text email; SMTP from env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`); include date/time/provider/Add-to-calendar link (TR-011, FR-021); same retry pattern as SMS
  - AC-5: `users.phone IS NULL` → skip SMS step; INSERT `notifications (channel=SMS, status=Skipped, reason=NoPhoneNumber)`; INSERT `audit_logs (action=SMSSkipped_NoPhone)`; email step unaffected
  - Edge Case: Appointment cancelled between queue and send → check `appointments.status = Confirmed` before send; if not Confirmed → `notifications.status=Cancelled_Appointment`; no message sent
  - Edge Case: Twilio 402 (balance exhausted) → treat as delivery failure; same retry pattern; second 402 → `PermanentFail`

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No |
| **Figma URL** | N/A |
| **Wireframe Status** | N/A — Background job, no wireframe |
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
| SMS | Twilio SDK | 7.x (.NET) |
| Email | MailKit | 4.x |
| ORM | Entity Framework Core | 9 (Npgsql) |
| Database | PostgreSQL | 16 |
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

Implement `AppointmentReminderJob` as a Hangfire recurring job (every 15 min). The job runs two time-window queries against `appointments`, applies idempotency checks against `notifications`, and for each unnotified appointment: (1) skips or sends SMS via Twilio, (2) sends HTML+plain-text email via MailKit SMTP. Failures enqueue `NotificationRetryJob` with 5-min delay; second failure transitions to `PermanentFail`. Credentials are sourced exclusively from environment variables — never from source code.

---

## Dependent Tasks

- US_009 (Foundational) — `notifications` entity (`notification_id`, `appointment_id`, `channel`, `status`, `attempt_count`, `scheduled_at`, `sent_at`, `error_message`) must exist
- US_006 (Foundational) — Hangfire job store + CRON registration; Twilio + MailKit NuGet packages installed
- us_027 task_002 — `appointments` entity with `slot_datetime`, `status`, `patient_id` must exist
- us_030 task_002 — Email content follows appointment confirmation format established there

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Notifications/Jobs/AppointmentReminderJob.cs` | CREATE | Main recurring CRON job; 48h + 2h window queries; SMS + Email dispatch |
| `Server/Features/Notifications/Jobs/NotificationRetryJob.cs` | CREATE | Single-retry job enqueued with 5-min delay; `PermanentFail` on second failure |
| `Server/Features/Notifications/Services/SmsService.cs` | CREATE | Twilio wrapper; credentials from `IConfiguration`; returns success/failure result |
| `Server/Features/Notifications/Services/EmailReminderService.cs` | CREATE | MailKit SMTP wrapper; HTML + plain-text; SMTP config from env vars |
| `Server/Program.cs` | MODIFY | Register `AppointmentReminderJob` CRON (`"*/15 * * * *"`); register `NotificationRetryJob`; bind SMTP + Twilio config sections |

---

## Implementation Checklist

- [ ] Implement `AppointmentReminderJob`: query 48h batch `slot_datetime BETWEEN NOW()+48h AND NOW()+49h AND status='Confirmed'`; query 2h batch `slot_datetime BETWEEN NOW()+2h AND NOW()+2h15m AND status='Confirmed'`; for each appointment check idempotency: `SELECT notifications WHERE appointment_id=X AND channel=Y AND scheduled_at >= window_start AND status NOT IN ('Failed')`; if exists → skip
- [ ] SMS step: if `users.phone IS NULL` → INSERT `notifications { channel=SMS, status=Skipped, reason=NoPhoneNumber }`; INSERT `audit_logs { action_type='SMSSkipped_NoPhone' }`; skip Twilio call; else INSERT `notifications { channel=SMS, status=Pending }`; call `SmsService.SendAsync(phone, message)`; on success UPDATE `status=Sent, sent_at=NOW()`; on failure UPDATE `status=Failed, error_message` + INSERT `audit_logs { action_type='SMSDeliveryFailed' }` + `BackgroundJob.Schedule<NotificationRetryJob>(j => j.Execute(notificationId), TimeSpan.FromMinutes(5))`
- [ ] Email step: INSERT `notifications { channel=Email, status=Pending }`; validate `appointments.status = Confirmed` before send; call `EmailReminderService.SendReminderAsync(email, appointmentDetails)`; on success UPDATE `status=Sent`; on failure apply same retry pattern as SMS
- [ ] `NotificationRetryJob.Execute(Guid notificationId)`: load notification; validate `appointments.status = Confirmed` (skip if cancelled → `status=Cancelled_Appointment`); re-attempt send via appropriate service (SMS or Email based on `channel`); on success UPDATE `status=Sent`; on failure UPDATE `status=PermanentFail` + INSERT `audit_logs { action_type='SMSPermanentFailure' OR 'EmailPermanentFailure' }`; no further retries
- [ ] `SmsService`: inject `TwilioRestClient` using `AccountSid` + `AuthToken` from `IConfiguration["Twilio:AccountSid"]` / `IConfiguration["Twilio:AuthToken"]`; NEVER embed credentials in source code; message body: "Reminder: Your appointment at PropelIQ Health is on {date} at {time} with {provider}."
- [ ] `EmailReminderService`: build `MimeMessage` with HTML part (date, time, provider, "Add to calendar" ICS link) and plain-text part; use `SmtpClient` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` from `IConfiguration`; credentials NEVER in source code (TR-011)
- [ ] Register `AppointmentReminderJob` CRON: `RecurringJob.AddOrUpdate<AppointmentReminderJob>("appointment-reminders", j => j.Execute(), "*/15 * * * *")`
- [ ] Remaining jobs (both queues) continue processing even if one appointment's send fails — do not throw from the outer loop; log per-appointment errors and continue

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] CRON fires every 15 min; appointments in 48h window picked up; idempotency check prevents re-send on next tick
- [ ] `users.phone IS NULL` → `notifications.status=Skipped`; `audit_logs SMSSkipped_NoPhone`; email sends normally
- [ ] Twilio success → `notifications.status=Sent`; no retry job enqueued
- [ ] Twilio failure → `notifications.status=Failed`; `audit_logs SMSDeliveryFailed`; `NotificationRetryJob` scheduled at `NOW()+5min`
- [ ] `NotificationRetryJob` succeeds → `notifications.status=Sent`
- [ ] `NotificationRetryJob` fails → `notifications.status=PermanentFail`; `audit_logs SMSPermanentFailure`; no third attempt
- [ ] Appointment cancelled before retry → `notifications.status=Cancelled_Appointment`; no message sent
- [ ] Twilio 402 → treated as delivery failure; `PermanentFail` on second 402
- [ ] Credentials never appear in source code; loaded from `IConfiguration` only
