---
title: "Task — FE Manual Intake Form (SCR-005, SCR-007, SCR-007b)"
task_id: task_001
story_id: us_023
epic: EP-002
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Manual Intake Form (SCR-005, SCR-007, SCR-007b)

## Requirement Reference

- **User Story**: us_023
- **Story Location**: .propel/context/tasks/EP-002/us_023/us_023.md
- **Acceptance Criteria**:
  - AC-1: Patient selects "Manual Form" on SCR-005 → SCR-007 loads → calls `GET /api/intake/status`; if partial row exists → pre-fill all fields; progress indicator shows "X / 7 sections completed"
  - AC-2: Every 60 s (setInterval), SPA calls `POST /api/intake/draft {partial_fields}`; on success → topbar "✓ Saved X seconds ago" (UXR-004); on failure → "⚠ Save failed — retrying…" + retry after 5 s
  - AC-3: All required fields filled → "Review answers →" → SCR-007b; read-only grouped sections with "Edit" links back to SCR-007; "Confirm & submit intake" calls `POST /api/intake/submit` → navigate to SCR-004
  - AC-4: Blur event on invalid field → red border + error icon + descriptive message (UXR-601); submit button disabled until all valid; validation is client-side only on blur
  - AC-5: "Switch to AI chat" button → triggers switch flow (handled by us_024)
  - AC-6: If `submitted_at` already set → form in edit mode pre-filled; submit calls `PUT /api/intake/{intake_id}` (handled by us_025)
- **Edge Cases**:
  - Auto-save returns HTTP 401 → intercept, attempt token refresh; if refresh fails → session expiry modal; in-memory state preserved
  - Payload exceeds 64 KB → API returns HTTP 413 → inline error "Your entry is too long — please shorten the medical history field"

---

## Design References (Frontend Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-005-intake-method.html, .propel/context/wireframes/Hi-Fi/wireframe-SCR-007-manual-intake.html, .propel/context/wireframes/Hi-Fi/wireframe-SCR-007b-intake-review.html |
| **Screen Spec** | .propel/context/docs/figma_spec.md#SCR-005, .propel/context/docs/figma_spec.md#SCR-007, .propel/context/docs/figma_spec.md#SCR-007b |
| **UXR Requirements** | UXR-004 (60-second auto-save indicator "✓ Saved X seconds ago" in topbar), UXR-601 (inline blur validation — red border, error icon, descriptive message), UXR-501 (submit spinner >500 ms), UXR-204 (visible labels + aria-describedby for all form fields) |
| **Design Tokens** | designsystem.md#colors, designsystem.md#typography, designsystem.md#forms |

### CRITICAL: Wireframe Implementation Requirement

**Wireframe Status = AVAILABLE** — MUST open all three wireframes and match layout, spacing, typography, colors. Implement all states: SCR-007 Default, Loading, Error, Validation; SCR-007b Default, Loading. Validate at 375 px, 768 px, 1440 px.

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript | React 18, TypeScript 5 |
| Frontend | TailwindCSS | 3.x |
| Backend | ASP.NET Core Web API | .NET 9 |
| Library | React Hook Form | v7 |
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

Implement SCR-007 (Manual Intake Form) and SCR-007b (Intake Review & Summary). SCR-007 is a multi-section form (Demographics, Medical History, Medications, Allergies, Chief Complaint) using React Hook Form with on-blur validation. A `setInterval` auto-save fires every 60 s calling `POST /api/intake/draft`. A topbar auto-save indicator updates on success/failure. SCR-007b renders all field values in read-only grouped sections, each with an "Edit" link back to the matching section in SCR-007. The "Confirm & submit" button calls `POST /api/intake/submit`. SCR-005 is shared with us_022 (task_001 there creates the method selection screen; this task adds the Manual Form button navigation if not already created).

---

## Dependent Tasks

- task_002 (BE Draft/Submit API) — `GET /api/intake/status`, `POST /api/intake/draft`, `POST /api/intake/submit` must be available; can develop in parallel with mocked API
- us_022 task_001 — `IntakeMethodPage` (SCR-005) may already exist; if so, MODIFY to wire "Fill manually" navigation

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `app/src/pages/intake/ManualIntakePage.tsx` | CREATE | SCR-007 multi-section form container |
| `app/src/pages/intake/IntakeReviewPage.tsx` | CREATE | SCR-007b read-only review container |
| `app/src/components/intake/IntakeForm.tsx` | CREATE | React Hook Form; 5 section groups; on-blur validation |
| `app/src/components/intake/IntakeProgressBar.tsx` | CREATE | "X / 7 sections completed" progress indicator |
| `app/src/components/intake/AutoSaveIndicator.tsx` | CREATE | Topbar "✓ Saved X s ago" / "⚠ Save failed" status |
| `app/src/api/intakeApi.ts` | MODIFY | Add `postIntakeDraft`, `postIntakeSubmit` if not added by us_022 task |
| `app/src/router/AppRouter.tsx` | MODIFY | Add `/intake/manual`, `/intake/review` routes |

---

## Implementation Plan

1. **SCR-007 on mount** — Call `GET /api/intake/status`. If partial row → pass `defaultValues` to React Hook Form `reset()` to pre-fill all sections. Compute section completion count for `IntakeProgressBar`.

2. **Multi-section form** — `IntakeForm.tsx` using `useForm<IntakeFormData>()` with 5 field groups. On-blur validation (`trigger(fieldName)` on `onBlur`): required field empty → red border + error icon + message (UXR-601). All fields have visible labels + `aria-describedby` pointing to error span (UXR-204).

