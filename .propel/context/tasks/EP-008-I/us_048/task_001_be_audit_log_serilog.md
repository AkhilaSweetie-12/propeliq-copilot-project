---
title: "Task — BE Immutable Audit Log, AuditLogger Service, Serilog/Seq Pipeline, PHI Scrubber & Annual Partition Strategy"
task_id: task_001
story_id: us_048
epic: EP-008-I
layer: Backend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — BE Immutable Audit Log, AuditLogger Service, Serilog/Seq Pipeline, PHI Scrubber & Annual Partition Strategy

## Requirement Reference

- **User Story**: us_048
- **Story Location**: .propel/context/tasks/EP-008-I/us_048/us_048.md
- **Acceptance Criteria**:
  - AC-1: `UseSerilog()` registered in `Program.cs`; 3 sinks: (a) Seq durable (`WriteTo.Seq("http://seq:5341", bufferBaseFilename: "/logs/serilog-seq-buffer")`), (b) Console structured JSON, (c) File rolling daily `/logs/app-{Date}.log` (7-day retention); `AuditLogger` service calls `Log.Write()` synchronously at `LogEventLevel.Warning`; application diagnostics written asynchronously via default Serilog internal queue; min levels: `Information` (application), `Warning` (audit) (TR-015, NFR-017)
  - AC-2: `AuditLogger.Write()` (single-event) + `AuditLogger.WriteBatch(List<AuditEvent>)` (batch multi-row INSERT) write synchronous `audit_logs` rows with: `log_id` (UUID v4), `actor_id` (JWT `sub` or `AnonymousUser` UUID for unauthenticated), `actor_role` (Patient|Staff|Admin|System), `action_type` (one of 30+ enum values — see full list in AC-2 below), `entity_type`, `entity_id`, `change_summary` (≤500 chars, NO PHI), `ip_address` (X-Forwarded-For respected), `occurred_at` (UTC `DateTimeOffset.UtcNow`) (NFR-017, DR-010, FR-035)
  - AC-3: EF Core migration applies: (a) PostgreSQL `BEFORE UPDATE` trigger on `audit_logs` → `RAISE EXCEPTION 'Audit logs are immutable — UPDATE is prohibited'`; (b) PostgreSQL `BEFORE DELETE` trigger → `RAISE EXCEPTION 'Audit logs are immutable — DELETE is prohibited'`; (c) `audit_log_writer` DB role: only `INSERT` + `SELECT` on `audit_logs` — no `UPDATE`/`DELETE`; `app_writer` role for all other tables; app connection string uses `audit_log_writer` role for audit operations (DR-010, NFR-017, NFR-005)
  - AC-4: `change_summary` PHI scrubber (Serilog enricher): checks `change_summary` before write; replaces matches with `[REDACTED]` for: (a) `[A-Z][a-z]+ [A-Z][a-z]+` (name pattern), (b) `[^@]+@[^@]+` (email pattern), (c) known medication name prefixes (~50 generics from config file); unit tests with 200+ sample values including UUIDs, timestamps, entity IDs — confirm 0 false positives on structural identifiers (NFR-005, NFR-017, AIR-S03)
  - AC-5: `audit_logs` table `PARTITION BY RANGE (occurred_at)` by calendar year; current-year partition write-active; partitions > 6 years eligible for archival (export only, not deletion — HIPAA 45 CFR § 164.530(j)); automated check on 1st day of each year creates new-year partition + identifies partitions ≥ 72 months old eligible for archival; Phase 1: only initial year partition created; no partition ever dropped (NFR-017, DR-012)

