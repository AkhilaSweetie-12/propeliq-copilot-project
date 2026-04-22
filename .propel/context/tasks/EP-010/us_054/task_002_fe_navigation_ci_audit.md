---
title: "Task — FE Navigation CI: 3-Click Playwright Click-Path Audit, Role-Isolation Assertions & Navigation Audit Config"
task_id: task_002
story_id: us_054
epic: EP-010
layer: Frontend
status: Not Started
date: 2026-04-22
---

# Task - task_002 — FE Navigation CI: 3-Click Playwright Click-Path Audit, Role-Isolation Assertions & Navigation Audit Config

## Requirement Reference

- **User Story**: us_054
- **Story Location**: .propel/context/tasks/EP-010/us_054/us_054.md
- **Acceptance Criteria**:
  - AC-1: Every primary feature reachable within 3 clicks from role dashboard for 9 persona task flows: Patient — (a) Book Appointment: Dashboard → SCR-008 → SCR-009 [2 clicks]; (b) Complete Intake: Dashboard → SCR-005 → SCR-006/SCR-007 [2 clicks]; (c) Upload Document: Dashboard → SCR-015 [1 click]; Staff — (a) View Queue: Dashboard → SCR-014 [1 click]; (b) View Patient 360°: Dashboard → SCR-014 → SCR-016 [2 clicks]; (c) Add Walk-In: Dashboard → SCR-013 → SCR-012 [2 clicks]; Admin — (a) View Users: already at SCR-019 [0 clicks]; (b) View User Detail: SCR-019 → SCR-020 [1 click]; (c) View Audit Log: SCR-019 → SCR-021 [1 click]; Playwright click-path script navigates each flow and asserts destination within 3 clicks; fails CI if any flow exceeds 3 clicks (UXR-001)
  - AC-5: Playwright navigation audit in CI: (a) all 9 click-path flows pass ≤ 3 clicks; (b) breadcrumbs present on all depth ≥ 2 screens, absent on depth-0/1 screens; (c) Patient-authenticated session: 0 Staff/Admin nav items in DOM; Staff-authenticated session: 0 Patient/Admin nav items in DOM; (d) direct `page.goto('/patients/123/coding')` → correct nav item active (UXR-001, UXR-002, UXR-003)
  - Navigation audit config: `.propel/config/navigation-audit.json` — extensible path config; adding a new screen requires updating the config; CI gate fails if any configured path exceeds 3 clicks (enforces 3-click constraint continuously)

- **Edge Cases**:
  - Edge Case: New feature added in future sprint not reachable within 3 clicks → navigation audit config in `.propel/config/navigation-audit.json` must be updated; CI gate fails if path > 3 clicks; developer must add dashboard shortcut before PR merge
  - Edge Case: Active nav item wrong after deep-link navigation → Playwright `page.goto()` test (not click-through) asserts correct nav item active after direct URL navigation

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes — CI gates on navigation architecture |
| **Figma URL** | N/A |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | Wireframe HTML files include navigation map comments showing click-path targets |
| **Screen Spec** | All SCR-001–SCR-021 (navigation audit scope) |
| **UXR Requirements** | UXR-001, UXR-002, UXR-003 |
| **Design Tokens** | N/A (CI/test task) |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Testing | Playwright | — |
| CI | GitHub Actions | — |
| Config | JSON (`.propel/config/navigation-audit.json`) | — |

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
| **Mobile Impact** | No (CI/audit task) |
| **Platform Target** | N/A |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Create the `.propel/config/navigation-audit.json` config file defining all 9 persona click-path flows (and extensible for future screens). Implement the Playwright `navigation-audit.spec.ts` test: for each flow, authenticate as the correct persona, click through the path, and assert the destination screen is reached in ≤ 3 clicks. Add role-isolation DOM assertions (no forbidden nav items). Add breadcrumb presence/absence assertions for depth-0/1 vs depth-≥-2 screens. Add deep-link active-nav-item assertion. Wire all into GitHub Actions CI.

