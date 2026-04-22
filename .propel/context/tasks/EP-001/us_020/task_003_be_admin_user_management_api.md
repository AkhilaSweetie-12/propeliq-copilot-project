---
title: "Task — BE Admin User Management API"
task_id: task_003
story_id: us_020
epic: EP-001
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_003 — BE Admin User Management API

## Requirement Reference

- **User Story**: us_020
- **Story Location**: .propel/context/tasks/EP-001/us_020/us_020.md
- **Acceptance Criteria**:
  - AC-1: `GET /api/admin/users?query=X&role=Staff&page=1&pageSize=20` → paginated `[{user_id, name, email, role, status, last_active}]` via ILIKE with parameterised query
  - AC-2: `POST /api/admin/users {name, email, role}` → HTTP 201 `{user_id}` if email new; audit log `UserCreated`; HTTP 409 if email exists
  - AC-3: `PATCH /api/admin/users/{id} {role?, status?}` → validate admin != target; UPDATE users; audit log `UserUpdated`; HTTP 200
  - AC-4: `DELETE /api/admin/users/{id}` → soft-delete only (`UPDATE users SET status = Inactive`); audit log `UserDeactivated`; HTTP 200; no physical row removal
  - AC-5: Deactivated user login attempt → HTTP 401 "Invalid credentials" (no disclosure of deactivation)
  - AC-6: `DELETE /api/admin/users/{id}?permanent=true` → HTTP 400 "Permanent deletion of user records is prohibited — use deactivation"
- **Edge Cases**:
  - Admin self-deactivation: `actor_id == target_user_id` → HTTP 400 "Administrators cannot deactivate their own account"
  - Role change to Patient with active appointments: permit the change; include `warnings.activeAppointments: true` in response body for FE to surface banner
  - SQL injection in `query` param: EF Core parameterised ILIKE; no raw SQL

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
| Auth | JWT Bearer + RBAC | ASP.NET Core Identity / custom claims |

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

Implement the Admin User Management API in the `Admin` feature module of the ASP.NET Core Web API. The controller exposes four endpoints: paginated search (`GET`), create (`POST`), update (`PATCH`), and soft-delete (`DELETE`). All endpoints require the `Admin` RBAC role via `[Authorize(Roles = "Admin")]`. Mutation endpoints write an audit log entry to `audit_logs` (consumed by US_021 middleware). Hard-delete is actively rejected with HTTP 400. The deactivated-user login guard for AC-5 is handled in the existing login flow (US_018 dependency); this task only ensures `status = Inactive` is set correctly.

---

## Dependent Tasks

