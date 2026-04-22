---
title: "Task — FE Responsive Layout: 3-Breakpoint Grid (4/8/12-Column), Hamburger Slide-Over Drawer & Mobile Form Stacking"
task_id: task_001
story_id: us_052
epic: EP-009
layer: Frontend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — FE Responsive Layout: 3-Breakpoint Grid (4/8/12-Column), Hamburger Slide-Over Drawer & Mobile Form Stacking

## Requirement Reference

- **User Story**: us_052
- **Story Location**: .propel/context/tasks/EP-009/us_052/us_052.md
- **Acceptance Criteria**:
  - AC-1: All screens use TailwindCSS responsive grid `grid-cols-4 md:grid-cols-8 lg:grid-cols-12`; no horizontal scrollbar at 320px, 768px, or 1024px (Playwright assertion: `document.documentElement.scrollWidth === document.body.scrollWidth`); content reflows without overlap, truncation, or loss at each breakpoint; Playwright responsive audit visits all 21 routes at 3 breakpoints (63 test cases parameterised via `test.each`); zero horizontal overflow on any combination (UXR-301)
  - AC-2: Authenticated screens (SCR-003–SCR-021) at viewport < 768px: persistent sidebar replaced by hamburger button in topbar (`aria-label="Open navigation menu"`, `aria-expanded="false"` when closed); tap/click renders slide-over drawer from left edge with all role-appropriate nav items; drawer has close button (`aria-label="Close navigation menu"`) + backdrop overlay (closes on click); drawer traps focus while open (per us_051 UXR-202); at ≥ 768px hamburger hidden (`hidden md:flex`), sidebar persistent; `useEffect` `window.matchMedia('(min-width: 768px)')` resize listener auto-closes drawer on breakpoint crossing; GPU-accelerated `transform: translateX()` animation (200ms, `will-change: transform` only during transition) (UXR-302)
  - AC-3: Form screens (SCR-002, SCR-006, SCR-009, SCR-013) at < 768px: two-column field groups collapse to single-column (`grid-cols-1 md:grid-cols-2`); Submit/Continue CTA full-width on mobile (`w-full md:w-auto`); all form elements ≥ 44px height (`min-h-[44px]`); no field hidden/clipped at 320px minimum viewport; Playwright snapshot at 375px confirms single-column layout, zero overflow, all fields visible in DOM (UXR-303)
  - AC-4: SCR-014 (Queue View) and SCR-016 (360° Patient View) data tables at mobile: reflow to card-based layout (row → stacked card with field-label: value pairs) OR scoped horizontal scroll on table container only (not full-page); no-show risk badge and action buttons on SCR-014 remain ≥ 44px touch target; SCR-016 360° summary sections stack vertically with section headings visible (UXR-301)
  - AC-5: Playwright responsive audit CI: all 63 parameterised test cases pass; (a) zero horizontal overflow at 320px/768px/1024px on all routes; (b) hamburger visible at 320px, hidden at 1024px on all authenticated screens; (c) form stacking confirmed on 4 form screens at 375px; (d) no interactive element < 44px height at mobile; (e) drawer open/close works at 375px (UXR-301, UXR-302, UXR-303)

