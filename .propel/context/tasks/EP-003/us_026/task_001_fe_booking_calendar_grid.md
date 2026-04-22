---
title: "Task — FE Booking Calendar Grid & Slot Selection (SCR-008)"
task_id: task_001
story_id: us_026
epic: EP-003
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Booking Calendar Grid & Slot Selection (SCR-008)

## Requirement Reference

- **User Story**: us_026
- **Story Location**: .propel/context/tasks/EP-003/us_026/us_026.md
- **Acceptance Criteria**:
  - AC-1: `GET /api/slots?date_range=X` on SCR-008 mount; weekly grid with Available (green ✓), Unavailable (grey —), Waitlist (amber ★) states; persistent legend; icon + colour for colour-blind safety (UXR-101)
  - AC-2: Click/keyboard selects a slot (teal `aria-selected="true"`); sidebar updates; one selection at a time; `#btn-continue` activates
  - AC-4: Empty state with "No slots available this week" + "Join waitlist" CTA when all cells Unavailable; `#btn-continue` disabled
  - AC-5: Selected `slot_id` passed in React Router state to SCR-009; back-navigation restores selection

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | .propel/context/docs/figma_spec.md#SCR-008 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-008-booking-calendar.html |
| **Screen Spec** | SCR-008 Booking Calendar |
| **UXR Requirements** | UXR-101 (colour-blind-safe slot legend — icon + colour), UXR-201 (WCAG 2.2 AA: tabindex="0", aria-label, keyboard Enter), UXR-502 (skeleton loading on grid fetch > 300 ms), UXR-603 (full-page error state + retry CTA on API failure), UXR-604 (empty state with "Join waitlist" CTA when no available slots) |
| **Design Tokens** | Available=`#16A34A` (green), Unavailable=`#9CA3AF` (grey), Waitlist=`#F59E0B` (amber), Selected=`#0D9488` (teal), Brand navy=`#1E3A5F` |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18 |
| Language | TypeScript | 5 |
| Routing | React Router | v6 |
| Styling | TailwindCSS | 3.x |
| HTTP Client | fetch / Axios | — |
| Accessibility | WCAG 2.2 AA | — |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |

---

## Mobile References

| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |

---

## Task Overview

Build `BookingCalendarPage` (`/book` route, Patient-only). Renders a 7-day weekly slot grid using data from `GET /api/slots?date_range=X`. Each cell displays one of three visual states: Available, Unavailable, or Waitlist/Preferred. A slot can be selected (teal) and metadata is shown in a `BookingSidebar`. Keyboard navigation, skeleton loading, empty state, and error state are all required. Passes `{ slot_id, slotMeta }` via React Router state to SCR-009 on Continue.

---

## Dependent Tasks

- us_026 task_002 (BE slots API) — provides the `GET /api/slots` endpoint this component calls
- us_018 (JWT auth) — `useAuth()` must confirm `role === 'Patient'` before rendering; otherwise redirect to 403

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `src/pages/BookingCalendarPage.tsx` | CREATE | SCR-008 page component |
| `src/components/booking/SlotCell.tsx` | CREATE | Single slot cell — Available/Unavailable/Waitlist/Selected states |
| `src/components/booking/CalendarGrid.tsx` | CREATE | 7-column weekly grid rendering SlotCell instances |
| `src/components/booking/BookingSidebar.tsx` | CREATE | Displays selected slot details; `#btn-continue` activates on selection |
| `src/components/booking/SlotLegend.tsx` | CREATE | Persistent colour + icon legend panel (UXR-101) |
| `src/api/slotsApi.ts` | CREATE | `getSlots(dateRange: string): Promise<SlotResponse[]>` |
| `src/App.tsx` / router | MODIFY | Register `/book` route protected by `PatientGuard` |

---

## Implementation Checklist

- [ ] Create `BookingCalendarPage.tsx`; call `getSlots(currentWeekRange)` on mount; render `CalendarGrid` with skeleton (UXR-502) while loading; render full-page error state with "Retry" CTA on fetch failure (UXR-603)
- [ ] Implement `SlotCell.tsx` with three base states (Available / Unavailable / Waitlist) and Selected state; set `aria-label="{date} {time} — {state}"`, `aria-selected`, `tabindex="0"` on Available + Waitlist cells; grey cells `tabindex="-1"` (UXR-201)
- [ ] Wire keyboard `Enter` on `SlotCell` to the same selection handler as `onClick`; ensure single-selection — selecting a second Available slot deselects the first
- [ ] Implement `CalendarGrid.tsx` with 7-column layout (Mon–Sun) and time-row groupings; render empty-state panel with "No slots available this week" text and "Join waitlist" CTA when all cells Unavailable (UXR-604)
- [ ] Implement `BookingSidebar.tsx`; update in real time when a slot is selected (date, time, provider name, duration); `#btn-continue` is `disabled` until a slot is selected
- [ ] Implement `SlotLegend.tsx` with static colour swatches + icons (✓ green, — grey, ★ amber); persist visibly during scroll (UXR-101)
- [ ] On "Continue →" click, navigate to `/book/insurance` with `{ state: { slot_id, slotMeta } }` via `useNavigate`; when returning from SCR-009 via "← Change slot", restore the previously selected slot cell to Selected state from `location.state`
- [ ] Validate `date_range` max 28 days server-side is enforced; default SPA range = current week (7 days); do not expose raw query param to patient

---

## Build Commands

- `cd client && npm run build` — TypeScript compile
- `cd client && npm test` — component tests

---

## Implementation Validation Strategy

- [ ] All three slot states render with correct colour + icon (visual check against wireframe-SCR-008)
- [ ] Clicking Available → Selected state with teal border; sidebar updates; `#btn-continue` enabled
- [ ] Clicking second Available slot → first deselected
- [ ] Keyboard Enter on Available slot → same selection behaviour as click
- [ ] Unavailable cells are not keyboard-focusable (`tabindex="-1"`)
- [ ] Empty state shows "Join waitlist" CTA when no available slots
- [ ] Skeleton renders on load > 300 ms; error state + retry on API failure
- [ ] `slot_id` present in React Router state after navigating to SCR-009
