---
title: "Task — BE TLS 1.2+ Kestrel Enforcement, HTTPS Redirect, HSTS & RedisPhiGuard with Audit Violation Logging"
task_id: task_001
story_id: us_046
epic: EP-008-I
layer: Backend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — BE TLS 1.2+ Kestrel Enforcement, HTTPS Redirect, HSTS & RedisPhiGuard with Audit Violation Logging

## Requirement Reference

- **User Story**: us_046
- **Story Location**: .propel/context/tasks/EP-008-I/us_046/us_046.md
- **Acceptance Criteria**:
  - AC-1: `UseHttpsRedirection()` in `Program.cs` middleware pipeline redirects HTTP → HTTPS with HTTP 301; `UseHsts()` adds `Strict-Transport-Security: max-age=31536000; includeSubDomains` to all HTTPS responses; HSTS only applied in non-Development environments (`if (!env.IsDevelopment())`); all environments still redirect HTTP; no request body parsed before redirect (NFR-006, FR-036)
  - AC-2: Kestrel `ConfigureKestrel` block sets `SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13`; TLS 1.0/1.1 connections closed at transport layer with no HTTP response body; cipher allowlist excludes `NULL`, `RC4`, `DES`, `3DES`, `EXPORT` suites per NIST SP 800-52r2; integration test asserts TLS 1.0/1.1 connections are refused (NFR-006, FR-036)
  - AC-3: `RedisPhiGuard` service wrapper intercepts all Redis write operations; if value exceeds 128 bytes OR can be deserialized as a JSON object containing keys `email`, `demographics`, `medications`, or other PHI keys → reject write; INSERT `audit_logs (action=RedisPhiViolation, actor_id, attempted_key)`; log at Error level to Serilog; non-PHI writes pass through transparently (FR-038, NFR-005, NFR-010)
  - AC-4: Redis stores only opaque token UUID (key) + `{ expires_at, role, revoked }` (value, ≤ 128 bytes); JWT payload contains only `sub` (UUID), `role`, `iat`, `exp` — no PHI claims (patient name, email, demographics); HMAC-SHA-256 of email used for lookup, not plaintext email in token (TR-006, NFR-009, FR-038)
  - AC-5: Integration tests assert: (a) `GET http://{host}/health` → HTTP 301; (b) `GET https://{host}/health` → HTTP 200 + `Strict-Transport-Security` header; (c) TLS 1.0 connection attempt → socket closed; (d) Redis GET after full booking + intake workflow returns no PHI-pattern values; all pass in CI + Codespaces (NFR-005, NFR-006)

- **Edge Cases**:
  - Edge Case: HTTPS redirect loop in dev with untrusted dev cert → `dotnet dev-certs https --trust`; integration tests use `HttpClientHandler.ServerCertificateCustomValidationCallback` (test only); CI linter flags any production usage of cert bypass callbacks
  - Edge Case: `RedisPhiGuard` false positive on valid UUID string → structural guard: UUID regex `[0-9a-f-]{36}` never flagged; only JSON objects with PHI keys flagged; unit tests confirm false positive rate = 0 for valid token ops
  - Edge Case: Redis unavailable → auth middleware fails-open (accept non-revoked tokens up to 15-minute TTL); NFR-014 graceful degradation; no PHI at risk since PHI never in Redis

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
| TLS | Kestrel (built-in) | .NET 9 |
| Cache | Upstash Redis (StackExchange.Redis) | TR-005 |
| Auth | JWT Bearer (HS256 / RS256) | .NET 9 |
| Logging | Serilog | latest |
| Database | PostgreSQL 16 | via EF Core 9 |

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

Configure Kestrel for TLS 1.2/1.3-only (rejecting TLS 1.0/1.1 at transport layer), register HTTPS redirect + env-conditional HSTS middleware, and implement `RedisPhiGuard` as a wrapper around all Redis write operations. The guard inspects value content (size + JSON PHI key detection) before any Redis SET/HSET call; violations are rejected and written to `audit_logs` + Serilog Error. JWT token metadata stored in Redis is validated to contain only `{ expires_at, role, revoked }` with opaque UUID keys (no PHI). Integration tests validate all TLS downgrade and Redis PHI scanning assertions.

---

## Dependent Tasks