- **Edge Cases**:
  - Edge Case: Device rotates to landscape crossing 768px breakpoint with drawer open → `useEffect` + `window.matchMedia` listener auto-closes drawer; sidebar renders in persistent state; no simultaneous drawer + sidebar visible
  - Edge Case: 540px viewport (between breakpoints) → falls in mobile range (< 768px); receives 4-column grid, hamburger nav, single-column form; TailwindCSS mobile-first continuous application; no special handling needed
  - Edge Case: CalendarGrid (SCR-008) — 7-column weekly grid cannot be reduced → exception to 4-column rule; at mobile renders single-day view with left/right day navigation; full-page grid still uses 4 columns; CalendarGrid occupies all 4 columns in single-day mode
  - Edge Case: Drawer animation performance on low-end mobile → use `transform: translateX()` (GPU-accelerated, no layout thrashing); 200ms `transition-transform duration-200`; `will-change: transform` applied via JS class toggle only during animation, removed on `transitionend` to prevent GPU memory waste
  - Edge Case: Playwright responsive audit failure on one route/breakpoint → `test.each` parameterised: each of 63 combinations is independent; one failure does not block others; CI report surfaces exact route + breakpoint for targeted debugging

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes — all 21 screens (SCR-001 through SCR-021) |
| **Figma URL** | .propel/context/docs/figma_spec.md — UXR-301, UXR-302, UXR-303 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-001-login.html through wireframe-SCR-021-audit-log.html (wireframe-shared.css implements responsive grid via media queries at 768px and 1024px) |
| **Screen Spec** | All SCR-001–SCR-021 (grid + hamburger); form screens: SCR-002, SCR-006, SCR-009, SCR-013; data screens: SCR-014, SCR-016 |
| **UXR Requirements** | UXR-301, UXR-302, UXR-303 |
| **Design Tokens** | Grid: `grid-cols-4 md:grid-cols-8 lg:grid-cols-12`; breakpoints: `md: 768px`, `lg: 1024px` (from `tailwind.config.ts`) |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React 18 + TypeScript 5 | — |
| Styling | TailwindCSS 3.x | — |
| Routing | React Router v6 | — |
| Testing | Playwright | — |
| Calendar | `@react-aria/calendar` | — |

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
| **Mobile Impact** | Yes — primary story is mobile/tablet layout; 320px minimum viewport; 44px touch targets |
| **Platform Target** | Web (responsive — mobile, tablet, desktop) |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Apply the 3-breakpoint TailwindCSS responsive grid (`grid-cols-4 md:grid-cols-8 lg:grid-cols-12`) to all 21 page layouts. Implement the `HamburgerMenu` component with a slide-over `NavDrawer` (GPU-accelerated `translateX` animation, focus trap per us_051, backdrop overlay, resize listener for breakpoint auto-close). Convert all 4 form screens' two-column field groups to single-column mobile stacking. Reflow SCR-014 and SCR-016 data tables to card-based layout at mobile. Implement CalendarGrid single-day mobile view. Wire a parameterised 63-case Playwright responsive audit covering all 21 routes × 3 breakpoints.

---

## Dependent Tasks

- US_001 (EP-TECH) — React 18 + TailwindCSS scaffold; `tailwind.config.ts` with breakpoint definitions
- us_051 task_001 (EP-009) — Focus trap implementation (`useFocusTrap` hook) shared by hamburger drawer (can be implemented in parallel; us_052 imports the hook from us_051)
- us_053 task_001 (EP-009) — Design tokens in `tailwind.config.ts` (breakpoint and grid values must be populated from `designsystem.md` before responsive classes work correctly)

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `client/src/components/layout/AuthenticatedLayout.tsx` | MODIFY | Add responsive grid wrapper; render `<HamburgerMenu>` at < 768px, `<Sidebar>` at ≥ 768px |
| `client/src/components/layout/PageGrid.tsx` | CREATE OR MODIFY | Reusable `grid-cols-4 md:grid-cols-8 lg:grid-cols-12` wrapper applied to all pages |
| `client/src/components/navigation/HamburgerMenu.tsx` | CREATE | `aria-label`, `aria-expanded`; opens `NavDrawer` |
| `client/src/components/navigation/NavDrawer.tsx` | CREATE | Slide-over drawer; `transform: translateX(-100%)` closed / `translateX(0)` open; backdrop; focus trap; resize listener |
| `client/src/components/navigation/Sidebar.tsx` | MODIFY | Hide at < 768px (`hidden md:flex`); persistent at ≥ 768px |
| `client/src/features/*/forms/*.tsx` | MODIFY | Two-column field groups → `grid-cols-1 md:grid-cols-2`; CTA → `w-full md:w-auto`; `min-h-[44px]` on all inputs |
| `client/src/features/queue/QueueView.tsx` (SCR-014) | MODIFY | Data table → card-based layout at mobile; 44px touch targets on action buttons |
| `client/src/features/patients/View360.tsx` (SCR-016) | MODIFY | Summary sections stack vertically; headings visible at mobile |
| `client/src/features/booking/CalendarGrid.tsx` (SCR-008) | MODIFY | Mobile: single-day view + left/right navigation; `grid-cols-1` on mobile; full 7-column week at ≥ 768px |
| `client/tests/responsive/responsive-audit.spec.ts` | CREATE | 63 parameterised test cases: 21 routes × 3 breakpoints; horizontal overflow + hamburger visibility + form stacking assertions |

---

## Implementation Plan

1. Create `PageGrid.tsx` reusable layout wrapper: `<div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-4 w-full">` (or `container mx-auto` pattern); apply to all 21 page-level layout components; verify no existing layout applies conflicting fixed widths

2. Create `HamburgerMenu.tsx`: renders a `<button>` with `aria-label="Open navigation menu"` and `aria-expanded={isOpen}`; icon: `☰` via Heroicons `Bars3Icon`; on click: sets `drawerOpen = true`; hidden at `md:` breakpoint (`block md:hidden`)

