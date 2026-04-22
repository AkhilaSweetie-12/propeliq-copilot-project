---
title: "Task — BE Intake Current-Data Endpoint"
task_id: task_002
story_id: us_024
epic: EP-002
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE Intake Current-Data Endpoint

## Requirement Reference

- **User Story**: us_024
- **Story Location**: .propel/context/tasks/EP-002/us_024/us_024.md
- **Acceptance Criteria**:
  - AC-1, AC-2: `GET /api/intake/current-data` → return the full current `patient_intakes` row for the authenticated patient as a structured field map; empty object `{}` if no row exists (never 404)
  - AC-3: `intake_method` enum recorded at next `POST /api/intake/draft` or `POST /api/intake/submit` (not a separate API call); this task only provides the current-data read endpoint
- **Edge Cases**:
  - No `patient_intakes` row exists → return HTTP 200 with empty field map `{}`; FE shows target screen with empty fields

---

## Design References (Frontend Tasks Only)

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
| ORM | Entity Framework Core | 9 (Npgsql provider) |
| Database | PostgreSQL | 16 |
| Auth | JWT Bearer | ASP.NET Core |

---

## AI References (AI Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |
| **AI Pattern** | N/A |
| **Prompt Template Path** | N/A |
| **Guardrails Config** | N/A |
| **Model Provider** | N/A |

---

## Mobile References (Mobile Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |
| **Platform Target** | N/A |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Implement `GET /api/intake/current-data` in the existing `IntakeController`. This endpoint reads the full `patient_intakes` row for the authenticated patient (identified by `actor_id` from JWT) and returns all field values decrypted into a structured DTO. If no row exists, return HTTP 200 with an empty object. This is a pure read endpoint — it performs no writes and writes no audit log. It is called by the SPA before navigating between intake screens to carry full field data across the switch.

---

## Dependent Tasks

- US_010 (`patient_intakes` entity) — must exist; encrypted JSONB columns must be readable via EF Core
- us_022 task_002 / us_023 task_002 — `IntakeController` must already exist; this task adds one endpoint

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Intake/IntakeController.cs` | MODIFY | Add `GET /api/intake/current-data` endpoint |
| `Server/Features/Intake/IntakeService.cs` | MODIFY | Add `GetCurrentDataAsync(Guid patientId)` method |
| `Server/Features/Intake/Dtos/IntakeCurrentDataResponse.cs` | CREATE | Response DTO with all 5 JSONB field objects + intake_method + intake_id |

---

## Implementation Plan

1. **Endpoint** — `[HttpGet("current-data")]` in `IntakeController`. `[Authorize(Roles = "Patient")]`. Extract `actor_id` from JWT claim.

2. **Service method** — `GetCurrentDataAsync(Guid patientId)`:
   - Query: `await _context.PatientIntakes.AsNoTracking().FirstOrDefaultAsync(p => p.PatientId == patientId)`.
   - If null: return `new IntakeCurrentDataResponse()` (all fields null/empty).
   - If found: decrypt JSONB columns via column-level decryption helper; map to `IntakeCurrentDataResponse`.

3. **Response DTO** — `IntakeCurrentDataResponse`:
   ```csharp
   public class IntakeCurrentDataResponse
   {
       public Guid? IntakeId { get; set; }
       public string? IntakeMethod { get; set; }
       public object? Demographics { get; set; }
       public object? MedicalHistory { get; set; }
       public object? Medications { get; set; }
       public object? Allergies { get; set; }
       public string? ChiefComplaint { get; set; }
       public DateTimeOffset? UpdatedAt { get; set; }
   }
   ```
   All fields nullable; FE treats null as "not yet filled".

4. **Empty-row handling** — Return `IntakeCurrentDataResponse` with all nulls and HTTP 200. Never return 404.

5. **No audit log** — This is a pure read; no audit entry is written.

---

## Current Project State

```
Server/
  Features/
    Intake/
      IntakeController.cs    # exists (us_022/us_023)
      IntakeService.cs       # exists (us_023)
      Dtos/
        IntakeDraftRequest.cs
        IntakeStatusResponse.cs
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | Server/Features/Intake/IntakeController.cs | Add GET /api/intake/current-data endpoint |
| MODIFY | Server/Features/Intake/IntakeService.cs | Add GetCurrentDataAsync method with decryption |
| CREATE | Server/Features/Intake/Dtos/IntakeCurrentDataResponse.cs | All-nullable response DTO for full intake field map |

---

## External References

- EF Core `FirstOrDefaultAsync` for nullable read: https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries
- EF Core `AsNoTracking` for read-only performance: https://learn.microsoft.com/en-us/ef/core/querying/tracking
- Npgsql JSONB decryption column mapping: https://www.npgsql.org/efcore/mapping/json.html

---

## Build Commands

- `cd Server && dotnet build` — C# compile check
- `cd Server && dotnet test` — Run unit tests
- `cd Server && dotnet run` — Start server for integration testing

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `GET /api/intake/current-data` for patient with existing row → returns all fields decrypted
- [ ] `GET /api/intake/current-data` for patient with no row → HTTP 200 with empty DTO (all nulls)
- [ ] No audit log entry written on this endpoint
- [ ] Non-Patient JWT → HTTP 403
- [ ] All JSONB PHI fields decrypted correctly in response (no ciphertext returned)

---

## Implementation Checklist

- [ ] Add `[HttpGet("current-data")]` to `IntakeController.cs` with `[Authorize(Roles = "Patient")]`
- [ ] Implement `GetCurrentDataAsync(Guid patientId)` in `IntakeService.cs` using `FirstOrDefaultAsync`
- [ ] Use `AsNoTracking()` for read-only query
- [ ] Decrypt all JSONB PHI columns before mapping to DTO
- [ ] Create `IntakeCurrentDataResponse.cs` with all nullable fields
- [ ] Return empty DTO (all nulls) when no row exists — never 404
- [ ] Confirm no audit log entry is written
