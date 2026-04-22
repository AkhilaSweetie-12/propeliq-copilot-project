---
title: "Task — BE Queue Today API & Staff RBAC Guard (GET /api/queue/today)"
task_id: task_002
story_id: us_031
epic: EP-004
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE Queue Today API & Staff RBAC Guard (GET /api/queue/today)

## Requirement Reference

- **User Story**: us_031
- **Story Location**: .propel/context/tasks/EP-004/us_031/us_031.md
- **Acceptance Criteria**:
  - AC-1: All `/api/queue/*` and `/api/appointments/walkin` endpoints return HTTP 403 for non-Staff roles; RBAC enforced at API middleware level
  - AC-2: `GET /api/queue/today` returns payload including: total appointments today, arrived count, still-scheduled count, High-risk count, and queue preview rows (first 5 by `slot_time ASC`)
  - AC-3: Queue preview rows include: `patient_id`, `patient_name`, `slot_time`, `provider_name`, `status`, `no_show_risk`, `risk_score`; ordered by `slot_time ASC`
  - Edge Case: Empty queue (no appointments today) → HTTP 200 with all counts = 0 and empty preview array (never HTTP 404)

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
| Database | PostgreSQL | 16 |
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

Create `QueueController` with `GET /api/queue/today` restricted to `[Authorize(Roles = "Staff")]`. Single query (or two lightweight queries) aggregates appointment counts (total, arrived, scheduled, High-risk) and the top-5 preview rows ordered by `slot_time ASC`. All `/api/queue/*` routes inherit the Staff RBAC constraint. Returns HTTP 200 with counts and preview array; always returns 200 even when empty.

---

## Dependent Tasks

- US_008 (Foundational) — `appointments` entity with `status`, `slot_date`, `slot_time`, `no_show_risk`, `queue_position` columns
- US_018 (Foundational) — JWT middleware; `role` claim available
- us_035 task_002 — `AppointmentRiskScoringJob` writes `no_show_risk` to `appointments`; this endpoint reads it

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Queue/QueueController.cs` | CREATE | `GET /api/queue/today`; `[Authorize(Roles = "Staff")]` |
| `Server/Features/Queue/QueueService.cs` | CREATE | Aggregation query + preview rows |
| `Server/Features/Queue/Dtos/QueueTodayResponse.cs` | CREATE | `TotalToday`, `ArrivedCount`, `ScheduledCount`, `HighRiskCount`, `Preview: QueuePreviewRow[]` |
| `Server/Features/Queue/Dtos/QueuePreviewRow.cs` | CREATE | `AppointmentId`, `PatientId`, `PatientName`, `SlotTime`, `ProviderName`, `Status`, `NoShowRisk`, `RiskScore` |

---

## Implementation Checklist

- [ ] Create `QueueController [Authorize(Roles = "Staff")] [Route("api/queue")]`; all child routes inherit Staff RBAC — non-Staff JWT → HTTP 403 automatically
- [ ] Implement `GET /api/queue/today`: query `appointments JOIN users JOIN providers WHERE slot_date = CURRENT_DATE`; use `AsNoTracking()` for read performance
- [ ] Compute aggregates from the same dataset: `TotalToday = Count()`; `ArrivedCount = Count(status=Arrived)`; `ScheduledCount = Count(status=Confirmed OR status=WalkIn)`; `HighRiskCount = Count(no_show_risk='High')`
- [ ] Build preview rows: `OrderBy(slot_time ASC).Take(5)`; include `patient_name` (from `users.first_name + last_name`), `provider_name`, `status`, `no_show_risk`, `risk_score`; map to `QueuePreviewRow` DTO
- [ ] Return HTTP 200 `QueueTodayResponse` always — empty array + zero counts when no appointments; never HTTP 404
- [ ] Ensure no PHI beyond patient name is returned in the preview DTO; no DOB, insurance details, or MRN in this endpoint response

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Staff JWT → HTTP 200 with correct counts and preview rows
- [ ] Patient/Admin JWT → HTTP 403
- [ ] Empty queue → HTTP 200 with all counts = 0 and `Preview: []`
- [ ] Preview ordered by `slot_time ASC`; at most 5 rows
- [ ] `no_show_risk` field included (may be null for new appointments)
- [ ] `AsNoTracking()` confirmed; no EF tracking overhead
