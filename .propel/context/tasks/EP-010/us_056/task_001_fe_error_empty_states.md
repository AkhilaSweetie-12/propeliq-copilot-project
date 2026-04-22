---
title: "Task — FE Error & Empty States: ToastProvider Notifications, Full-Page ErrorState, EmptyState with Filtered Variant & Playwright API-Mock Tests"
task_id: task_001
story_id: us_056
epic: EP-010
layer: Frontend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — FE Error & Empty States: ToastProvider Notifications, Full-Page ErrorState, EmptyState with Filtered Variant & Playwright API-Mock Tests

## Requirement Reference

- **User Story**: us_056
- **Story Location**: .propel/context/tasks/EP-010/us_056/us_056.md
- **Acceptance Criteria**:
  - AC-1: `<ToastProvider>` as React Context singleton; `useToast()` hook exposes `showToast({ message, type: 'warning' | 'error' | 'info' })`; fixed bottom-right (`position: fixed; bottom: var(--space-6); right: var(--space-6); z-index: 50`); max 3 stacked (oldest auto-dismissed on 4th); each toast: `role="status"` + `aria-live="polite"`; `⚠` warning icon + concise message + `✕` dismiss button (`aria-label="Dismiss notification"`); 5-second `setTimeout` auto-dismiss; slide-out `transform: translateX(110%)` over 200ms on dismiss; does NOT block pointer events on underlying content; fires on SCR-008 calendar sync failure, SCR-010 SMS failure, SCR-014 queue refresh failure (from EP-005 Hangfire job error events) (UXR-601)
  - AC-2: Full-page error state triggered by TanStack Query `isError` or 30-second fetch timeout; screen-specific headings: SCR-008 → "Patient view unavailable" [correction: SCR-008 calendar → "Calendar unavailable"], SCR-014 → "Queue could not be loaded", SCR-001 → inline form error only (no full-page), SCR-016 → "Patient view unavailable", SCR-018 → "Code suggestions unavailable"; "Try again" button → TanStack Query `refetch()`; "Go to dashboard" secondary `<Link>` → role-specific dashboard path; NO HTTP status codes, stack traces, or internal entity IDs exposed to user; `<title>` updated to `Error — [Screen Name] | PropelIQ Health` via React Helmet or `document.title`; targets: SCR-001 (inline form error only), SCR-008, SCR-014, SCR-016, SCR-018 (UXR-602)
  - AC-3: `<EmptyState>` renders ONLY when `isSuccess === true && data.length === 0` (not during loading); 5 inline SVG React components: `CalendarEmptyIllustration` (calendar icon, SCR-008), `DocumentEmptyIllustration` (document icon, SCR-015), `PeopleEmptyIllustration` (people icon, SCR-019), `MedicalChartEmptyIllustration` (chart icon, SCR-018), `ClipboardEmptyIllustration` (clipboard icon, SCR-014); screen-specific headings + contextual CTAs: SCR-008 → "Book your first appointment" (→ `/booking`), SCR-015 → "Upload your first document" (→ file chooser trigger), SCR-019 → "Invite a user" (→ SCR-020 form), SCR-018 → "Retry code generation" (→ coding API `refetch()`), SCR-014 → "Check back later" (static text); `isFiltered: boolean` prop: SCR-019 filtered → "No users match your search" + "Clear search" CTA; not filtered → "No users yet" + "Invite a user" CTA (UXR-603)
  - AC-4: Toast: dismiss animation `translateX(110%)` over 200ms; cancel `setTimeout` on manual dismiss; `<ToastProvider>` wraps app root in `main.tsx`; Playwright: toast slides in ≤ 500ms of trigger; toast absent from DOM at 5.5 seconds (UXR-601)
  - AC-5: Playwright API-mock tests: toast appears within 500ms of mocked calendar sync failure (SCR-008); full-page `<ErrorState>` within 300ms of mocked HTTP 500 response on SCR-014; "Try again" button click → network request count increments by 1; `<EmptyState>` on SCR-014 and SCR-015 with correct illustrations; "Upload your first document" CTA → `waitForFileChooser()` resolves; no full-page error during active skeleton loading (`isLoading` phase) (UXR-601, UXR-602, UXR-603)

