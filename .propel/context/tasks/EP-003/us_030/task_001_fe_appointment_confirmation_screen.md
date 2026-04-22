---
title: "Task — FE Appointment Confirmation Screen & No-Checkin Enforcement (SCR-010)"
task_id: task_001
story_id: us_030
epic: EP-003
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Appointment Confirmation Screen & No-Checkin Enforcement (SCR-010)

## Requirement Reference

- **User Story**: us_030
- **Story Location**: .propel/context/tasks/EP-003/us_030/us_030.md
- **Acceptance Criteria**:
  - AC-2: SPA navigates to SCR-010 immediately on HTTP 201 from `POST /api/appointments/book`; renders appointment date/time, provider name/specialty, appointment type, insurance provider, "Back to dashboard" link (SCR-004), "Add to calendar" button; status message "A PDF confirmation has been emailed to your address"; no "Check in" or "I have arrived" button/link/control anywhere on SCR-010 (FR-017)
  - AC-4: SPA router contains no routes matching `/checkin`, `/self-checkin`, or similar patterns; all unmatched routes render the SPA's 404 "Page not found" view (FR-017)
  - Edge Case: SCR-010 accessed via direct URL without `appointment_id` in React Router state → redirect to SCR-004 (Patient Dashboard) immediately (UXR-501)
  - Edge Case: "Add to calendar" failure → non-blocking toast notification (UXR-602); booking record unaffected

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | .propel/context/docs/figma_spec.md#SCR-010 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-010-confirmation.html |
| **Screen Spec** | SCR-010 Appointment Confirmation |
| **UXR Requirements** | UXR-201 (WCAG 2.2 AA: confirmation details in semantic HTML; "Back to dashboard" and "Add to calendar" keyboard-accessible), UXR-501 (SCR-010 renders immediately from React Router state — no loading spinner, no second API call), UXR-602 (calendar sync failure → non-blocking toast, auto-dismisses 5 s) |
| **Design Tokens** | Brand navy=`#1E3A5F`, teal accent=`#0D9488`, success green=`#16A34A`, Brand white background |

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

Build `AppointmentConfirmationPage` (`/book/confirmation`, Patient-only). On mount, check `location.state.appointment_id`; if absent, redirect to `/dashboard`. Renders confirmation card from state data only (no second API call). Displays a PDF email status message. Provides "Back to dashboard" and "Add to calendar" (with toast error handler for sync failure). Absolutely no check-in button, link, or form element on this screen. Register a catch-all `*` route in React Router that renders a `NotFoundPage`; confirm no `/checkin` or `/self-checkin` route exists in the router config.

---

## Dependent Tasks

- us_027 task_001 — navigates to `/book/confirmation` with `{ state: { appointment_id, appointmentMeta } }` on HTTP 201

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `src/pages/AppointmentConfirmationPage.tsx` | CREATE | SCR-010; state guard; confirmation card; no checkin controls |
| `src/pages/NotFoundPage.tsx` | CREATE | Generic 404 "Page not found" view for unmatched routes |
| `src/App.tsx` / router | MODIFY | Add `/book/confirmation` route; add catch-all `path="*"` route → `NotFoundPage`; confirm no `/checkin*` route exists |

---

## Implementation Checklist

- [ ] On `AppointmentConfirmationPage` mount, check `location.state?.appointment_id`; if absent, call `navigate("/dashboard", { replace: true })`; do not render confirmation or make API calls
- [ ] Render confirmation card from `location.state.appointmentMeta` (date, time, provider name, specialty, appointment type, insurance provider) — no second API call required (UXR-501); all content in semantic `<dl>` / `<section>` with WCAG-compliant headings (UXR-201)
- [ ] Render status message paragraph: "A PDF confirmation has been emailed to your address" with icon; message is informational only — no spinner or loading state
- [ ] Render "Back to dashboard" as `<a href="/dashboard">` (not a button) for semantic correctness; render "Add to calendar" as `<button>`; on calendar-sync failure catch the error, show `ToastNotification` "Calendar sync unavailable. Your appointment will still be confirmed." auto-dismissing after 5 s (UXR-602)
- [ ] Confirm zero check-in controls on this page: do not render any button, link, or form element with text or href containing "check", "checkin", "arrived", or "self-check" (FR-017 UI enforcement)
- [ ] Create `NotFoundPage.tsx` rendering a "Page not found" message and a link back to `/dashboard`
- [ ] In `App.tsx` router config: add `<Route path="*" element={<NotFoundPage />} />`; verify no `path="/checkin"`, `path="/self-checkin"`, or similar route is registered anywhere in the router tree (audit all `<Route>` and `useNavigate` calls)

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm test`

---

## Implementation Validation Strategy

- [ ] Navigate to `/book/confirmation` with valid state → confirmation card renders from state; no API call made
- [ ] Navigate to `/book/confirmation` without state → immediate redirect to `/dashboard`
- [ ] "Back to dashboard" link navigates to SCR-004
- [ ] "Add to calendar" failure → toast notification displayed; confirmation card remains intact
- [ ] Zero check-in-related buttons/links present on SCR-010 (DOM inspection)
- [ ] Navigate to `/checkin`, `/self-checkin`, `/book/checkin` → all render `NotFoundPage`
- [ ] All confirmation text readable in semantic HTML; keyboard navigation reaches both "Back to dashboard" and "Add to calendar" (UXR-201)
