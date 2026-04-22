---
title: "Task — FE Session Expiry Warning Modal"
task_id: task_002
story_id: us_019
epic: EP-001
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — FE Session Expiry Warning Modal

## Requirement Reference

- **User Story**: us_019
- **Story Location**: .propel/context/tasks/EP-001/us_019/us_019.md
- **Acceptance Criteria**:
  - AC-1: Warning modal displays at 13-min inactivity with message, 2-min live countdown, "Extend Session" (primary) and "Sign out" (ghost) buttons; full-viewport overlay blocking interaction
  - AC-2: "Extend Session" → `POST /api/auth/refresh` → dismiss modal, reset inactivity timer to 13 min; user stays on current screen
  - AC-3: "Sign out" in modal → `POST /api/auth/logout` → blocklist JWT, navigate to SCR-001
  - AC-4: Countdown reaches 0 → auto-call `POST /api/auth/logout` → navigate to SCR-001 with toast "You were signed out due to inactivity"; unsaved form state cleared
- **Edge Cases**:
  - `POST /api/auth/refresh` fails: modal stays visible with error message "Unable to extend session — check your connection"; countdown continues; at zero, proceeds to auto-logout
  - Mid-form entry at expiry: toast notifies "Unsaved changes may have been lost"; re-authentication restores last auto-saved draft

---

## Design References (Frontend Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A |
| **Wireframe Status** | PENDING |
| **Wireframe Type** | N/A |
| **Wireframe Path/URL** | TODO: Upload to `.propel/context/wireframes/Hi-Fi/wireframe-SCR-session-expiry-modal.[html\|png\|jpg]` or provide external URL |
| **Screen Spec** | .propel/context/docs/figma_spec.md#UXR-503 |
| **UXR Requirements** | UXR-503 (warning modal at 13 min; extend session resets timer; all authenticated SCR-002–SCR-021) |
| **Design Tokens** | designsystem.md#colors, designsystem.md#typography, designsystem.md#spacing |

> **Wireframe Status: PENDING** — No dedicated wireframe exists for the session-expiry modal overlay. Implement using design tokens and UXR-503 specification until wireframe is provided.

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript | React 18, TypeScript 5 |
| Frontend | TailwindCSS | 3.x |
| Backend | ASP.NET Core Web API | .NET 9 |
| Database | PostgreSQL | 16 |
| Library | React Router | v6 |

---

## AI References (AI Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |
| **AI Pattern** | N/A |
| **Prompt Template Path** | N/A |
| **Guardrails Config** | N/A |
| **Model Provider** | N/A |

---

## Mobile References (Mobile Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |
| **Platform Target** | N/A |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Implement the `SessionExpiryModal` React component: a full-viewport overlay that renders when the inactivity timer (task_001) transitions to the `warning` state. The modal displays a live 2-minute countdown decrement in real time (`setInterval` at 1-second tick). It exposes two actions — "Extend Session" (calls `POST /api/auth/refresh`) and "Sign out" (calls `POST /api/auth/logout`). If the countdown reaches zero without user action, the modal auto-invokes logout. The component consumes `AuthContext` for token access and the inactivity timer's `onExtend` / `onExpire` callbacks.

---

## Dependent Tasks

- **task_001** (useInactivityTimer hook) — must be complete; this modal is triggered by the hook's `onWarn` callback
- US_018 / US_005 — `/api/auth/refresh` and `/api/auth/logout` endpoints must be available

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `app/src/components/modals/SessionExpiryModal.tsx` | CREATE | Modal with countdown, extend, signout |
| `app/src/contexts/AuthContext.tsx` | MODIFY | Pass `showExpiryModal` state and handlers to render `SessionExpiryModal` |
| `app/src/hooks/useInactivityTimer.ts` | MODIFY | Expose `resetTimer()` function for extend-session flow |

---

## Implementation Plan

1. **Modal overlay** — Full-viewport semi-transparent backdrop (`fixed inset-0 bg-black/60 z-50`). Trap focus inside the modal using `aria-modal="true"` and `role="dialog"`.
2. **Countdown timer** — On modal open, start a `setInterval` decrementing from 120 seconds. Display formatted `MM:SS`. Clear interval on unmount or modal close.
3. **"Extend Session" handler**:
   - Set loading state on button
   - Call `POST /api/auth/refresh` with current refresh token
   - On success: store new access token via `AuthContext`, dismiss modal, call `resetTimer()` from hook
   - On failure: display error message "Unable to extend session — check your connection" within the modal; countdown continues