- **Edge Cases**:
  - State machine: `isLoading → skeleton (us_055)` | `isError → <ErrorState>` | `isSuccess && data.length === 0 → <EmptyState>` | `isSuccess && data.length > 0 → render data`; `<EmptyState>` NEVER renders while `isLoading` is true
  - Edge Case: Toast max-3 stack — 4th toast arrives while 3 are visible → oldest is auto-dismissed immediately (no queue; newest replaces oldest); Playwright test: trigger 4 toasts rapidly; assert count ≤ 3
  - Edge Case: Inline SVG illustrations must NOT use `<img src>` tags (bundle-inlined to avoid asset load failure during offline/flaky network); all 5 illustrations are React SVG components with `aria-hidden="true"` (decorative — adjacent heading provides label)
  - Edge Case: SCR-001 login failure → inline form-level error only; no full-page `<ErrorState>` on authentication screens; form error must not echo server 401 message verbatim (static client string)
  - Edge Case: `<EmptyState>` on SCR-018 (medical coding) → "Retry code generation" CTA calls `refetch()` directly, not a navigation link — keeps user on screen

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes — all screens (toast); SCR-008, SCR-014, SCR-015, SCR-016, SCR-018, SCR-019 (error/empty states) |
| **Figma URL** | .propel/context/docs/figma_spec.md — UXR-601, UXR-602, UXR-603 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/ — all relevant screens; wireframe-shared.css defines `.toast`, `.toast-container`, `.empty-state`, `.error-state` class patterns |
| **Screen Spec** | SCR-001 (inline only), SCR-008, SCR-010, SCR-014, SCR-015, SCR-016, SCR-018, SCR-019, SCR-020, SCR-021 |
| **UXR Requirements** | UXR-601, UXR-602, UXR-603 |
| **Design Tokens** | `var(--space-6)`; `z-index: 50`; `var(--color-error)` (red-600); `var(--color-warning)` (amber-500); 200ms transition |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React 18 + TypeScript 5 | — |
| Data Fetching | TanStack Query (React Query) | — |
| Styling | TailwindCSS 3.x | — |
| Testing | Playwright (with `page.route()` API mocking) | — |

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
| **Mobile Impact** | Yes — toast fixed bottom-right does not overlap keyboard on mobile; empty state SVGs scale responsively; error state "Go to dashboard" link usable at 375px |
| **Platform Target** | Web (responsive) |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Implement `<ToastProvider>` (React Context + `useToast()` hook) with fixed bottom-right stacking (max 3), 5-second auto-dismiss, slide-out animation, and `aria-live="polite"`. Implement `<ErrorState>` component with screen-specific headings, "Try again" refetch, "Go to dashboard" link, no technical detail exposure, and `<title>` update. Implement `<EmptyState>` with 5 inline SVG illustration components, screen-specific headings, contextual CTAs, and `isFiltered` variant. Wire state machine to TanStack Query `isLoading`/`isError`/`isSuccess` in 5 screens. Add Playwright API-mock tests for all three states.

---

## Dependent Tasks

