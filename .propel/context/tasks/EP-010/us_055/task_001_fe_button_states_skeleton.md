---
title: "Task — FE Interaction Feedback: Button 200ms Loading State, Double-Click Protection & 5 Screen Skeleton Placeholders"
task_id: task_001
story_id: us_055
epic: EP-010
layer: Frontend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — FE Interaction Feedback: Button 200ms Loading State, Double-Click Protection & 5 Screen Skeleton Placeholders

## Requirement Reference

- **User Story**: us_055
- **Story Location**: .propel/context/tasks/EP-010/us_055/us_055.md
- **Acceptance Criteria**:
  - AC-1: Every button renders active/pressed visual state within 200ms: primary buttons → `filter: brightness(0.9)` on `:active` via `transition-all duration-micro`; async operation buttons enter loading state within 200ms — label replaced by spinner, `aria-busy="true"` + `aria-label="Loading"`, `disabled` set; for operations > 500ms → page/section-scoped spinner overlay; Playwright asserts `[aria-busy="true"]` within 200ms of button click (UXR-501)
  - AC-4: `<Button isLoading>` sets `disabled={isLoading}` + `aria-disabled="true"`; Enter key blocked when `isLoading` via `onKeyDown` guard; Playwright confirms rapid double-click on "Confirm Booking" (SCR-009) results in exactly 1 `POST /api/appointments` request (UXR-501)
  - AC-2: Skeleton loading state on 5 screens: SCR-008 (7-column calendar grid shimmer cells), SCR-014 (5 queue table row skeletons), SCR-016 (patient header + clinical section skeletons), SCR-018 (3 code row skeletons), SCR-019 (8 user row skeletons); skeletons render within 200ms of navigation before first API response; CSS shimmer: `@keyframes shimmer` background-position sweep; staggered `animation-delay: nth-child(n) * 0.15s`; TanStack Query `isLoading` drives conditional render; React `Suspense` skeleton fallback (UXR-502)
  - AC-5 (partial): `[aria-busy="true"]` within 200ms of async button click on SCR-002, SCR-007, SCR-009, SCR-018; skeleton `.skeleton` elements in DOM within 200ms of navigating to SCR-008, SCR-014, SCR-016, SCR-018, SCR-019; no blank flash at 50ms post-navigation screenshot on 5 skeleton screens (UXR-501, UXR-502)

- **Edge Cases**:
  - Edge Case: Skeleton on SCR-016 > 30 seconds → TanStack Query `staleTime`/`gcTime` 30s threshold → skeleton replaced by full-page error state (us_056 UXR-603); skeleton never permanently stuck
  - Edge Case: Shimmer FOUC on SCR-019 (8 rows simultaneously) → staggered `animation-delay: nth-child(n) * 0.15s`; shimmer uses pseudo-element gradient sweep (GPU `transform`) not `background-position` paint
  - Edge Case: Button spinner overlapping page-level spinner → two independent feedback layers; both can be simultaneously visible; button confirms action received; page spinner confirms significant async response awaited

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes — all screens (button states); SCR-008, SCR-014, SCR-016, SCR-018, SCR-019 (skeletons) |
| **Figma URL** | .propel/context/docs/figma_spec.md — UXR-501, UXR-502 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-008-booking-calendar.html, wireframe-SCR-014-queue-view.html, wireframe-SCR-016-patient-360.html, wireframe-SCR-018-coding-panel.html, wireframe-SCR-019-admin-users.html; wireframe-shared.css defines `.btn` active states, `transition: all var(--transition-micro)` |
| **Screen Spec** | All screens (button); SCR-008, SCR-014, SCR-016, SCR-018, SCR-019 (skeletons) |
| **UXR Requirements** | UXR-501, UXR-502 |
| **Design Tokens** | `transition-micro` (200ms transition); shimmer animation from `wireframe-shared.css` |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React 18 + TypeScript 5 | — |
| Data Fetching | TanStack Query (React Query) | — |
| Styling | TailwindCSS 3.x | — |
| Testing | Playwright | — |

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
| **Mobile Impact** | Yes — 44px minimum button height (enforced via us_051/us_052); loading state applies at all breakpoints |
| **Platform Target** | Web (responsive) |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Enhance the `<Button>` component with an `isLoading` prop: render a spinner, set `aria-busy="true"`, set `disabled`, block Enter key during loading, and prevent double-submission. Configure the global `:active` press state (`filter: brightness(0.9)`, `transition-all duration-micro`). Implement 5 layout-matched skeleton screen components (SCR-008, SCR-014, SCR-016, SCR-018, SCR-019) with GPU-accelerated shimmer animation and staggered `animation-delay`. Wire skeletons to TanStack Query `isLoading` state and React `Suspense` fallback.

