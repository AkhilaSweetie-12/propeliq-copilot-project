---
title: "Task — BE Audit Log Middleware"
task_id: task_001
story_id: us_021
epic: EP-001
layer: Backend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — BE Audit Log Middleware

## Requirement Reference

- **User Story**: us_021
- **Story Location**: .propel/context/tasks/EP-001/us_021/us_021.md
- **Acceptance Criteria**:
  - AC-1: Middleware intercepts requests on controllers tagged `[AuditAction]`; on successful 2xx completion, inserts one row into `audit_logs` with: `actor_id`, `actor_role` (from JWT claims), `action_type`, `entity_type`, `entity_id`, `change_summary` (max 4,000 chars), `ip_address` (`HttpContext.Connection.RemoteIpAddress`), `occurred_at` (PostgreSQL `NOW()`). INSERT is fire-and-forget (no await on write path).
  - AC-2: 4xx or 5xx response → NO audit log entry written; phantom entries prevented.
  - AC-5: `change_summary` exceeding 4,000 characters → truncate at 4,000 with `"...[truncated]"` appended; full payload logged to Serilog at `DEBUG`; row inserted normally.
  - AC-6: No mutation routes (`DELETE`, `PUT`) registered for `audit_logs` table; HTTP 405 for any attempt; `InvalidOperationException` guard at application layer as secondary defence.
- **Edge Cases**:
  - Audit INSERT fails after primary mutation succeeds → catch exception, log to Serilog at `ERROR` with full payload; do NOT roll back primary mutation; schedule Hangfire retry job (up to 3 retries within 5 minutes); alert via Seq if all retries fail.
  - High-volume concurrent mutations → bounded channel (`Channel<AuditEntry>`) for fire-and-forget; if channel full, hold in-memory briefly and flush on next cycle; primary API response never blocked; overflow logged at `WARN`.
  - `ip_address` unresolvable → record `"unknown"`, log `WARN`; do not block mutation or audit write.

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
| Background Jobs | Hangfire | latest compatible with .NET 9 |
| Logging | Serilog + Seq | latest |
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

Implement the ASP.NET Core `AuditMiddleware` and its companion `[AuditAction]` attribute. The middleware inspects the HTTP response status code after the downstream pipeline completes. Only on 2xx responses does it enqueue an `AuditEntry` into a bounded `System.Threading.Channels.Channel<AuditEntry>`. A background hosted service (`AuditChannelProcessor`) drains the channel and inserts entries into `audit_logs` using a dedicated `AuditDbContext` (separate from the main transactional context). Hangfire is used for retry on INSERT failure. The `[AuditAction]` attribute carries `ActionType`, `EntityType`, and a delegate or convention for extracting `EntityId` from the response.

---

## Dependent Tasks

- US_015 (audit_logs append-only EF Core entity + `InvalidOperationException` guard) — `AuditLog` entity and `AuditDbContext` must exist
- US_018 (JWT authentication) — JWT claims (`actor_id`, `actor_role`) must be resolvable from `HttpContext.User`

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Middleware/AuditMiddleware.cs` | CREATE | Intercepts request/response; enqueues to bounded channel |
| `Server/Middleware/AuditActionAttribute.cs` | CREATE | Custom attribute carrying ActionType and EntityType metadata |
| `Server/Services/AuditChannelProcessor.cs` | CREATE | `IHostedService` draining channel and writing to DB |
| `Server/Services/AuditRetryJob.cs` | CREATE | Hangfire job for retry on INSERT failure (max 3, within 5 min) |
| `Server/Program.cs` | MODIFY | Register middleware, hosted service, and Hangfire job |
| `Server/Data/AuditDbContext.cs` | MODIFY or CREATE | Separate EF Core context for audit writes (isolation from primary transaction) |

---

## Implementation Plan

1. **`[AuditAction]` attribute** — Implement `AuditActionAttribute : Attribute` with properties `string ActionType` and `string EntityType`. Optionally accepts `string EntityIdClaim = "id"` for extracting entity ID from the response JSON.

2. **`AuditMiddleware`** — ASP.NET Core middleware class:
   - After `await _next(context)` executes, check `context.Response.StatusCode`.
   - If `statusCode < 200 || statusCode >= 300` → skip, return immediately.
   - Resolve `[AuditAction]` metadata via `context.GetEndpoint()?.Metadata`.
   - Extract `actor_id` from `context.User.FindFirst("sub")?.Value` and `actor_role` from `context.User.FindFirst("role")?.Value`.
   - Resolve `ip_address` from `context.Connection.RemoteIpAddress?.ToString() ?? "unknown"`; log `WARN` if null.
   - Extract `entity_id` from response body (read via `PipeReader`) or route values.
   - Truncate `change_summary` at 4,000 chars: if > 4,000, append `"...[truncated]"` to the 3,986th character; log full payload to Serilog `DEBUG`.
   - Write `AuditEntry` to the bounded `Channel<AuditEntry>` (non-blocking `TryWrite`); if channel full, log `WARN` "AuditChannel overflow — entry buffered in retry queue" and enqueue Hangfire retry.

3. **Bounded channel** — `Channel.CreateBounded<AuditEntry>(new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropWrite })`. Register as singleton in DI.

4. **`AuditChannelProcessor` (IHostedService)** — Background service reading from channel using `await reader.ReadAsync()` in a loop. For each entry, call `auditDbContext.AuditLogs.Add(entry)` then `await auditDbContext.SaveChangesAsync()`. On exception: log Serilog `ERROR` with full entry; schedule `BackgroundJob.Schedule<AuditRetryJob>(j => j.Execute(entry), TimeSpan.FromMinutes(1))`.

5. **`AuditRetryJob` (Hangfire)** — Retries the INSERT up to 3 times (Hangfire `[AutomaticRetry(Attempts = 3, DelaysInSeconds = new[] { 60, 120, 300 })]`). If all 3 fail, log Serilog `FATAL` and publish alert to Seq dashboard.

6. **Middleware registration** — `app.UseMiddleware<AuditMiddleware>()` in `Program.cs`, placed after `UseAuthentication()` and `UseAuthorization()` so JWT claims are populated.

7. **HTTP 405 guard for audit mutations** — No `DELETE` or `PUT` route for `audit_logs` is registered. At the service layer, override EF Core's `Remove` and `Update` methods in `AuditDbContext` to throw `InvalidOperationException("Audit log is immutable")` as secondary defence.

---

## Current Project State

```
Server/
  Middleware/         # (to be created)
  Services/           # (to be created or may exist)
  Data/
    AppDbContext.cs
  Program.cs
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/Middleware/AuditMiddleware.cs | Middleware: response-status gate, JWT claim extraction, IP resolution, change_summary truncation, channel enqueue |
| CREATE | Server/Middleware/AuditActionAttribute.cs | Custom attribute: ActionType, EntityType, EntityIdClaim |
| CREATE | Server/Services/AuditChannelProcessor.cs | IHostedService reading bounded channel and writing to audit_logs via AuditDbContext |
| CREATE | Server/Services/AuditRetryJob.cs | Hangfire job for 3-attempt retry with escalating delays; FATAL alert on all retries exhausted |
| MODIFY | Server/Program.cs | Register AuditMiddleware, AuditChannelProcessor, Hangfire; configure bounded channel singleton |
| MODIFY or CREATE | Server/Data/AuditDbContext.cs | Isolated EF Core context for audit writes; override Remove/Update to throw InvalidOperationException |