- us_055 task_001 (EP-010) — skeleton components must exist (state machine: `isLoading → skeleton` comes first)
- US_001 (EP-TECH) — TanStack Query client configured; 5 screens scaffolded
- EP-005 (Hangfire jobs) — Calendar sync + SMS job error events trigger toast notifications

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `client/src/context/ToastContext.tsx` | CREATE | React Context + `useToast()` hook; `ToastProvider` component |
| `client/src/components/shared/Toast.tsx` | CREATE | Single toast item: `role="status"` + `aria-live`; icon; message; dismiss button; slide-out animation |
| `client/src/components/shared/ToastContainer.tsx` | CREATE | Fixed bottom-right container; max-3 stacking; manages dismiss timer |
| `client/src/components/shared/ErrorState.tsx` | CREATE | Screen-specific heading prop; "Try again" + "Go to dashboard" buttons; no technical detail; `document.title` update |
| `client/src/components/shared/EmptyState.tsx` | CREATE | `heading`, `cta`, `illustration`, `isFiltered` props; conditional CTA behaviour |
| `client/src/components/illustrations/CalendarEmptyIllustration.tsx` | CREATE | Inline SVG React component; `aria-hidden="true"` |
| `client/src/components/illustrations/DocumentEmptyIllustration.tsx` | CREATE | Inline SVG; `aria-hidden="true"` |
| `client/src/components/illustrations/PeopleEmptyIllustration.tsx` | CREATE | Inline SVG; `aria-hidden="true"` |
| `client/src/components/illustrations/MedicalChartEmptyIllustration.tsx` | CREATE | Inline SVG; `aria-hidden="true"` |
| `client/src/components/illustrations/ClipboardEmptyIllustration.tsx` | CREATE | Inline SVG; `aria-hidden="true"` |
| `client/src/main.tsx` | MODIFY | Wrap `<App>` in `<ToastProvider>` |
| `client/src/features/booking/BookingCalendar.tsx` (SCR-008) | MODIFY | Wire `isError → <ErrorState>`; `isSuccess && empty → <EmptyState isFiltered={false}`>; `useToast` for Hangfire job errors |
| `client/src/features/queue/QueueView.tsx` (SCR-014) | MODIFY | Wire `isError → <ErrorState>`; `isSuccess && empty → <EmptyState isFiltered={false}>`; `useToast` |
| `client/src/features/patients/Documents.tsx` (SCR-015) | MODIFY | Wire `isSuccess && empty → <EmptyState>` with upload CTA |
| `client/src/features/patients/View360.tsx` (SCR-016) | MODIFY | Wire `isError → <ErrorState>` |
| `client/src/features/coding/CodingPanel.tsx` (SCR-018) | MODIFY | Wire `isError → <ErrorState>`; `isSuccess && empty → <EmptyState>` with `refetch` CTA |
| `client/src/features/admin/AdminUsers.tsx` (SCR-019) | MODIFY | Wire `isSuccess && empty → <EmptyState isFiltered={searchActive}>`; "Invite a user" vs "No users match your search" |
| `client/tests/error-states/error-empty-states.spec.ts` | CREATE | Playwright API-mock tests for toast, error state, empty state |

---

## Implementation Plan

1. Create `ToastContext.tsx`:
   ```tsx
   interface Toast { id: string; message: string; type: 'warning' | 'error' | 'info'; }
   const ToastContext = createContext<{ showToast: (t: Omit<Toast, 'id'>) => void }>(null!);
   
   export function ToastProvider({ children }) {
     const [toasts, setToasts] = useState<Toast[]>([]);
     
     const showToast = (t: Omit<Toast, 'id'>) => {
       const id = crypto.randomUUID();
       setToasts(prev => {
         const next = [...prev, { ...t, id }];
         return next.length > 3 ? next.slice(1) : next; // oldest dropped on 4th
       });
       const timer = setTimeout(() => dismissToast(id), 5000);
       // store timer reference for cancellation on manual dismiss
     };
     
     const dismissToast = (id: string) => {
       // trigger slide-out animation, then remove from state after 200ms
     };
     
     return (
       <ToastContext.Provider value={{ showToast }}>
         {children}
         <ToastContainer toasts={toasts} onDismiss={dismissToast} />
       </ToastContext.Provider>
     );
   }
   
   export const useToast = () => useContext(ToastContext);
   ```

2. Create `Toast.tsx`: render `role="status"` `aria-live="polite"` div; `⚠` icon (Heroicons `ExclamationTriangleIcon`); message text; `<button aria-label="Dismiss notification" onClick={onDismiss}>✕</button>`; apply slide-in/slide-out CSS: `transition-transform duration-200` + `translate-x-0` (visible) → `translate-x-[110%]` (dismissed)