---

## Dependent Tasks

- US_001 (EP-TECH) — React 18 + TailwindCSS scaffold; base `<Button>` component; TanStack Query client configured
- us_053 task_001 (EP-009) — `transition-micro` token in `tailwind.config.ts`

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `client/src/components/shared/Button.tsx` | MODIFY | Add `isLoading: boolean` prop; spinner render; `aria-busy`; `disabled`; Enter key block |
| `client/src/index.css` | MODIFY | Add `@keyframes shimmer` + global `:active` `filter: brightness(0.9)` + `transition-all duration-micro` for `.btn` |
| `client/src/components/skeletons/CalendarSkeleton.tsx` | CREATE | 7-column grid of shimmer cells; matches SCR-008 calendar layout |
| `client/src/components/skeletons/QueueSkeleton.tsx` | CREATE | 5 queue table row skeletons; position/name/time/status/action placeholders |
| `client/src/components/skeletons/Patient360Skeleton.tsx` | CREATE | Patient header skeleton + clinical section skeletons (vitals/meds/allergies/diagnoses) |
| `client/src/components/skeletons/CodingSkeleton.tsx` | CREATE | 3 code row skeletons; code/description/confidence-bar/action-buttons placeholders |
| `client/src/components/skeletons/UsersSkeleton.tsx` | CREATE | 8 user row skeletons |
| `client/src/features/booking/BookingCalendar.tsx` (SCR-008) | MODIFY | Wire `<CalendarSkeleton>` via TanStack Query `isLoading` |
| `client/src/features/queue/QueueView.tsx` (SCR-014) | MODIFY | Wire `<QueueSkeleton>` via TanStack Query `isLoading` |
| `client/src/features/patients/View360.tsx` (SCR-016) | MODIFY | Wire `<Patient360Skeleton>` via TanStack Query `isLoading` |
| `client/src/features/coding/CodingPanel.tsx` (SCR-018) | MODIFY | Wire `<CodingSkeleton>` via TanStack Query `isLoading` |
| `client/src/features/admin/AdminUsers.tsx` (SCR-019) | MODIFY | Wire `<UsersSkeleton>` via TanStack Query `isLoading` |

---

## Implementation Plan

1. Update `<Button>` component interface:
   ```tsx
   interface ButtonProps {
     isLoading?: boolean;
     onClick?: () => void;
     children: ReactNode;
     // ... existing props
   }
   ```
   - When `isLoading`: render `<span className="sr-only">Loading</span>` + spinner SVG; set `disabled={true}`; set `aria-busy="true"`; set `aria-label="Loading"`
   - Add `onKeyDown` handler: `if (isLoading && e.key === 'Enter') e.preventDefault()`
   - Ensure `disabled` prevents any `onClick` from firing (native HTML `disabled` attribute handles this)

2. Add global button active state in `index.css`:
   ```css
   @layer components {
     .btn:active {
       filter: brightness(0.9);
       transition: filter var(--transition-micro, 100ms) ease;
     }
   }
   ```
   Also add to `tailwind.config.ts`: `transitionDuration: { micro: '100ms' }` (or align with `wireframe-shared.css` `--transition-micro` value)

