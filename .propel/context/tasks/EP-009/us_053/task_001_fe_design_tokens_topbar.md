---
title: "Task — FE Design Token System (tailwind.config.ts from designsystem.md), ESLint Enforcement & Shared TopBar Component"
task_id: task_001
story_id: us_053
epic: EP-009
layer: Frontend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — FE Design Token System (tailwind.config.ts from designsystem.md), ESLint Enforcement & Shared TopBar Component

## Requirement Reference

- **User Story**: us_053
- **Story Location**: .propel/context/tasks/EP-009/us_053/us_053.md
- **Acceptance Criteria**:
  - AC-2: Zero hard-coded colour hex values, spacing pixel values, or typography values in any `.tsx` component or CSS module; all values expressed exclusively via TailwindCSS utility classes mapped to design tokens (e.g., `bg-navy-700`, `text-teal-500`, `p-4`, `text-sm`); `tailwind.config.ts` `theme.extend` values match `designsystem.md` token specification exactly (verified by TypeScript token-validation CI script comparing token tables); `no-restricted-syntax` ESLint rule in `.eslintrc.ts` flags `style={{ }}` props containing hex colours, numeric pixel padding, or numeric pixel font sizes; ESLint check runs in CI and blocks PR merge on violation (UXR-401)
  - AC-3: Consistent page header `<TopBar>` React component on all 19 authenticated screens (SCR-003–SCR-021); `<header role="banner">` as first `<body>` child; contains: (a) PropelIQ Health logo (`<div class="topbar-logo">`, "P" icon + "PropelIQ Health" text), (b) role label badge (navy-600 Staff / teal-500 Patient / neutral-600 Admin — all design token colours), (c) user avatar/initials circle from `users.first_name + users.last_name`, (d) "Sign out" button calls `DELETE /api/auth/session` + clears JWT from `localStorage` + redirects to SCR-001; `<TopBar>` is a single shared component — not re-implemented per screen; `isAuthenticated={false}` renders logo-only (no badge/avatar/logout) for SCR-001/SCR-002 unauthenticated variant (UXR-402)
  - AC-4: ESLint `no-restricted-syntax` rule also flags arbitrary Tailwind values: `text-[#FF0000]`, `p-[12px]`; violation message: "Hard-coded style value detected — use TailwindCSS design token classes instead (see designsystem.md)"; exception: `wireframe-shared.css` explicitly excluded from ESLint rule scope (UXR-401)
  - AC-5 (partial): ESLint token check reports 0 violations across all `.tsx` files in `/client/src`; TypeScript token-validation script confirms `tailwind.config.ts` tokens match `designsystem.md` with 0 discrepancies; `<TopBar>` renders on all 19 authenticated routes (Playwright asserts `role="banner"` with logo, role badge, avatar, logout button visible) (NFR-002, UXR-401, UXR-402)

- **Edge Cases**:
  - Edge Case: `designsystem.md` token table updated without updating `tailwind.config.ts` → TypeScript token-validation CI script detects discrepancy; fails CI with diff of out-of-sync tokens; PR author must update `tailwind.config.ts` to match before merge
  - Edge Case: `<TopBar>` on unauthenticated screen (SCR-001 Login / SCR-002 Register) → `isAuthenticated={false}` prop; renders logo-only; role badge, avatar, logout button hidden via `{isAuthenticated && ...}` guards; consistent with wireframes for SCR-001/SCR-002
  - Edge Case: Developer adds new authenticated route without wrapping in `<AuthenticatedLayout>` → all authenticated routes defined under `<AuthenticatedLayout>` which renders `<TopBar>` before `<Outlet>`; individual page components do not import `<TopBar>` directly; Playwright CI smoke test on AC-5 crawls all authenticated routes and asserts `role="banner"` presence

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes — all 21 screens (design tokens); 19 authenticated screens (TopBar) |
| **Figma URL** | .propel/context/docs/figma_spec.md — UXR-401, UXR-402 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-001-login.html through wireframe-SCR-021-audit-log.html (wireframe-shared.css defines all design tokens as CSS custom properties; topbar visible in all authenticated wireframes) |
| **Screen Spec** | SCR-001 through SCR-021 (tokens); SCR-003 through SCR-021 (TopBar); SCR-001/SCR-002 (logo-only unauthenticated variant) |
| **UXR Requirements** | UXR-401 (design token system), UXR-402 (consistent authenticated page header) |
| **Design Tokens** | navy-700, navy-600, teal-500, neutral-600, neutral-100 etc. — full palette from `designsystem.md` |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React 18 + TypeScript 5 | — |
| Styling | TailwindCSS 3.x | — |
| Linting | ESLint + `no-restricted-syntax` rule | — |
| Design System | `designsystem.md` (source of truth) | — |
| Testing | Playwright | — |
| Auth | JWT from `localStorage` | — |

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
| **Mobile Impact** | Yes — design tokens apply at all breakpoints; `<TopBar>` renders on mobile with hamburger integration (us_052) |
| **Platform Target** | Web (responsive) |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Populate `tailwind.config.ts` `theme.extend` with the complete design token palette, spacing scale, and type scale from `designsystem.md`. Write a TypeScript CI script to diff `tailwind.config.ts` tokens against `designsystem.md` and fail on discrepancy. Add `no-restricted-syntax` ESLint rules blocking hex/px inline styles and arbitrary Tailwind values. Implement the shared `<TopBar>` React component with `isAuthenticated` prop, role badge (3 token colours), avatar/initials, and logout (`DELETE /api/auth/session` + `localStorage` clear). Wire `<TopBar>` into `<AuthenticatedLayout>` and `<PublicLayout>` (logo-only). Add Playwright CI assertion verifying `role="banner"` on all 19 authenticated routes.

