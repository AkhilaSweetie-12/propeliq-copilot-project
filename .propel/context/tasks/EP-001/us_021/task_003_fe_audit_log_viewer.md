---
title: "Task — FE Audit Log Viewer (SCR-021)"
task_id: task_003
story_id: us_021
epic: EP-001
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_003 — FE Audit Log Viewer (SCR-021)

## Requirement Reference

- **User Story**: us_021
- **Story Location**: .propel/context/tasks/EP-001/us_021/us_021.md
- **Acceptance Criteria**:
  - AC-3: Page loads → `GET /api/admin/audit-logs?page=1&pageSize=50` → read-only table with columns: Timestamp, Actor, Action, Resource (entity_type badge), Details (change_summary), IP Address; **no edit or delete controls** anywhere on screen
  - AC-4: Admin applies filters (date range, actor, action_type, entity_type) → `GET /api/admin/audit-logs?from=X&to=Y&actor=Z&action=A&entity=E` → filtered paginated results via `X-Total-Count`; SPA updates rows without full-page reload
- **Edge Cases**:
  - No entries match filter → empty-state illustration + contextual message; no 404 state shown (API returns 200 + `[]`)

---

## Design References (Frontend Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-021-audit-log.html |
| **Screen Spec** | .propel/context/docs/figma_spec.md#SCR-021 |
| **UXR Requirements** | UXR-501 (visual feedback ≤200 ms on filter apply; spinner if fetch >500 ms), UXR-502 (skeleton loading state on SCR-021 initial fetch), UXR-604 (empty-state illustration + CTA when no log entries) |
| **Design Tokens** | designsystem.md#colors, designsystem.md#typography, designsystem.md#spacing |

### CRITICAL: Wireframe Implementation Requirement

**Wireframe Status = AVAILABLE** — MUST open `.propel/context/wireframes/Hi-Fi/wireframe-SCR-021-audit-log.html` and match layout, spacing, typography, and colors. Implement all states: Default, Loading (skeleton), Empty. Validate at 375 px, 768 px, 1440 px.

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript | React 18, TypeScript 5 |
| Frontend | TailwindCSS | 3.x |
| Backend | ASP.NET Core Web API | .NET 9 |
| Database | PostgreSQL | 16 |
| Library | React Router | v6 |

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

Implement SCR-021 — Audit Log Viewer screen. This is a strictly read-only screen accessible to Admin users only. The screen renders a filterable, paginated table of audit log entries ordered by `occurred_at DESC`. The filter panel supports: date-range pickers (`from` / `to`), actor name input, action-type dropdown, and entity-type dropdown. All filter changes update URL search parameters and trigger a new API fetch without full-page reload. No edit or delete controls exist anywhere on the screen. Skeleton rows render during initial fetch (UXR-502). Empty-state illustration appears when no entries match (UXR-604). Action type displayed as a colour-coded badge.

---

## Dependent Tasks

- task_002 (BE Audit Log Read API) — `GET /api/admin/audit-logs` must be available; can develop in parallel with mocked API responses

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `app/src/pages/admin/AuditLogViewerPage.tsx` | CREATE | SCR-021 page container |
| `app/src/components/admin/AuditLogTable.tsx` | CREATE | Read-only table: Timestamp, Actor, Action badge, Resource badge, Details, IP |
| `app/src/components/admin/AuditLogFilterPanel.tsx` | CREATE | Filter: date range, actor input, action dropdown, entity dropdown |
| `app/src/api/auditLogsApi.ts` | CREATE | Typed API client for `GET /api/admin/audit-logs` with filter params |
| `app/src/router/AppRouter.tsx` | MODIFY | Add `/admin/audit-logs` route with Admin guard |

---

## Implementation Plan

1. **Route** — Register `/admin/audit-logs` in `AppRouter.tsx` with Admin role guard.

2. **API client** — `auditLogsApi.ts`: typed `getAuditLogs({ from, to, actor, action, entity, page, pageSize })` function; reads `X-Total-Count` from response headers; return type: `{ data: AuditLogEntry[]; totalCount: number }`.

3. **Filter panel** — `AuditLogFilterPanel` component:
   - Date range: two `<input type="date">` inputs for `from` / `to`
   - Actor text input (debounced 300 ms)
   - Action-type dropdown: All | PatientCreated | AppointmentUpdated | UserDeactivated | etc.
   - Entity-type dropdown: All | Patient | Appointment | User
   - On any filter change: update URL `useSearchParams`; trigger re-fetch
   - Visual feedback ≤200 ms on filter apply (UXR-501); spinner appears if fetch >500 ms

4. **Table** — `AuditLogTable` columns:
   - **Timestamp**: `occurred_at` formatted as local datetime string (e.g., `Apr 21 2026, 14:32:05`)
   - **Actor**: `actor_role` + `actor_id` (truncated UUID)
   - **Action**: `action_type` rendered as badge (distinct colour per action category; use `color.semantic.*` tokens)
   - **Resource**: `entity_type` rendered as badge (Patient=blue `#2563EB`, Appointment=teal `#0D9488`, User=navy `#1E3A5F`)
   - **Details**: `change_summary` (truncated to 80 chars with expandable detail on click)
   - **IP Address**: `ip_address`
   - **No edit or delete controls** — zero action buttons in table rows or toolbar