3. Add `@keyframes shimmer` to `index.css`:
   ```css
   @keyframes shimmer {
     0% { transform: translateX(-100%); }
     100% { transform: translateX(100%); }
   }
   .skeleton {
     @apply bg-neutral-200 rounded overflow-hidden relative;
   }
   .skeleton::after {
     content: '';
     position: absolute;
     inset: 0;
     background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
     animation: shimmer 1.5s infinite;
   }
   .skeleton-row:nth-child(1) { animation-delay: 0s; }
   .skeleton-row:nth-child(2) { animation-delay: 0.15s; }
   /* ... up to nth-child(8) */
   ```

4. Create `CalendarSkeleton.tsx`: render a 7-column grid (`grid grid-cols-7`) with 5 rows × 7 cells; each cell is a `<div className="skeleton h-16">` matching the approximate calendar cell height from wireframe

5. Create `QueueSkeleton.tsx`: render 5 `<tr className="skeleton-row">` rows each with: position `<td className="skeleton h-8 w-8">`, name `<td className="skeleton h-4 w-32">`, time `<td className="skeleton h-6 w-20">`, status badge `<td className="skeleton h-6 w-24">`, action button `<td className="skeleton h-8 w-24">`

6. Create `Patient360Skeleton.tsx`: render patient header section (name placeholder `<div className="skeleton h-8 w-48">` + MRN `<div className="skeleton h-4 w-24">`); then 4 clinical section cards (vitals, medications, allergies, diagnoses) each as `<div className="skeleton h-32 w-full">`

7. Create `CodingSkeleton.tsx`: render 3 code rows; each row: code `<div className="skeleton h-6 w-24">`, description `<div className="skeleton h-4 w-64">`, confidence bar `<div className="skeleton h-3 w-full">`, action buttons `<div className="skeleton h-8 w-32">`

8. Create `UsersSkeleton.tsx`: render 8 `<tr className="skeleton-row">` rows; each: avatar circle, name, email, role badge, status badge, action buttons placeholders

9. Wire skeletons to TanStack Query in each screen:
   ```tsx
   const { data, isLoading } = useQuery(...)
   if (isLoading) return <CalendarSkeleton />;
   ```
   Also use React `Suspense` at the route level:
   ```tsx
   <Suspense fallback={<CalendarSkeleton />}>
     <BookingCalendarContent />
   </Suspense>
   ```

---

## Current Project State

