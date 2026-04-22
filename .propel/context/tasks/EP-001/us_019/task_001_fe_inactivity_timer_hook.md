---
title: "Task — FE Inactivity Timer Hook"
task_id: task_001
story_id: us_019
epic: EP-001
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Inactivity Timer Hook

## Requirement Reference

- **User Story**: us_019
- **Story Location**: .propel/context/tasks/EP-001/us_019/us_019.md
- **Acceptance Criteria**:
  - AC-1: After 13 minutes of inactivity (mouse, key, API call), trigger the warning modal display
  - AC-5: Any user interaction (mouse movement, click, keypress, scroll) resets the inactivity timer to 0; modal does NOT appear; no API call is fired
  - AC-6: Server-side JWT expiry (15-min TTL) is the authoritative enforcement; client timer provides UX feedback only
- **Edge Cases**:
  - Multi-tab scenario: timer runs independently per tab; extending in one tab issues new JWT used by other tabs on next call
  - Extension `POST /api/auth/refresh` failure: modal stays visible with error message; countdown continues to zero

---

## Design References (Frontend Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No |
| **Figma URL** | N/A |
| **Wireframe Status** | N/A |
| **Wireframe Type** | N/A |
| **Wireframe Path/URL** | N/A |
| **Screen Spec** | N/A |
| **UXR Requirements** | N/A |
| **Design Tokens** | N/A |

> This task produces a headless React hook only; no visual rendering. The modal UI is in task_002.

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript | React 18, TypeScript 5 |
| Frontend | TailwindCSS | 3.x |
| Backend | ASP.NET Core Web API | .NET 9 |
| Database | PostgreSQL | 16 |

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

Implement the `useInactivityTimer` React custom hook that tracks user inactivity across all authenticated screens (SCR-002 through SCR-021). The hook attaches debounced event listeners to `mousemove`, `keydown`, `click`, and `scroll` DOM events. When 13 minutes of inactivity elapse, the hook transitions to a "warning" state, triggering the session-expiry modal (rendered by task_002). When 15 minutes elapse (2 additional minutes of no action after warning), the hook transitions to an "expired" state, triggering the automatic logout flow. All timer logic is encapsulated in the hook; no API calls are made from the hook itself — callbacks are injected by the consumer.

---

## Dependent Tasks

- US_018 (login flow / JWT session context) must be merged; the hook reads the active JWT access token presence to know whether to activate.
- US_005 (JWT infrastructure) must be complete; `/api/auth/refresh` and `/api/auth/logout` endpoints must be callable.

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `app/src/hooks/useInactivityTimer.ts` | CREATE | New custom hook |
| `app/src/contexts/AuthContext.tsx` | MODIFY | Integrate `useInactivityTimer` in authenticated context provider |

---

## Implementation Plan

1. **Define hook API** — `useInactivityTimer({ warningThresholdMs, expiredThresholdMs, onWarn, onExpire, onReset })` with injectable callbacks.
2. **Attach DOM event listeners** — Register `mousemove`, `keydown`, `click`, and `scroll` on `window` within a `useEffect`. Return cleanup function removing all listeners on unmount.
3. **Implement debounced reset** — Debounce the reset handler at 300 ms to avoid excessive timer clears on rapid mouse moves. Use `useRef` for the debounce timer to avoid stale closures.
4. **Dual-phase timer** — Use two `setTimeout` refs (warning at 13 min, expiry at 15 min). On any reset event, clear both timeouts and reschedule from zero.
5. **State machine** — Maintain `timerState: 'active' | 'warning' | 'expired'` via `useReducer`. Transitions: `active → warning` at 13 min, `warning → expired` at 15 min total, `warning | active → active` on any user interaction.
6. **Activation guard** — Hook is dormant when no valid access token is present in `AuthContext`; start listening only when `isAuthenticated === true`.
7. **Cleanup** — On `isAuthenticated` change to `false` (logout), clear all timers and reset state to `active`.

---

## Current Project State

```
app/
  src/
    hooks/           # (to be created)
    contexts/
      AuthContext.tsx
    components/
    pages/
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | app/src/hooks/useInactivityTimer.ts | Custom hook with dual-phase inactivity timer, debounced reset, injectable callbacks |
| MODIFY | app/src/contexts/AuthContext.tsx | Mount `useInactivityTimer` inside authenticated context; pass `onWarn` / `onExpire` to control modal and logout state |

---

## External References

- React `useEffect` cleanup: https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development
- React `useReducer` for state machines: https://react.dev/reference/react/useReducer
- `useRef` for timers (avoids stale closure): https://react.dev/learn/referencing-values-with-refs
- Debouncing in React hooks: https://www.developerway.com/posts/debouncing-in-react

---

## Build Commands

- `cd app && npm run build` — TypeScript compile check
- `cd app && npm run lint` — ESLint validation
- `cd app && npm test -- --testPathPattern=useInactivityTimer` — Run hook unit tests

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] Hook activates only when `isAuthenticated === true`
- [ ] Timer fires `onWarn` callback at exactly 13 minutes of zero interaction
- [ ] Timer fires `onExpire` callback at exactly 15 minutes of zero interaction
- [ ] Any DOM event resets both timers and calls `onReset`; no false `onWarn` fires
- [ ] Listeners are removed on unmount (no memory leaks)
- [ ] Multiple rapid mouse events do not create unbounded setTimeout accumulation

---

## Implementation Checklist

- [ ] Create `app/src/hooks/useInactivityTimer.ts` with full TypeScript types for options and state
- [ ] Define `TimerState` type: `'active' | 'warning' | 'expired'`
- [ ] Implement `useReducer` state machine with `WARN`, `EXPIRE`, and `RESET` actions
- [ ] Attach debounced `window` event listeners (`mousemove`, `keydown`, `click`, `scroll`) in `useEffect`
- [ ] Schedule `warningTimeout` (13 min) and `expiryTimeout` (15 min) using `useRef`-stored handles
- [ ] Clear and reschedule both timeouts on every reset event
- [ ] Guard hook activation behind `isAuthenticated` flag from `AuthContext`
- [ ] Integrate hook into `AuthContext.tsx` with `onWarn` showing the modal and `onExpire` triggering logout