3. **60-second auto-save** — `useEffect` with `setInterval(60_000)`. On tick: collect `getValues()`, call `POST /api/intake/draft`. On success: update `AutoSaveIndicator` with timestamp. On failure: show "⚠ Save failed — retrying…", schedule retry after 5 s via `setTimeout`. Clear interval on unmount.

4. **Submit button guard** — Disabled unless `formState.isValid && !isDirtyBlock`. Show spinner on `isSubmitting` (UXR-501).

5. **"Review answers →"** — On form valid, navigate to `/intake/review` passing current values via React Router state (or re-fetched from `GET /api/intake/status`).

6. **SCR-007b** — Read-only `DataList` groups for each section. Each section header has "Edit" link navigating to `/intake/manual#section-{name}` (hash-scroll to section anchor). "Confirm & submit intake" button → `POST /api/intake/submit` → on 200 → navigate to `/dashboard` (SCR-004) + toast "Intake submitted successfully."

7. **HTTP 413 handling** — On `POST /api/intake/draft` returning 413, show inline error beneath medical-history textarea: "Your entry is too long — please shorten the medical history field."

8. **"Switch to AI chat"** — Header button with `id="btn-switch-ai"` navigating to AI chat (us_024 pre-save-then-switch logic wires into this button).

---

## Current Project State

```
app/
  src/
    pages/
      intake/
        IntakeMethodPage.tsx   # from us_022 task_001
        AiIntakeChatPage.tsx   # from us_022 task_001
    components/
      intake/
        TypingIndicator.tsx    # from us_022 task_001
    api/
      intakeApi.ts             # from us_022 task_001
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | app/src/pages/intake/ManualIntakePage.tsx | SCR-007 container with auto-save timer, pre-fill, section navigation |
| CREATE | app/src/pages/intake/IntakeReviewPage.tsx | SCR-007b read-only review with edit links and submit |
| CREATE | app/src/components/intake/IntakeForm.tsx | React Hook Form multi-section with on-blur validation |
| CREATE | app/src/components/intake/IntakeProgressBar.tsx | Section completion progress tracker |
| CREATE | app/src/components/intake/AutoSaveIndicator.tsx | Topbar save status indicator |
| MODIFY | app/src/api/intakeApi.ts | Add `postIntakeDraft`, confirm `postIntakeSubmit` present |
| MODIFY | app/src/router/AppRouter.tsx | Add `/intake/manual`, `/intake/review` routes |

---

## External References

- React Hook Form on-blur mode: https://react-hook-form.com/docs/useform#mode (mode: "onBlur")
- React Hook Form `trigger()` for field-level validation: https://react-hook-form.com/docs/useform/trigger
- `setInterval` in React `useEffect` with cleanup: https://react.dev/learn/synchronizing-with-effects
- Hash-scroll with React Router: https://reactrouter.com/en/main/hooks/use-location
- Design tokens — validation error: border `#DC2626`, bg `#FEE2E2`; success save indicator: `#0D9488`
- figma_spec.md components SCR-007: TextField ×8, Select ×2, Textarea ×2, Button ×2
- figma_spec.md components SCR-007b: DataList ×5, Button ×2

---

## Build Commands

- `cd app && npm run build` — TypeScript compile check
- `cd app && npm run lint` — ESLint validation
- `cd app && npm test -- --testPathPattern=ManualIntakePage|IntakeReviewPage` — Run tests

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] **[UI Tasks]** Visual comparison against wireframes at 375 px, 768 px, 1440 px
- [ ] **[UI Tasks]** Run `/analyze-ux` to validate wireframe alignment
- [ ] SCR-007 pre-fills all fields from `GET /api/intake/status`
- [ ] Progress bar shows correct section count on load and updates on field fill
- [ ] Auto-save fires at 60-s intervals; topbar shows "✓ Saved X s ago" on success
- [ ] Blur validation: empty required field → red border + error icon + message (UXR-601)
- [ ] Submit disabled while any required field is invalid
- [ ] HTTP 413 → inline error on medical-history textarea
- [ ] SCR-007b: all sections read-only; "Edit" links scroll to correct section in SCR-007
- [ ] "Confirm & submit" → `POST /api/intake/submit` → navigate to dashboard + success toast

---

## Implementation Checklist

- [ ] Create `ManualIntakePage.tsx` calling `GET /api/intake/status` on mount, passing `defaultValues` to form
- [ ] Create `IntakeForm.tsx` (React Hook Form, `mode: "onBlur"`) with 5 section groups
- [ ] Implement on-blur validation per field; red border + error icon + `aria-describedby` error message
- [ ] Create `IntakeProgressBar.tsx` showing "X / 7 sections completed"
- [ ] Implement 60-second `setInterval` auto-save with success/failure indicator (UXR-004)
- [ ] Handle HTTP 413 response → inline error on medical-history field
- [ ] Create `AutoSaveIndicator.tsx` topbar component with "✓ Saved / ⚠ Save failed" states
- [ ] Create `IntakeReviewPage.tsx` (SCR-007b) with read-only DataList groups and section Edit links
- [ ] Implement "Confirm & submit" → `POST /api/intake/submit` → navigate to `/dashboard` + toast
- [ ] Add `id="btn-switch-ai"` on the switch button in SCR-007 header
- [ ] Register routes in `AppRouter.tsx`
- [ ] **[UI Tasks - MANDATORY]** Reference all three wireframes during implementation
- [ ] **[UI Tasks - MANDATORY]** Validate UI matches wireframes before marking task complete
