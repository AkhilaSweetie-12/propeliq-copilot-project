---
title: "Task — FE Navigation Architecture: NavigationItems (Role-Sensitive), RequireRole Guard, Breadcrumb & Active Route Detection"
task_id: task_001
story_id: us_054
epic: EP-010
layer: Frontend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — FE Navigation Architecture: NavigationItems (Role-Sensitive), RequireRole Guard, Breadcrumb & Active Route Detection

## Requirement Reference

- **User Story**: us_054
- **Story Location**: .propel/context/tasks/EP-010/us_054/us_054.md
- **Acceptance Criteria**:
  - AC-3: Navigation items visible per role: Patient — "Dashboard", "Book Appointment", "Intake", "Documents"; Staff — "Dashboard", "Queue", "Walk-In Booking", "Patient Search"; Admin — "Users", "Audit Log"; forbidden items completely absent from DOM (not `display: none` — conditionally rendered based on JWT `role` claim); active nav item carries `aria-current="page"` + `sidebar-nav-item active` CSS class; active detection via `useMatch` from React Router; same `<NavigationItems role={userRole}>` component drives both sidebar (desktop/tablet) and hamburger drawer (mobile, us_052) (UXR-003)
  - AC-4: Active item on SCR-016 shows `aria-current="page"` + `background: var(--color-teal-100); border-left: 3px solid var(--color-teal-500)`; routing via React Router `<Link>` only (no `<a href>` full-page reloads); `<NavigationItems>` unit test: (a) only role-appropriate items rendered; (b) correct item active for each route; (c) no forbidden items in DOM for any role (UXR-003, UXR-001)
  - AC-2: `<Breadcrumb>` component on all depth ≥ 2 screens (SCR-005–SCR-010 Patient, SCR-012–SCR-018 Staff, SCR-020–SCR-021 Admin); full path from dashboard with `<a>` anchors for ancestors, `›` separator, `<span aria-current="page">` for current; mobile (< 768px) truncates to parent + current only; `<nav aria-label="Breadcrumb">`; absent on SCR-001, SCR-002, SCR-003, SCR-004, SCR-011, SCR-019 (depth-0/1 screens) (UXR-002)
  - Edge Cases (routing guard): `<RequireRole roles={['Patient']}>` guard for Patient-only routes; Staff navigating to `/booking` → redirected to SCR-011 (replace); `audit_logs (action=UnauthorisedNavigation, actor_id, entity_type=route, entity_id=/booking)` written; defence-in-depth with server-side RBAC (us_021)

- **Edge Cases**:
  - Edge Case: Breadcrumb > 4 levels deep → `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` + mobile truncation (parent + current only); platform max depth = 3 in Phase 1; screen reader reads full `aria-label` regardless of visual truncation
  - Edge Case: Unknown role value in `<NavigationItems>` → TypeScript `'Patient' | 'Staff' | 'Admin'` union type catches at compile time; runtime unknown role → empty nav list + `console.error("Unknown role in navigation: [role]")`; fails safe (no items) rather than exposing forbidden items
  - Edge Case: Deep-link navigation (bookmark to `/patients/123/coding`) → `useMatch` detects URL path; correct nav item activated without click history; Playwright direct `page.goto()` test asserts correct active item

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes — all 21 screens (role nav); depth ≥ 2 screens (breadcrumb) |
| **Figma URL** | .propel/context/docs/figma_spec.md — UXR-001, UXR-002, UXR-003 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/ — all 21 screens; wireframe-shared.css defines `.sidebar-nav`, `.sidebar-nav-item.active`, `.breadcrumb`, `.breadcrumb a`, `.breadcrumb .current` patterns |
| **Screen Spec** | SCR-003–SCR-021 (nav sidebar/drawer); SCR-005–SCR-010, SCR-012–SCR-018, SCR-020–SCR-021 (breadcrumb) |
| **UXR Requirements** | UXR-001, UXR-002, UXR-003 |
| **Design Tokens** | `var(--color-teal-100)` active bg; `var(--color-teal-500)` active border-left; from `tailwind.config.ts` (us_053) |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React 18 + TypeScript 5 | — |
| Routing | React Router v6 (`useMatch`, `useNavigate`, `<Link>`) | — |
| Styling | TailwindCSS 3.x | — |
| Auth | JWT decode (`role` claim) | — |

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
| **Mobile Impact** | Yes — `<NavigationItems>` renders inside hamburger drawer (us_052) on mobile; breadcrumb truncates to parent + current at < 768px |
| **Platform Target** | Web (responsive) |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Implement the `<NavigationItems>` React component with a `role: 'Patient' | 'Staff' | 'Admin'` typed prop; render only the role-appropriate link set from a static config; use `useMatch` for active item detection; apply `aria-current="page"` and active CSS classes. Implement `<RequireRole>` router guard that redirects unauthorised role navigations to the role dashboard and writes an `audit_logs` entry. Implement the `<Breadcrumb>` component that constructs the full path from the React Router location, renders ancestor `<a>` links with `›` separators, and truncates to parent + current on mobile. Wire both components into `<AuthenticatedLayout>` and the hamburger `<NavDrawer>` from us_052.