3. Create `ToastContainer.tsx`: `position: fixed; bottom: var(--space-6, 1.5rem); right: var(--space-6, 1.5rem); z-index: 50`; stack toasts vertically with `gap-2`; `pointer-events: none` on container (each toast has `pointer-events: auto`)

4. Create `ErrorState.tsx`:
   ```tsx
   interface ErrorStateProps {
     heading: string; // e.g. "Queue could not be loaded"
     onRetry: () => void; // TanStack Query refetch
     dashboardPath: string; // role-specific
   }
   ```
   - Renders heading, body text ("Something went wrong. Please try again."), "Try again" `<button onClick={onRetry}>`, "Go to dashboard" `<Link to={dashboardPath}>`
   - Updates `document.title` to `Error — [heading split] | PropelIQ Health` on mount; restores on unmount
   - NEVER renders HTTP status code, stack trace, or entity ID

5. Create `EmptyState.tsx`:
   ```tsx
   interface EmptyStateProps {
     illustration: ReactNode;
     heading: string;
     cta: ReactNode; // can be <Link>, <button onClick={refetch}>, or static <p>
     isFiltered?: boolean;
     filteredHeading?: string;
     filteredCta?: ReactNode;
   }
   ```
   - When `isFiltered` is true: renders `filteredHeading` + `filteredCta`
   - When `isFiltered` is false or undefined: renders `heading` + `cta`
   - Illustration: passed as prop (inline SVG React component)

6. Create 5 SVG illustration components: each is a React component with `aria-hidden="true"` (decorative); simple icon-level SVGs (not complex illustrations) matching platform design system tone; approximately 80×80px; `fill="currentColor"` using design token colors

7. Wire state machine in each screen:
   ```tsx
   const { data, isLoading, isError, refetch } = useQuery(...)
   if (isLoading) return <CalendarSkeleton />;             // us_055
   if (isError) return <ErrorState heading="Calendar unavailable" onRetry={refetch} dashboardPath={...} />;
   if (data?.length === 0) return <EmptyState illustration={<CalendarEmptyIllustration />} heading="No appointments yet" cta={<Link to="/booking">Book your first appointment</Link>} />;
   return <CalendarContent data={data} />;
   ```

8. SCR-019 `isFiltered` variant:
   ```tsx
   const isFiltered = searchQuery.length > 0;
   if (data?.length === 0) return (
     <EmptyState
       illustration={<PeopleEmptyIllustration />}
       heading="No users yet"
       cta={<Link to="/admin/users/new">Invite a user</Link>}
       isFiltered={isFiltered}
       filteredHeading="No users match your search"
       filteredCta={<button onClick={() => setSearchQuery('')}>Clear search</button>}
     />
   );
   ```

9. Wire `<ToastProvider>` in `main.tsx`:
   ```tsx
   root.render(<ToastProvider><App /></ToastProvider>)
   ```

