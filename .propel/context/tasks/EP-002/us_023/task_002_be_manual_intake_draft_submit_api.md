---
title: "Task — BE Manual Intake Draft & Submit API"
task_id: task_002
story_id: us_023
epic: EP-002
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE Manual Intake Draft & Submit API

## Requirement Reference

- **User Story**: us_023
- **Story Location**: .propel/context/tasks/EP-002/us_023/us_023.md
- **Acceptance Criteria**:
  - AC-1: `GET /api/intake/status` → return existing `patient_intakes` row fields or empty state (shared with us_022 task_002; ensure endpoint exists)
  - AC-2: `POST /api/intake/draft {partial_fields}` → UPSERT `patient_intakes` setting `intake_method = Manual`, partial JSONB fields, `updated_at = NOW()`; return HTTP 200; no audit log for drafts
  - AC-3: `POST /api/intake/submit` → set `submitted_at = NOW()`, `intake_method = Manual`; write `audit_logs { action_type = "IntakeSubmitted" }`; return HTTP 200
  - AC-4: Client-side validation only; API enforces NOT NULL on `chief_complaint` as secondary guard → HTTP 400 if chief_complaint empty on submit
  - AC-6: If `submitted_at` already set and patient re-submits → `PUT /api/intake/{intake_id}` (handled by us_025); `POST /api/intake/submit` should check and route appropriately or refuse (defer to us_025 for the PUT path)
- **Edge Cases**:
  - Auto-save payload exceeds 64 KB → API returns HTTP 413 (configured `MaxRequestBodySize` in ASP.NET Core middleware)
  - `intake_method` overwrite on manual submission → set `Manual` regardless of previous AI value; all JSONB field values preserved

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
| Logging | Serilog | latest |

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

Implement the manual intake backend endpoints in `Server/Features/Intake/`. The `IntakeController` exposes `POST /api/intake/draft` (UPSERT partial fields, no audit log) and `POST /api/intake/submit` (set `submitted_at`, write audit log). Both endpoints are Patient-role-only. A 64 KB request body limit is applied via ASP.NET Core middleware. The UPSERT pattern uses PostgreSQL `ON CONFLICT (patient_id) DO UPDATE` via EF Core raw SQL or `ExecuteSqlRawAsync` to handle partial JSONB column updates safely. `GET /api/intake/status` may already exist from us_022 task_002; this task confirms/adds it.

---

## Dependent Tasks

- US_010 (`patient_intakes` EF Core entity with encrypted JSONB fields) — must be migrated
- US_015 (`audit_logs` entity) — `AuditLogs` DbSet must exist for submit audit write
- us_022 task_002 — `GET /api/intake/status` and `IntakeController` may already be partially created; this task adds draft + submit endpoints

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Intake/IntakeController.cs` | MODIFY or CREATE | Add `POST /api/intake/draft` and `POST /api/intake/submit` |
| `Server/Features/Intake/IntakeService.cs` | CREATE | Business logic: UPSERT draft, submit with audit log, status fetch |
| `Server/Features/Intake/Dtos/IntakeDraftRequest.cs` | CREATE | DTO for draft partial fields (all nullable JSONB objects) |
| `Server/Features/Intake/Dtos/IntakeStatusResponse.cs` | CREATE | Response DTO: has existing row + section presence map |
| `Server/Program.cs` | MODIFY | Configure 64 KB `MaxRequestBodySize` for intake endpoints |

---

## Implementation Plan

1. **`POST /api/intake/draft`** — Accept `IntakeDraftRequest { demographics?, medical_history?, medications?, allergies?, chief_complaint?, intake_method }`. UPSERT into `patient_intakes`:
   ```sql
   INSERT INTO patient_intakes (intake_id, patient_id, intake_method, demographics, medical_history, medications, allergies, chief_complaint, updated_at)
   VALUES (@id, @patientId, @method, @demographics, @medicalHistory, @medications, @allergies, @chiefComplaint, NOW())
   ON CONFLICT (patient_id)
   DO UPDATE SET
     demographics    = COALESCE(EXCLUDED.demographics, patient_intakes.demographics),
     medical_history = COALESCE(EXCLUDED.medical_history, patient_intakes.medical_history),
     medications     = COALESCE(EXCLUDED.medications, patient_intakes.medications),
     allergies       = COALESCE(EXCLUDED.allergies, patient_intakes.allergies),
     chief_complaint = COALESCE(EXCLUDED.chief_complaint, patient_intakes.chief_complaint),
     intake_method   = EXCLUDED.intake_method,
     updated_at      = NOW();
   ```
   No `submitted_at` update. No audit log. Return HTTP 200.

2. **`POST /api/intake/submit`** — Load existing `patient_intakes` row. Validate `chief_complaint` NOT NULL; return HTTP 400 if empty. Set `submitted_at = NOW()`, `intake_method = Manual`. Write `audit_logs { action_type = "IntakeSubmitted", entity_type = "PatientIntake", entity_id = intake_id, actor_id, actor_role = "Patient", change_summary = "Manual intake submitted" }`. Return HTTP 200.

3. **Request size limit** — Configure in `Program.cs`:
   ```csharp
   builder.WebHost.ConfigureKestrel(options =>
       options.Limits.MaxRequestBodySize = 65_536); // 64 KB
   ```
   ASP.NET Core automatically returns HTTP 413 when limit is exceeded.

4. **`GET /api/intake/status`** — If already created by us_022 task_002, confirm it returns correct response; otherwise create: query `patient_intakes WHERE patient_id = @actorId`; return `{ hasIntake, sections: { demographics: bool, medical_history: bool, medications: bool, allergies: bool, chief_complaint: bool }, intake_id, updated_at }`.

5. **JSONB encryption** — All JSONB columns storing PHI must pass through column-level encryption helpers established in US_010. Ensure `IntakeService` delegates to the encryption utility before persistence.

---

## Current Project State

```
Server/
  Features/
    Intake/
      IntakeChatController.cs  # from us_022 task_002
      IntakeChatService.cs     # from us_022 task_002
      AiGuardLayer.cs          # from us_022 task_002
  Data/
    AppDbContext.cs
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY or CREATE | Server/Features/Intake/IntakeController.cs | Add POST /api/intake/draft and POST /api/intake/submit endpoints |
| CREATE | Server/Features/Intake/IntakeService.cs | UPSERT draft, submit with audit log, status check logic |
| CREATE | Server/Features/Intake/Dtos/IntakeDraftRequest.cs | Nullable partial JSONB field DTO |
| CREATE | Server/Features/Intake/Dtos/IntakeStatusResponse.cs | Section presence map response DTO |
| MODIFY | Server/Program.cs | Set 64 KB MaxRequestBodySize for Kestrel |