---

## Dependent Tasks

- US_001 (EP-TECH) — React Router v6 scaffold with route definitions
- us_052 task_001 (EP-009) — `<NavDrawer>` and `<Sidebar>` shells exist to receive `<NavigationItems>`
- us_053 task_001 (EP-009) — `<AuthenticatedLayout>` exists to receive `<Breadcrumb>`
- us_048 task_001 (EP-008-I) — `AuditLogger` on backend for `UnauthorisedNavigation` write (client calls `DELETE`/redirect; backend logs on 403 response from `<RequireRole>` guard)

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `client/src/components/navigation/NavigationItems.tsx` | CREATE | Typed `role` prop; role-specific link config; `useMatch` active detection; `aria-current="page"`; `<Link>` not `<a href>` |
| `client/src/components/navigation/navConfig.ts` | CREATE | Static config: `{ Patient: [...links], Staff: [...links], Admin: [...links] }` |
| `client/src/components/navigation/RequireRole.tsx` | CREATE | Wraps route; checks JWT `role` claim; redirects to role dashboard on mismatch; fires API call to log `UnauthorisedNavigation` |
| `client/src/components/navigation/Breadcrumb.tsx` | CREATE | Full path from React Router `useLocation`; ancestor `<a>` links; `›` separator; mobile truncation via `useWindowSize`; `<nav aria-label="Breadcrumb">` |
| `client/src/components/navigation/breadcrumbConfig.ts` | CREATE | Static route-to-breadcrumb-path mapping: `{ '/patients/:id/coding': ['Queue', '/queue', 'Patient Name', '/patients/:id', 'Medical Coding'] }` etc. |
| `client/src/components/layout/AuthenticatedLayout.tsx` | MODIFY | Render `<Breadcrumb>` between `<TopBar>` and `<main>`; conditionally show based on route depth |
| `client/src/components/navigation/Sidebar.tsx` | MODIFY | Replace hardcoded nav links with `<NavigationItems role={userRole} />` |
| `client/src/components/navigation/NavDrawer.tsx` | MODIFY | Replace hardcoded nav links with `<NavigationItems role={userRole} />` |
| `client/src/router/AppRouter.tsx` | MODIFY | Wrap Patient-only routes in `<RequireRole roles={['Patient']}>`; wrap Staff-only routes similarly; Admin routes similarly |

---

## Implementation Plan

1. Create `navConfig.ts` — static link configuration:
   ```ts
   export const NAV_CONFIG: Record<'Patient' | 'Staff' | 'Admin', NavItem[]> = {
     Patient: [
       { label: 'Dashboard', to: '/dashboard', icon: HomeIcon },
       { label: 'Book Appointment', to: '/booking', icon: CalendarIcon },
       { label: 'Intake', to: '/intake', icon: ClipboardIcon },
       { label: 'Documents', to: '/documents', icon: DocumentIcon },
     ],
     Staff: [
       { label: 'Dashboard', to: '/staff/dashboard', icon: HomeIcon },
       { label: 'Queue', to: '/queue', icon: QueueListIcon },
       { label: 'Walk-In Booking', to: '/walk-in', icon: UserPlusIcon },
       { label: 'Patient Search', to: '/patients/search', icon: MagnifyingGlassIcon },
     ],
     Admin: [
       { label: 'Users', to: '/admin/users', icon: UsersIcon },
       { label: 'Audit Log', to: '/admin/audit', icon: DocumentTextIcon },
     ],
   };
   ```