10. Create `error-empty-states.spec.ts` Playwright API-mock tests:
    ```ts
    test('Toast appears within 500ms of calendar sync failure on SCR-008', async ({ page }) => {
      await page.route('/api/calendar/sync', r => r.fulfill({ status: 500 }));
      await page.goto('/booking');
      await page.waitForSelector('[role="status"]', { timeout: 500 });
    });
    
    test('Full-page ErrorState within 300ms of mocked 500 on SCR-014', async ({ page }) => {
      await page.route('/api/queue*', r => r.fulfill({ status: 500 }));
      await page.goto('/queue');
      await page.waitForSelector('[data-testid="error-state"]', { timeout: 300 });
    });
    
    test('"Try again" on SCR-014 increments request count by 1', async ({ page }) => {
      let requestCount = 0;
      await page.route('/api/queue*', r => { requestCount++; r.fulfill({ status: 500 }); });
      await page.goto('/queue');
      await page.click('[data-testid="error-state-retry"]');
      await page.waitForTimeout(200);
      expect(requestCount).toBe(2); // initial load + retry
    });
    
    test('EmptyState on SCR-015 shows DocumentEmptyIllustration', async ({ page }) => {
      await page.route('/api/documents*', r => r.fulfill({ status: 200, body: '[]' }));
      await page.goto('/documents');
      await page.waitForSelector('[data-testid="empty-state"]', { timeout: 300 });
      await expect(page.locator('[data-testid="illustration-document"]')).toBeVisible();
    });
    
    test('Upload CTA on SCR-015 opens file chooser', async ({ page }) => {
      await page.route('/api/documents*', r => r.fulfill({ status: 200, body: '[]' }));
      await page.goto('/documents');
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click('[data-testid="empty-state-cta"]'),
      ]);
      expect(fileChooser).toBeTruthy();
    });
    
    test('No full-page error during skeleton loading on SCR-016', async ({ page }) => {
      let resolveRequest: () => void;
      await page.route('/api/patients/*', r => {
        new Promise(res => { resolveRequest = res; }).then(() => r.continue());
      });
      await page.goto('/patients/123');
      // Error state should not appear while loading
      const errorState = await page.locator('[data-testid="error-state"]').count();
      expect(errorState).toBe(0);
      resolveRequest!();
    });
    
    test('Toast absent from DOM at 5.5 seconds', async ({ page }) => {
      // trigger toast and wait 5.5 seconds
      await page.goto('/queue');
      await page.evaluate(() => window.__toastCtx?.showToast({ message: 'Test', type: 'info' }));
      await page.waitForTimeout(5500);
      const toasts = await page.locator('[role="status"]').count();
      expect(toasts).toBe(0);
    });
    ```

---

## Current Project State