- **Edge Cases**:
  - Edge Case: `AuditLogger` sync INSERT fails (DB connectivity loss) → catch exception; retry once immediately (no delay); if retry also fails → write to `/logs/audit-overflow-{Date}.log` as structured JSON; primary operation NOT rolled back; overflow entries manually replayed post-recovery; all overflow events flagged in ops runbook
  - Edge Case: Seq unavailable → `audit_logs` DB writes unaffected (direct PostgreSQL); Seq durable buffer (`/logs/serilog-seq-buffer`) replays when Seq recovers; console + file sinks continue receiving all events; no app functionality impacted
  - Edge Case: EF Core `BEFORE UPDATE` trigger conflict → `AuditLogger` only ever calls `dbContext.AuditLogs.Add()` + `SaveChanges()` — never `Update()` or UPSERT; all audit log reads use `AsNoTracking()` to prevent change tracking; integration test asserts `dbContext.AuditLogs.Update()` → exception (trigger fires); `Add()` succeeds
  - Edge Case: High-throughput batch (50 documents) → `WriteBatch(List<AuditEvent>)` performs single multi-row `INSERT ... SELECT` within batch operation's transaction; reduces 50 round trips to 1; sync guarantee maintained (transaction commits only after all events written); single-operation paths use single-row INSERT

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No |
| **Figma URL** | N/A |
| **Wireframe Status** | N/A |
| **Wireframe Type** | N/A |
| **Wireframe Path/URL** | N/A |
| **Screen Spec** | N/A — Audit log viewer (SCR-021) out of EP-008-I scope |
| **UXR Requirements** | N/A |
| **Design Tokens** | N/A |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | ASP.NET Core | .NET 9 |
| Logging | Serilog + Serilog.Sinks.Seq | latest |
| Log Sink | Seq community server | Devcontainer port 5341 |
| Database | PostgreSQL 16 | via EF Core 9 |
| ORM | EF Core with Npgsql | 9.x |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |
| **AI Pattern** | N/A |
| **Prompt Template Path** | N/A |
| **Guardrails Config** | N/A |
| **Model Provider** | N/A |

---

## Mobile References

| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |
| **Platform Target** | N/A |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Set up the Serilog + Seq structured logging pipeline (Seq durable, Console JSON, File rolling daily) in `Program.cs`, then implement the `AuditLogger` service as the single point of synchronous `audit_logs` INSERT for all PHI-touching operations. Define the `AuditActionType` enum (30+ values), the `AuditEvent` record/DTO, and a `PhiScrubber` component that strips name/email/medication patterns from `change_summary` before write. Apply PostgreSQL `BEFORE UPDATE` and `BEFORE DELETE` immutability triggers and the `audit_log_writer` role GRANT via EF Core migration. Implement the `PARTITION BY RANGE(occurred_at)` annual partitioning strategy with an automated annual partition creation job. Add DB-failure overflow fallback to file sink and batch INSERT support for high-throughput operations.

---

## Dependent Tasks