---

## Dependent Tasks

- us_054 task_001 (EP-010) — `<NavigationItems>`, `<RequireRole>`, `<Breadcrumb>` must be implemented before these CI tests can pass

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `.propel/config/navigation-audit.json` | CREATE | 9 persona task flows; extensible; click count per step |
| `client/tests/navigation/navigation-audit.spec.ts` | CREATE | 9 click-path Playwright tests; role isolation DOM assertions; breadcrumb presence assertions; deep-link active item test |
| `.github/workflows/navigation-ci.yml` | CREATE OR MODIFY | Wire navigation audit to CI on `pull_request` targeting `main`; fail on any navigation assertion failure |

---

## Implementation Plan

1. Create `.propel/config/navigation-audit.json`:
   ```json
   {
     "flows": [
       {
         "persona": "Patient",
         "task": "Book Appointment",
         "startRoute": "/dashboard",
         "steps": [
           { "action": "click", "selector": "a[href='/booking']", "expectRoute": "/booking" },
           { "action": "click", "selector": "[data-testid='booking-continue']", "expectRoute": "/booking/insurance" }
         ],
         "maxClicks": 3
       },
       {
         "persona": "Patient",
         "task": "Complete Intake",
         "startRoute": "/dashboard",
         "steps": [
           { "action": "click", "selector": "a[href='/intake']", "expectRoute": "/intake" },
           { "action": "click", "selector": "[data-testid='intake-ai-option']", "expectRoute": "/intake/chat" }
         ],
         "maxClicks": 3
       },
       {
         "persona": "Patient",
         "task": "Upload Document",
         "startRoute": "/dashboard",
         "steps": [
           { "action": "click", "selector": "a[href='/documents']", "expectRoute": "/documents" }
         ],
         "maxClicks": 3
       },
       {
         "persona": "Staff",
         "task": "View Queue",
         "startRoute": "/staff/dashboard",
         "steps": [
           { "action": "click", "selector": "a[href='/queue']", "expectRoute": "/queue" }
         ],
         "maxClicks": 3
       },
       {
         "persona": "Staff",
         "task": "View Patient 360",
         "startRoute": "/staff/dashboard",
         "steps": [
           { "action": "click", "selector": "a[href='/queue']", "expectRoute": "/queue" },
           { "action": "click", "selector": "[data-testid='queue-row-0'] a", "expectRoute": "/patients/" }
         ],
         "maxClicks": 3
       },
       {
         "persona": "Staff",
         "task": "Add Walk-In",
         "startRoute": "/staff/dashboard",
         "steps": [
           { "action": "click", "selector": "a[href='/patients/search']", "expectRoute": "/patients/search" },
           { "action": "click", "selector": "[data-testid='walkin-book-button']", "expectRoute": "/walk-in" }
         ],
         "maxClicks": 3
       },
       {
         "persona": "Admin",
         "task": "View Users",
         "startRoute": "/admin/users",
         "steps": [],
         "maxClicks": 0
       },
       {
         "persona": "Admin",
         "task": "View User Detail",
         "startRoute": "/admin/users",
         "steps": [
           { "action": "click", "selector": "[data-testid='user-row-0'] a", "expectRoute": "/admin/users/" }
         ],
         "maxClicks": 3
       },
       {
         "persona": "Admin",
         "task": "View Audit Log",
         "startRoute": "/admin/users",
         "steps": [
           { "action": "click", "selector": "a[href='/admin/audit']", "expectRoute": "/admin/audit" }
         ],
         "maxClicks": 3
       }
     ]
   }
   ```

2. Create `navigation-audit.spec.ts`:
   - Import `navigationAuditConfig` from `.propel/config/navigation-audit.json`
   - For each `flow`:
     - `test(`${flow.persona} — ${flow.task} reachable in ≤ ${flow.maxClicks} clicks`, async ({ page }) => { ... })`
     - Authenticate as `flow.persona` (use test fixture with pre-seeded JWT for each role)
     - Navigate to `flow.startRoute`
     - For each step in `flow.steps`: `await page.click(step.selector)`; assert `page.url()` contains `step.expectRoute`
     - Assert `flow.steps.length <= flow.maxClicks`