- US_001 (Foundational EP-TECH) — ASP.NET Core 9 Kestrel scaffold
- US_005 (Foundational EP-TECH) — JWT + Upstash Redis session infrastructure; `IConnectionMultiplexer` registered in DI
- us_048 task_001 — `AuditLogger.Write(action=RedisPhiViolation)` call requires `AuditLogger` to be available; can stub during development

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Server/Program.cs` | MODIFY | Add `UseHttpsRedirection()`; env-conditional `UseHsts()`; `ConfigureKestrel` with TLS 1.2/1.3 + cipher allowlist |
| `Server/Infrastructure/Redis/RedisPhiGuard.cs` | CREATE | Wrapper around `IDatabase`; pre-write content inspection; PHI rejection + audit log |
| `Server/Infrastructure/Redis/IRedisService.cs` | CREATE OR MODIFY | Ensure all Redis writes route through `RedisPhiGuard` — no direct `IDatabase.StringSet/HashSet` calls in application code |
| `Server/Tests/Integration/TlsEnforcementTests.cs` | CREATE | AC-5 assertions: HTTP 301, HSTS header, TLS 1.0 rejection |
| `Server/Tests/Integration/RedisPhiScanTests.cs` | CREATE | Full booking + intake workflow; assert no PHI in Redis after execution |

---

## Implementation Plan

1. Modify `Program.cs` middleware pipeline: add `app.UseHttpsRedirection()` before route handling; add `if (!env.IsDevelopment()) app.UseHsts()` with `options.MaxAge(365).IncludeSubDomains()`
2. Configure Kestrel in `Program.cs`: `builder.WebHost.ConfigureKestrel(opts => { opts.ConfigureHttpsDefaults(https => { https.SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13; }); })` — also configure cipher suite exclusions via `CipherSuitesPolicy` where the .NET runtime exposes it (Linux/Windows differ; document platform-specific behaviour)
3. Implement `RedisPhiGuard`: wrap `IDatabase`; intercept `StringSetAsync`, `HashSetAsync`, `ExecuteAsync` methods; for each: (a) if value is a string > 128 bytes → attempt JSON parse; if JSON object contains keys from `_phiKeySet = { "email", "demographics", "medications", "allergies", "field_value", "aggregated_data", "clinical_data" }` → reject + `AuditLogger.Write(RedisPhiViolation, attempted_key)` + Serilog Error; (b) if value is a string ≤ 128 bytes matching UUID regex → pass through; (c) if value is `{ expires_at, role, revoked }` only → pass through
4. Replace all direct `IDatabase` injections in authentication/session services with `IRedisService` backed by `RedisPhiGuard`
5. Validate JWT payload construction: assert `sub` (UUID only), `role`, `iat`, `exp` — no other claims added; document that name/email MUST NOT be added to JWT claims in future
6. Write `TlsEnforcementTests.cs`: use `HttpClient` without TLS bypass for AC-5(a) and (b); use `TcpClient` + `SslStream` with explicit `TlsVersion.Tls10` to assert `AuthenticationException` for AC-5(c)
7. Write `RedisPhiScanTests.cs`: run full booking + intake API sequence against test server; then iterate all Redis keys matching `*`; assert no value matches PHI pattern set

---

## Current Project State

```
Server/
├── Program.cs                    ← MODIFY (TLS + middleware)
├── Infrastructure/
│   ├── Auth/                     # JWT + Redis session (US_005)
│   └── Redis/                    # TO ADD — RedisPhiGuard
└── Tests/
    └── Integration/              # TO ADD — TLS + Redis PHI tests
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `Server/Program.cs` | HTTPS redirect; HSTS; Kestrel TLS 1.2/1.3; cipher allowlist |
| CREATE | `Server/Infrastructure/Redis/RedisPhiGuard.cs` | Pre-write PHI inspection; reject + audit on violation |
| CREATE | `Server/Infrastructure/Redis/IRedisService.cs` | Abstraction; routes all writes through RedisPhiGuard |
| CREATE | `Server/Tests/Integration/TlsEnforcementTests.cs` | AC-5(a)(b)(c) TLS assertions |
| CREATE | `Server/Tests/Integration/RedisPhiScanTests.cs` | AC-5(d) — no PHI in Redis after workflow |

---

## External References

- [NIST SP 800-52r2 — TLS Implementation Guidelines](https://csrc.nist.gov/publications/detail/sp/800-52/rev-2/final)
- [ASP.NET Core — Configure HTTPS and TLS](https://learn.microsoft.com/en-us/aspnet/core/security/enforcing-ssl)
- [ASP.NET Core — Kestrel SslProtocols configuration](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/servers/kestrel/endpoints#configure-https-defaults)
- [HIPAA Security Rule — Transmission Security (45 CFR § 164.312(e))](https://www.hhs.gov/hipaa/for-professionals/security/index.html)

---

## Build Commands

- `cd Server && dotnet build`
- `cd Server && dotnet test`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] `GET http://{host}/health` → HTTP 301; HTTPS URL in Location header
- [ ] `GET https://{host}/health` → HTTP 200 + `Strict-Transport-Security: max-age=31536000; includeSubDomains` present
- [ ] TLS 1.0/1.1 connection attempt → `AuthenticationException` / socket closed; no HTTP response
- [ ] `UseHsts()` NOT applied in Development environment; TLS redirect still applies
- [ ] `RedisPhiGuard`: value with `{ email: "test@test.com" }` → write rejected; `RedisPhiViolation` audit log; Serilog Error logged
- [ ] `RedisPhiGuard`: UUID string → passes through; `{ expires_at, role, revoked }` → passes through
- [ ] No PHI pattern found in any Redis key/value after full booking + intake test workflow
- [ ] JWT claims contain only `sub`, `role`, `iat`, `exp` — no name, email, demographics
- [ ] CI linter reports 0 usages of `DangerousAcceptAnyServerCertificateValidator` outside test projects

---

## Implementation Checklist

- [ ] Add `UseHttpsRedirection()` and env-conditional `UseHsts()` in `Program.cs` middleware pipeline in correct order
- [ ] Configure Kestrel `SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13` in `ConfigureKestrel`; document cipher suite config per OS platform
- [ ] Implement `RedisPhiGuard`: define `_phiKeySet`; implement pre-write inspection; reject + audit + Serilog Error on violation; pass-through for valid token structures
- [ ] Route all Redis writes through `IRedisService` backed by `RedisPhiGuard`; remove any direct `IDatabase` usage in application services
- [ ] Validate JWT claim construction — assert no PHI fields present; add comment in JWT builder listing prohibited claim types
- [ ] Write `TlsEnforcementTests.cs` with explicit TLS version negotiation assertions
- [ ] Write `RedisPhiScanTests.cs` with full workflow + Redis key scan
- [ ] Unit tests for `RedisPhiGuard`: PHI sample values rejected; UUID + small token metadata pass; false positive rate = 0 on structural identifiers
