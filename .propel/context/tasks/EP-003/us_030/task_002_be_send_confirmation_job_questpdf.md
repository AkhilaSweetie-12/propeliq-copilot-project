---
title: "Task — BE SendConfirmationJob (QuestPDF), Checkin Route Exclusion & Swap Re-confirmation"
task_id: task_002
story_id: us_030
epic: EP-003
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE SendConfirmationJob (QuestPDF), Checkin Route Exclusion & Swap Re-confirmation

## Requirement Reference

- **User Story**: us_030
- **Story Location**: .propel/context/tasks/EP-003/us_030/us_030.md
- **Acceptance Criteria**:
  - AC-1: `send_confirmation_job(appointment_id)` picked up by Hangfire; calls QuestPDF Community (MIT) fluent API to build PDF with: appointment date/time, location/clinic name, provider full name + specialty, appointment type, patient full name, insurance provider, cancellation policy section; generated PDF attached to email sent to patient `email`; subject "Your PropelIQ Health Appointment Confirmation" (TR-010, FR-016)
  - AC-3: Email delivery failure → retry ×3 with exponential backoff (15 s, 30 s, 60 s); all retries fail → Hangfire `Failed` state; INSERT `audit_logs (action=ConfirmationEmailFailed, appointment_id, error_message, failed_at)`; appointment `status` remains `Confirmed` (booking NOT rolled back)
  - AC-4: No `/checkin` route, no `/api/appointments/{id}/checkin` route, no QR-code-to-checkin handler exists in the API routing table; HTTP 404 for any path matching `checkin` (FR-017 API enforcement)
  - AC-5: Swap notification email triggered by `SendSwapNotificationJob` (us_028) uses the same QuestPDF template; adds note "Your appointment has been moved to your preferred slot"; INSERT `audit_logs (action=SwapConfirmationSent)`
  - Edge Case: QuestPDF generation failure → catch, INSERT `audit_logs (action=ConfirmationPDFGenerationFailed)`; transition Hangfire job to `Failed`; retry per AC-3; booking remains `Confirmed`

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
| Backend | ASP.NET Core | .NET 9 |
| Background Jobs | Hangfire | latest compatible with .NET 9 |
| PDF Generation | QuestPDF Community | MIT licence |
| Email | SMTP / MailKit | — |
| ORM | Entity Framework Core | 9 (Npgsql) |
| Database | PostgreSQL 16 | — |
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

Implement `SendConfirmationJob` using QuestPDF Community (MIT) to build a PDF confirmation document. The job fetches appointment + patient + provider data from the DB, generates the PDF using the fluent QuestPDF API, attaches it to an email, and sends it. Retry configuration is 3 × exponential backoff; all failure paths write to `audit_logs`; the booking is never affected by email/PDF failure. Also enforce FR-017 at API level by confirming no `/checkin` routes exist and adding a route-not-found catch-all that returns HTTP 404. Update `SendSwapNotificationJob` (us_028) to reuse the same PDF template with a swap-specific note.

---

## Dependent Tasks

- US_008 (Foundational) — `appointments`, `providers`, `patients` entities for PDF data
- US_006 (Foundational) — Hangfire registration
- us_027 task_002 — enqueues `SendConfirmationJob` after booking commit
- us_028 task_001 — `SendSwapNotificationJob` must call the shared PDF template

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Appointments/Jobs/SendConfirmationJob.cs` | CREATE | Hangfire job; QuestPDF generation + email send |
| `Server/Features/Appointments/Documents/AppointmentConfirmationDocument.cs` | CREATE | QuestPDF fluent document builder (shared by confirmation + swap) |
| `Server/Features/Slots/Jobs/SendSwapNotificationJob.cs` | MODIFY | Reuse `AppointmentConfirmationDocument` with `isSwap=true` flag; INSERT `audit_logs (action=SwapConfirmationSent)` |
| `Server/Program.cs` | MODIFY | Register `SendConfirmationJob`; confirm no `/checkin` route registered anywhere |
| `Server/Features/Appointments/AppointmentsController.cs` | MODIFY | Verify no `checkin` action method exists; add explicit comment documenting FR-017 exclusion |

---

## Implementation Checklist

- [ ] Add `QuestPDF.Fluent` NuGet package (Community MIT licence); implement `AppointmentConfirmationDocument` with fluent API sections: header (clinic name, logo), appointment summary table (date, time, location, provider name, specialty, appointment type), patient section (full name, insurance provider), cancellation policy section (static text)
- [ ] Implement `SendConfirmationJob [AutomaticRetry(Attempts=3, DelaysInSeconds=[15,30,60])]`: load appointment + patient + provider from DB; call `AppointmentConfirmationDocument.GeneratePdf()` in a try-catch; if generation fails → INSERT `audit_logs { action_type='ConfirmationPDFGenerationFailed' }`; re-throw for Hangfire retry
- [ ] Attach generated `byte[]` PDF to email as `application/pdf`; send to `patient.email`; subject "Your PropelIQ Health Appointment Confirmation"; on send failure → INSERT `audit_logs { action_type='ConfirmationEmailFailed', appointment_id, error_message, failed_at }` on all-retries-exhausted; do NOT update `appointments.status`
- [ ] Update `SendSwapNotificationJob` (us_028): invoke `AppointmentConfirmationDocument.GeneratePdf(isSwap: true)` which appends note "Your appointment has been moved to your preferred slot" to the summary section; attach PDF to swap notification email; INSERT `audit_logs { action_type='SwapConfirmationSent' }` on successful send
- [ ] Audit API router for FR-017: search all `[HttpPatch]`, `[HttpGet]`, `[HttpPost]` controller actions for route segments containing "checkin"; remove any found; add XML comment `// FR-017: No self-checkin route — arrival is Staff-only action` at the top of `AppointmentsController`
- [ ] Register `SendConfirmationJob` in `Program.cs`; configure Hangfire retry with explicit delay intervals `[15, 30, 60]` seconds; verify job transitions to `Failed` state after 3 exhausted retries (Hangfire dashboard observable)
- [ ] Verify `GET /api/appointments/{id}/checkin`, `PATCH /api/appointments/{id}/checkin`, and any `/checkin` path returns HTTP 404 (no route registered — handled automatically by ASP.NET Core routing); add an integration test or route table assertion to prevent future accidental registration

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] `SendConfirmationJob` triggered after booking → PDF generated with all required fields; email received with PDF attachment; subject matches "Your PropelIQ Health Appointment Confirmation"
- [ ] QuestPDF generation exception → `audit_logs ConfirmationPDFGenerationFailed`; job retries ×3; appointment `status` remains `Confirmed`
- [ ] All email retries exhausted → Hangfire `Failed` state; `audit_logs ConfirmationEmailFailed` with `appointment_id` and `error_message`; appointment not cancelled
- [ ] `GET /api/appointments/{id}/checkin` → HTTP 404 (no route); `PATCH /api/appointments/{id}/checkin` → HTTP 404
- [ ] Swap notification via `SendSwapNotificationJob` → PDF contains "Your appointment has been moved to your preferred slot"; `audit_logs SwapConfirmationSent` written
- [ ] QuestPDF Community licence satisfied (MIT); no binary dependencies incompatible with GitHub Codespaces
