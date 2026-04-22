---
title: "Task — BE Audit Log Read API"
task_id: task_002
story_id: us_021
epic: EP-001
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — BE Audit Log Read API

## Requirement Reference

- **User Story**: us_021
- **Story Location**: .propel/context/tasks/EP-001/us_021/us_021.md
- **Acceptance Criteria**:
  - AC-3: `GET /api/admin/audit-logs?page=1&pageSize=50` (default) → paginated list ordered by `occurred_at DESC`; response body: `[{log_id, occurred_at, actor_id, actor_role, action_type, entity_type, entity_id, change_summary, ip_address}]`; `X-Total-Count` response header.
  - AC-4: `GET /api/admin/audit-logs?from=X&to=Y&actor=Z&action=A&entity=E` → WHERE clauses using parameterised queries; `X-Total-Count` header on filtered results; existing composite index on `(entity_type, occurred_at DESC)` (from US_015) is used.
  - AC-6: No `DELETE /api/admin/audit-logs/{id}` or `PUT /api/admin/audit-logs/{id}` route registered → HTTP 405 Method Not Allowed; `InvalidOperationException` guard in `AuditDbContext` as secondary defence.
- **Edge Cases**:
  - No entries match the filter: return empty `[]` array with `X-Total-Count: 0` and HTTP 200 (not 404).
  - `from` > `to` date range: return HTTP 400 "Invalid date range — from must be before to".
  - `pageSize` exceeding allowed maximum (e.g., > 200): clamp to 200 and log INFO.

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
| Auth | JWT Bearer + RBAC | ASP.NET Core |
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

Implement the read-only Admin Audit Log API in the `Admin` feature module. A single `GET /api/admin/audit-logs` endpoint returns paginated, filterable audit log entries ordered by `occurred_at DESC`. Filtering supports date range (`from`/`to`), actor name substring, `action_type`, and `entity_type`. All filter predicates use EF Core LINQ (parameterised). No write routes (`PUT`, `DELETE`) are registered for this resource; the router itself enforces HTTP 405 by simply not registering those routes. The composite index on `(entity_type, occurred_at DESC)` from US_015 ensures efficient filtered queries.

---

## Dependent Tasks

- US_015 (audit_logs entity + composite index on `entity_type, occurred_at DESC`) — must be migrated
- task_001 (AuditMiddleware) — populates the `audit_logs` table; read API is independent and can be developed in parallel using seeded test data

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Admin/AuditLogsController.cs` | CREATE | Read-only controller; `GET` only; no PUT/DELETE routes |
| `Server/Features/Admin/AuditLogService.cs` | CREATE | Query service: pagination, filtering, LINQ predicate building |
| `Server/Features/Admin/Dtos/AuditLogEntryDto.cs` | CREATE | Response DTO mapping from AuditLog entity |
| `Server/Features/Admin/Dtos/AuditLogFilterRequest.cs` | CREATE | Query parameter model: from, to, actor, action, entity, page, pageSize |

---

## Implementation Plan

1. **Controller scaffold** — `AuditLogsController` in `Server/Features/Admin/`; `[ApiController]`, `[Route("api/admin/audit-logs")]`, `[Authorize(Roles = "Admin")]`. Only register `[HttpGet]` — no `[HttpPut]`, `[HttpDelete]`. ASP.NET Core will automatically return HTTP 405 for unregistered HTTP verbs on a matched route.

2. **Filter model** — `AuditLogFilterRequest` with: `DateTimeOffset? From`, `DateTimeOffset? To`, `string? Actor`, `string? Action`, `string? Entity`, `int Page = 1`, `int PageSize = 50`. Validate `From < To` (return HTTP 400 if violated). Clamp `PageSize` to max 200.

3. **LINQ query building** — In `AuditLogService.GetFilteredAsync(AuditLogFilterRequest filter)`:
   ```csharp
   var query = _context.AuditLogs.AsNoTracking();
   if (filter.From.HasValue) query = query.Where(l => l.OccurredAt >= filter.From.Value);
   if (filter.To.HasValue)   query = query.Where(l => l.OccurredAt <= filter.To.Value);
   if (!string.IsNullOrEmpty(filter.Actor))  query = query.Where(l => EF.Functions.ILike(l.ActorRole, $"%{filter.Actor}%"));
   if (!string.IsNullOrEmpty(filter.Action)) query = query.Where(l => l.ActionType == filter.Action);
   if (!string.IsNullOrEmpty(filter.Entity)) query = query.Where(l => l.EntityType == filter.Entity);
   var total = await query.CountAsync();
   var items = await query.OrderByDescending(l => l.OccurredAt)
                           .Skip((filter.Page - 1) * filter.PageSize)
                           .Take(filter.PageSize)
                           .Select(l => new AuditLogEntryDto { ... })
                           .ToListAsync();
   return (items, total);
   ```
   The `OrderByDescending(l => l.OccurredAt)` combined with the `entity_type` filter leverages the composite index `(entity_type, occurred_at DESC)`.

4. **Response** — Set `Response.Headers["X-Total-Count"] = total.ToString()`. Return HTTP 200 with `items` (empty array if no results — never 404).

5. **HTTP 405 enforcement** — No mutation routes registered in controller. ASP.NET Core's default routing returns 405 when a route matches but the HTTP method is not handled.

6. **Date range validation** — Validate in `AuditLogService` or via a `[ModelBinder]`/`IActionFilter`: if `From > To` return `BadRequest("Invalid date range — from must be before to")`.

---

## Current Project State

```
Server/
  Features/
    Admin/
      UsersController.cs          # from task_003 of us_020
      AdminUserService.cs         # from task_003 of us_020
      AuditLogsController.cs      # (to be created)
  Data/
    AuditDbContext.cs             # from task_001 of us_021
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/Features/Admin/AuditLogsController.cs | Read-only controller; GET endpoint only; no mutation routes |
| CREATE | Server/Features/Admin/AuditLogService.cs | Filtering + pagination service with parameterised LINQ predicates |
| CREATE | Server/Features/Admin/Dtos/AuditLogEntryDto.cs | Response DTO: log_id, occurred_at, actor_id, actor_role, action_type, entity_type, entity_id, change_summary, ip_address |
| CREATE | Server/Features/Admin/Dtos/AuditLogFilterRequest.cs | Query param model with date range, actor, action, entity, page, pageSize |
| MODIFY | Server/Program.cs | Ensure `AuditLogService` registered as scoped |

