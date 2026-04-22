---
title: "Task — FE Booking & Insurance Form with Preferred Slot (SCR-009)"
task_id: task_001
story_id: us_027
epic: EP-003
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Booking & Insurance Form with Preferred Slot (SCR-009)

## Requirement Reference

- **User Story**: us_027
- **Story Location**: .propel/context/tasks/EP-003/us_027/us_027.md
- **Acceptance Criteria**:
  - AC-1: SCR-009 renders booking summary sidebar from React Router state (`slot_id`); two required fields — `#insurance-provider` + `#insurance-id`; `aria-required="true"`; on-blur inline validation
  - AC-2: Submit calls `POST /api/appointments/book`; insurance pre-check result shown inline (Matched=green ✓, Unmatched=amber ✗, Not Found=grey ?); `role="status"` `aria-live="polite"`; never blocks booking
  - AC-3: Optional preferred slot dropdown `#preferred-slot` populated from unavailable slots; "No preference" default; `preferred_slot_id` included in payload only if selected
  - AC-5: On HTTP 201, navigate to SCR-010 confirmation screen via `useNavigate`
  - Edge Case: No `slot_id` in React Router state on mount → redirect to SCR-008 immediately; no API call

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | .propel/context/docs/figma_spec.md#SCR-009 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-009-booking-insurance.html |
| **Screen Spec** | SCR-009 Booking & Insurance Form |
| **UXR Requirements** | UXR-201 (WCAG 2.2 AA: all fields labelled, aria-describedby error IDs), UXR-303 (two-column form collapses to single at < 768 px), UXR-501 (insurance pre-check result inline, no full-page reload), UXR-601 (inline validation error on blur — red border + icon + message beneath field), UXR-602 ("Confirm appointment →" shows loading state while in-flight) |
| **Design Tokens** | Matched=`#16A34A` (green ✓), Unmatched=`#F59E0B` (amber ✗), Not Found=`#9CA3AF` (grey ?), error border=`#EF4444`, Brand navy=`#1E3A5F` |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18 |
| Language | TypeScript | 5 |
| Forms | React Hook Form | v7 |
| Routing | React Router | v6 |
| Styling | TailwindCSS | 3.x |

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

Build `BookingInsurancePage` (`/book/insurance`, Patient-only). On mount, check `location.state.slot_id`; if absent, redirect to `/book`. Renders a booking summary sidebar (slot metadata from state) and a form with two required insurance fields and an optional preferred-slot dropdown. On submit, calls `POST /api/appointments/book`, shows loading state on the button, displays the insurance pre-check result inline, and on HTTP 201 navigates to SCR-010. On HTTP 409, shows inline error and navigates back to SCR-008.

---

## Dependent Tasks

- us_026 task_001 — passes `slot_id` and `slotMeta` via React Router state to this page
- us_027 task_002 (BE booking API) — provides `POST /api/appointments/book` endpoint

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `src/pages/BookingInsurancePage.tsx` | CREATE | SCR-009 page; state guard redirect |
| `src/components/booking/InsurancePreCheckBadge.tsx` | CREATE | Inline result badge (Matched/Unmatched/Not Found) with `role="status"` `aria-live="polite"` |
| `src/components/booking/PreferredSlotSelect.tsx` | CREATE | `#preferred-slot` dropdown; populated from unavailable slots passed in state; "No preference" default |
| `src/api/appointmentsApi.ts` | CREATE | `bookAppointment(payload): Promise<BookingResponse>` |

---

## Implementation Checklist

- [ ] On `BookingInsurancePage` mount, check `location.state?.slot_id`; if absent, call `navigate("/book", { replace: true })`; do not make any API call without valid state
- [ ] Render booking summary sidebar from `location.state.slotMeta` (date, time, provider name, appointment type) — no second API call required (UXR-501)
- [ ] Build form with React Hook Form `mode: "onBlur"`; `#insurance-provider` and `#insurance-id` fields are `required`; inline error (`aria-describedby` + red border) on blur if blank (UXR-601)
- [ ] Render `PreferredSlotSelect` with unavailable slots from `location.state.unavailableSlots`; default option is "No preference"; omit `preferred_slot_id` from payload when "No preference" selected
- [ ] On `#btn-confirm` click, set button to loading state (UXR-602); call `bookAppointment({ slot_id, preferred_slot_id?, insurance_name, insurance_id })`; re-enable button on response regardless of outcome
- [ ] On HTTP 201: show `InsurancePreCheckBadge` with returned `insurance_status`; after badge renders briefly, navigate to `/book/confirmation` with `{ state: { appointment_id } }`
- [ ] On HTTP 409: display inline error "That slot was just taken — please choose another" (`role="alert"`); call `navigate("/book", { replace: true })` to return patient to SCR-008 with no partial state
- [ ] Validate `preferred_slot_id != slot_id` client-side before submit; surface error "Invalid preferred slot selection" if equal — mirrors server-side API guard

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm test`

---

## Implementation Validation Strategy

- [ ] Navigating to `/book/insurance` without state → immediate redirect to `/book`
- [ ] Booking summary sidebar renders correctly from state (no API call)
- [ ] Blank insurance fields on blur → inline error with `aria-describedby` pointing to error element
- [ ] "Confirm appointment →" shows loading state while API in-flight
- [ ] HTTP 201 → insurance badge rendered; navigation to SCR-010
- [ ] HTTP 409 → inline error + back-navigation to SCR-008
- [ ] `preferred_slot_id == slot_id` → client-side validation error before submit
- [ ] Single-column layout at < 768 px viewport (UXR-303)