```
client/
├── src/
│   ├── context/ToastContext.tsx             ← CREATE
│   ├── components/
│   │   ├── shared/
│   │   │   ├── Toast.tsx                    ← CREATE
│   │   │   ├── ToastContainer.tsx           ← CREATE
│   │   │   ├── ErrorState.tsx               ← CREATE
│   │   │   └── EmptyState.tsx               ← CREATE
│   │   └── illustrations/                   ← CREATE all 5 SVG components
│   ├── main.tsx                             ← MODIFY (wrap in ToastProvider)
│   └── features/
│       ├── booking/BookingCalendar.tsx       ← MODIFY (state machine)
│       ├── queue/QueueView.tsx              ← MODIFY
│       ├── patients/Documents.tsx           ← MODIFY
│       ├── patients/View360.tsx             ← MODIFY
│       ├── coding/CodingPanel.tsx           ← MODIFY
│       └── admin/AdminUsers.tsx             ← MODIFY (isFiltered variant)
└── tests/error-states/
    └── error-empty-states.spec.ts           ← CREATE
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `client/src/context/ToastContext.tsx` | Context + `useToast()` hook + `<ToastProvider>`; max-3 stacking; 5s auto-dismiss; cancel on manual dismiss |
| CREATE | `client/src/components/shared/Toast.tsx` | Single toast; `role="status"`; `aria-live="polite"`; dismiss button; slide-out animation |
| CREATE | `client/src/components/shared/ToastContainer.tsx` | Fixed bottom-right; `pointer-events: none` on container |
| CREATE | `client/src/components/shared/ErrorState.tsx` | Screen-specific heading; "Try again" refetch; "Go to dashboard" link; no technical detail; `document.title` update |
| CREATE | `client/src/components/shared/EmptyState.tsx` | `isFiltered` variant; illustration prop; screen-specific CTA |
| CREATE | `client/src/components/illustrations/*.tsx` | 5 inline SVG illustration components; `aria-hidden="true"` |
| MODIFY | `client/src/main.tsx` | Wrap `<App>` in `<ToastProvider>` |
| MODIFY | `client/src/features/booking/BookingCalendar.tsx` | `isError → ErrorState`; `isSuccess && empty → EmptyState`; toast hook |
| MODIFY | `client/src/features/queue/QueueView.tsx` | State machine; toast hook |
| MODIFY | `client/src/features/patients/Documents.tsx` | `isSuccess && empty → EmptyState` with upload CTA |
| MODIFY | `client/src/features/patients/View360.tsx` | `isError → ErrorState` |
| MODIFY | `client/src/features/coding/CodingPanel.tsx` | `isError → ErrorState`; `isSuccess && empty → EmptyState` with refetch CTA |
| MODIFY | `client/src/features/admin/AdminUsers.tsx` | `isSuccess && empty → EmptyState` with `isFiltered` prop |
| CREATE | `client/tests/error-states/error-empty-states.spec.ts` | 6 Playwright API-mock tests |

---

## External References

- [React Context — Provider pattern](https://react.dev/reference/react/createContext)
- [TanStack Query — `isError`, `isSuccess`, `refetch`](https://tanstack.com/query/latest/docs/react/reference/useQuery)
- [Playwright — `page.route()` API mocking](https://playwright.dev/docs/mock)
- [Playwright — `waitForFileChooser()`](https://playwright.dev/docs/api/class-page#page-wait-for-file-chooser)
- [WAI-ARIA — Live regions](https://www.w3.org/TR/wai-aria-1.2/#aria-live)

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm run lint`
- `cd client && npx playwright test tests/error-states/`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `useToast().showToast(...)` renders toast with `role="status"` + `aria-live="polite"` in fixed bottom-right position
- [ ] 4th toast triggers immediate dismiss of oldest; max 3 visible at any time
- [ ] Toast auto-dismisses at 5 seconds; absent from DOM by 5.5 seconds
- [ ] Manual dismiss → slide-out animation plays (200ms) before DOM removal
- [ ] `<ErrorState>`: no HTTP status codes, stack traces, or entity IDs rendered
- [ ] `<ErrorState>` "Try again" button → `refetch()` called; Playwright confirms request count +1
- [ ] `<ErrorState>` `document.title` updated to "Error — Queue | PropelIQ Health" on SCR-014
- [ ] `<EmptyState>` NEVER rendered while TanStack Query `isLoading` is true
- [ ] SCR-019 with `isFiltered=true`: shows "No users match your search" + "Clear search" CTA
- [ ] SCR-019 with `isFiltered=false`: shows "No users yet" + "Invite a user" CTA
- [ ] SCR-015 empty state "Upload your first document" → `waitForFileChooser()` resolves in Playwright
- [ ] 5 SVG illustrations are inline React components (not `<img>` tags); all have `aria-hidden="true"`
- [ ] Playwright: toast ≤ 500ms from Hangfire error event; ErrorState ≤ 300ms from mocked 500; no error state during `isLoading`

---

## Implementation Checklist

- [ ] Create `ToastContext.tsx`: React Context; `useToast()`; max-3 stacking (oldest dropped on 4th); 5s `setTimeout` + cancel on manual dismiss
- [ ] Create `Toast.tsx`: `role="status"` + `aria-live="polite"`; `⚠` icon; `✕` dismiss button; slide-out `translateX(110%)` over 200ms
- [ ] Create `ToastContainer.tsx`: fixed bottom-right; `z-index: 50`; `pointer-events: none` on container; each toast `pointer-events: auto`
- [ ] Update `main.tsx`: wrap `<App>` in `<ToastProvider>`
- [ ] Create `ErrorState.tsx`: heading prop; no technical detail; "Try again" + "Go to dashboard"; `document.title` update on mount/unmount
- [ ] Create `EmptyState.tsx`: `isFiltered` variant; illustration prop; screen-specific heading/CTA
- [ ] Create 5 inline SVG illustration React components with `aria-hidden="true"`
- [ ] Wire state machine (skeleton → ErrorState → EmptyState → data) in SCR-008, SCR-014, SCR-015, SCR-016, SCR-018, SCR-019
- [ ] Create `error-empty-states.spec.ts`: 6 Playwright API-mock tests (toast timing; ErrorState timing; retry request count; EmptyState illustrations; file chooser; no error during loading)
