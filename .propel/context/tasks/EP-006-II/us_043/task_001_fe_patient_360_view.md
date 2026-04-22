---
title: "Task — FE SCR-016 & SCR-017 — 360° Patient View, Trust-First Badges, Conflict Banner, Acknowledgement Panel & Mark as Verified"
task_id: task_001
story_id: us_043
epic: EP-006-II
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE SCR-016 & SCR-017 — 360° Patient View, Trust-First Badges, Conflict Banner, Acknowledgement Panel & Mark as Verified

## Requirement Reference

- **User Story**: us_043
- **Story Location**: .propel/context/tasks/EP-006-II/us_043/us_043.md
- **Acceptance Criteria**:
  - AC-1: SCR-016 loads via `GET /api/patients/{id}/view360`; skeleton loading state while fetching (no blank screen — UXR-502); renders all 5 field groups with count badges; AI-suggested fields (unverified) → amber "AI Suggested" badge + `--neutral-100` muted background; Staff-verified fields → solid navy border + no badge; colour + text label together (not colour alone, a11y); empty groups → "No data extracted" with upload documents link; full-page error state with Retry CTA on GET failure (UXR-603) (UXR-403, FR-028)
  - AC-2: `conflict_flags` non-empty → "Conflicts Detected" banner at page top with count of unacknowledged conflicts; red conflict indicator badge per affected field group; "Review Conflicts" CTA navigates to SCR-017; fields with unacknowledged conflicts rendered with red border highlight; "Mark as Verified" button disabled while unacknowledged conflicts remain (FR-030)
  - AC-3: SCR-017 renders each conflict as a card: field type colour-coded tag, side-by-side value comparison with source document names and extraction dates; per-conflict "Acknowledge" button; on click → `POST /api/patients/{id}/view360/acknowledge { conflict_id }`; on HTTP 200 → card transitions: green border + checkmark + "Acknowledged by [staff name] at [time]"; "Acknowledge" button → disabled "Acknowledged" label; `audit_logs` written by API (FR-030)
  - AC-4: All conflicts acknowledged → "Back to Patient View" returns to SCR-016; banner cleared; conflict badges cleared; "Mark as Verified" button enabled (blue primary); Staff clicks → confirmation modal: "Mark this patient's 360° view as verified? This confirms all AI-extracted data has been reviewed."; confirm → `POST /api/patients/{id}/view360/verify`; on HTTP 200 → view header "Verified" badge (green + Staff name + timestamp); all "AI Suggested" badges replaced with "Staff Verified" labels + solid border; `audit_logs ViewVerified` written by API (FR-030)
  - AC-5: `_NeedsReview` fields rendered with amber "Needs Review" badge + `--color-warning-50` muted yellow background (distinct from "AI Suggested"); inline "Enter value manually" link; click → inline edit input for that field; save → `PATCH /api/patients/{id}/view360/fields { field_type, field_value, source="StaffManual" }`; on HTTP 200 → field renders as "Staff Verified" with entered value; allows manual resolution without re-running AI pipeline (AIR-Q04, UXR-403)
  - Edge Case: Staff navigates away mid-acknowledgement → acknowledged conflicts persisted immediately; partial state shown accurately on return; "Mark as Verified" remains disabled
  - Edge Case: New document processed while viewing → 30-second auto-poll detects `is_verified=false` reset; non-blocking info toast "New document data available — view has been reset for re-verification" (warning variant, auto-dismisses 5 s); "Mark as Verified" disabled again
  - Edge Case: Patient navigates to SCR-016 URL directly → React Router guard checks role from JWT; `role ≠ Staff/Admin` → redirect to SCR-004 + brief toast "You do not have permission to access this page"
  - Edge Case: `GET /view360` HTTP 500 → full-page error state with Retry CTA (UXR-603); skeleton shown on retry

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A — inferred from figma_spec.md |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | `.propel/context/wireframes/Hi-Fi/wireframe-SCR-016-patient-360.html`, `.propel/context/wireframes/Hi-Fi/wireframe-SCR-017-conflict-ack.html` |
| **Screen Spec** | SCR-016, SCR-017 |
| **UXR Requirements** | UXR-403, UXR-501, UXR-502, UXR-603 |
| **Design Tokens** | `--neutral-100` AI Suggested muted bg; `--color-warning-50` Needs Review yellow bg; amber badge; solid navy border (verified); red border (unacknowledged conflict); green border + checkmark (acknowledged); `badge-success` Verified header; `badge-warning` AI Suggested; `badge-error` conflict indicator |