- US_001 (Foundational EP-TECH) — ASP.NET Core 9 DI container for `AuditLogger` registration and `UseSerilog()` in `Program.cs`
- US_007 (Foundational EP-DATA-I) — `audit_logs` entity (DR-010) migrated with all required columns before triggers and role grants
- us_046 task_001 — `RedisPhiViolation` action type in `AuditActionType` enum; `RedisPhiGuard` calls `AuditLogger.Write(RedisPhiViolation)`
- us_047 task_001 — `DecryptionFailure` action type in `AuditActionType` enum; `PhiEncryptionService` calls `AuditLogger.Write(DecryptionFailure)`

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Program.cs` | MODIFY | `UseSerilog()` with 3 sinks; devcontainer Seq endpoint; min levels |
| `Server/Infrastructure/Audit/AuditLogger.cs` | CREATE | `Write(AuditEvent)` (single, sync); `WriteBatch(List<AuditEvent>)` (multi-row INSERT); DB-failure retry + overflow file sink |
| `Server/Infrastructure/Audit/AuditEvent.cs` | CREATE | Record/DTO: all `audit_logs` fields |
| `Server/Infrastructure/Audit/AuditActionType.cs` | CREATE | Enum with 30+ action type constants |
| `Server/Infrastructure/Audit/PhiScrubber.cs` | CREATE | Regex scrubber: name, email, medication prefixes; returns sanitised `change_summary` |
| `Server/Data/AppDbContext.cs` | MODIFY | `DbSet<AuditLog>` with `AsNoTracking()` default; batch INSERT helper |
| `Server/Data/Entities/AuditLog.cs` | VERIFY/CREATE | All DR-010 fields; matches `audit_logs` table schema |
| `Server/Data/Migrations/...AuditLogImmutabilityTriggers.cs` | CREATE | `BEFORE UPDATE` + `BEFORE DELETE` triggers; `audit_log_writer` GRANT; partition DDL |
| `Server/Infrastructure/Jobs/AnnualPartitionJob.cs` | CREATE | Hangfire job; runs 1 Jan each year; creates new-year partition + reports 6-year-old partitions eligible for archival |
| `Server/Tests/Unit/Audit/PhiScrubberTests.cs` | CREATE | 200+ sample values; 0 false positives on structural identifiers |
| `Server/Tests/Integration/AuditLogImmutabilityTests.cs` | CREATE | Trigger assertions: UPDATE → exception; DELETE → exception; Add() → success |

---

## Audit Action Type Enum (AC-2 — Full List)

```
PatientRegistered, PatientLogin, PatientLogout,
IntakeSubmitted, IntakeRead,
AppointmentCreated, AppointmentRead, AppointmentCancelled,
DocumentUploaded, DocumentRead,
ExtractionCompleted, ExtractionFailed,
PatientView360Accessed,
ConflictAcknowledged, ViewVerified,
CodingRequested, CodeReviewed, CodingFinalised,
CodeSuggestionGenerated,
DeduplicationApplied, ConflictDetected, ViewResetUnverified,
LowConfidenceRetrieval, EmbeddingFailed,
CodingJobFailed, CodingBudgetExceeded,
DecryptionFailure, RedisPhiViolation,
AdminUserCreated, AdminUserDeactivated, AdminRoleChanged
```

---

## Implementation Plan

1. Add Serilog NuGet packages: `Serilog.AspNetCore`, `Serilog.Sinks.Seq`, `Serilog.Sinks.Console`, `Serilog.Sinks.File`; configure in `Program.cs` via `Log.Logger = new LoggerConfiguration()` before `builder.Build()`; set `MinimumLevel.Information()` with `MinimumLevel.Override("Audit", LogEventLevel.Warning)`; add durable Seq sink with `bufferBaseFilename: "/logs/serilog-seq-buffer"`; register `UseSerilog()` on `IHostBuilder`

2. Create `AuditActionType` enum in `Server/Infrastructure/Audit/AuditActionType.cs` with all 30+ values from AC-2 full list

3. Create `AuditEvent` record: `LogId (Guid)`, `ActorId (Guid)`, `ActorRole (string)`, `ActionType (AuditActionType)`, `EntityType (string)`, `EntityId (Guid)`, `ChangeSummary (string)`, `IpAddress (string)`, `OccurredAt (DateTimeOffset)`

4. Create `PhiScrubber` class: load medication name prefix list from config (`appsettings.json` key `PhiScrubber:MedicationPrefixes`); compile 3 regexes (name: `[A-Z][a-z]+ [A-Z][a-z]+`; email: `[^@]+@[^@]+`; medications: prefix alternation); expose `Scrub(string input): string` that replaces matches with `[REDACTED]`; register as singleton in DI

5. Create `AuditLogger` service:
   - Constructor: inject `AppDbContext` (or a dedicated `AuditDbContext` using `audit_log_writer` role), `PhiScrubber`, `ILogger<AuditLogger>`
   - `Write(AuditEvent evt)`: (a) scrub `change_summary` via `PhiScrubber.Scrub()`; (b) write Serilog `Log.Write(LogEventLevel.Warning, ...)` synchronously; (c) INSERT to `audit_logs` via `dbContext.AuditLogs.Add(entity); dbContext.SaveChanges()`; (d) on `DbException`: retry once; on second failure: write to `/logs/audit-overflow-{Date}.log` via file sink; primary operation NOT rolled back
   - `WriteBatch(List<AuditEvent> events)`: scrub all; build parameterised multi-row INSERT SQL; execute within ambient transaction using `dbContext.Database.ExecuteSqlRaw()`

6. Apply all audit log INSERT/SELECT calls to use `audit_log_writer` connection; document connection string separation in `appsettings.json` (`ConnectionStrings:AuditLog` vs `ConnectionStrings:DefaultConnection`)

7. Create EF Core migration `AddAuditLogImmutabilityTriggers`:
   - `BEFORE UPDATE` plpgsql trigger: `RAISE EXCEPTION 'Audit logs are immutable — UPDATE is prohibited'`
   - `BEFORE DELETE` plpgsql trigger: `RAISE EXCEPTION 'Audit logs are immutable — DELETE is prohibited'`
   - `REVOKE UPDATE, DELETE ON audit_logs FROM app_writer`
   - `GRANT INSERT, SELECT ON audit_logs TO audit_log_writer`
   - `ALTER TABLE audit_logs PARTITION BY RANGE (occurred_at)` — with initial `CREATE TABLE audit_logs_YYYY PARTITION OF audit_logs FOR VALUES FROM ('YYYY-01-01') TO ('YYYY+1-01-01')` for current year

8. Create `AnnualPartitionJob` — Hangfire recurring job (`[RecurringJob]` CRON `0 0 1 1 *` — midnight 1 Jan): create new-year partition (`CREATE TABLE IF NOT EXISTS audit_logs_YYYY PARTITION OF audit_logs FOR VALUES ...`); log which partitions are ≥ 72 months old (eligible for archival); never drops any partition

9. Write `PhiScrubberTests.cs`: 200+ samples covering: (a) known PHI values (patient names, emails, medication names) → `[REDACTED]` present; (b) UUIDs, ISO timestamps, entity ID strings, appointment IDs, integers → 0 false positives (no `[REDACTED]` in output)

10. Write `AuditLogImmutabilityTests.cs`: (a) call `dbContext.AuditLogs.Update(existingLog); dbContext.SaveChanges()` → assert `DbUpdateException` / Npgsql exception; (b) call `dbContext.AuditLogs.Remove(existingLog); dbContext.SaveChanges()` → assert exception; (c) `AuditLogger.Write(new AuditEvent(...))` with valid event → success; row found in `audit_logs` with correct values

---

## Current Project State

```
Server/
├── Program.cs                           ← MODIFY (UseSerilog)
├── Data/
│   ├── AppDbContext.cs                  ← MODIFY (AuditLog DbSet; AsNoTracking)
│   ├── Entities/AuditLog.cs             ← VERIFY/CREATE (DR-010 fields)
│   └── Migrations/                      ← ADD AuditLogImmutabilityTriggers migration
├── Infrastructure/
│   ├── Audit/                           ← CREATE AuditLogger, AuditEvent, AuditActionType, PhiScrubber
│   └── Jobs/AnnualPartitionJob.cs       ← CREATE
└── Tests/
    ├── Unit/Audit/PhiScrubberTests.cs   ← CREATE
    └── Integration/AuditLogImmutabilityTests.cs ← CREATE
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `Server/Program.cs` | `UseSerilog()` with Seq durable, Console JSON, File rolling daily; min levels |
| CREATE | `Server/Infrastructure/Audit/AuditActionType.cs` | Enum — 30+ action type constants |
| CREATE | `Server/Infrastructure/Audit/AuditEvent.cs` | Record/DTO — all `audit_logs` fields |
| CREATE | `Server/Infrastructure/Audit/AuditLogger.cs` | Single + batch sync INSERT; DB retry; overflow file sink |
| CREATE | `Server/Infrastructure/Audit/PhiScrubber.cs` | 3 regex patterns; medication config list; `Scrub(string)` |
| CREATE | `Server/Infrastructure/Jobs/AnnualPartitionJob.cs` | Hangfire CRON 1 Jan; new-year partition creation + archival flag |
| MODIFY | `Server/Data/AppDbContext.cs` | `DbSet<AuditLog>`; `AsNoTracking()` for audit reads |
| CREATE | `Server/Data/Migrations/..._AuditLogImmutabilityTriggers.cs` | BEFORE UPDATE/DELETE triggers; role GRANTs; initial partition |
| CREATE | `Server/Tests/Unit/Audit/PhiScrubberTests.cs` | 200+ sample value assertions; 0 false positives |
| CREATE | `Server/Tests/Integration/AuditLogImmutabilityTests.cs` | Trigger assertions; Add() success; Update()/Delete() exceptions |
| MODIFY | `Server/appsettings.json` | `ConnectionStrings:AuditLog`; `PhiScrubber:MedicationPrefixes` config section |

