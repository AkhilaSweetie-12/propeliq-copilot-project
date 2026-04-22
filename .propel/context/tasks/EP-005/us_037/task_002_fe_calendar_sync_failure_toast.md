---
title: "Task — FE CalendarSyncFailureToast component — UXR-602 non-blocking warning toast (Google & Outlook)"
task_id: task_002
story_id: us_037
epic: EP-005
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — FE CalendarSyncFailureToast component — UXR-602 non-blocking warning toast (Google & Outlook)

## Requirement Reference

- **User Story**: us_037 (created here); extended by us_038 (Outlook variant reuses same component via `provider` prop)
- **Story Location**: .propel/context/tasks/EP-005/us_037/us_037.md
- **Acceptance Criteria**:
  - AC-4 (US_037): When backend signals Google Calendar sync failure, display a non-blocking warning toast on SCR-008, SCR-010, and SCR-014 with text: "Google Calendar sync unavailable. Your appointment is still confirmed." (UXR-602, FR-022)
  - AC-4 (US_038): When backend signals Outlook Calendar sync failure, display same toast variant: "Outlook Calendar sync unavailable. Your appointment is still confirmed." (UXR-602, FR-023)
  - Stacking: Both Google and Outlook failure toasts CAN appear simultaneously as two separate stacked toasts (UXR-602)
  - Auto-dismiss: Toast auto-dismisses after 5 seconds (UXR-602)
  - Manual dismiss: × button dismisses immediately (UXR-602)
  - Non-blocking: Toast does NOT interrupt primary booking confirmation flow; appointment confirmed banner remains fully visible (NFR-014)
  - Accessibility: `role="alert"` and `aria-live="assertive"` on toast container; `aria-label="Dismiss"` on × button
  - Edge Case: If both Google and Outlook fail, two toasts stack vertically in bottom-right, each with independent dismiss and 5-second timer
  - Edge Case: Toast does NOT appear on HTTP 403/404 from calendar API (permanent-silent failures)

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A — inferred from figma_spec.md |
| **Wireframe Status** | AVAILABLE — reuses existing screens |
| **Wireframe Type** | Hi-Fi HTML |
| **Wireframe Path/URL** | `.propel/context/wireframes/Hi-Fi/wireframe-SCR-010-confirmation.html` |
| **Screen Spec** | SCR-008, SCR-010, SCR-014 |
| **UXR Requirements** | UXR-602 |
| **Design Tokens** | warning/amber variant; bottom-right anchor; shadow-md; rounded-lg |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React 18 + TypeScript 5 | 18 / 5 |
| Styling | TailwindCSS | 3.x |
| Accessibility | WCAG 2.1 AA | — |

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

Create a reusable `CalendarSyncFailureToast` React component that receives a `provider: 'Google' | 'Microsoft'` prop and renders a non-blocking warning toast in the bottom-right corner of the viewport. The toast auto-dismisses after 5 seconds and can be manually dismissed via the × button. Multiple instances stack vertically. A `ToastProvider` context or equivalent mechanism manages the toast queue. The component is rendered within SCR-008, SCR-010, and SCR-014 whenever the booking API response includes a calendar sync failure signal. No toast is shown for silent 4xx permanent failures.

---

## Dependent Tasks

