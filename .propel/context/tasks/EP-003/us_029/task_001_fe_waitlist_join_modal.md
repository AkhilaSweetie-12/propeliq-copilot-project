---
title: "Task — FE Waitlist Join Form (SCR-008 Empty State Extension)"
task_id: task_001
story_id: us_029
epic: EP-003
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Waitlist Join Form (SCR-008 Empty State Extension)

## Requirement Reference

- **User Story**: us_029
- **Story Location**: .propel/context/tasks/EP-003/us_029/us_029.md
- **Acceptance Criteria**:
  - AC-1: From SCR-008 empty state, patient clicks "Join waitlist" → modal / inline panel appears; optional preferred time window (morning / afternoon / any); on submit calls `POST /api/waitlist`; API returns `{ waitlist_position }` with HTTP 201
  - AC-2: After HTTP 201, display confirmation "You are #N in the waitlist. We'll notify you when a slot opens." with `aria-live="polite"`; HTTP 409 → inline "You are already on the waitlist"
  - Edge Case: Duplicate join attempt → API returns HTTP 409; SPA surfaces as inline message (not a navigation away)

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | .propel/context/docs/figma_spec.md#FL-003 |
| **Wireframe Status** | PENDING — no standalone wireframe; implement as modal triggered from "Join waitlist" CTA in SCR-008 empty state |
| **Wireframe Type** | N/A |
| **Wireframe Path/URL** | N/A |
| **Screen Spec** | SCR-008 empty state extension (FL-003 path 2a: No slots available → Empty state → Join waitlist CTA) |
| **UXR Requirements** | UXR-201 (WCAG 2.2 AA: modal keyboard-accessible, focus trapped inside modal, Escape key dismisses), UXR-501 (queue position confirmation message displayed immediately after HTTP 201 — no extra API call), UXR-604 (empty state with "Join waitlist" CTA already rendered by us_026 task_001) |
| **Design Tokens** | Brand navy=`#1E3A5F`, teal accent=`#0D9488`, error=`#EF4444` |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18 |
| Language | TypeScript | 5 |
| Forms | React Hook Form | v7 |
| Routing | React Router | v6 |
| Styling | TailwindCSS | 3.x |
| Accessibility | WCAG 2.2 AA (focus trap) | — |

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

Extend `BookingCalendarPage` to include a `WaitlistJoinModal` component, triggered from the "Join waitlist" CTA rendered by the empty state (us_026 task_001). The modal contains an optional preferred-time-window select (Morning / Afternoon / Any). On submission, calls `POST /api/waitlist`. HTTP 201 → inline confirmation with queue position. HTTP 409 → inline "already on waitlist" error. Modal is keyboard-accessible with focus trap and Escape-to-dismiss.

---

## Dependent Tasks

- us_026 task_001 — SCR-008 `BookingCalendarPage` and empty state must exist; this task adds the modal component and "Join waitlist" click handler to that page
- us_029 task_002 (BE waitlist API) — provides `POST /api/waitlist` endpoint

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `src/components/booking/WaitlistJoinModal.tsx` | CREATE | Modal dialog: time-window select, submit button, confirmation / error message |
| `src/pages/BookingCalendarPage.tsx` | MODIFY | Add `isWaitlistModalOpen` state; wire "Join waitlist" CTA to open modal |
| `src/api/waitlistApi.ts` | CREATE | `joinWaitlist(payload): Promise<WaitlistJoinResponse>` |

---

## Implementation Checklist

- [ ] Create `WaitlistJoinModal.tsx` as a `role="dialog"` `aria-modal="true"` element; trap keyboard focus inside modal (Tab cycles within); `Escape` key and "Cancel" button close modal (UXR-201)
- [ ] Add optional `#preferred-time-window` `<select>` with options: "Morning", "Afternoon", "Any" (default); no field is required — patient may submit with "Any" selected
- [ ] On modal form submit, call `joinWaitlist({ patient_id, preferred_time_window? })` with loading state on submit button
- [ ] On HTTP 201: render confirmation message "You are #N in the waitlist. We'll notify you when a slot opens." with `aria-live="polite"` within the modal; queue position `N` from response body (UXR-501)
- [ ] On HTTP 409: render inline error "You are already on the waitlist" without dismissing the modal; do not re-submit
- [ ] Wire "Join waitlist" CTA in `BookingCalendarPage` empty state to open `WaitlistJoinModal`; modal open state managed via `useState` in `BookingCalendarPage`
- [ ] Ensure modal renders over the slot grid at correct z-index; semi-transparent backdrop; modal is dismissed by Escape or "Cancel" without any API side effects

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm test`

---

## Implementation Validation Strategy

- [ ] "Join waitlist" CTA visible only in empty state (no available slots)
- [ ] Modal opens on CTA click; focus moves to modal; Tab cycles within; Escape dismisses
- [ ] Submit → HTTP 201 → confirmation message with queue number rendered inside modal
- [ ] Submit → HTTP 409 → inline "already on waitlist" error; modal stays open
- [ ] Submit button shows loading state while API in-flight
- [ ] "Cancel" dismisses modal without API call
