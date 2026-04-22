---
title: "Task — FE WCAG 2.2 AA Accessibility: Colour Contrast, Keyboard Navigation, ARIA Labels, Form Associations & axe-core CI"
task_id: task_001
story_id: us_051
epic: EP-009
layer: Frontend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — FE WCAG 2.2 AA Accessibility: Colour Contrast, Keyboard Navigation, ARIA Labels, Form Associations & axe-core CI

## Requirement Reference

- **User Story**: us_051
- **Story Location**: .propel/context/tasks/EP-009/us_051/us_051.md
- **Acceptance Criteria**:
  - AC-1: All body text (≥ 18px regular / ≥ 14px bold) achieves contrast ratio ≥ 4.5:1; all UI components (form field borders, icon-only buttons, badges, progress indicators, nav links) achieve ≥ 3:1 against adjacent colours; `@axe-core/playwright` CI scan reports 0 WCAG 2.2 AA critical/serious contrast violations across all 21 screens; colour never sole conveyance — every colour-coded indicator (availability slots, no-show risk badges, extraction status, code confidence) also carries a text label or icon (UXR-201)
  - AC-2: Tab order on all screens follows visual reading order (top-to-bottom, left-to-right); no focus traps outside modals; every focused element shows `outline: 2px solid var(--color-teal-500); outline-offset: 2px` visible at 100%, 150%, 200% zoom; modal dialogs (session expiry, Code Finalise Confirm, walk-in override confirm, conflict acknowledgement) trap focus within bounds and return focus to triggering element on close; skip-to-main-content link is first focusable element in DOM on all authenticated screens (SCR-003–SCR-021) (UXR-202)
  - AC-3: All icon-only buttons carry descriptive `aria-label` (e.g., `aria-label="Mark Jane Smith as arrived"`, `aria-label="View source evidence for 99213"`, `aria-label="Upload clinical document"`); status badges carry `aria-label` (e.g., `aria-label="No-show risk: High"`); progress indicators carry `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-label`; no interactive element is a bare `<div onClick>` without ARIA role (UXR-203)
  - AC-4: Every `<input>`, `<select>`, `<textarea>` on form screens (SCR-002, SCR-006, SCR-007, SCR-009, SCR-013, SCR-020) has a visible `<label>` (via `for`/`id` or wrapping `<label>`) — no placeholder-only labelling; error messages referenced by field via `aria-describedby`; multiple errors per field contained in single referenced element; axe-core rules `form-field-multiple-labels`, `label`, `aria-describedby-id-exists` pass with 0 violations across all 6 form screens; password fields carry `autocomplete="current-password"` or `autocomplete="new-password"` (UXR-204)
  - AC-5: `@axe-core/playwright` scan across all 21 routes reports 0 WCAG 2.2 AA critical violations in CI; Playwright `page.keyboard.press('Tab')` keyboard smoke test on SCR-001, SCR-004, SCR-008, SCR-014, SCR-018 confirms: (a) all interactive elements receive focus in visual order; (b) no focus lost on dynamic content insertion; (c) modals trap and restore focus correctly; (d) skip-to-main-content is first Tab stop on authenticated screens (UXR-201, UXR-202, UXR-203, UXR-204)