> **CRITICAL — Wireframe Implementation:**
> - Reference `wireframe-SCR-016-patient-360.html` for: field group card layout, "AI Suggested" amber badge + muted background, "Staff Verified" solid navy border, conflict banner position, "Mark as Verified" button state (disabled/enabled), skeleton loading pattern
> - Reference `wireframe-SCR-017-conflict-ack.html` for: conflict card layout, side-by-side value comparison columns, colour-coded field type tag, "Acknowledge" → "Acknowledged" state transition, green border + checkmark on acknowledged card
> - Implement all states: Default, Loading (skeleton), Error (full-page), Verified (header badge), Conflict-present, All-conflicts-acknowledged
> - Validate at 375px, 768px, 1440px breakpoints
> - Run `/analyze-ux` after implementation to verify pixel-perfect alignment

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React 18 + TypeScript 5 | 18 / 5 |
| Styling | TailwindCSS | 3.x |
| Routing | React Router v6 | 6.x |
| HTTP | Axios or Fetch API | — |
| Polling | React `useEffect` + `setInterval` | built-in |
| Accessibility | WCAG 2.1 AA | — |

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
| **Mobile Impact** | No |
| **Platform Target** | N/A |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Implement the SCR-016 (360° Patient View) and SCR-017 (Conflict Acknowledgement Panel) React pages with full Trust-First visual hierarchy (UXR-403). SCR-016 renders field groups with three badge states (AI Suggested / Needs Review / Staff Verified), a conflict banner with per-group indicators, a disabled "Mark as Verified" guard while conflicts are unacknowledged, and a 30-second auto-poll detecting view resets. SCR-017 presents conflict cards with side-by-side value comparison and per-conflict Acknowledge flow. Both screens include skeleton loading (UXR-502), full-page error state (UXR-603), and a Staff-only React Router route guard.

---

## Dependent Tasks