```
client/
├── src/
│   ├── components/
│   │   ├── shared/Button.tsx           ← MODIFY (isLoading prop)
│   │   └── skeletons/                  ← CREATE all 5 skeleton components
│   ├── index.css                       ← MODIFY (@keyframes shimmer; .btn:active)
│   └── features/
│       ├── booking/BookingCalendar.tsx ← MODIFY (wire CalendarSkeleton)
│       ├── queue/QueueView.tsx         ← MODIFY (wire QueueSkeleton)
│       ├── patients/View360.tsx        ← MODIFY (wire Patient360Skeleton)
│       ├── coding/CodingPanel.tsx      ← MODIFY (wire CodingSkeleton)
│       └── admin/AdminUsers.tsx        ← MODIFY (wire UsersSkeleton)
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `client/src/components/shared/Button.tsx` | `isLoading` prop; spinner; `aria-busy`; `disabled`; Enter key block |
| MODIFY | `client/src/index.css` | `@keyframes shimmer`; `.skeleton` class; staggered delays; `.btn:active` brightness |
| CREATE | `client/src/components/skeletons/CalendarSkeleton.tsx` | 7-column × 5-row grid shimmer |
| CREATE | `client/src/components/skeletons/QueueSkeleton.tsx` | 5 queue row shimmer |
| CREATE | `client/src/components/skeletons/Patient360Skeleton.tsx` | Patient header + 4 clinical section shimmer |
| CREATE | `client/src/components/skeletons/CodingSkeleton.tsx` | 3 code row shimmer |
| CREATE | `client/src/components/skeletons/UsersSkeleton.tsx` | 8 user row shimmer |
| MODIFY | `client/src/features/booking/BookingCalendar.tsx` | `isLoading` → `<CalendarSkeleton>` |
| MODIFY | `client/src/features/queue/QueueView.tsx` | `isLoading` → `<QueueSkeleton>` |
| MODIFY | `client/src/features/patients/View360.tsx` | `isLoading` → `<Patient360Skeleton>` |
| MODIFY | `client/src/features/coding/CodingPanel.tsx` | `isLoading` → `<CodingSkeleton>` |
| MODIFY | `client/src/features/admin/AdminUsers.tsx` | `isLoading` → `<UsersSkeleton>` |

---

## External References

- [TanStack Query — Loading states](https://tanstack.com/query/latest/docs/react/guides/queries)
- [React — Suspense with data fetching](https://react.dev/reference/react/Suspense)
- [web.dev — Skeleton screens](https://web.dev/patterns/web-vitals-patterns/loading/skeleton-screens/)
- [CSS — GPU-accelerated animations (transform vs background-position)](https://web.dev/animations-guide/)

---

## Build Commands

- `cd client && npm run build`
- `cd client && npx playwright test tests/interaction/`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `<Button isLoading>`: renders spinner; `disabled` attribute present; `aria-busy="true"`; `aria-label="Loading"` present
- [ ] `<Button isLoading>`: Enter key press → no `onClick` fired (keyboard double-submit blocked)
- [ ] `<Button isLoading>`: rapid double-click → `onClick` fires at most 1 time
- [ ] Playwright: `[aria-busy="true"]` appears within 200ms of clicking async submit on SCR-009
- [ ] `<CalendarSkeleton>`: renders within 200ms of SCR-008 navigation; Playwright `page.waitForSelector('.skeleton', { timeout: 200 })` passes
- [ ] `<QueueSkeleton>`: 5 skeleton rows visible within 200ms of SCR-014 navigation
- [ ] `<Patient360Skeleton>`: header + 4 section skeletons visible within 200ms of SCR-016 navigation
- [ ] `<CodingSkeleton>`: 3 code row skeletons visible within 200ms of SCR-018 navigation
- [ ] `<UsersSkeleton>`: 8 user row skeletons visible within 200ms of SCR-019 navigation
- [ ] Playwright screenshot at 50ms post-navigation: no blank white screen on any of 5 skeleton screens
- [ ] Shimmer animation: smooth sweep; no paint jank (verify with DevTools Performance panel)
- [ ] Staggered animation delay: skeleton rows animate sequentially (not simultaneously)

---

## Implementation Checklist

- [ ] Update `<Button>`: add `isLoading` prop; spinner SVG; `aria-busy="true"`; `disabled={isLoading}`; `onKeyDown` Enter guard
- [ ] Add `.btn:active` `filter: brightness(0.9)` + `transition-all duration-micro` to `index.css`
- [ ] Add `@keyframes shimmer`, `.skeleton` class with GPU pseudo-element sweep, staggered delays to `index.css`
- [ ] Create `CalendarSkeleton.tsx`: 7-column × 5-row grid of `.skeleton` cells
- [ ] Create `QueueSkeleton.tsx`: 5 `.skeleton-row` table rows with column placeholders
- [ ] Create `Patient360Skeleton.tsx`: header block + 4 clinical section blocks
- [ ] Create `CodingSkeleton.tsx`: 3 code row placeholder blocks
- [ ] Create `UsersSkeleton.tsx`: 8 `.skeleton-row` user row placeholders
- [ ] Wire each skeleton to TanStack Query `isLoading` + React `Suspense` fallback in all 5 screens