- **Edge Cases**:
  - Edge Case: No-show risk badge (red/amber/green + arrow icon) → always shows text label "High"/"Medium"/"Low" alongside icon; colour is supplementary (WCAG 1.4.1 Use of Colour Level A satisfied)
  - Edge Case: Third-party calendar component without `role="grid"` → use `@react-aria/calendar` (provides WAI-ARIA Grid keyboard nav + roles); axe-core CI scan catches any role omission before merge
  - Edge Case: TailwindCSS purge removes `sr-only` class → `sr-only` and `focus:not-sr-only` added to `tailwind.config.ts` `safelist`; post-build CI step checks for `.sr-only` CSS rule presence; fails build if missing
  - Edge Case: Dynamic content update (extraction status badge `Processing` → `Extracted`) → dynamic badge elements wrapped in `aria-live="polite"` region; critical failures use `aria-live="assertive"`
  - Edge Case: New form screen added without label associations → axe-core CI scan covers all pages in Playwright site-crawl; `label` and `aria-describedby` failures block PR merge

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes — all 21 screens (SCR-001 through SCR-021) |
| **Figma URL** | .propel/context/docs/figma_spec.md — UXR-201, UXR-202, UXR-203, UXR-204 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-001-login.html through wireframe-SCR-021-audit-log.html |
| **Screen Spec** | SCR-001 through SCR-021 (all screens); form screens: SCR-002, SCR-006, SCR-007, SCR-009, SCR-013, SCR-020 |
| **UXR Requirements** | UXR-201, UXR-202, UXR-203, UXR-204 |
| **Design Tokens** | `--color-teal-500` (focus ring); contrast-verified token palette from `tailwind.config.ts` / `designsystem.md` |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React 18 + TypeScript 5 | — |
| Styling | TailwindCSS 3.x | — |
| Accessibility Testing | `@axe-core/playwright` | — |
| E2E Testing | Playwright | — |
| Calendar Accessibility | `@react-aria/calendar` | — |
| Routing | React Router v6 | — |

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
| **Mobile Impact** | Yes — focus ring visible at all zoom levels; 44px minimum touch targets (enforced here, shared with us_052) |
| **Platform Target** | Web (responsive) |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Apply WCAG 2.2 AA accessibility controls across all 21 screens. Configure TailwindCSS focus ring styles globally (`outline-2 outline-teal-500 focus-visible:outline`). Add skip-to-main-content links on all authenticated layouts. Wire `aria-label` on every icon-only button, status badge, and progress indicator. Associate all form field `<label>` elements via `for`/`id` and link error messages via `aria-describedby`. Wrap dynamic status badges in `aria-live` regions. Implement focus trapping in all 4 modal dialogs. Add `sr-only` to `tailwind.config.ts` safelist. Integrate `@axe-core/playwright` into the Playwright CI suite to scan all 21 routes and block PRs on any WCAG AA critical violation.

---

## Dependent Tasks

- US_001 (EP-TECH) — React 18 + TailwindCSS SPA scaffold; `tailwind.config.ts` must exist
- us_053 task_001 (EP-009) — Design token system in `tailwind.config.ts` must be populated (contrast-verified tokens) before colour contrast assertions can pass; us_051 and us_053 can be co-developed in same sprint

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `client/src/components/layout/AuthenticatedLayout.tsx` | MODIFY | Add skip-to-main-content link as first focusable child; ensure `<main id="main-content">` target exists |
| `client/src/components/shared/StatusBadge.tsx` | MODIFY | Add `aria-label` prop with full state description; wrap in `aria-live="polite"` (or `"assertive"` for failures) |
| `client/src/components/shared/ProgressBar.tsx` | MODIFY | Add `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` |
| `client/src/components/shared/IconButton.tsx` | MODIFY OR CREATE | Enforce `aria-label` prop as required (TypeScript); default disabled to prevent bare `<div onClick>` |
| `client/src/components/modals/*.tsx` | MODIFY | Add focus trap logic (FocusTrap from `focus-trap-react` or custom hook); return focus to trigger element on close |
| `client/src/components/forms/*.tsx` | MODIFY | Associate `<label>` via `htmlFor` + field `id`; add `aria-describedby={errorId}` on fields; add `autocomplete` attributes to password fields |
| `client/tailwind.config.ts` | MODIFY | Add `sr-only` and `focus:not-sr-only` to `safelist`; configure focus ring: `outline: 2px solid var(--color-teal-500); outline-offset: 2px` in `extend.outline` |
| `client/.eslintrc.ts` | MODIFY | Add `jsx-a11y` plugin rules: `aria-label`, `no-interactive-element-to-noninteractive-role`, `label-has-associated-control` |
| `client/tests/accessibility/a11y-audit.spec.ts` | CREATE | `@axe-core/playwright` scan all 21 routes; assert 0 critical/serious violations; keyboard Tab chain test on 5 routes |
| `client/tests/accessibility/modal-focus-trap.spec.ts` | CREATE | Open/close each of 4 modals; assert focus trap and focus restoration |

---

## Implementation Plan

1. Configure global focus ring in `tailwind.config.ts` and `index.css`: add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500` to the base layer via `@layer base { *, *::before, *::after { @apply focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500; } }`; remove any `outline: none` or `outline: 0` from existing component CSS that would suppress focus rings

2. Add skip-to-main-content link to `AuthenticatedLayout.tsx`: render `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-2 focus:bg-navy-700 focus:text-white">Skip to main content</a>` as the absolute first child before `<TopBar>`; ensure `<main id="main-content">` is the page content wrapper

3. Add `sr-only` and `focus:not-sr-only` to `tailwind.config.ts` `safelist` array; add post-build CI step in GitHub Actions to `grep` for `.sr-only` in the Vite dist CSS bundle and fail on absence