3. Create `NavDrawer.tsx`: full-height slide-over panel; initial CSS `transform: translateX(-100%)`; open: `translateX(0)`; TailwindCSS: `transition-transform duration-200`; add `will-change-transform` class via JS on open, remove on `transitionend` event; backdrop `<div>` with `onClick={close}` and `aria-hidden="true"`; close button `aria-label="Close navigation menu"`; focus trap using `useFocusTrap` hook (from us_051) while open; renders role-appropriate nav items from `useAuthContext()`; on `window.matchMedia('(min-width: 768px)').addEventListener('change')` → if matches && isOpen → setIsOpen(false)

4. Update `Sidebar.tsx`: add `className="hidden md:flex ..."` to root element to hide at mobile; add `display: none` → `display: flex` responsive classes

5. Update `AuthenticatedLayout.tsx`: render `<HamburgerMenu onOpen={openDrawer} />` inside `<TopBar>` at mobile; render `<NavDrawer isOpen={drawerOpen} onClose={closeDrawer} />` as sibling; render `<Sidebar />` for tablet/desktop

6. Update 4 form screens (SCR-002 Registration, SCR-006 AI Intake, SCR-009 Booking & Insurance, SCR-013 Patient Search): change all two-column field groups from `grid-cols-2` to `grid-cols-1 md:grid-cols-2`; change CTA buttons from auto-width to `w-full md:w-auto`; add `min-h-[44px]` to all `<input>`, `<select>`, `<textarea>`, `<button>` elements (can be applied globally in `tailwind.config.ts` base layer or per-form)

7. Update SCR-014 `QueueView.tsx`: add responsive table pattern — at `< md:` breakpoint, table rows render as card layout (`flex flex-col` with `data-label` attribute approach or `hidden md:table-cell` / `block md:hidden` card row alternative); ensure 44px minimum touch target on action buttons and risk badges

8. Update SCR-016 `View360.tsx`: summary section grid → `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`; section headings use `h2` with appropriate `text-sm md:text-base` scaling

9. Update `CalendarGrid.tsx` (SCR-008): add `isMobile` state from `window.matchMedia('(max-width: 767px)')`; when `isMobile`: render single-day column view with `<button aria-label="Previous day">◀</button>` and `<button aria-label="Next day">▶</button>` navigation; when not mobile: render full 7-column `grid-cols-7` week view

10. Create `responsive-audit.spec.ts` Playwright test: define `ROUTES` array (21 routes) and `BREAKPOINTS` array `[{ width: 320, name: 'mobile' }, { width: 768, name: 'tablet' }, { width: 1024, name: 'desktop' }]`; use `test.each(cartesian(ROUTES, BREAKPOINTS))` for 63 parameterised cases; each case: set viewport, navigate, assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`; additionally assert hamburger button visibility (`toBeVisible` at 320px, `toBeHidden` at 1024px on authenticated screens); form stacking at 375px; touch targets ≥ 44px

---

## Current Project State

```
client/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AuthenticatedLayout.tsx    ← MODIFY (hamburger + drawer integration)
│   │   │   └── PageGrid.tsx               ← CREATE (responsive grid wrapper)
│   │   └── navigation/
│   │       ├── HamburgerMenu.tsx          ← CREATE
│   │       ├── NavDrawer.tsx              ← CREATE (slide-over, focus trap, resize listener)
│   │       └── Sidebar.tsx               ← MODIFY (hidden md:flex)
│   └── features/
│       ├── auth/forms/                    ← MODIFY SCR-002 (form stacking)
│       ├── intake/forms/                  ← MODIFY SCR-006, SCR-007 (form stacking)
│       ├── booking/
│       │   ├── BookingForm.tsx            ← MODIFY SCR-009 (form stacking)
│       │   └── CalendarGrid.tsx           ← MODIFY SCR-008 (single-day mobile)
│       ├── patients/
│       │   ├── PatientSearch.tsx          ← MODIFY SCR-013 (form stacking)
│       │   └── View360.tsx               ← MODIFY SCR-016 (vertical stack)
│       └── queue/QueueView.tsx            ← MODIFY SCR-014 (card reflow)
└── tests/responsive/
    └── responsive-audit.spec.ts           ← CREATE (63 parameterised cases)
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `client/src/components/layout/PageGrid.tsx` | `grid-cols-4 md:grid-cols-8 lg:grid-cols-12` reusable wrapper |
| CREATE | `client/src/components/navigation/HamburgerMenu.tsx` | Button; `aria-label`; `aria-expanded`; `block md:hidden` |
| CREATE | `client/src/components/navigation/NavDrawer.tsx` | Slide-over drawer; `translateX` animation; focus trap; backdrop; resize listener |
| MODIFY | `client/src/components/navigation/Sidebar.tsx` | Add `hidden md:flex` responsive visibility |
| MODIFY | `client/src/components/layout/AuthenticatedLayout.tsx` | Integrate `HamburgerMenu` + `NavDrawer`; apply `PageGrid` |
| MODIFY | `client/src/features/auth/forms/RegisterForm.tsx` | `grid-cols-1 md:grid-cols-2`; `w-full md:w-auto` CTA; `min-h-[44px]` inputs |
| MODIFY | `client/src/features/intake/forms/IntakeForm.tsx` | Same responsive form stacking |
| MODIFY | `client/src/features/booking/BookingForm.tsx` | Same responsive form stacking |
| MODIFY | `client/src/features/patients/PatientSearch.tsx` | Same responsive form stacking |
| MODIFY | `client/src/features/booking/CalendarGrid.tsx` | Single-day mobile view; prev/next day navigation |
| MODIFY | `client/src/features/queue/QueueView.tsx` | Card reflow at mobile; 44px touch targets |
| MODIFY | `client/src/features/patients/View360.tsx` | Vertical section stacking; responsive summary grid |
| CREATE | `client/tests/responsive/responsive-audit.spec.ts` | 63 parameterised Playwright cases |