---

## Dependent Tasks

- US_001 (EP-TECH) — React 18 + TailwindCSS scaffold; `tailwind.config.ts` must exist with base configuration
- us_051 task_001 (EP-009) — Focus ring design token (`--color-teal-500`) must be set in `tailwind.config.ts`; co-develop in same sprint
- us_052 task_001 (EP-009) — `<TopBar>` integrates with `<HamburgerMenu>` at mobile; us_052 and us_053 share `<AuthenticatedLayout>` — coordinate task ordering or implement in parallel

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `client/tailwind.config.ts` | MODIFY | Populate `theme.extend` with full colour palette, spacing scale, type scale from `designsystem.md` |
| `client/scripts/validate-tokens.ts` | CREATE | TypeScript CI script; parse `designsystem.md` token table; diff against `tailwind.config.ts` `theme.extend`; exit 1 on discrepancy |
| `client/.eslintrc.ts` | MODIFY | Add `no-restricted-syntax` for hex/px `style={{}}` props; add arbitrary Tailwind value pattern block (`text-[`, `p-[` etc.); exclude `wireframe-shared.css` |
| `client/src/components/layout/TopBar.tsx` | CREATE | `isAuthenticated` prop; logo; role badge (3 token colours); avatar/initials; logout button |
| `client/src/components/layout/AuthenticatedLayout.tsx` | MODIFY | Render `<TopBar isAuthenticated={true} />` as first child before `<Outlet>` |
| `client/src/components/layout/PublicLayout.tsx` | CREATE OR MODIFY | Render `<TopBar isAuthenticated={false} />` (logo-only) for SCR-001/SCR-002 |
| `client/src/contexts/AuthContext.tsx` | MODIFY OR CREATE | Provide `user.firstName`, `user.lastName`, `user.role` to `<TopBar>` via context |
| `client/src/features/auth/services/authService.ts` | MODIFY | Add `logout()` function: `DELETE /api/auth/session` + `localStorage.removeItem('jwt')` + navigate to `/login` |
| `client/tests/smoke/topbar-smoke.spec.ts` | CREATE | Playwright: assert `role="banner"` on all 19 authenticated routes with logo, badge, avatar, logout visible |

---

## Implementation Plan

1. Read `designsystem.md` token specification: extract all colour tokens (primary, neutral, semantic), spacing scale values, and type scale values; map to TailwindCSS `theme.extend` format:
   ```ts
   // tailwind.config.ts
   theme: {
     extend: {
       colors: {
         navy: { 50: '#...', 100: '#...', ..., 700: '#162D4A', ... },
         teal: { 50: '#...', 500: '#0D9488', ... },
         neutral: { ... }
       },
       spacing: { /* design system spacing scale */ },
       fontSize: { /* design system type scale */ }
     }
   }
   ```

2. Create `client/scripts/validate-tokens.ts`: parse `designsystem.md` using regex/AST extraction of the token table section; extract key-value pairs of token name → value; parse `tailwind.config.ts` `theme.extend` using `ts-morph` or `JSON.parse(execSync('node -e ...').toString())`; compare each token; on any mismatch: log diff and `process.exit(1)`; wire to GitHub Actions as `npm run validate-tokens` step on `push` and `pull_request`