- US_007 (users entity + EF Core entity model) — `Users` DbSet must be configured
- US_015 (audit_logs append-only entity) — `AuditLogs` DbSet must be available for audit writes
- US_018 (login flow) — `status = Inactive` check on login is an existing or co-located concern; confirm it returns HTTP 401 "Invalid credentials" for inactive users

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Features/Admin/UsersController.cs` | CREATE | REST controller with all 4 endpoints |
| `Server/Features/Admin/AdminUserService.cs` | CREATE | Business logic: search, create, update, deactivate |
| `Server/Features/Admin/Dtos/UserSummaryDto.cs` | CREATE | Response DTO for list endpoint |
| `Server/Features/Admin/Dtos/CreateUserRequest.cs` | CREATE | Request DTO for POST |
| `Server/Features/Admin/Dtos/UpdateUserRequest.cs` | CREATE | Request DTO for PATCH |
| `Server/Data/AppDbContext.cs` | MODIFY | Ensure `Users` and `AuditLogs` DbSets are registered (if not already) |

---

## Implementation Plan

1. **Controller scaffold** — `UsersController` in `Server/Features/Admin/`; decorate with `[ApiController]`, `[Route("api/admin/users")]`, `[Authorize(Roles = "Admin")]`.
2. **GET /api/admin/users** — Accept `query` (string, optional), `role` (enum, optional), `page` (int, default 1), `pageSize` (int, default 20, max 100). Build LINQ query: `Users.Where(u => EF.Functions.ILike(u.Name, $"%{query}%") || EF.Functions.ILike(u.Email, $"%{query}%"))` with optional role filter. Project to `UserSummaryDto`. Add `X-Total-Count` response header. Use `.Skip((page-1)*pageSize).Take(pageSize)`. **No raw SQL** — EF Core parameterises all inputs.
3. **POST /api/admin/users** — Validate `CreateUserRequest` (name, email, role). Check email uniqueness: `Users.AnyAsync(u => u.Email == request.Email)`. If duplicate, return HTTP 409. Otherwise, insert `User` with `Status = Active`, `PasswordHash = TemporaryHash` (random; user resets on first login), write `AuditLog { action_type = "UserCreated", entity_type = "User", entity_id = newUser.user_id, change_summary = $"User {name} created with role {role}", actor_id, actor_role, ip_address }`. Return HTTP 201 `{ user_id }`.
4. **PATCH /api/admin/users/{id}** — Validate `UpdateUserRequest`. Guard: if `actorId == targetId` → HTTP 400. Load user by ID; 404 if not found. Apply `role` and/or `status` if provided. Check active appointments if role changed to Patient: `Appointments.AnyAsync(a => a.PatientId == id && a.Status == AppointmentStatus.Confirmed)` → set `response.Warnings.ActiveAppointments = true`. Write `AuditLog { action_type = "UserUpdated", ... }`. Return HTTP 200 with updated user + optional warnings.
5. **DELETE /api/admin/users/{id}** — Check `permanent` query param: if `permanent == true` → HTTP 400 "Permanent deletion prohibited". Otherwise, soft-delete: `user.Status = Inactive`. Guard: if `actorId == targetId` → HTTP 400 "Administrators cannot deactivate their own account". Write `AuditLog { action_type = "UserDeactivated", ... }`. Return HTTP 200.
6. **Registration** — Register `AdminUserService` as scoped in `Program.cs`. Ensure EF Core `Users` and `AuditLogs` DbSets are configured in `AppDbContext`.

---

## Current Project State

```
Server/
  Features/
    Admin/           # (to be created)
  Data/
    AppDbContext.cs
  Features/
    Auth/
      AuthController.cs    # existing login/logout
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/Features/Admin/UsersController.cs | REST controller for admin user management endpoints |
| CREATE | Server/Features/Admin/AdminUserService.cs | Business logic service with LINQ queries, audit log writes, guards |
| CREATE | Server/Features/Admin/Dtos/UserSummaryDto.cs | List endpoint response: user_id, name, email, role, status, last_active |
| CREATE | Server/Features/Admin/Dtos/CreateUserRequest.cs | POST request DTO with data annotations |
| CREATE | Server/Features/Admin/Dtos/UpdateUserRequest.cs | PATCH request DTO (role and status both optional) |
| MODIFY | Server/Data/AppDbContext.cs | Confirm Users, AuditLogs DbSets registered |
| MODIFY | Server/Program.cs | Register AdminUserService as scoped |

---

## External References

- EF Core ILIKE with Npgsql: https://www.npgsql.org/efcore/mapping/full-text-search.html
- EF Core `EF.Functions.ILike` (parameterised): https://learn.microsoft.com/en-us/ef/core/querying/database-functions
- ASP.NET Core RBAC with `[Authorize(Roles)]`: https://learn.microsoft.com/en-us/aspnet/core/security/authorization/roles
- EF Core pagination with Skip/Take: https://learn.microsoft.com/en-us/ef/core/querying/pagination
- X-Total-Count header pattern for pagination metadata

---

## Build Commands

- `cd Server && dotnet build` — C# compile check
- `cd Server && dotnet test` — Run API unit tests
- `cd Server && dotnet run` — Start API server for integration testing

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `GET /api/admin/users` returns paginated results with `X-Total-Count` header
- [ ] `query` parameter uses `ILike` (parameterised); SQL injection string returns zero rows
- [ ] `POST` with new email → HTTP 201 `{user_id}`; `AuditLog` row with `action_type=UserCreated` inserted
- [ ] `POST` with duplicate email → HTTP 409
- [ ] `PATCH` for own account → HTTP 400 "Administrators cannot deactivate their own account"
- [ ] `PATCH` returns `warnings.activeAppointments=true` when confirmed appointments exist
- [ ] `DELETE` with `permanent=true` → HTTP 400
- [ ] `DELETE` soft-deletes only; `users` row count unchanged; status = Inactive; audit log written
- [ ] All endpoints return HTTP 401/403 when called without Admin JWT

---

## Implementation Checklist

- [ ] Scaffold `UsersController.cs` with `[Authorize(Roles = "Admin")]` and route `api/admin/users`
- [ ] Implement `GET` endpoint with ILIKE query, role filter, pagination, `X-Total-Count` header
- [ ] Implement `POST` endpoint: email uniqueness check, user insert, audit log write, HTTP 201/409
- [ ] Implement `PATCH` endpoint: self-guard, optional field update, appointment warning, audit log, HTTP 200/400
- [ ] Implement `DELETE` endpoint: `permanent` param guard, self-guard, soft-delete, audit log, HTTP 200/400
- [ ] Create all DTOs with `[Required]`, `[EmailAddress]` data annotations where applicable
- [ ] Register `AdminUserService` in `Program.cs` as scoped
- [ ] Verify `AppDbContext` has `Users` and `AuditLogs` DbSets configured
- [ ] Confirm inactive user HTTP 401 on login returns "Invalid credentials" (not "Account inactive")
