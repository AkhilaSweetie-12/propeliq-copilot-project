---
title: "Task — FE Walk-In Booking Panel, Slot Mini-Grid & Override Dialog (SCR-012)"
task_id: task_001
story_id: us_033
epic: EP-004
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Walk-In Booking Panel, Slot Mini-Grid & Override Dialog (SCR-012)

## Requirement Reference

- **User Story**: us_033
- **Story Location**: .propel/context/tasks/EP-004/us_033/us_033.md
- **Acceptance Criteria**:
  - AC-1: SCR-012 renders patient summary card from React Router state; `#link-new-pt` back to SCR-013; required fields: Chief complaint, Assign provider (select from `GET /api/providers/available-today`), Urgency level; optional: Staff notes
  - AC-2: Slot mini-grid from `GET /api/slots?date=TODAY`; re-fetch `GET /api/slots?date=TODAY&provider_id=X` when provider changes; Available (green) / Unavailable (grey); `aria-selected`; `#btn-confirm` disabled until slot selected + all required fields filled
  - AC-3: Submit `POST /api/appointments/walkin`; on HTTP 201 navigate to SCR-014; on HTTP 409 re-fetch slot grid + inline error
  - AC-4: Unavailable slot click → "Override booking" confirmation dialog; if confirmed, resubmit with `slot_override=true`
  - Edge Case: Session expires between open and submit → 401 caught → session expiry modal; form state preserved

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | .propel/context/docs/figma_spec.md#SCR-012 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-012-walkin-booking.html |
| **Screen Spec** | SCR-012 Walk-In Booking Panel |
| **UXR Requirements** | UXR-201 (WCAG 2.2 AA: slot mini-grid cells `role="gridcell"` `tabindex="0"` for available; `aria-label` per cell; `aria-selected`), UXR-501 (provider dropdown + slot grid show loading state while fetching), UXR-601 (inline validation on required fields on blur; `#btn-confirm` disabled until all required + slot selected) |
| **Design Tokens** | Slot-Available=`#16A34A` (green), Slot-Unavailable=`#9CA3AF` (grey), Slot-Selected=`#0D9488` (teal), Brand navy=`#1E3A5F`, error=`#EF4444` |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18 |
| Language | TypeScript | 5 |
| Forms | React Hook Form | v7 |
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

Build `WalkInBookingPage` (`/staff/walkin/panel`, Staff-only). On mount, read `location.state` for `patient_id` / `guest_profile`; if absent, redirect to `/staff/walkin/search`. Renders patient summary card, booking form (React Hook Form), and a same-day slot mini-grid (filtered by selected provider). Clicking an Unavailable slot shows an override confirmation dialog. Submit calls `POST /api/appointments/walkin`; on HTTP 201 navigate to SCR-014; on HTTP 409 refresh slot grid + inline error.

---

## Dependent Tasks

- us_032 task_001 — passes patient identity in Router state to this page
- us_033 task_002 (BE walk-in booking API) — provides `POST /api/appointments/walkin` and `GET /api/providers/available-today`

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `src/pages/WalkInBookingPage.tsx` | CREATE | SCR-012; state guard; form; slot grid; override dialog |
| `src/components/staff/WalkInSlotGrid.tsx` | CREATE | Same-day slot mini-grid filtered by provider; reuses CSS variables from EP-003 SlotCell |
| `src/components/staff/OverrideConfirmDialog.tsx` | CREATE | `role="dialog"` confirmation modal for unavailable slot override |
| `src/components/staff/PatientSummaryCard.tsx` | CREATE | Displays patient name/DOB/MRN/insurance + guest badge when `guest_profile=true` |
| `src/api/appointmentsApi.ts` | MODIFY | Add `bookWalkIn(payload): Promise<WalkInBookingResponse>` |
| `src/api/providersApi.ts` | CREATE | `getAvailableProvidersToday(): Promise<Provider[]>` |
| `src/App.tsx` / router | MODIFY | Register `/staff/walkin/panel` route under `StaffGuard` |

---

## Implementation Checklist

- [ ] On `WalkInBookingPage` mount, check `location.state`; redirect to `/staff/walkin/search` if patient identity absent; render `PatientSummaryCard` (show guest badge when `guest_profile=true`)
- [ ] Load provider select dropdown from `GET /api/providers/available-today` with loading indicator (UXR-501); on provider change, re-fetch `GET /api/slots?date=TODAY&provider_id=X` and refresh `WalkInSlotGrid` without page reload
- [ ] `WalkInSlotGrid`: Available cells `role="gridcell"` `tabindex="0"` green; Unavailable cells grey; selected cell teal with `aria-selected="true"`; one selection at a time; available cell keyboard-Enter fires same handler as click (UXR-201)
- [ ] Unavailable slot click → show `OverrideConfirmDialog` with message: "No available slot selected. Walk-in bookings can override scheduling. A justification note will be auto-logged. Confirm override?"; if confirmed, set `slot_override=true` in payload; if dismissed, no state change
- [ ] React Hook Form `mode: "onBlur"`; required: Chief complaint, provider, urgency; `#btn-confirm` disabled until all required fields valid AND a slot selected (UXR-601); on blur show inline validation errors
- [ ] On `#btn-confirm` click: call `bookWalkIn(payload)`; show loading state; on HTTP 201 navigate to `/staff/queue`; on HTTP 409 re-fetch slot grid + show "That slot was just taken — please select another" inline error; on HTTP 401 trigger session expiry modal
- [ ] Preserve React Hook Form state across 401 session expiry / re-auth cycle; do not clear form on 401

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm test`

---

## Implementation Validation Strategy

- [ ] Navigate to `/staff/walkin/panel` without state → redirect to `/staff/walkin/search`
- [ ] Patient summary card renders correctly; guest badge shown for `guest_profile=true`
- [ ] Provider change → slot grid re-fetches automatically
- [ ] Available slot click → teal selection; `aria-selected="true"`; `#btn-confirm` enables when all required fields valid
- [ ] Unavailable slot click → override dialog appears; confirm → `slot_override=true` in payload
- [ ] HTTP 201 → navigate to `/staff/queue`
- [ ] HTTP 409 → inline error + slot grid refreshed
- [ ] Non-Staff JWT → route guard blocks access
