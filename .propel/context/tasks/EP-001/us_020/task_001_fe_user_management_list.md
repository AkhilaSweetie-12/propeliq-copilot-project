---
title: "Task — FE User Management List (SCR-019)"
task_id: task_001
story_id: us_020
epic: EP-001
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE User Management List (SCR-019)

## Requirement Reference

- **User Story**: us_020
- **Story Location**: .propel/context/tasks/EP-001/us_020/us_020.md
- **Acceptance Criteria**:
  - AC-1: Admin searches by name, email, or role filter → API `GET /api/admin/users?query=X&role=Staff` → SPA renders paginated table with `[user_id, name, email, role, status, last_active]` rows; "Edit" link per row; "+ Create user" button; empty-state when no results
- **Edge Cases**:
  - SQL injection characters in search → parameterised LINQ on backend; no risk from FE; display zero results naturally
  - Role change to Patient with active appointments → warning banner on SCR-020 (not SCR-019)

---

## Design References (Frontend Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-019-admin-users.html |
| **Screen Spec** | .propel/context/docs/figma_spec.md#SCR-019 |
| **UXR Requirements** | UXR-501 (visual feedback ≤200 ms; spinner >500 ms), UXR-502 (skeleton loading on user list fetch), UXR-604 (empty-state illustration + CTA when no users match) |
| **Design Tokens** | designsystem.md#colors, designsystem.md#typography, designsystem.md#spacing |

### CRITICAL: Wireframe Implementation Requirement

**Wireframe Status = AVAILABLE** — MUST open `.propel/context/wireframes/Hi-Fi/wireframe-SCR-019-admin-users.html` and match layout, spacing, typography, and colors. Implement all states: Default, Loading (skeleton), Empty, Error. Validate at 375 px, 768 px, 1440 px.

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

Implement SCR-019 — Admin User Management List screen. The screen shows a searchable, filterable, paginated table of all platform users. The Admin can search by name or email (live text input) and filter by role (dropdown: All / Patient / Staff / Admin). Each row shows: Name, Email, Role badge (Patient=blue, Staff=green, Admin=purple), Status badge (Active=teal, Inactive=grey), Last Active, and an "Edit" link navigating to SCR-020. A "+ Create user" button navigates to SCR-020 in create mode. Skeleton loading renders on initial fetch; empty-state illustration with CTA appears when no results match.

---

## Dependent Tasks

- task_003 (BE Admin User Management API) — `GET /api/admin/users` endpoint must be available; can be developed in parallel against a mocked API response

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `app/src/pages/admin/AdminUsersListPage.tsx` | CREATE | Main SCR-019 page container |
| `app/src/components/admin/UserTable.tsx` | CREATE | Table with sortable columns, role/status badges, Edit links |
| `app/src/components/admin/UserSearchFilter.tsx` | CREATE | Search text input + role dropdown filter |
| `app/src/components/common/SkeletonTable.tsx` | MODIFY or CREATE | Reusable skeleton row for table loading state |
| `app/src/api/adminUsersApi.ts` | CREATE | Typed API client for `GET /api/admin/users` with query parameters |

---

## Implementation Plan

1. **Route** — Register `/admin/users` route (Admin-role-guarded) in `app/src/router/AppRouter.tsx`; redirect non-Admin to dashboard.
2. **API client** — `adminUsersApi.ts`: typed `getUsers({ query, role, page, pageSize })` function using `fetch` (or Axios) with query-string serialisation; return type: `{ data: UserSummary[]; totalCount: number }`.
3. **Search & filter** — `UserSearchFilter` component: debounced text input (300 ms) for name/email search; role `<select>` dropdown. Both push updated params via `URL search params` (React Router `useSearchParams`) to keep state in URL for shareability.
4. **Paginated table** — `UserTable` renders rows from API response. Role badge uses `color.semantic.info` (Patient blue), `color.semantic.success` (Staff green), `color.brand.navy.600` (Admin purple). Status badge: Active → `color.brand.teal.500`; Inactive → `color.neutral.400`.
5. **Skeleton loading** — On initial fetch and on search param change, render 5 `SkeletonTable` rows until data resolves. No blank flash > 200 ms (UXR-502).
6. **Empty state** — When `data.length === 0 && !isLoading`, render `UserEmptyState` with illustration and "Create the first user" CTA navigating to SCR-020 create mode (UXR-604).
7. **Error state** — On API error, render an error banner with retry button.
8. **Pagination** — Page controls (prev / next / page number) driven by `X-Total-Count` response header.
9. **"+ Create user" button** — Navigate to `/admin/users/new` (SCR-020 create mode).

