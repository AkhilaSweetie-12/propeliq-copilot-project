---
title: "Task — BE NoShowRiskEngine, AppointmentRiskScoringJob & Nightly CRON"
task_id: task_002
story_id: us_035
epic: EP-004
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE NoShowRiskEngine, AppointmentRiskScoringJob & Nightly CRON

## Requirement Reference

- **User Story**: us_035
- **Story Location**: .propel/context/tasks/EP-004/us_035/us_035.md
- **Acceptance Criteria**:
  - AC-1: On booking commit (us_027 + us_033), enqueue `AppointmentRiskScoringJob(appointment_id)` immediately; nightly CRON at 00:00 UTC re-scores all `status=Confirmed` appointments with `slot_date >= TODAY`
  - AC-2: Scoring formula: `score = (prior_no_shows × 30) + (lead_time_days < 2 ? 30 : 0) + (insurance_unmatched × 20) + (intake_incomplete × 20)`; clamped to [0, 100]; Low (0–30) / Medium (31–60) / High (61–100); new patients with no history → default score = 50 (Medium)
  - AC-3: `UPDATE appointments SET no_show_risk='Low|Medium|High', risk_score=N` in separate transaction from booking; INSERT `audit_logs (action=RiskScored, change_summary="risk=High, score=80")`; if job fails all 3 retries, appointment retains previous `no_show_risk` value (or NULL); no booking rollback
  - Edge Case: `patient_id = NULL` (guest) → default score = 50 (Medium); `audit_logs change_summary="risk=Medium (guest profile — no history)"`
  - Edge Case: `prior_no_shows = 3` → score = 90 (already above High); clamped to 100 max

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No |
| **Figma URL** | N/A |
| **Wireframe Status** | N/A — Server-side scoring job |
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

Implement `NoShowRiskEngine` as a pure deterministic C# service with a scoring formula across 4 factors. Implement `AppointmentRiskScoringJob` that calls the engine, writes the risk score in a separate transaction from the booking, and logs to audit. Register the job as both a fire-and-forget trigger (on booking commit) and a nightly Hangfire CRON (`"0 0 * * *"` UTC). Update `GET /api/queue/today` response DTO to include `risk_factors` breakdown for tooltip consumption on the FE.

---

## Dependent Tasks

- US_008 (Foundational) — `appointments.no_show_risk`, `appointments.risk_score` columns (DR-003 enum extension)
- US_006 (Foundational) — Hangfire registration
- us_027 task_002 — enqueues `AppointmentRiskScoringJob` after online booking commit (already specified there; register job here)
- us_033 task_002 — enqueues `AppointmentRiskScoringJob` after walk-in commit (already specified there)

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Appointments/Services/NoShowRiskEngine.cs` | CREATE | Pure deterministic scoring service |
| `Server/Features/Appointments/Jobs/AppointmentRiskScoringJob.cs` | CREATE | Hangfire job; calls engine; writes score; audit log |
| `Server/Features/Queue/Dtos/QueueTodayResponse.cs` | MODIFY | Add `RiskFactors: string[]?` to `QueuePreviewRow` for tooltip |
| `Server/Program.cs` | MODIFY | Register `AppointmentRiskScoringJob`; register nightly CRON |

---

## Implementation Checklist

- [ ] Implement `NoShowRiskEngine.Score(Guid appointmentId)` (or accept loaded data): compute `prior_no_shows`, `lead_time_days`, `insurance_unmatched`, `intake_incomplete`; apply formula; clamp `MIN(100, MAX(0, rawScore))`; assign `Low` (0–30) / `Medium` (31–60) / `High` (61–100); return `{ RiskLevel, Score, Factors: List<string> }` — `Factors` is a list of human-readable contributing strings (e.g., "2 prior no-shows", "Booked same-day", "Insurance unmatched")
- [ ] Guest profile (`patient_id = null`) and new patient (no history) → return `{ RiskLevel="Medium", Score=50, Factors=["No prior history — default Medium"] }` or `["Guest profile — no history"]` respectively, without querying history tables
- [ ] `AppointmentRiskScoringJob [AutomaticRetry(Attempts=3)]`: call `NoShowRiskEngine.Score(appointmentId)`; open a NEW DbContext transaction (separate from booking tx); `UPDATE appointments SET no_show_risk=level, risk_score=score, risk_updated_at=NOW()`; INSERT `audit_logs { action_type='RiskScored', entity_id=appointmentId, change_summary=$"risk={level}, score={score}" }`; COMMIT; on all-retries-exhausted: Hangfire transitions to `Failed`; appointment retains existing `no_show_risk` value (no forced null-out)
- [ ] Nightly CRON: `RecurringJob.AddOrUpdate<NightlyRiskRescoringJob>("nightly-risk-rescore", j => j.Execute(), "0 0 * * *")`; `NightlyRiskRescoringJob` loads all `appointments WHERE status='Confirmed' AND slot_date >= CURRENT_DATE`; enqueues one `AppointmentRiskScoringJob` per appointment; does not score inline (avoids long-running job)
- [ ] Extend `QueuePreviewRow` DTO with `RiskFactors: string[]?`; populate from `appointments.risk_factors` JSONB column (or compute inline from raw columns on read — choose simpler approach); expose in `GET /api/queue/today` response for FE tooltip
- [ ] Register `AppointmentRiskScoringJob` and `NightlyRiskRescoringJob` in `Program.cs`; configure retry policy: `[AutomaticRetry(Attempts=3)]` on job class attribute

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] `NoShowRiskEngine.Score` unit tests: score = 0 (no factors) → Low; score = 50 (Medium default for new patient); score = 80 (2 no-shows + insurance unmatched) → High; score clamped at 100 when raw score > 100
- [ ] `AppointmentRiskScoringJob` runs → `appointments.no_show_risk` updated; `audit_logs RiskScored` entry with correct `change_summary`
- [ ] Job failure all 3 retries → Hangfire `Failed` state; appointment `no_show_risk` unchanged (retains prior value or NULL)
- [ ] Guest profile appointment → `no_show_risk=Medium`, `risk_score=50`; `audit_logs change_summary` contains "guest profile"
- [ ] Nightly CRON enqueues one job per upcoming `Confirmed` appointment; no inline scoring in CRON job
- [ ] `GET /api/queue/today` response includes `risk_factors` array for High-risk rows
- [ ] Scoring transaction is separate from booking transaction (verify by simulating scoring failure — booking must already be committed and intact)