- us_037 task_001 — Backend job must emit a calendar sync failure signal for the FE to consume (e.g., `calendarSyncFailed: ['Google' | 'Microsoft']` field in booking confirmation response or POST-completion polling endpoint)
- us_028 task_001 — Slot swap booking response may also carry calendar failure signals
- us_030 task_002 — Booking confirmation view (SCR-010) already implemented; this task adds toast overlay

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Client/src/components/feedback/CalendarSyncFailureToast.tsx` | CREATE | `provider: 'Google' \| 'Microsoft'`; amber warning; auto-dismiss 5 s; × dismiss |
| `Client/src/components/feedback/ToastContainer.tsx` | CREATE | Fixed bottom-right container; manages toast queue; stacks multiple toasts vertically |
| `Client/src/context/ToastContext.tsx` | CREATE | React context + `useToast()` hook; `addToast(provider)`, `removeToast(id)` |
| `Client/src/pages/BookingConfirmation.tsx` (SCR-010) | MODIFY | Import `useToast()`; call `addToast('Google')` or `addToast('Microsoft')` when API response includes `calendarSyncFailed` |
| `Client/src/pages/BookingCalendar.tsx` (SCR-008) | MODIFY | Same — add toast trigger on calendar page if booking confirmation returns failure signal |
| `Client/src/pages/QueueView.tsx` (SCR-014) | MODIFY | Same — add toast trigger on queue view |

---

## Implementation Checklist

- [ ] Create `CalendarSyncFailureToast.tsx`: props `{ id: string; provider: 'Google' | 'Microsoft'; onDismiss: (id: string) => void }`; render amber warning card with text `"${provider} Calendar sync unavailable. Your appointment is still confirmed."`; `role="alert"` on root element; × button with `aria-label="Dismiss calendar sync notification"` calls `onDismiss(id)`; `useEffect` to auto-dismiss via `setTimeout(5000)` — clear timeout in cleanup
- [ ] Create `ToastContainer.tsx`: fixed position `bottom-4 right-4`; `aria-live="assertive"` on container; maps toast state array to `<CalendarSyncFailureToast />` elements stacked with `space-y-2`; `z-index: 50` (above primary content)
- [ ] Create `ToastContext.tsx`: state `toasts: { id: string; provider: 'Google' | 'Microsoft' }[]`; `addToast(provider)` generates UUID, appends; `removeToast(id)` removes; expose `useToast()` hook; wrap app root with `<ToastProvider>` including `<ToastContainer />`
- [ ] Modify `BookingConfirmation.tsx` (SCR-010): after booking API call returns, check `response.calendarSyncFailed` array; for each failed provider call `addToast(provider)`; booking confirmed banner renders independently (NFR-014 — toast does not replace confirmation)
- [ ] Modify `BookingCalendar.tsx` (SCR-008) and `QueueView.tsx` (SCR-014): same `calendarSyncFailed` signal check; call `addToast` as applicable
- [ ] Style: `bg-amber-50 border border-amber-300 text-amber-800 rounded-lg shadow-md p-4`; × button `text-amber-600 hover:text-amber-800`; text: `text-sm font-medium`
- [ ] Do NOT show toast when no `calendarSyncFailed` field present or when field is empty array; permanent 4xx failures are NOT signalled by the API (backend swallows them silently)
- [ ] Write unit test: `CalendarSyncFailureToast` renders correct provider text; × click calls `onDismiss`; auto-dismiss fires after 5 s (use fake timers)

---

## Build Commands

- `cd Client && npm run build`
- `cd Client && npm test`

---

## Implementation Validation Strategy

- [ ] API returns `calendarSyncFailed: ['Google']` → amber toast appears bottom-right on SCR-010 with "Google Calendar sync unavailable..." text
- [ ] Auto-dismiss fires at 5 s; toast removed from DOM; no memory leak (timeout cleared on unmount)
- [ ] × button dismisses immediately; `aria-label="Dismiss calendar sync notification"` present
- [ ] Both `calendarSyncFailed: ['Google', 'Microsoft']` → two stacked toasts; each dismisses independently
- [ ] No `calendarSyncFailed` field → no toast rendered
- [ ] Booking confirmed banner on SCR-010 unaffected by toast presence (NFR-014)
- [ ] `role="alert"` and `aria-live="assertive"` present; WCAG 2.1 AA screen-reader announces toast
- [ ] `provider="Google"` → "Google Calendar sync unavailable..."; `provider="Microsoft"` → "Outlook Calendar sync unavailable..."