---

## Current Project State

```
app/
  src/
    pages/
      admin/        # (to be created)
    components/
      admin/        # (to be created)
      common/
    api/
    router/
      AppRouter.tsx
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | app/src/pages/admin/AdminUsersListPage.tsx | SCR-019 page container managing search params, pagination state, data fetch |
| CREATE | app/src/components/admin/UserTable.tsx | Paginated table with role/status badges and Edit links |
| CREATE | app/src/components/admin/UserSearchFilter.tsx | Search input + role filter dropdown |
| CREATE | app/src/api/adminUsersApi.ts | Typed API client for admin users list endpoint |
| MODIFY | app/src/router/AppRouter.tsx | Add `/admin/users` route with Admin role guard |

---

## External References

- React 18 `useSearchParams` for URL-based filter state: https://reactrouter.com/en/main/hooks/use-search-params
- TailwindCSS table patterns: https://tailwindcss.com/docs/table-layout
- Design tokens — Role badges: Patient `#2563EB` / Staff `#16A34A` / Admin `#1E3A5F`; Status Active `#0D9488` / Inactive `#9CA3AF`
- Screen states — SCR-019: Default, Loading (skeleton), Empty, Error (per figma_spec.md#SCR-019)
- Wireframe: `.propel/context/wireframes/Hi-Fi/wireframe-SCR-019-admin-users.html`
- figma_spec.md component inventory: Table (users), Badge (role/status), Button ×2, SearchInput

---

## Build Commands

- `cd app && npm run build` — TypeScript compile check
- `cd app && npm run lint` — ESLint validation
- `cd app && npm test -- --testPathPattern=AdminUsersListPage` — Run page tests

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Integration tests pass (with mocked API responses)
- [ ] **[UI Tasks]** Visual comparison against wireframe at 375 px, 768 px, 1440 px
- [ ] **[UI Tasks]** Run `/analyze-ux` to validate wireframe alignment
- [ ] All 4 screen states render correctly: Default, Loading (skeleton ≤200 ms), Empty (with CTA), Error (with retry)
- [ ] Search debounce fires at 300 ms; no API call on each keystroke
- [ ] Role filter updates URL search params and refetches; browser back/forward navigates correctly
- [ ] Pagination controls reflect `X-Total-Count`; correct page boundary handling
- [ ] Non-Admin role accessing `/admin/users` is redirected

---

## Implementation Checklist

- [ ] Create `app/src/pages/admin/AdminUsersListPage.tsx` with `useSearchParams` for query/role/page state
- [ ] Implement `getUsers()` API function in `app/src/api/adminUsersApi.ts` with typed request/response shapes
- [ ] Build `UserSearchFilter` component: debounced text input + role `<select>`
- [ ] Build `UserTable` component: columns Name, Email, Role badge, Status badge, Last Active, Edit link
- [ ] Implement role badge colour mapping (Patient=blue `#2563EB`, Staff=green `#16A34A`, Admin=navy `#1E3A5F`)
- [ ] Implement status badge (Active=teal `#0D9488`, Inactive=grey `#9CA3AF`)
- [ ] Implement skeleton loading rows during fetch (UXR-502)
- [ ] Implement empty-state component with illustration and "+ Create user" CTA (UXR-604)
- [ ] Add pagination component driven by `X-Total-Count` response header
- [ ] Register `/admin/users` route with Admin role guard in `AppRouter.tsx`
- [ ] **[UI Tasks - MANDATORY]** Reference wireframe `wireframe-SCR-019-admin-users.html` during implementation
- [ ] **[UI Tasks - MANDATORY]** Validate UI matches wireframe before marking task complete