2. Create `NavigationItems.tsx`:
   - Props: `role: 'Patient' | 'Staff' | 'Admin'`; unknown role → empty list + `console.error`
   - Map `NAV_CONFIG[role]` to `<li>` items; each renders a `<Link to={item.to}>` with Heroicons icon + label text
   - Active detection: `const isActive = !!useMatch({ path: item.to, end: false })`
   - Active item: add `sidebar-nav-item active` className (matches wireframe-shared.css pattern) + `aria-current="page"`
   - Active CSS via TailwindCSS: `bg-teal-100 border-l-[3px] border-teal-500` when active

3. Create `RequireRole.tsx`:
   - Props: `roles: Array<'Patient' | 'Staff' | 'Admin'>`, `children: ReactNode`
   - Read JWT role from `useAuthContext()`
   - If `!roles.includes(userRole)` → call `POST /api/audit/navigation-violation` (or equivalent lightweight endpoint to log `UnauthorisedNavigation`); then `<Navigate to={roleDashboardPath(userRole)} replace />`
   - Helper `roleDashboardPath`: Patient → `/dashboard`, Staff → `/staff/dashboard`, Admin → `/admin/users`
   - Wrap in `AppRouter.tsx` around role-scoped route sections

4. Update `AppRouter.tsx`: group routes by role using `<RequireRole>`:
   ```tsx
   <Route path="/" element={<AuthenticatedLayout />}>
     <Route element={<RequireRole roles={['Patient']} />}>
       <Route path="booking" element={...} />
       <Route path="intake" element={...} />
       <Route path="documents" element={...} />
     </Route>
     <Route element={<RequireRole roles={['Staff']} />}>
       <Route path="queue" element={...} />
       <Route path="walk-in" element={...} />
     </Route>
     ...
   </Route>
   ```

5. Create `breadcrumbConfig.ts` — static route → path mapping:
   - Map each depth ≥ 2 route path pattern to its ancestor chain: `{ path, label, parentPath, parentLabel }`
   - Example: `/patients/:id/coding` → `[{ label: 'Queue', to: '/queue' }, { label: ':id name (dynamic)', to: '/patients/:id' }, { label: 'Medical Coding', current: true }]`
   - Dynamic segments (`:id`) resolved at render time from `useParams()` to display the actual patient name

6. Create `Breadcrumb.tsx`:
   - Use `useLocation()` + `useParams()` to resolve current route
   - Look up `breadcrumbConfig` entry for current path pattern
   - Render `<nav aria-label="Breadcrumb"><ol>` with ancestor `<a>` links separated by `<span aria-hidden="true"> › </span>` and `<span aria-current="page">` for the last item
   - Mobile truncation: `const isMobile = useWindowWidth() < 768`; when mobile: show only `[parentItem, currentItem]`
   - Absent on depth-0/1 routes (SCR-001–SCR-004, SCR-011, SCR-019): `breadcrumbConfig` returns null for these → render nothing

7. Update `AuthenticatedLayout.tsx`: render `<Breadcrumb />` between `<TopBar>` and `<main id="main-content">`

8. Update `Sidebar.tsx` and `NavDrawer.tsx`: replace any hardcoded `<a>` nav links with `<NavigationItems role={userRole} />`

---

## Current Project State

