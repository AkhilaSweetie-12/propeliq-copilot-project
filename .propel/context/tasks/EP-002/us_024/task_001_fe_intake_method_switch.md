---
title: "Task — FE Intake Method Switch with Data Preservation"
task_id: task_001
story_id: us_024
epic: EP-002
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Intake Method Switch with Data Preservation

## Requirement Reference

- **User Story**: us_024
- **Story Location**: .propel/context/tasks/EP-002/us_024/us_024.md
- **Acceptance Criteria**:
  - AC-1: SCR-006 "Switch to manual form" (`#btn-switch-manual`) → `GET /api/intake/current-data` → navigate to SCR-007 with all returned fields pre-filled; no data lost
  - AC-2: SCR-007 "Switch to AI chat" (`#btn-switch-ai`) → `POST /api/intake/draft {current_form_state}` (save first) → on success → `GET /api/intake/current-data` → navigate to SCR-006 with greeting acknowledging filled fields + sidebar chips reflecting pre-filled sections
  - AC-3: On next draft/submit call after switch, `intake_method` enum updated to reflect current mode
  - AC-4: In-flight Ollama API call when switch clicked → `AbortController.abort()` → proceed immediately to `GET /api/intake/current-data` with last persisted state; no partial/uncommitted LLM output surfaced; no error shown to patient
  - AC-5: All 5 sections complete → switch still available; target screen pre-filled with all 5 sections; "Review answers →" directly accessible
- **Edge Cases**:
  - `GET /api/intake/current-data` returns empty → target screen opens with all fields empty (no error)
  - Save-before-switch `POST /api/intake/draft` fails → toast "Could not save your progress before switching — please try again"; switch cancelled; form state preserved in memory

---

## Design References (Frontend Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-006-ai-intake-chat.html, .propel/context/wireframes/Hi-Fi/wireframe-SCR-007-manual-intake.html |
| **Screen Spec** | .propel/context/docs/figma_spec.md#SCR-006, .propel/context/docs/figma_spec.md#SCR-007 |
| **UXR Requirements** | UXR-004 (auto-save triggered before Manual→AI switch), UXR-501 (switch button spinner while `GET /api/intake/current-data` in-flight >500 ms) |
| **Design Tokens** | designsystem.md#colors, designsystem.md#typography |

### CRITICAL: Wireframe Implementation Requirement

**Wireframe Status = AVAILABLE** — MUST open both wireframes and confirm switch button placement and spinner behaviour match. Implement switch button states: default, loading (spinner), disabled (during save-before-switch). Validate at 375 px, 768 px, 1440 px.

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript | React 18, TypeScript 5 |
| Frontend | TailwindCSS | 3.x |
| Backend | ASP.NET Core Web API | .NET 9 |
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

Implement the intake method switch logic on both SCR-006 (AI→Manual) and SCR-007 (Manual→AI). Each switch button orchestrates a specific sequence: save-before-switch (Manual→AI only), abort in-flight LLM call (AI→Manual only), fetch current data, and navigate to the target screen with pre-filled data. A custom `useIntakeSwitch` hook centralises the switch orchestration to avoid duplicating this logic in both page components.

---

## Dependent Tasks

- us_022 task_001 — `AiIntakeChatPage` must exist with `AbortController` ref for in-flight LLM request
- us_023 task_001 — `ManualIntakePage` must exist with React Hook Form `getValues()` accessible
- task_002 (BE Current-Data endpoint) — `GET /api/intake/current-data` must be available

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `app/src/hooks/useIntakeSwitch.ts` | CREATE | Switch orchestration hook: save-before-switch, abort in-flight, fetch current data, navigate |
| `app/src/pages/intake/AiIntakeChatPage.tsx` | MODIFY | Wire `#btn-switch-manual` to `useIntakeSwitch`; pass `AbortController` ref |
| `app/src/pages/intake/ManualIntakePage.tsx` | MODIFY | Wire `#btn-switch-ai` to `useIntakeSwitch`; pass `getValues()` for save-before-switch |
| `app/src/api/intakeApi.ts` | MODIFY | Add `getIntakeCurrentData()` typed API function |

---

## Implementation Plan

1. **`useIntakeSwitch` hook** — Accepts `{ currentMode: 'ai' | 'manual', getFormValues?, abortRef? }`. Returns `{ switchTo(targetMode), isSwitching, switchError }`.

2. **AI→Manual switch** (`#btn-switch-manual` on SCR-006):
   - Call `abortRef.current?.abort()` to cancel any in-flight `POST /api/intake/chat`
   - Set `isSwitching = true`; show spinner on switch button (UXR-501)
   - Call `GET /api/intake/current-data`
   - On success: navigate to `/intake/manual` passing `{ prefillData }` via React Router location state
   - Empty response: navigate with empty state (no error)
   - `ManualIntakePage` reads location state and calls `form.reset(prefillData)` on mount