4. **"Sign out" handler** — Call `POST /api/auth/logout`, clear auth state, navigate to `/login` (SCR-001) via React Router
5. **Auto-logout on countdown zero** — When `countdown === 0`, call `POST /api/auth/logout` automatically, navigate to `/login`, show toast "You were signed out due to inactivity"
6. **Toast notification** — On auto-logout, fire a toast notification component (global toast context or library) with the expiry message
7. **Accessibility** — `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to title, `aria-describedby` pointing to countdown message; "Sign out" is a ghost button variant from design system

---

## Current Project State

```
app/
  src/
    components/
      modals/        # (to be created)
    contexts/
      AuthContext.tsx
    hooks/
      useInactivityTimer.ts  # created in task_001
    pages/
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | app/src/components/modals/SessionExpiryModal.tsx | Full-viewport overlay modal with countdown, extend/signout actions, error state, auto-logout at zero |
| MODIFY | app/src/contexts/AuthContext.tsx | Manage `isExpiryModalVisible` boolean state; render `<SessionExpiryModal>` conditionally in provider |
| MODIFY | app/src/hooks/useInactivityTimer.ts | Expose `resetTimer()` imperative handle for use after successful token refresh |

---

## External References

- React Dialog accessibility (role, aria-modal, focus trap): https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- React Portal for modals (renders outside root DOM): https://react.dev/reference/react-dom/createPortal
- Countdown timer with useEffect + setInterval: https://react.dev/learn/synchronizing-with-effects
- TailwindCSS modal overlay pattern: https://tailwindcss.com/docs/z-index
- Design tokens — Primary button: `color.brand.teal.500` (`#0D9488`); Ghost button border: `color.neutral.300`; body text: `color.neutral.600` (`#4B5563`)
- Design tokens — Typography: `text.heading.sm` (20px/600) for modal title, `text.body.lg` (16px/400) for message

---

## Build Commands

- `cd app && npm run build` — TypeScript compile check
- `cd app && npm run lint` — ESLint validation
- `cd app && npm test -- --testPathPattern=SessionExpiryModal` — Run component tests

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Modal renders as full-viewport overlay blocking interaction with underlying page
- [ ] Countdown decrements from 120 to 0 in real time (1-second intervals)
- [ ] "Extend Session" calls `POST /api/auth/refresh`; on success modal closes, timer resets
- [ ] "Extend Session" failure shows inline error; countdown continues
- [ ] "Sign out" calls `POST /api/auth/logout` and navigates to `/login`
- [ ] Auto-logout at countdown zero: navigates to `/login` + toast "You were signed out due to inactivity"
- [ ] Focus trapped within modal; keyboard navigation functional; `Escape` key does NOT dismiss (per security intent — no accidental dismissal)
- [ ] WCAG 2.2 AA: `aria-modal`, `aria-labelledby`, `aria-describedby` attributes present

---

## Implementation Checklist

- [ ] Create `app/src/components/modals/SessionExpiryModal.tsx` with TypeScript props interface
- [ ] Implement fixed full-viewport overlay with `z-50` stacking and semi-transparent backdrop
- [ ] Add countdown state (`useState<number>(120)`) with `setInterval` cleanup on unmount
- [ ] Implement "Extend Session" primary button with loading spinner; call `POST /api/auth/refresh`
- [ ] Handle refresh success: dismiss modal, invoke `resetTimer()`, update access token in `AuthContext`
- [ ] Handle refresh failure: render inline error message within modal; do NOT dismiss modal
- [ ] Implement "Sign out" ghost button: call `POST /api/auth/logout`, clear auth, navigate to `/login`
- [ ] Implement auto-logout on `countdown === 0`: call logout API, navigate to `/login`, fire toast
- [ ] Apply ARIA attributes: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- [ ] Integrate modal rendering in `AuthContext.tsx` driven by `isExpiryModalVisible` flag
- [ ] **[UI Tasks - MANDATORY]** Reference wireframe from Design References table during implementation — wireframe PENDING; implement per UXR-503 spec until wireframe provided
- [ ] **[UI Tasks - MANDATORY]** Validate UI matches UXR-503 specification before marking task complete