---

## External References

- [HIPAA Security Rule — Audit Controls Standard (45 CFR § 164.312(b))](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [HIPAA Documentation Retention (45 CFR § 164.530(j)) — 6-year minimum](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/index.html)
- [Serilog ASP.NET Core integration documentation](https://github.com/serilog/serilog-aspnetcore)
- [Serilog Sinks Seq — durable buffer configuration](https://github.com/serilog/serilog-sinks-seq)
- [PostgreSQL Table Partitioning by Range](https://www.postgresql.org/docs/16/ddl-partitioning.html)

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`
- `cd Server && dotnet ef migrations add AuditLogImmutabilityTriggers`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] Application starts with `UseSerilog()`; logs appear in Seq at `http://seq:5341` in devcontainer
- [ ] Console sink outputs structured JSON log lines on startup
- [ ] File sink creates `/logs/app-{Date}.log`; old files purged after 7 days
- [ ] `AuditLogger.Write()`: single INSERT to `audit_logs` row; `log_id` is UUID v4; `occurred_at` is UTC
- [ ] `AuditLogger.WriteBatch(50 events)`: single multi-row INSERT SQL executed; all 50 rows in `audit_logs`
- [ ] `AuditLogger.Write()` when DB unavailable → retry once; on second fail → overflow file created at `/logs/audit-overflow-{Date}.log`; primary operation continues without exception
- [ ] `dbContext.AuditLogs.Update(log); dbContext.SaveChanges()` → `DbException` with "immutable" message
- [ ] `dbContext.AuditLogs.Remove(log); dbContext.SaveChanges()` → `DbException` with "immutable" message
- [ ] `PhiScrubber.Scrub("John Smith visited clinic")` → contains `[REDACTED]`
- [ ] `PhiScrubber.Scrub("appointment_id=550e8400-e29b-41d4-a716-446655440000")` → no `[REDACTED]` (UUID not redacted)
- [ ] `PhiScrubber.Scrub("actor_id=a1b2c3d4")` → no `[REDACTED]` (hex ID not redacted)
- [ ] `AuditActionType` enum contains all 30+ action type constants including `RedisPhiViolation` and `DecryptionFailure`
- [ ] `audit_log_writer` role: `INSERT` + `SELECT` only on `audit_logs`; no `UPDATE`/`DELETE` in migration grants
- [ ] Annual partition: `audit_logs_{current_year}` partition exists after migration; Hangfire job schedules for 1 Jan next year
- [ ] No partition dropped in any migration or job code

---

## Implementation Checklist

- [ ] Add Serilog NuGet packages (`Serilog.AspNetCore`, `Serilog.Sinks.Seq`, `Serilog.Sinks.Console`, `Serilog.Sinks.File`)
- [ ] Configure `Log.Logger` in `Program.cs` with 3 sinks (Seq durable, Console JSON, File rolling); set min levels; call `UseSerilog()`
- [ ] Create `AuditActionType.cs` enum with all 30+ action types from AC-2
- [ ] Create `AuditEvent.cs` record with all `audit_logs` column fields
- [ ] Create `PhiScrubber.cs`: load medication prefix list from config; compile 3 compiled regexes; `Scrub(string): string`
- [ ] Register `PhiScrubber` as singleton in DI via `builder.Services.AddSingleton<PhiScrubber>()`
- [ ] Create `AuditLogger.cs`: inject `AppDbContext` (audit connection), `PhiScrubber`, `ILogger<AuditLogger>`; implement `Write()` (single, sync) + `WriteBatch()` (multi-row INSERT SQL); DB-failure: retry once → overflow file sink
- [ ] Register `AuditLogger` as singleton in DI
- [ ] Modify `AppDbContext.cs`: add `DbSet<AuditLog> AuditLogs`; configure `AsNoTracking()` default for `AuditLog` reads
- [ ] Add `ConnectionStrings:AuditLog` to `appsettings.json` using `audit_log_writer` PostgreSQL role credentials
- [ ] Add `PhiScrubber:MedicationPrefixes` config section to `appsettings.json` with ~50 generic drug name prefixes
- [ ] Create `AddAuditLogImmutabilityTriggers` migration: `BEFORE UPDATE` trigger, `BEFORE DELETE` trigger, role GRANTs, initial annual partition
- [ ] Create `AnnualPartitionJob.cs` Hangfire job: CRON `0 0 1 1 *`; `CREATE TABLE IF NOT EXISTS audit_logs_{year} PARTITION OF audit_logs FOR VALUES ...`; identify partitions ≥ 72 months for archival flag
- [ ] Write `PhiScrubberTests.cs`: 200+ sample value PHI scrub + 0 false-positive assertions on UUIDs, IDs, timestamps
- [ ] Write `AuditLogImmutabilityTests.cs`: trigger fire assertions for UPDATE + DELETE; `Add()` success assertion
