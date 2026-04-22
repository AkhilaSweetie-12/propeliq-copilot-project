---
title: "Task — BE Slots Query API & RBAC Guard (GET /api/slots)"
task_id: task_002
story_id: us_026
epic: EP-003
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE Slots Query API & RBAC Guard (GET /api/slots)

## Requirement Reference

- **User Story**: us_026
- **Story Location**: .propel/context/tasks/EP-003/us_026/us_026.md
- **Acceptance Criteria**:
  - AC-1: `GET /api/slots?date_range=X` returns all `appointment_slots` rows (available + unavailable); response includes `slot_id`, `slot_date`, `slot_time`, `duration_minutes`, `is_available`, provider info
  - AC-3: API returns HTTP 403 Forbidden for Staff and Admin roles — booking calendar is Patient-only; RBAC enforced at API route level
  - Edge Case: `date_range` exceeding 28 days → HTTP 400 "Date range cannot exceed 28 days"; default client range is 7 days

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
| Auth | JWT Bearer RBAC | ASP.NET Core |
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

Create `SlotsController` with a `GET /api/slots` endpoint. The endpoint is restricted to `role = Patient` via `[Authorize(Roles = "Patient")]`. It accepts a `date_range` query string (ISO format: `start_date,end_date`), validates span ≤ 28 days, queries `appointment_slots` joined to provider data, and returns a JSON array of slot DTOs. Non-patient callers receive HTTP 403.

---

## Dependent Tasks

- US_008 (Foundational) — `appointment_slots` entity with `slot_id`, `slot_date`, `slot_time`, `duration_minutes`, `is_available`, `provider_id` must exist
- US_018 (Foundational) — JWT auth middleware must be registered; `role` claim available

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Slots/SlotsController.cs` | CREATE | `GET /api/slots?date_range=start,end` |
| `Server/Features/Slots/SlotsService.cs` | CREATE | Query + date validation logic |
| `Server/Features/Slots/Dtos/SlotResponse.cs` | CREATE | `slot_id`, `slot_date`, `slot_time`, `duration_minutes`, `is_available`, `provider_name`, `provider_specialty`, `appointment_type` |
| `Server/Program.cs` | MODIFY | Register `SlotsController` routes if not auto-discovered |

---

## Implementation Checklist

- [ ] Create `SlotsController` with `[Authorize(Roles = "Patient")]`; add `[HttpGet]` method accepting `date_range` query parameter
- [ ] Parse `date_range` as `"start_date,end_date"` (ISO 8601); return HTTP 400 with message "Date range cannot exceed 28 days" if span > 28 days; return HTTP 400 if parse fails
- [ ] Query `appointment_slots` filtered by `slot_date BETWEEN startDate AND endDate`; join provider info (`providers.full_name`, `providers.specialty`); use `AsNoTracking()` for read performance
- [ ] Map results to `SlotResponse` DTO (no PHI fields); return `IEnumerable<SlotResponse>` with HTTP 200
- [ ] Add Staff/Admin access test: `[Authorize(Roles = "Patient")]` alone is sufficient; non-Patient JWT → HTTP 403 (handled by ASP.NET Core middleware — no extra code needed beyond the attribute)
- [ ] Log `Serilog.Warning` when date range exceeds 28 days (potential misuse indicator); include `actor_id` from JWT claim in log properties
- [ ] Add `X-Total-Count` response header with total slot count for the range (aids SPA pagination/planning without a separate count endpoint)

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] `GET /api/slots?date_range=2026-04-21,2026-04-27` with Patient JWT → HTTP 200, array of slots
- [ ] Same request with Staff JWT → HTTP 403
- [ ] `date_range` span > 28 days → HTTP 400 "Date range cannot exceed 28 days"
- [ ] Malformed `date_range` (non-ISO) → HTTP 400
- [ ] Response DTOs contain no PHI fields (no patient data)
- [ ] `AsNoTracking()` confirmed; no EF change-tracking overhead on read