4. Update `StatusBadge` component: add required `aria-label` string prop (TypeScript required); wrap badge `<span>` in `role="status"` with `aria-live="polite"` (or pass `aria-live="assertive"` prop for failure states); update all usage sites: no-show risk badge, extraction status badge, code suggestion status badge, slot availability badge

5. Update `ProgressBar` component: add `role="progressbar"`, `aria-valuenow={value}`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-label` prop (required string); update extraction progress bar usage in SCR-016/document views

6. Update all icon-only buttons: enforce `aria-label` as required TypeScript prop in `IconButton` component interface; update all usage sites with descriptive labels: arrived button (`aria-label="Mark {name} as arrived"`), source evidence button (`aria-label="View source evidence for {code}"`), upload button (`aria-label="Upload clinical document"`), queue drag handles (`aria-label="Drag to reorder {name}"`); prohibit bare `<div onClick>` — use `<button>` elements only

7. Implement focus trapping in all 4 modal dialogs: install `focus-trap-react` or create `useFocusTrap` hook using `focus-trap` library; apply to: session expiry warning modal, Code Finalise Confirm modal, walk-in override confirm modal, conflict acknowledgement modal; ensure `returnFocusOnDeactivate: true` to restore focus to triggering element on close

8. Update all 6 form-screen components (SCR-002, SCR-006, SCR-007, SCR-009, SCR-013, SCR-020):
   - Replace any `placeholder`-only labels with visible `<label htmlFor={id}>` elements
   - Add unique `id` to each form field; set matching `htmlFor` on label
   - Add `aria-describedby={`${fieldId}-error`}` to each field; set `id={`${fieldId}-error`}` on error message container
   - Add `autocomplete="new-password"` on registration password, `autocomplete="current-password"` on login password
   - Ensure multiple error conditions for one field are all inside the single `aria-describedby` target element

9. Install `@axe-core/playwright` (`npm install --save-dev @axe-core/playwright`); create `a11y-audit.spec.ts`: iterate all 21 routes; for each: `await checkA11y(page, undefined, { runOnly: { type: 'tag', values: ['wcag2aa'] } })`; assert 0 `critical` or `serious` violations; add to GitHub Actions CI workflow `on: [pull_request]` trigger

10. Create Playwright keyboard navigation test in `a11y-audit.spec.ts` or separate file: for each of the 5 target screens (SCR-001, SCR-004, SCR-008, SCR-014, SCR-018), Tab through all interactive elements; assert focus order matches visual DOM order; confirm skip-to-main-content is first Tab; confirm modal focus trap and restore on each modal screen

---

## Current Project State

```
client/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── AuthenticatedLayout.tsx    ← MODIFY (skip-to-content link)
│   │   ├── shared/
│   │   │   ├── StatusBadge.tsx            ← MODIFY (aria-label, aria-live)
│   │   │   ├── ProgressBar.tsx            ← MODIFY (role=progressbar attrs)
│   │   │   └── IconButton.tsx             ← MODIFY/CREATE (required aria-label)
│   │   ├── modals/                        ← MODIFY (focus trap in all 4 modals)
│   │   └── forms/                         ← MODIFY (label, aria-describedby)
│   └── index.css                          ← MODIFY (global focus ring base layer)
├── tailwind.config.ts                     ← MODIFY (safelist: sr-only)
├── .eslintrc.ts                           ← MODIFY (jsx-a11y rules)
└── tests/accessibility/
    ├── a11y-audit.spec.ts                 ← CREATE (axe-core 21-route scan)
    └── modal-focus-trap.spec.ts           ← CREATE (focus trap/restore assertions)
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `client/src/index.css` | Global focus ring via `@layer base`; remove any `outline: none` suppressions |
| MODIFY | `client/src/components/layout/AuthenticatedLayout.tsx` | Skip-to-main-content link (first focusable child); `<main id="main-content">` wrapper |
| MODIFY | `client/src/components/shared/StatusBadge.tsx` | Required `aria-label` prop; `aria-live` region wrapper |
| MODIFY | `client/src/components/shared/ProgressBar.tsx` | `role="progressbar"`; `aria-valuenow/min/max`; required `aria-label` |
| MODIFY | `client/src/components/shared/IconButton.tsx` | Required `aria-label` TypeScript prop; `<button>` element enforced |
| MODIFY | `client/src/components/modals/*.tsx` | `focus-trap-react` or `useFocusTrap` hook; `returnFocusOnDeactivate: true` |
| MODIFY | `client/src/features/*/forms/*.tsx` | `<label htmlFor>` + field `id`; `aria-describedby` error wiring; `autocomplete` attrs |
| MODIFY | `client/tailwind.config.ts` | `safelist: ['sr-only', 'focus:not-sr-only']` |
| MODIFY | `client/.eslintrc.ts` | `eslint-plugin-jsx-a11y` rules: `aria-label`, `label-has-associated-control`, `no-interactive-element-to-noninteractive-role` |
| CREATE | `client/tests/accessibility/a11y-audit.spec.ts` | `@axe-core/playwright` 21-route scan + keyboard Tab smoke tests on 5 routes |
| CREATE | `client/tests/accessibility/modal-focus-trap.spec.ts` | 4 modal focus trap + focus restoration assertions |