---

## External References

- PostgreSQL `ON CONFLICT DO UPDATE` (UPSERT) with `COALESCE` for partial JSONB: https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT
- EF Core `ExecuteSqlRawAsync` for custom UPSERT: https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete
- ASP.NET Core Kestrel request body size limit: https://learn.microsoft.com/en-us/aspnet/core/mvc/models/file-uploads#server-side-validation
- EF Core Npgsql JSON mapping: https://www.npgsql.org/efcore/mapping/json.html
- ASP.NET Core `[Authorize(Roles = "Patient")]`: https://learn.microsoft.com/en-us/aspnet/core/security/authorization/roles

---

## Build Commands

- `cd Server && dotnet build` — C# compile check
- `cd Server && dotnet test` — Run unit/integration tests
- `cd Server && dotnet run` — Start API for integration testing

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `POST /api/intake/draft`: partial UPSERT only updates provided columns; preserves existing JSONB values
- [ ] `POST /api/intake/draft`: no `submitted_at` change; no audit log entry written
- [ ] `POST /api/intake/draft` with payload > 64 KB → HTTP 413
- [ ] `POST /api/intake/submit` with empty `chief_complaint` → HTTP 400
- [ ] `POST /api/intake/submit`: `submitted_at` set; audit log `IntakeSubmitted` written; HTTP 200
- [ ] `intake_method` set to `Manual` on draft and submit regardless of previous value
- [ ] PHI JSONB columns encrypted before persistence (verify encrypted bytes in DB)
- [ ] Non-Patient JWT → HTTP 403

---

## Implementation Checklist

- [ ] Create or modify `IntakeController.cs` to add `POST /api/intake/draft` and `POST /api/intake/submit`
- [ ] Create `IntakeService.cs` with UPSERT draft logic using `ON CONFLICT DO UPDATE` with `COALESCE`
- [ ] Implement `chief_complaint` NOT NULL guard in submit path → HTTP 400 if null/empty
- [ ] Set `submitted_at = NOW()` and write audit log entry in submit path
- [ ] Create `IntakeDraftRequest.cs` DTO with all nullable fields
- [ ] Confirm `GET /api/intake/status` returns section presence map (create if not already done in us_022)
- [ ] Configure 64 KB `MaxRequestBodySize` in `Program.cs`
- [ ] Ensure all JSONB PHI columns use column-level encryption before EF Core persistence
- [ ] Register `IntakeService` as scoped in `Program.cs`