```
client/
├── src/
│   ├── components/
│   │   ├── navigation/
│   │   │   ├── NavigationItems.tsx       ← CREATE
│   │   │   ├── navConfig.ts              ← CREATE
│   │   │   ├── RequireRole.tsx           ← CREATE
│   │   │   ├── Breadcrumb.tsx            ← CREATE
│   │   │   ├── breadcrumbConfig.ts       ← CREATE
│   │   │   ├── Sidebar.tsx               ← MODIFY (use NavigationItems)
│   │   │   └── NavDrawer.tsx             ← MODIFY (use NavigationItems)
│   │   └── layout/
│   │       └── AuthenticatedLayout.tsx   ← MODIFY (add Breadcrumb)
│   └── router/AppRouter.tsx              ← MODIFY (RequireRole wrappers)
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `client/src/components/navigation/navConfig.ts` | Static `NAV_CONFIG` per role |
| CREATE | `client/src/components/navigation/NavigationItems.tsx` | Typed role prop; `useMatch` active; `aria-current="page"`; `<Link>` only |
| CREATE | `client/src/components/navigation/RequireRole.tsx` | Role guard; redirect to role dashboard; log `UnauthorisedNavigation` |
| CREATE | `client/src/components/navigation/breadcrumbConfig.ts` | Route-to-path mapping for all depth ≥ 2 routes |
| CREATE | `client/src/components/navigation/Breadcrumb.tsx` | Full path render; `›` separator; mobile truncation; `<nav aria-label="Breadcrumb">` |
| MODIFY | `client/src/components/navigation/Sidebar.tsx` | Replace hardcoded links with `<NavigationItems role={userRole} />` |
| MODIFY | `client/src/components/navigation/NavDrawer.tsx` | Replace hardcoded links with `<NavigationItems role={userRole} />` |
| MODIFY | `client/src/components/layout/AuthenticatedLayout.tsx` | Render `<Breadcrumb />` between TopBar and main |
| MODIFY | `client/src/router/AppRouter.tsx` | Wrap role-scoped route groups in `<RequireRole roles={[...]} />` |

---

## External References

- [React Router v6 — `useMatch`, `<Navigate>`, route nesting](https://reactrouter.com/en/main/hooks/use-match)
- [WAI-ARIA — Breadcrumb navigation pattern](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/)
- [WAI-ARIA — Navigation landmark](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/navigation.html)

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm run lint`
- `cd client && npx playwright test tests/navigation/`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `<NavigationItems role="Patient">`: renders "Dashboard", "Book Appointment", "Intake", "Documents"; "Queue", "Walk-In Booking" absent from DOM
- [ ] `<NavigationItems role="Staff">`: renders "Dashboard", "Queue", "Walk-In Booking", "Patient Search"; "Book Appointment", "Intake" absent from DOM
- [ ] `<NavigationItems role="Admin">`: renders "Users", "Audit Log" only
- [ ] Active item on `/queue` route: "Queue" nav item has `aria-current="page"` and `bg-teal-100 border-l-teal-500`
- [ ] Deep-link `page.goto('/patients/123/coding')` → "Queue" nav item active (via `useMatch` prefix detection)
- [ ] Staff navigates to `/booking` → redirected to `/staff/dashboard`; no history entry for `/booking`
- [ ] `<Breadcrumb>` on SCR-016: shows "Queue › Jane Smith — 360° View"; "Queue" is `<a href="/queue">`; "360° View" is `<span aria-current="page">`
- [ ] `<Breadcrumb>` on SCR-001 (Login): absent from DOM
- [ ] `<Breadcrumb>` on mobile (375px): shows only "Queue › 360° View" (parent + current)
- [ ] `<nav aria-label="Breadcrumb">` present on all depth ≥ 2 screens
- [ ] Unknown role passed to `<NavigationItems>`: empty list rendered; `console.error` logged; no forbidden items exposed

---

## Implementation Checklist

- [ ] Create `navConfig.ts` with `NAV_CONFIG` for all 3 roles (Patient: 4 items, Staff: 4 items, Admin: 2 items)
- [ ] Create `NavigationItems.tsx`: typed `role` prop; `NAV_CONFIG[role]` map; `useMatch` active detection; `aria-current="page"`; `<Link>` only; unknown role → empty + `console.error`
- [ ] Create `RequireRole.tsx`: role check from `useAuthContext()`; redirect with `replace`; `UnauthorisedNavigation` API log call
- [ ] Update `AppRouter.tsx`: wrap Patient/Staff/Admin route groups in `<RequireRole>`
- [ ] Create `breadcrumbConfig.ts`: all depth ≥ 2 route patterns with ancestor chain definitions; `null` for depth-0/1 screens
- [ ] Create `Breadcrumb.tsx`: `useLocation` + `useParams` resolution; ancestor `<a>` + separator + `<span aria-current="page">`; mobile truncation via `useWindowWidth`
- [ ] Update `AuthenticatedLayout.tsx`: render `<Breadcrumb />` between `<TopBar>` and `<main>`
- [ ] Update `Sidebar.tsx` + `NavDrawer.tsx`: replace hardcoded links with `<NavigationItems role={userRole} />`
- [ ] Unit tests for `NavigationItems`: 3 roles × all routes; forbidden items absent; active item correct