- us_042 task_001 — `GET /api/patients/{id}/view360`, `POST /verify`, `POST /acknowledge` APIs must be implemented; FE can be built against MSW mocks
- us_039 task_001 — SCR-015 "Enter data manually" CTA (for NeedsReview fields) establishes the manual-entry pattern this screen's inline edit extends

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Client/src/pages/PatientView360.tsx` (SCR-016) | CREATE | Main page; data fetch + 30 s polling; conflict banner; Mark as Verified flow |
| `Client/src/pages/ConflictAcknowledgement.tsx` (SCR-017) | CREATE | Conflict card list; per-conflict Acknowledge; Back to Patient View |
| `Client/src/components/view360/FieldGroupCard.tsx` | CREATE | Renders one field group (Vitals/Medications/etc.); badge state logic; conflict border; empty state |
| `Client/src/components/view360/AiSuggestedBadge.tsx` | CREATE | Amber badge + label; `--neutral-100` muted bg; a11y: colour + text |
| `Client/src/components/view360/NeedsReviewField.tsx` | CREATE | Amber "Needs Review" badge + `--color-warning-50` bg; inline edit input; PATCH on save |
| `Client/src/components/view360/ConflictBanner.tsx` | CREATE | Top-of-page banner; conflict count; "Review Conflicts" CTA |
| `Client/src/components/view360/ConflictCard.tsx` | CREATE | Side-by-side value comparison; colour-coded field type tag; Acknowledge button; resolved state |
| `Client/src/components/view360/VerifyConfirmationModal.tsx` | CREATE | Confirmation dialog before POST /verify; `aria-modal`; confirm/cancel |
| `Client/src/components/view360/View360Skeleton.tsx` | CREATE | Skeleton loading cards for SCR-016 (UXR-502) |
| `Client/src/hooks/useView360Polling.ts` | CREATE | 30 s interval poll; detects `is_verified=false` reset; fires toast on reset |

---

## Implementation Plan

1. Implement `PatientView360.tsx` (SCR-016): fetch `GET /view360` on mount; show `View360Skeleton` while loading; on error → full-page error state with Retry CTA; render 5 `FieldGroupCard` components; render `ConflictBanner` if `conflict_flags` has unacknowledged items; render "Mark as Verified" button (disabled if conflicts); `useView360Polling` hook for 30-second refresh; "New document data available" toast on `is_verified` flip

2. Implement `FieldGroupCard.tsx`: accept `{ fieldType, items, hasUnacknowledgedConflict, isVerified }` props; render count badge in header; per-item: if `source="AI"` and not verified → `AiSuggestedBadge` + `bg-neutral-100`; if verified → solid navy border + "Staff Verified" label; if `field_type=_NeedsReview` → `NeedsReviewField`; if `hasUnacknowledgedConflict` → red border on card; empty items → "No data extracted" with link to SCR-015

3. Implement `NeedsReviewField.tsx`: amber "Needs Review" badge; `bg-warning-50`; "Enter value manually" link; click → inline `<input>`; save button → `PATCH /api/patients/{id}/view360/fields`; on 200 → replace field display with "Staff Verified" state

4. Implement `ConflictBanner.tsx`: only when `unacknowledgedCount > 0`; text: "N conflicts require your review"; "Review Conflicts" button → navigate to SCR-017; count updates reactively as conflicts are acknowledged

5. Implement `ConflictAcknowledgement.tsx` (SCR-017): list `ConflictCard` components; "Back to Patient View" button → navigate back to SCR-016

6. Implement `ConflictCard.tsx`: colour-coded `field_type` tag; two-column value comparison (value + document name + extraction date per side); "Acknowledge" button → `POST /acknowledge { conflict_id }`; on 200 → transition card to: green border + checkmark icon + "Acknowledged by {staffName} at {time}"; replace button with disabled "Acknowledged" label; `aria-live="polite"` on status area

7. Implement `VerifyConfirmationModal.tsx`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; "Mark this patient's 360° view as verified? This confirms all AI-extracted data has been reviewed."; Confirm → `POST /verify`; on 200 → update view header with "Verified" badge + Staff name + timestamp; transition all "AI Suggested" labels to "Staff Verified"

8. Implement `useView360Polling.ts`: `setInterval(30000)`; call `GET /view360`; if `is_verified` flips from `true` to `false` → fire "New document data available" info toast (5 s auto-dismiss, warning variant using existing `ToastContext` from us_037 task_002)

9. Add React Router route guard for SCR-016 and SCR-017: decode JWT `role` claim; if `role ≠ Staff` and `role ≠ Admin` → redirect to SCR-004 + brief toast "You do not have permission to access this page"

---

## Current Project State

```
Client/
└── src/
    ├── pages/           # Existing (BookingCalendar, DocumentsUpload, etc.)
    ├── components/      # Existing (CalendarSyncFailureToast, etc.)
    ├── context/         # ToastContext (us_037 task_002)
    └── hooks/           # useDocumentPolling (us_039), useToast (us_037)
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `Client/src/pages/PatientView360.tsx` | SCR-016 main page |
| CREATE | `Client/src/pages/ConflictAcknowledgement.tsx` | SCR-017 conflict panel |
| CREATE | `Client/src/components/view360/FieldGroupCard.tsx` | Field group with badge logic |
| CREATE | `Client/src/components/view360/AiSuggestedBadge.tsx` | Amber AI Suggested badge |
| CREATE | `Client/src/components/view360/NeedsReviewField.tsx` | Inline edit for _NeedsReview fields |
| CREATE | `Client/src/components/view360/ConflictBanner.tsx` | Top conflict count banner |
| CREATE | `Client/src/components/view360/ConflictCard.tsx` | Side-by-side conflict card + Acknowledge |
| CREATE | `Client/src/components/view360/VerifyConfirmationModal.tsx` | Mark as Verified confirmation dialog |
| CREATE | `Client/src/components/view360/View360Skeleton.tsx` | Skeleton loading state (UXR-502) |
| CREATE | `Client/src/hooks/useView360Polling.ts` | 30 s polling; reset detection |
| MODIFY | `Client/src/App.tsx` (or router file) | Add Staff-only routes for SCR-016 `/patients/:id/360` and SCR-017 `/patients/:id/conflicts` |