3. Update `.eslintrc.ts` with `no-restricted-syntax` rules:
   - Rule 1: `JSXAttribute[name.name="style"]` with value containing `#[0-9a-fA-F]{3,6}` → error "Hard-coded style value detected — use TailwindCSS design token classes instead (see designsystem.md)"
   - Rule 2: `JSXAttribute[name.name="style"]` with value containing numeric `px` values → same error message
   - Rule 3: `Literal[value=/class.*\[#[0-9a-fA-F]/]` (arbitrary Tailwind hex) → same error
   - Rule 4: `Literal[value=/class.*\[[0-9]+px\]/]` (arbitrary Tailwind px) → same error
   - Add `overrides: [{ files: ['**/wireframe-shared.css'], rules: { 'no-restricted-syntax': 'off' } }]`

4. Create `TopBar.tsx` component:
   ```tsx
   interface TopBarProps {
     isAuthenticated: boolean;
   }
   ```
   - Always renders: `<header role="banner" className="topbar ...">` + logo `<div className="topbar-logo"><span>P</span> PropelIQ Health</div>`
   - When `isAuthenticated`: render role badge `<span className={roleBadgeClass[user.role]}>` (navy-600 Staff / teal-500 Patient / neutral-600 Admin); render avatar circle with `{user.firstName[0]}{user.lastName[0]}` initials; render logout `<button onClick={handleLogout}>Sign out</button>`
   - `handleLogout`: call `authService.logout()` (DELETE /api/auth/session + localStorage clear + navigate('/login'))
   - When `!isAuthenticated`: render logo only

5. Update `AuthenticatedLayout.tsx`: render `<TopBar isAuthenticated={true} />` as the first child inside `<body>`-level wrapper, before `<main>` / `<Outlet>`; remove any per-screen TopBar re-implementations if they exist

6. Create or update `PublicLayout.tsx`: render `<TopBar isAuthenticated={false} />` for SCR-001 (Login) and SCR-002 (Register)

7. Update `authService.ts`: implement `logout()`: call `DELETE /api/auth/session` (fire-and-forget on network error); `localStorage.removeItem('jwt')`; `navigate('/login')`; clear any auth context state

8. Audit all existing `.tsx` components for hard-coded colour hex values, numeric `px` padding/margin values, and numeric `px` font sizes; replace all with equivalent TailwindCSS token classes; run ESLint to confirm 0 violations

9. Create `topbar-smoke.spec.ts`: define list of 19 authenticated routes (SCR-003–SCR-021 paths); for each: authenticate, navigate, assert `page.locator('[role="banner"]').toBeVisible()`; assert logo text, role badge, avatar initials, logout button all visible; also test logout button: click → expect `localStorage.getItem('jwt')` to be null + redirect to `/login`

---

## Current Project State

