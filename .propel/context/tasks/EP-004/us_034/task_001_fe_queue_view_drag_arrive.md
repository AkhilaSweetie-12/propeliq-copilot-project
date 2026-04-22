---
title: "Task — FE Same-Day Queue Table, Filter Chips, Drag-to-Reorder & Mark Arrived (SCR-014)"
task_id: task_001
story_id: us_034
epic: EP-004
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Same-Day Queue Table, Filter Chips, Drag-to-Reorder & Mark Arrived (SCR-014)

## Requirement Reference

- **User Story**: us_034
- **Story Location**: .propel/context/tasks/EP-004/us_034/us_034.md
- **Acceptance Criteria**:
  - AC-1: `/staff/queue` (SCR-014); `GET /api/queue/today` (full payload); queue table ordered by `queue_position ASC`; columns: position + drag handle (⠿), patient name (link → SCR-016), time, provider, type, status badge, risk badge; filter chips: All / Arrived / Scheduled / In Progress / Walk-ins / High Risk; skeleton while loading (UXR-502)
  - AC-2: Drag-to-reorder (desktop ≥ 768 px only); optimistic UI reorder → `PATCH /api/queue/reorder { ordered_appointment_ids }`; revert on API failure with toast error (UXR-602); drag hidden on mobile
  - AC-3: "Arrived" button (`aria-label="Mark [name] as arrived"`) → `PATCH /api/appointments/{id}/arrive`; on HTTP 200 → row badge updates Scheduled → Arrived; button → "View"
  - AC-4: HTTP 400 from arrive → override confirmation dialog: "Patient not scheduled for today. Confirm override?"; confirm → `PATCH …?override=true`; cancel → no change
  - AC-5: Staff-only; non-Staff redirect to role home; drag handle keyboard-accessible on desktop
  - Edge Case: Walk-in added while filter hides walk-ins → toast "Walk-in added — currently hidden by your active filter" with "Show all" CTA

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | .propel/context/docs/figma_spec.md#SCR-014 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-014-queue-view.html |
| **Screen Spec** | SCR-014 Same-Day Queue View |
| **UXR Requirements** | UXR-102 (RiskBadge per row — icon ↓/—/↑ + text Low/Medium/High + colour green/amber/red; `aria-label="[level] no-show risk"` — reuse from us_031 task_001), UXR-201 (WCAG 2.2 AA: `role="grid"`, drag handles keyboard-accessible, arrived button `aria-label` includes patient name), UXR-501 (queue skeleton while `GET /api/queue/today` in-flight), UXR-502 (same), UXR-602 (toast on drag-reorder API failure; auto-dismiss 5 s), UXR-603 (full-page error + retry on critical `GET /api/queue/today` failure), UXR-604 (empty state when no appointments) |
| **Design Tokens** | Status-Scheduled=`#1E3A5F` (navy), Status-Arrived=`#16A34A` (green), Status-WalkIn=`#7C3AED` (purple), risk-Low=`#16A34A`, risk-Medium=`#F59E0B`, risk-High=`#EF4444` |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18 |
| Language | TypeScript | 5 |
| Routing | React Router | v6 |
| Drag-and-Drop | `@dnd-kit/core` + `@dnd-kit/sortable` | latest |
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

Build `QueueViewPage` (`/staff/queue`, Staff-only). Fetches full queue from `GET /api/queue/today`. Renders a filterable queue table using `@dnd-kit/sortable` for desktop-only drag-to-reorder with optimistic UI + API sync + revert-on-error. Each row includes `RiskBadge` (shared from us_031). "Arrived" button fires `PATCH /api/appointments/{id}/arrive`; HTTP 400 triggers override dialog. "↻ Refresh" and "↑ High Risk" filter chip complete the view.

---

## Dependent Tasks

- us_031 task_001 — `RiskBadge` component created here and reused; "View full queue →" link navigates here
- us_033 task_001 — walk-in submission navigates to this page; new walk-in appears at bottom
- us_034 task_002 (BE queue reorder + arrive APIs) — provides PATCH endpoints

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `src/pages/QueueViewPage.tsx` | CREATE | SCR-014; filter state; DnD context; refresh |
| `src/components/staff/QueueTable.tsx` | CREATE | `role="grid"` table with `DndContext` + `SortableContext` from `@dnd-kit/sortable`; desktop-only |
| `src/components/staff/QueueRow.tsx` | CREATE | Sortable row: drag handle (⠿), patient name link, time, provider, status badge, RiskBadge, Arrived/View button |
| `src/components/staff/ArrivalOverrideDialog.tsx` | CREATE | `role="dialog"` confirmation for not-today override |
| `src/api/queueApi.ts` | MODIFY | Add `reorderQueue(orderedIds: string[]): Promise<void>`; `markArrived(id: string, override?: boolean): Promise<void>` |
| `src/App.tsx` / router | MODIFY | Register `/staff/queue` route under `StaffGuard` |

---

## Implementation Checklist

- [ ] On `QueueViewPage` mount, verify `auth.role === 'Staff'`; call `GET /api/queue/today` (full payload); render skeleton while in-flight (UXR-501/502); render full-page error + retry on critical API failure (UXR-603); empty state when no appointments (UXR-604)
- [ ] Render filter chips (All / Arrived / Scheduled / In Progress / Walk-ins / High Risk); apply as client-side filter on already-fetched data — no extra API call per filter; active filter clears when "All" selected
- [ ] Implement drag-to-reorder using `@dnd-kit/sortable`: show drag handles (⠿) only on desktop (≥ 768 px — hide via CSS at smaller breakpoints); on `onDragEnd`, update local order immediately (optimistic); call `reorderQueue(orderedIds)`; on API failure revert to pre-drag order and show toast error "Queue order could not be updated — please try again" (UXR-602)
- [ ] Each `QueueRow` "Arrived" button: `aria-label="Mark [patient name] as arrived"`; click → `markArrived(appointmentId)`; on HTTP 200 update row status badge to "Arrived" and swap button to "View"; on HTTP 409 "Patient has already been marked arrived" reload that row's state and show "View"
- [ ] HTTP 400 from `markArrived` → open `ArrivalOverrideDialog` ("Patient not scheduled for today. Confirm override?"); confirm → `markArrived(id, override=true)`; cancel → no state change; dismiss dialog; on override success → row updates to "Arrived"
- [ ] Reuse `RiskBadge` component from us_031 task_001 for all queue rows (UXR-102)
- [ ] When a walk-in is added (redirected from SCR-012) while an active filter hides walk-ins: detect incoming new appointment from `location.state`; show toast "Walk-in added — currently hidden by your active filter" with "Show all" button; "Show all" clears filter to "All"

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm test`

---

## Implementation Validation Strategy

- [ ] Queue loads ordered by `queue_position ASC`; all columns render correctly including `RiskBadge`
- [ ] Filter chip "High Risk" → only rows with `no_show_risk=High` visible
- [ ] Drag row on desktop → optimistic reorder; `PATCH /api/queue/reorder` called; API failure → row reverts + toast
- [ ] Drag handle hidden at < 768 px viewport
- [ ] "Arrived" click → HTTP 200 → row badge updates to "Arrived"; button → "View"
- [ ] "Arrived" click → HTTP 400 → `ArrivalOverrideDialog` opens; confirm → HTTP 200 with `?override=true`
- [ ] "Arrived" click when already arrived (HTTP 409) → button updates to "View"
- [ ] Walk-in added with Walk-ins filter active → toast with "Show all" CTA
- [ ] Non-Staff JWT → route guard redirects