---

## External References

- ASP.NET Core custom middleware: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/middleware/write
- `System.Threading.Channels` bounded channel: https://learn.microsoft.com/en-us/dotnet/core/extensions/channels
- `IHostedService` background processing: https://learn.microsoft.com/en-us/aspnet/core/fundamentals/host/hosted-services
- Hangfire `[AutomaticRetry]` attribute: https://docs.hangfire.io/en/latest/background-processing/dealing-with-exceptions.html
- ASP.NET Core endpoint metadata (`GetEndpoint().Metadata`): https://learn.microsoft.com/en-us/aspnet/core/fundamentals/routing#endpoint-metadata
- Serilog structured logging levels: https://serilog.net/
- EF Core DbContext isolation (separate context per concern): https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/

---

## Build Commands

- `cd Server && dotnet build` — C# compile check
- `cd Server && dotnet test` — Run unit/integration tests
- `cd Server && dotnet run` — Start server to validate middleware pipeline

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] On 2xx response with `[AuditAction]` endpoint: one `audit_logs` row inserted with all required fields
- [ ] On 4xx/5xx response: NO `audit_logs` row inserted
- [ ] `change_summary` > 4,000 chars: truncated at 4,000 + `"...[truncated]"`; full payload in Serilog DEBUG
- [ ] IP address null → stored as `"unknown"`; WARN log written
- [ ] Channel full → WARN log; no primary API response blocking
- [ ] Audit INSERT failure → Serilog ERROR; Hangfire retry job scheduled; primary transaction NOT rolled back
- [ ] `AuditDbContext.Remove()` / `AuditDbContext.Update()` throw `InvalidOperationException`
- [ ] No `DELETE` or `PUT` route registered under `api/admin/audit-logs`

---

## Implementation Checklist

- [ ] Create `AuditActionAttribute.cs` with `ActionType`, `EntityType`, `EntityIdClaim` properties
- [ ] Create `AuditMiddleware.cs`: response-status gate (2xx only), JWT claim extraction, IP resolution, `change_summary` truncation at 4,000 chars
- [ ] Implement bounded `Channel<AuditEntry>` (capacity 1,000; `DropWrite` on full) as singleton
- [ ] Create `AuditChannelProcessor` IHostedService with channel drain loop and `AuditDbContext` write
- [ ] Handle INSERT failure in `AuditChannelProcessor`: Serilog ERROR + schedule `AuditRetryJob`
- [ ] Create `AuditRetryJob` with `[AutomaticRetry(Attempts = 3)]`; FATAL log + Seq alert on exhaustion
- [ ] Override `Remove` and `Update` in `AuditDbContext` to throw `InvalidOperationException`
- [ ] Register middleware after `UseAuthentication()` / `UseAuthorization()` in `Program.cs`
- [ ] Register `AuditChannelProcessor` as hosted service and `AuditRetryJob` in Hangfire