```
client/
├── src/
│   ├── components/layout/
│   │   ├── TopBar.tsx               ← CREATE (shared authenticated header)
│   │   ├── AuthenticatedLayout.tsx  ← MODIFY (render <TopBar isAuthenticated>)
│   │   └── PublicLayout.tsx         ← CREATE/MODIFY (logo-only variant)
│   ├── contexts/AuthContext.tsx     ← MODIFY (expose user.firstName/lastName/role)
│   └── features/auth/services/
│       └── authService.ts           ← MODIFY (add logout())
├── tailwind.config.ts               ← MODIFY (full token palette from designsystem.md)
├── .eslintrc.ts                     ← MODIFY (no-restricted-syntax for hex/px)
└── scripts/
    └── validate-tokens.ts           ← CREATE (CI token validation script)
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `client/tailwind.config.ts` | Populate `theme.extend` with full colour/spacing/type scale from `designsystem.md` |
| CREATE | `client/scripts/validate-tokens.ts` | CI diff script: `designsystem.md` tokens vs `tailwind.config.ts` `theme.extend`; exit 1 on mismatch |
| MODIFY | `client/.eslintrc.ts` | `no-restricted-syntax`: hex/px inline styles; arbitrary Tailwind values; `wireframe-shared.css` excluded |
| CREATE | `client/src/components/layout/TopBar.tsx` | `isAuthenticated` prop; logo; role badge (3 token colours); avatar/initials; logout button |
| MODIFY | `client/src/components/layout/AuthenticatedLayout.tsx` | Render `<TopBar isAuthenticated={true} />` as first child |
| CREATE | `client/src/components/layout/PublicLayout.tsx` | Logo-only `<TopBar isAuthenticated={false} />` for SCR-001/SCR-002 |
| MODIFY | `client/src/contexts/AuthContext.tsx` | Expose `firstName`, `lastName`, `role` |
| MODIFY | `client/src/features/auth/services/authService.ts` | Add `logout()`: DELETE session + localStorage clear + navigate |
| CREATE | `client/tests/smoke/topbar-smoke.spec.ts` | Playwright: `role="banner"` on all 19 authenticated routes; logout flow |

---

## External References

- [TailwindCSS — Theme Configuration / Design Tokens](https://tailwindcss.com/docs/configuration#theme)
- [TailwindCSS — Customizing Colors](https://tailwindcss.com/docs/customizing-colors)
- [ESLint — no-restricted-syntax rule](https://eslint.org/docs/latest/rules/no-restricted-syntax)
- [WAI-ARIA — Landmark Roles (banner)](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
- [ts-morph — TypeScript AST manipulation for CI scripts](https://ts-morph.com/)

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm run lint`
- `cd client && npx ts-node scripts/validate-tokens.ts`
- `cd client && npx playwright test tests/smoke/topbar-smoke.spec.ts`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `tailwind.config.ts` `theme.extend.colors.navy[700]` === `#162D4A` (matches `designsystem.md`)
- [ ] `tailwind.config.ts` `theme.extend.colors.teal[500]` === `#0D9488` (matches `designsystem.md`)
- [ ] `validate-tokens.ts` script: exits 0 when `tailwind.config.ts` matches `designsystem.md`; exits 1 when manual hex value discrepancy introduced
- [ ] ESLint check: 0 violations on all `.tsx` files in `/client/src` (no hex/px inline styles, no arbitrary Tailwind values)
- [ ] ESLint check: `wireframe-shared.css` does NOT trigger `no-restricted-syntax` violations
- [ ] `<TopBar isAuthenticated={true} role="Staff">`: renders logo + "Staff" badge with `bg-navy-600` + avatar initials + "Sign out" button
- [ ] `<TopBar isAuthenticated={true} role="Patient">`: role badge uses `bg-teal-500`
- [ ] `<TopBar isAuthenticated={true} role="Admin">`: role badge uses `bg-neutral-600`
- [ ] `<TopBar isAuthenticated={false}>`: renders logo only; no badge, avatar, or logout button in DOM
- [ ] Playwright: `[role="banner"]` visible on all 19 authenticated routes (SCR-003–SCR-021)
- [ ] Playwright: logout button click → `DELETE /api/auth/session` called; `localStorage.getItem('jwt')` returns null; page redirects to `/login`
- [ ] No per-screen TopBar re-implementation exists; all authenticated routes use `<AuthenticatedLayout>` wrapper

---

## Implementation Checklist

- [ ] Read `designsystem.md` token tables; extract all colour tokens, spacing values, type scale values into `tailwind.config.ts` `theme.extend` (colours: navy, teal, neutral, semantic; spacing scale; font sizes)
- [ ] Create `scripts/validate-tokens.ts`: parse `designsystem.md` token table + `tailwind.config.ts` `theme.extend`; diff; exit 1 on discrepancy; wire to CI
- [ ] Update `.eslintrc.ts`: add `no-restricted-syntax` for hex/px inline styles, arbitrary Tailwind `[#...]` and `[Npx]` values; exclude `wireframe-shared.css`
- [ ] Audit all existing `.tsx` files for hard-coded styles; replace with token classes; run ESLint to confirm 0 violations
- [ ] Create `TopBar.tsx`: `<header role="banner">`; logo; conditional role badge, avatar/initials, logout button based on `isAuthenticated`
- [ ] Update `AuthContext.tsx`: provide `firstName`, `lastName`, `role` consumed by `TopBar`
- [ ] Update `authService.ts`: `logout()` function with `DELETE /api/auth/session` + localStorage clear + navigate
- [ ] Update `AuthenticatedLayout.tsx`: render `<TopBar isAuthenticated={true} />` as first child
- [ ] Create `PublicLayout.tsx`: render `<TopBar isAuthenticated={false} />` for SCR-001/SCR-002
- [ ] Create `topbar-smoke.spec.ts`: `role="banner"` assertion on all 19 authenticated routes; logout flow validation
- [ ] Wire ESLint check and `validate-tokens.ts` to GitHub Actions CI `on: pull_request`