---

## External References

- [WCAG 2.2 AA — Success Criteria](https://www.w3.org/TR/WCAG22/)
- [axe-core/playwright — Playwright accessibility testing](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
- [React ARIA — @react-aria/calendar WAI-ARIA grid](https://react-spectrum.adobe.com/react-aria/Calendar.html)
- [focus-trap-react — React focus trap](https://github.com/focus-trap/focus-trap-react)
- [WAI-ARIA Authoring Practices — Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm run lint`
- `cd client && npx playwright test tests/accessibility/`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `@axe-core/playwright` scan: 0 WCAG 2.2 AA critical violations on all 21 routes
- [ ] Focus ring visible at 100%, 150%, 200% zoom on all interactive elements (manual spot check + Playwright screenshot)
- [ ] Skip-to-main-content link: first Tab stop on all authenticated screens (SCR-003–SCR-021)
- [ ] All icon-only buttons have non-empty `aria-label`; TypeScript build fails if `aria-label` prop omitted
- [ ] `StatusBadge` with `aria-live="assertive"` on failure state — announced by screen reader without focus movement
- [ ] `ProgressBar` has `role="progressbar"` + all 3 `aria-value*` attributes
- [ ] Session expiry modal: Tab stays within modal bounds; Escape/close button returns focus to triggering element
- [ ] Code Finalise Confirm modal: same focus trap + restore behaviour
- [ ] All form fields on SCR-002, SCR-006, SCR-007, SCR-009, SCR-013, SCR-020 have associated `<label>` elements
- [ ] Validation error shown → `aria-describedby` targets error container; axe-core `label` rule passes
- [ ] `tailwind.config.ts` `safelist` contains `sr-only`; post-build `grep` for `.sr-only` in dist CSS passes
- [ ] ESLint `jsx-a11y/label-has-associated-control` rule: 0 violations across all `.tsx` files
- [ ] No `<div onClick>` without `role` attribute in any component (ESLint `interactive-supports-focus` rule)
- [ ] Password fields carry correct `autocomplete` attribute on SCR-001 (login) and SCR-002 (register)

---

## Implementation Checklist

- [ ] Add global focus ring to `index.css` via `@layer base`; remove any `outline: none` / `outline: 0` in component styles
- [ ] Add skip-to-main-content link to `AuthenticatedLayout.tsx` (sr-only, reveals on focus); add `<main id="main-content">` wrapper
- [ ] Add `sr-only` + `focus:not-sr-only` to `tailwind.config.ts` safelist
- [ ] Update `StatusBadge`: required `aria-label` prop; `aria-live` wrapper (polite default, assertive for failures); update all 4+ usage sites with descriptive labels
- [ ] Update `ProgressBar`: add `role="progressbar"`, `aria-valuenow/min/max`, required `aria-label`
- [ ] Update all icon-only buttons: required `aria-label` TypeScript prop; replace any `<div onClick>` with `<button>`; update all usage site labels
- [ ] Implement focus trap in 4 modals (session expiry, Code Finalise Confirm, walk-in override, conflict acknowledgement); return focus to trigger on close
- [ ] Update 6 form screens: visible `<label htmlFor>` for every field; `aria-describedby` error wiring; `autocomplete` on password fields
- [ ] Add `eslint-plugin-jsx-a11y` to `.eslintrc.ts`; configure `aria-label`, `label-has-associated-control`, `no-interactive-element-to-noninteractive-role` rules
- [ ] Install `@axe-core/playwright`; create `a11y-audit.spec.ts` scanning all 21 routes for WCAG AA violations
- [ ] Create keyboard Tab smoke test for 5 target routes; assert focus order, skip link, modal trap/restore
- [ ] Wire `axe-core` Playwright tests into GitHub Actions CI `on: pull_request` — fails PR on any critical violation