---

## External References

- EF Core LINQ predicates with optional filters: https://learn.microsoft.com/en-us/ef/core/querying/
- EF Core `AsNoTracking` for read-only queries (performance): https://learn.microsoft.com/en-us/ef/core/querying/tracking
- ASP.NET Core 405 Method Not Allowed automatic handling: https://learn.microsoft.com/en-us/aspnet/core/web-api/
- PostgreSQL composite index leverage with EF Core `OrderByDescending`: https://www.npgsql.org/efcore/
- `X-Total-Count` header pattern for pagination

---

## Build Commands

- `cd Server && dotnet build` — C# compile check
- `cd Server && dotnet test` — Run unit tests
- `cd Server && dotnet run` — Start server for integration testing

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `GET /api/admin/audit-logs` returns paginated list ordered by `occurred_at DESC` with `X-Total-Count`
- [ ] All filter combinations (`from`, `to`, `actor`, `action`, `entity`) produce correct WHERE clauses (verified via EF Core logging)
- [ ] `from > to` → HTTP 400 "Invalid date range — from must be before to"
- [ ] Empty result set → HTTP 200 with `[]` and `X-Total-Count: 0`
- [ ] `pageSize > 200` → clamped to 200; INFO log written
- [ ] `PUT /api/admin/audit-logs/{id}` → HTTP 405
- [ ] `DELETE /api/admin/audit-logs/{id}` → HTTP 405
- [ ] Non-Admin JWT → HTTP 403

---

## Implementation Checklist

- [ ] Create `AuditLogsController.cs` with `[HttpGet]` only; no `[HttpPut]` or `[HttpDelete]`
- [ ] Create `AuditLogFilterRequest.cs` DTO with nullable filter fields and default page/pageSize
- [ ] Implement `AuditLogService.GetFilteredAsync()` with conditional LINQ predicates (parameterised)
- [ ] Add `from > to` date range validation returning HTTP 400
- [ ] Clamp `pageSize` to maximum 200 in service; log INFO if clamped
- [ ] Set `X-Total-Count` response header from `CountAsync()` before pagination
- [ ] Apply `OrderByDescending(l => l.OccurredAt)` to leverage `(entity_type, occurred_at DESC)` index
- [ ] Use `AsNoTracking()` on all read queries for performance
- [ ] Create `AuditLogEntryDto.cs` mapping all required fields
- [ ] Register `AuditLogService` as scoped in `Program.cs`