---

## External References

- [TailwindCSS — Responsive Design (breakpoints)](https://tailwindcss.com/docs/responsive-design)
- [TailwindCSS — Grid Template Columns](https://tailwindcss.com/docs/grid-template-columns)
- [WAI-ARIA — Disclosure Navigation (hamburger pattern)](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
- [Playwright — Multiple viewports / parameterised tests](https://playwright.dev/docs/test-parameterize)
- [CSS GPU-accelerated animations — transform vs position](https://web.dev/animations-guide/)

---

## Build Commands

- `cd client && npm run build`
- `cd client && npx playwright test tests/responsive/`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `document.documentElement.scrollWidth === document.documentElement.clientWidth` at 320px on all 21 routes
- [ ] Hamburger button: `toBeVisible()` at 320px viewport on authenticated screen; `toBeHidden()` at 1024px
- [ ] Drawer opens on hamburger click; closes on backdrop click; closes on close button click
- [ ] Drawer `aria-expanded="true"` when open; `aria-expanded="false"` when closed
- [ ] `window.matchMedia('(min-width: 768px)')` triggers → drawer auto-closes
- [ ] All form field groups on SCR-002: single-column at 375px (Playwright screenshot assertion)
- [ ] All CTA buttons: `w-full` at 375px; not `w-full` at 1024px
- [ ] All `<input>`, `<select>` elements: `offsetHeight >= 44` at mobile viewport
- [ ] SCR-014 at 320px: table rows render as cards; no horizontal page overflow
- [ ] SCR-016 at 320px: summary sections stack vertically; all headings visible
- [ ] SCR-008 at 375px: single-day view with prev/next buttons visible; no 7-column overflow
- [ ] All 63 Playwright parameterised responsive audit cases pass in CI
- [ ] Drawer animation uses `transform: translateX()` (not `left`/`right` position)

---

## Implementation Checklist

- [ ] Create `PageGrid.tsx` with `grid-cols-4 md:grid-cols-8 lg:grid-cols-12`; apply to all 21 page layouts
- [ ] Create `HamburgerMenu.tsx`: `<button>` with `aria-label` + `aria-expanded`; `block md:hidden`
- [ ] Create `NavDrawer.tsx`: `translateX` slide-over; backdrop overlay; close button; focus trap (`useFocusTrap` from us_051); resize listener auto-close; `will-change` toggle on transition
- [ ] Update `Sidebar.tsx`: add `hidden md:flex`
- [ ] Update `AuthenticatedLayout.tsx`: integrate `HamburgerMenu` + `NavDrawer`; persistent `<Sidebar>` for ≥ 768px
- [ ] Update 4 form screens: `grid-cols-1 md:grid-cols-2` field groups; `w-full md:w-auto` CTAs; `min-h-[44px]` all interactive elements
- [ ] Update `CalendarGrid.tsx`: single-day mobile view with prev/next navigation; full 7-column at ≥ 768px
- [ ] Update `QueueView.tsx`: card reflow for table rows at mobile; 44px touch targets on badges + buttons
- [ ] Update `View360.tsx`: responsive summary section grid; vertical stacking at mobile
- [ ] Create `responsive-audit.spec.ts`: 63 parameterised test cases (21 routes × 3 breakpoints); overflow, hamburger visibility, form stacking, touch target assertions
- [ ] Wire responsive audit into GitHub Actions CI `on: pull_request`