3. **Manual→AI switch** (`#btn-switch-ai` on SCR-007):
   - Set `isSwitching = true`; disable switch button
   - Call `POST /api/intake/draft { ...getFormValues() }` to persist current form state
   - On draft failure: toast "Could not save your progress before switching — please try again"; set `isSwitching = false`; cancel switch
   - On draft success: call `GET /api/intake/current-data`
   - Navigate to `/intake/ai` passing `{ prefillData }` via React Router location state
   - `AiIntakeChatPage` reads location state; updates `FieldCompletionSidebar` chips; sends initial greeting acknowledging pre-filled sections

4. **Pre-fill in SCR-006 on switch arrival** — On mount, if `location.state?.prefillData` present: update `extractedFieldsSoFar` state from pre-fill data map; render AI greeting bubble acknowledging already-captured sections (e.g., "I can see you've already provided your medications — let me continue with your allergies").

5. **`intake_method` update** — On the next `POST /api/intake/draft` or `POST /api/intake/submit` call after the switch, the payload includes `intake_method: 'ai' | 'manual'` reflecting the current mode. No explicit API call just for method update.

6. **Switch button states** — Default: "Switch to manual form" / "Switch to AI chat"; Loading: spinner + text disabled; Error: switch cancelled (user sees toast).

---

## Current Project State

```
app/
  src/
    pages/
      intake/
        IntakeMethodPage.tsx    # from us_022
        AiIntakeChatPage.tsx    # from us_022
        ManualIntakePage.tsx    # from us_023
        IntakeReviewPage.tsx    # from us_023
    hooks/
    api/
      intakeApi.ts
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | app/src/hooks/useIntakeSwitch.ts | Switch orchestration: save-before-switch, abort, fetch, navigate |
| MODIFY | app/src/pages/intake/AiIntakeChatPage.tsx | Wire `#btn-switch-manual` to hook; pass `AbortController` ref; handle `location.state.prefillData` on arrival |
| MODIFY | app/src/pages/intake/ManualIntakePage.tsx | Wire `#btn-switch-ai` to hook; pass `getValues()`; read `location.state.prefillData` on arrival |
| MODIFY | app/src/api/intakeApi.ts | Add `getIntakeCurrentData()` returning full `patient_intakes` field map |

---

## External References

- `AbortController` for cancelling fetch requests: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
- React Router `useNavigate` with state: https://reactrouter.com/en/main/hooks/use-navigate
- React Router `useLocation` for reading navigation state: https://reactrouter.com/en/main/hooks/use-location
- React `useRef` for `AbortController` lifecycle: https://react.dev/learn/referencing-values-with-refs

---

## Build Commands

- `cd app && npm run build` — TypeScript compile check
- `cd app && npm run lint` — ESLint validation
- `cd app && npm test -- --testPathPattern=useIntakeSwitch` — Run hook tests

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] **[UI Tasks]** Switch button spinner renders during `GET /api/intake/current-data` in-flight >500 ms
- [ ] AI→Manual: in-flight LLM call aborted; SCR-007 pre-filled from `current-data`
- [ ] AI→Manual with empty response: SCR-007 opens with all fields empty; no error
- [ ] Manual→AI: `POST /api/intake/draft` fires before switch; SCR-006 chips reflect pre-filled sections
- [ ] Manual→AI draft failure: toast shown; switch cancelled; form state preserved
- [ ] AI greeting on SCR-006 after switch acknowledges already-filled sections
- [ ] Multiple sequential switches (AI→Manual→AI→Manual): each loads latest persisted state
- [ ] `intake_method` updated correctly on next draft/submit after switch

---

## Implementation Checklist

- [ ] Create `useIntakeSwitch.ts` hook with `switchTo(targetMode)`, `isSwitching`, `switchError`
- [ ] Implement AI→Manual path: abort in-flight ref, `GET /api/intake/current-data`, navigate with state
- [ ] Implement Manual→AI path: save-before-switch draft POST, failure toast + cancel, fetch, navigate
- [ ] Add `getIntakeCurrentData()` to `intakeApi.ts` with typed return shape
- [ ] Modify `AiIntakeChatPage.tsx`: wire `#btn-switch-manual` button; store `AbortController` ref; read arrival `location.state.prefillData` to update chips + initial greeting
- [ ] Modify `ManualIntakePage.tsx`: wire `#btn-switch-ai` button; pass `getValues()` to hook; read arrival `location.state.prefillData` to call `form.reset(prefillData)`
- [ ] Implement switch button spinner state (UXR-501)
- [ ] Ensure `#btn-switch-manual` and `#btn-switch-ai` IDs are present for testing hooks