---

## External References

- [WCAG 2.1 — Colour alone not sufficient (1.4.1)](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)
- [ARIA — dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [React Router v6 — Route guards / redirect patterns](https://reactrouter.com/en/main/start/concepts)

---

## Build Commands

- `cd Client && npm run build`
- `cd Client && npm test`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] **[UI Tasks]** Visual comparison against `wireframe-SCR-016-patient-360.html` at 375px, 768px, 1440px
- [ ] **[UI Tasks]** Visual comparison against `wireframe-SCR-017-conflict-ack.html` at 375px, 768px, 1440px
- [ ] **[UI Tasks]** Run `/analyze-ux` to validate wireframe alignment
- [ ] SCR-016 skeleton loading renders on fetch (no blank flash > 200ms — UXR-502)
- [ ] AI-suggested field shows amber badge + neutral-100 muted bg; colour AND text label present (a11y — UXR-403)
- [ ] Staff-verified field shows solid navy border + "Staff Verified" label; no "AI Suggested" badge
- [ ] `_NeedsReview` field shows amber "Needs Review" badge + yellow warning-50 bg (distinct from AI Suggested)
- [ ] Inline edit opens for `_NeedsReview` field; PATCH sent on save; field transitions to Staff Verified on 200
- [ ] Conflict banner shows with unacknowledged count; "Mark as Verified" button disabled
- [ ] "Review Conflicts" navigates to SCR-017; conflict cards render with side-by-side values + source doc names
- [ ] "Acknowledge" click → POST /acknowledge; card transitions: green border + checkmark + staff/time label
- [ ] After all conflicts acknowledged, back to SCR-016: banner cleared; "Mark as Verified" enabled
- [ ] Confirm modal → POST /verify → view header "Verified" badge + Staff name + timestamp; all AI Suggested → Staff Verified
- [ ] 30 s poll detects `is_verified=false` flip → info toast "New document data available…" fires; "Mark as Verified" disabled
- [ ] Patient JWT accessing SCR-016 URL → redirected to SCR-004; "no permission" toast shown
- [ ] GET 500 → full-page error state with Retry CTA (UXR-603); skeleton shown on retry

---

## Implementation Checklist

- [ ] Scaffold `PatientView360.tsx`: fetch on mount; skeleton; error state; render field groups + conflict banner
- [ ] Implement `FieldGroupCard.tsx` with all badge state variants; empty state; conflict red border; colour + text a11y requirement
- [ ] Implement `AiSuggestedBadge.tsx`: amber colour; "AI Suggested" text label; `bg-neutral-100` on parent field row
- [ ] Implement `NeedsReviewField.tsx`: "Needs Review" badge (amber); `bg-warning-50`; inline edit on "Enter value manually" click; PATCH on save
- [ ] Implement `ConflictBanner.tsx`: reactive count; "Review Conflicts" CTA; hidden when `unacknowledgedCount === 0`
- [ ] Implement `ConflictCard.tsx` with side-by-side layout; Acknowledge button with loading state; resolved transition with `aria-live="polite"`
- [ ] Implement `VerifyConfirmationModal.tsx`: accessible dialog; POST /verify; header badge update on success
- [ ] Implement `View360Skeleton.tsx`: matches SCR-016 field group card structure for no-flash loading
- [ ] Implement `useView360Polling.ts`: 30 s interval; detect `is_verified` flip; call `addToast` from `ToastContext`; stop on unmount
- [ ] Add Staff/Admin route guard in router; redirect Patient to SCR-004 with permission toast
- [ ] **[UI Tasks - MANDATORY]** Reference both wireframes from Design References table during implementation
- [ ] **[UI Tasks - MANDATORY]** Validate both SCR-016 and SCR-017 match wireframes before marking task complete
