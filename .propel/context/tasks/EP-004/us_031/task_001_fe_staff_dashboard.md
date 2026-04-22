---
title: "Task — FE Staff Home Dashboard — Metrics, Queue Preview & Walk-In Entry (SCR-011)"
task_id: task_001
story_id: us_031
epic: EP-004
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Staff Home Dashboard — Metrics, Queue Preview & Walk-In Entry (SCR-011)

## Requirement Reference

- **User Story**: us_031
- **Story Location**: .propel/context/tasks/EP-004/us_031/us_031.md
- **Acceptance Criteria**:
  - AC-1: Post-login redirect to `/staff` for `role=Staff`; other roles receive HTTP 403 from any `/api/queue/*` call; SPA route guard redirects unauthenticated `/staff` to `/login`
  - AC-2: `GET /api/queue/today` single call populates four metric cards: total today, arrived, still scheduled, High-risk count; skeleton loading while in-flight (UXR-501)
  - AC-3: Queue preview shows first 5 by `slot_time ASC`; patient name (link → SCR-016), time, provider, status badge, `RiskBadge` (↓/—/↑ + icon + text, `aria-label`); "View full queue →" link to SCR-014 (UXR-102)
  - AC-4: `#btn-add-walkin` navigates to SCR-013 without page reload
  - AC-5: "↻ Refresh" re-calls `GET /api/queue/today`; updates metric cards + queue preview in place; visual indicator during in-flight; `aria-live="polite"` on queue preview container

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | .propel/context/docs/figma_spec.md#SCR-011 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-011-staff-dashboard.html |
| **Screen Spec** | SCR-011 Staff Home Dashboard |
| **UXR Requirements** | UXR-102 (RiskBadge: icon ↓/—/↑ + text Low/Medium/High + colour green/amber/red; `aria-label="[level] no-show risk"`; never colour-alone), UXR-201 (WCAG 2.2 AA: metric cards and queue rows keyboard-accessible; risk badge `aria-label`), UXR-501 (skeleton on metric cards and queue preview while `GET /api/queue/today` in-flight) |
| **Design Tokens** | Brand navy=`#1E3A5F`, teal accent=`#0D9488`, risk-Low=`#16A34A`, risk-Medium=`#F59E0B`, risk-High=`#EF4444`, grey=`#9CA3AF` |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18 |
| Language | TypeScript | 5 |
| Routing | React Router | v6 |
| Styling | TailwindCSS | 3.x |
| Accessibility | WCAG 2.2 AA | — |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |

---

## Mobile References

| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |

---

## Task Overview

Build `StaffDashboardPage` (`/staff` route). On mount, confirm `role === 'Staff'` from `useAuth()`; if not, redirect to role-appropriate home. Call `GET /api/queue/today` once; render four `MetricCard` components and a queue preview list of up to 5 rows each with a `RiskBadge`. Include `#btn-add-walkin` navigating to `/staff/walkin/search` and a "↻ Refresh" button that re-fetches and updates in-place with `aria-live="polite"`.

---

## Dependent Tasks

- us_031 task_002 (BE queue API) — provides `GET /api/queue/today` response payload
- us_035 task_001 (FE RiskBadge component) — `RiskBadge` shared between SCR-011 and SCR-014; implement in us_035 task_001 or extract as shared component here and reference there

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `src/pages/StaffDashboardPage.tsx` | CREATE | SCR-011; Staff route guard; single API call; refresh |
| `src/components/staff/MetricCard.tsx` | CREATE | Reusable card: label + count + optional icon |
| `src/components/staff/QueuePreviewRow.tsx` | CREATE | Single queue preview row: name link, time, provider, status badge, RiskBadge |
| `src/components/staff/RiskBadge.tsx` | CREATE | Shared: icon (↓/—/↑) + text (Low/Medium/High) + colour; NULL state = grey "—"; `aria-label` |
| `src/api/queueApi.ts` | CREATE | `getQueueToday(): Promise<QueueTodayResponse>` |
| `src/App.tsx` / router | MODIFY | Register `/staff` route protected by `StaffGuard` |

---

## Implementation Checklist

- [ ] On `StaffDashboardPage` mount, verify `auth.role === 'Staff'`; redirect unauthenticated users to `/login` (store intended path in state); render skeleton (UXR-501) while `GET /api/queue/today` is in-flight; on 401 response trigger session expiry modal (us_019)
- [ ] Render four `MetricCard` components from single response: total appointments today, patients arrived, patients still scheduled, High-risk count; source all values from `GET /api/queue/today` payload (no extra API calls)
- [ ] Render queue preview section (`aria-live="polite"`) showing first 5 appointments by `slot_time ASC`; each `QueuePreviewRow` shows: patient name as `<Link to="/staff/patient/[id]/360">`, time, provider name, status badge, `RiskBadge`
- [ ] Implement `RiskBadge` with four states: Low (green ↓), Medium (amber —), High (red ↑), NULL (grey "—" `aria-label="Risk not yet assessed"`); icon + text always visible — never colour alone (UXR-102); `aria-label="[level] no-show risk"` on badge element
- [ ] Implement `#btn-add-walkin` primary button calling `navigate("/staff/walkin/search")` without page reload; "View full queue →" link as `<Link to="/staff/queue">`
- [ ] Implement "↻ Refresh" button: re-call `getQueueToday()`; show inline spinner on button during in-flight; update metric cards and queue preview in-place; `aria-live="polite"` container notifies screen readers (UXR-201)
- [ ] Empty state: when `GET /api/queue/today` returns empty array, show "No appointments scheduled today — add a walk-in to get started" message with `#btn-add-walkin` CTA
- [ ] Handle 401 from `GET /api/queue/today` by surfacing session expiry modal (us_019); do not display stale data after expiry

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm test`

---

## Implementation Validation Strategy

- [ ] Patient/Admin JWT → `GET /api/queue/today` returns HTTP 403; SPA never reaches `/staff`
- [ ] Unauthenticated user navigates to `/staff` → redirect to `/login` with state
- [ ] All four metric cards populated from single API call; no extra requests in Network tab
- [ ] Queue preview shows ≤ 5 rows; `RiskBadge` renders correctly in all 4 states
- [ ] `#btn-add-walkin` navigates to `/staff/walkin/search` without page reload
- [ ] "↻ Refresh" refetches and updates in-place; `aria-live` region announces update
- [ ] Empty queue → empty state message with `#btn-add-walkin`