5. **Skeleton loading** — 7 skeleton rows on initial fetch; no blank flash >200 ms (UXR-502).

6. **Empty state** — `data.length === 0 && !isLoading` → render empty-state illustration with message "No audit log entries match your filters." with a "Clear filters" CTA (UXR-604).

7. **Pagination** — Page navigation driven by `X-Total-Count` header; prev/next + page number display.

8. **Read-only enforcement** — Confirm no edit/delete routes exist in `auditLogsApi.ts`; no mutation function is exported.

---

## Current Project State

```
app/
  src/
    pages/
      admin/
        AdminUsersListPage.tsx   # from us_020 task_001
        AdminUserDetailPage.tsx  # from us_020 task_002
    components/
      admin/
        UserTable.tsx            # existing
    api/
      adminUsersApi.ts           # existing
    router/
      AppRouter.tsx
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | app/src/pages/admin/AuditLogViewerPage.tsx | SCR-021 page container managing filter state, pagination, data fetch |
| CREATE | app/src/components/admin/AuditLogTable.tsx | Read-only table with action/resource badges; no mutation controls |
| CREATE | app/src/components/admin/AuditLogFilterPanel.tsx | Date range + actor + action_type + entity_type filter panel |
| CREATE | app/src/api/auditLogsApi.ts | Typed read-only API client for audit logs endpoint |
| MODIFY | app/src/router/AppRouter.tsx | Add `/admin/audit-logs` route with Admin role guard |

---

## External References

- React `useSearchParams` for URL-based filter persistence: https://reactrouter.com/en/main/hooks/use-search-params
- TailwindCSS badge component patterns: https://tailwindcss.com/docs/background-color
- Date input formatting (ISO 8601 for API, local display): https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date
- Design tokens — Action badges: create=green `#16A34A`, update=teal `#0D9488`, deactivate=warning `#D97706`, delete=error `#DC2626`
- Resource badges: Patient=info `#2563EB`, Appointment=teal `#0D9488`, User=navy `#1E3A5F`
- Screen states (per figma_spec.md#SCR-021): Default, Loading (skeleton), Empty
- Wireframe: `.propel/context/wireframes/Hi-Fi/wireframe-SCR-021-audit-log.html`
- figma_spec.md components: Table (audit log), Badge (action type), Filter panel

---

## Build Commands

- `cd app && npm run build` — TypeScript compile check
- `cd app && npm run lint` — ESLint validation
- `cd app && npm test -- --testPathPattern=AuditLogViewerPage` — Run page tests

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (with mocked API responses)
- [ ] **[UI Tasks]** Visual comparison against wireframe at 375 px, 768 px, 1440 px
- [ ] **[UI Tasks]** Run `/analyze-ux` to validate wireframe alignment
- [ ] Table renders all 6 columns with correct data
- [ ] Zero edit or delete controls present anywhere on the screen (DOM audit)
- [ ] Filter changes update URL params and re-fetch without full-page reload
- [ ] Action and resource badges render with correct colours
- [ ] Skeleton loading renders on initial fetch; no blank flash >200 ms (UXR-502)
- [ ] Empty state with "Clear filters" CTA appears when no results (UXR-604)
- [ ] Pagination reflects `X-Total-Count`; 50 default page size
- [ ] Non-Admin role → redirected; no audit log data accessible

---

## Implementation Checklist

- [ ] Create `AuditLogViewerPage.tsx` with `useSearchParams`-driven filter state + fetch
- [ ] Create typed `getAuditLogs()` in `auditLogsApi.ts`; read `X-Total-Count` from response headers
- [ ] Build `AuditLogFilterPanel` component: date inputs, debounced actor text, action dropdown, entity dropdown
- [ ] Build `AuditLogTable` component: 6 columns (Timestamp, Actor, Action badge, Resource badge, Details, IP)
- [ ] Implement action badge colour mapping (create/update/deactivate/delete categories)
- [ ] Implement entity_type badge colours (Patient=blue, Appointment=teal, User=navy)
- [ ] Truncate `change_summary` to 80 chars with expandable "Show more" inline
- [ ] Implement skeleton loading rows (UXR-502)
- [ ] Implement empty-state with "Clear filters" CTA (UXR-604)
- [ ] Add pagination controls driven by `X-Total-Count`
- [ ] Register `/admin/audit-logs` route with Admin role guard in `AppRouter.tsx`
- [ ] Confirm no mutation functions exported from `auditLogsApi.ts`
- [ ] **[UI Tasks - MANDATORY]** Reference wireframe `wireframe-SCR-021-audit-log.html` during implementation
- [ ] **[UI Tasks - MANDATORY]** Validate UI matches wireframe before marking task complete