3. Add role isolation assertions in the same spec file (separate `describe` block):
   - Patient-authenticated session: `expect(page.locator('a[href="/queue"]')).not.toBeVisible()`; assert 0 Staff/Admin nav items in DOM (check `locator('[aria-label="Queue"]')` and `locator('[aria-label="Users"]')` have count 0)
   - Staff-authenticated session: assert 0 Patient-only items ("Book Appointment", "Intake" nav links absent)
   - Admin session: assert 0 Patient or Staff items

4. Add breadcrumb assertions:
   - Depth-0/1 screens (SCR-001, SCR-002, SCR-004, SCR-011, SCR-019): `expect(page.locator('nav[aria-label="Breadcrumb"]')).not.toBeVisible()`
   - Depth-≥-2 screens (SCR-016, SCR-018, SCR-021): `expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible()` + assert ancestor `<a>` links present + `<span aria-current="page">` present

5. Add deep-link active nav test:
   - `await page.goto('/patients/123/coding')` (Staff session)
   - `expect(page.locator('[aria-current="page"][href="/queue"]')).toBeVisible()` (or parent path match)

6. Wire to GitHub Actions: add `navigation-audit` job to existing CI workflow (or create `navigation-ci.yml`); run after `npm run build` + start dev server; fail PR if any test fails

---

## Current Project State

```
.propel/config/
└── navigation-audit.json              ← CREATE

client/tests/navigation/
└── navigation-audit.spec.ts           ← CREATE

.github/workflows/
└── (existing CI yml or new file)      ← MODIFY/CREATE
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `.propel/config/navigation-audit.json` | 9 persona task flows; extensible config for future screens |
| CREATE | `client/tests/navigation/navigation-audit.spec.ts` | Click-path tests; role isolation; breadcrumb presence; deep-link active item |
| MODIFY | `.github/workflows/ci.yml` or `navigation-ci.yml` | Wire navigation audit Playwright tests to CI `on: pull_request` |

---

## Build Commands

- `cd client && npx playwright test tests/navigation/navigation-audit.spec.ts`

---

## Implementation Validation Strategy

- [ ] All 9 click-path flows reach destination in ≤ 3 clicks (Playwright assertions pass)
- [ ] Patient session: 0 Staff/Admin nav items in DOM on any authenticated screen
- [ ] Staff session: 0 Patient-only nav items ("Book Appointment", "Intake") in DOM
- [ ] Admin session: 0 Patient or Staff nav items in DOM
- [ ] `nav[aria-label="Breadcrumb"]` absent on SCR-001, SCR-004, SCR-011, SCR-019
- [ ] `nav[aria-label="Breadcrumb"]` present on SCR-016, SCR-018, SCR-021
- [ ] Direct `page.goto('/patients/123/coding')` → "Queue" nav item has `aria-current="page"`
- [ ] CI workflow fails on PR if any navigation audit test fails
- [ ] Adding new path to `navigation-audit.json` with `maxClicks: 4` → CI fails (enforcing the 3-click constraint)

---

## Implementation Checklist

- [ ] Create `.propel/config/navigation-audit.json` with all 9 persona task flows
- [ ] Create `navigation-audit.spec.ts`: iterate config; authenticate per persona; click-path traverse; assert destination in ≤ maxClicks
- [ ] Add role isolation assertions: 3 roles × forbidden items absent from DOM
- [ ] Add breadcrumb presence/absence assertions for depth-0/1 and depth-≥-2 routes
- [ ] Add deep-link active item assertion (`page.goto` then `aria-current="page"` check)
- [ ] Wire Playwright navigation audit tests to GitHub Actions CI `on: pull_request`
