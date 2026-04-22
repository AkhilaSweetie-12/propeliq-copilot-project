---
title: "Task — FE Intake Edit Mode (SCR-007 Edit, SCR-007b)"
task_id: task_001
story_id: us_025
epic: EP-002
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Intake Edit Mode (SCR-007 Edit, SCR-007b)

## Requirement Reference

- **User Story**: us_025
- **Story Location**: .propel/context/tasks/EP-002/us_025/us_025.md
- **Acceptance Criteria**:
  - AC-1: Patient navigates to `/intake` and `submitted_at` already set → SCR-007 loads in edit mode; all fields pre-filled; page subtitle "Update your intake — changes are saved automatically and applied immediately"; no lock state or "request edit" step; patient can modify any field immediately
  - AC-2: Patient edits fields → "Review answers →" → SCR-007b shows updated values alongside original submission date; "Confirm & submit intake" calls `PUT /api/intake/{intake_id} {updated_fields}`; on HTTP 200 → navigate to SCR-004 with toast "Intake updated successfully."
  - AC-5: Auto-save (60-second `POST /api/intake/draft`) still active during edit mode — "✓ Saved X seconds ago" in topbar (UXR-004)
- **Edge Cases**:
  - Patient navigates away without submitting → `beforeunload` confirmation "You have unsaved changes — are you sure you want to leave?"; auto-saved draft preserved in DB; returning to `/intake` pre-fills draft edits
  - Concurrent edits (two sessions) → HTTP 409 "Your intake was updated in another session — please refresh to see the latest version" → display toast with "Refresh" CTA; no silent overwrite
  - Clearing a required field → client-side blur validation (UXR-601) prevents submission; "Chief complaint is required" inline error; submit button disabled

---

## Design References (Frontend Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-007-manual-intake.html, .propel/context/wireframes/Hi-Fi/wireframe-SCR-007b-intake-review.html |
| **Screen Spec** | .propel/context/docs/figma_spec.md#SCR-007, .propel/context/docs/figma_spec.md#SCR-007b |
| **UXR Requirements** | UXR-601 (inline blur validation — prevents clearing required fields), UXR-004 (60-second auto-save active in edit mode), UXR-501 (submit spinner on PUT call >500 ms) |
| **Design Tokens** | designsystem.md#colors, designsystem.md#typography |

### CRITICAL: Wireframe Implementation Requirement

**Wireframe Status = AVAILABLE** — MUST open both wireframes. Edit mode is the same SCR-007 layout with a different subtitle and PUT submit path. Confirm subtitle placement and "original submission date" display on SCR-007b. Validate at 375 px, 768 px, 1440 px.

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

Extend `ManualIntakePage` (SCR-007) to support edit mode when `submitted_at` is already set on the patient's intake row. Edit mode is determined by checking the `GET /api/intake/status` response for a non-null `submitted_at`. When in edit mode, the page subtitle changes, the form is pre-filled (same as new intake), and the submit path calls `PUT /api/intake/{intake_id}` instead of `POST /api/intake/submit`. SCR-007b is similarly extended to show the original submission date and route the "Confirm & submit intake" button to PUT. A `beforeunload` guard warns on unsaved navigation. HTTP 409 (concurrent edit) is handled with a refresh toast.

---

## Dependent Tasks

- us_023 task_001 — `ManualIntakePage` and `IntakeReviewPage` must exist; this task adds edit-mode branching to both
- task_002 (BE PUT Intake Edit endpoint) — `PUT /api/intake/{intake_id}` must be available; develop in parallel with mocked response

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `app/src/pages/intake/ManualIntakePage.tsx` | MODIFY | Detect edit mode from `submitted_at` presence; change subtitle; wire `beforeunload` guard |
| `app/src/pages/intake/IntakeReviewPage.tsx` | MODIFY | Show original submission date; route confirm button to PUT for edit mode |
| `app/src/api/intakeApi.ts` | MODIFY | Add `putIntakeUpdate(intakeId, updatedFields, updatedAt)` typed function |

---

## Implementation Plan

1. **Edit mode detection** — In `ManualIntakePage.tsx`, after `GET /api/intake/status` resolves, check `response.submittedAt !== null`. Store `isEditMode = true` and `intakeId = response.intakeId` in component state.

2. **Edit mode subtitle** — Conditionally render page subtitle: `isEditMode ? "Update your intake — changes are saved automatically and applied immediately" : "Complete your intake"`. Style per wireframe heading hierarchy.

3. **Form pre-fill** — Same mechanism as initial load: `form.reset(response.fields)`. No lock state; all fields immediately editable.

4. **`beforeunload` guard** — `useEffect(() => { const handler = (e) => { if (form.formState.isDirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [form.formState.isDirty])`.

5. **Auto-save in edit mode** — Existing 60-second `setInterval` draft calls `POST /api/intake/draft` unchanged; no `submitted_at` modified by draft (UXR-004).

6. **SCR-007b in edit mode** — Pass `{ isEditMode, intakeId, originalSubmittedAt, updatedAt }` via React Router state. On SCR-007b: render "Originally submitted: {originalSubmittedAt}" below the review header. "Confirm & submit intake" button → if `isEditMode` → call `putIntakeUpdate(intakeId, fields, currentUpdatedAt)` → navigate to `/dashboard` + toast "Intake updated successfully."; else → existing `POST /api/intake/submit` path.

7. **HTTP 409 handling** — `putIntakeUpdate` returning 409 → show toast "Your intake was updated in another session — please refresh to see the latest version" with "Refresh" button calling `window.location.reload()`. No silent overwrite.

8. **Optimistic concurrency** — Include `updated_at` from `GET /api/intake/status` in the PUT payload for the BE to compare. FE stores `response.updatedAt` in component state and passes it to `putIntakeUpdate`.

---

## Current Project State

```
app/
  src/
    pages/
      intake/
        ManualIntakePage.tsx    # exists (us_023)
        IntakeReviewPage.tsx    # exists (us_023)
    api/
      intakeApi.ts              # exists
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | app/src/pages/intake/ManualIntakePage.tsx | Add edit mode detection, subtitle, `beforeunload` guard, pass `isEditMode`/`intakeId`/`updatedAt` to review |
| MODIFY | app/src/pages/intake/IntakeReviewPage.tsx | Show original submission date; route confirm to PUT in edit mode; handle HTTP 409 toast |
| MODIFY | app/src/api/intakeApi.ts | Add `putIntakeUpdate(intakeId, fields, updatedAt)` with typed request/response |

---

## External References

- `beforeunload` event in React: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
- React Hook Form `isDirty` state: https://react-hook-form.com/docs/useformstate
- React Router `useNavigate` with state for passing edit context: https://reactrouter.com/en/main/hooks/use-navigate
- Optimistic concurrency via `updated_at` timestamp in PUT body: REST API design pattern
- Design tokens — success toast: `#16A34A`; warning toast for 409: `#D97706`

---

## Build Commands

- `cd app && npm run build` — TypeScript compile check
- `cd app && npm run lint` — ESLint validation
- `cd app && npm test -- --testPathPattern=ManualIntakePage|IntakeReviewPage` — Run tests

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] **[UI Tasks]** Visual comparison against wireframes at 375 px, 768 px, 1440 px
- [ ] Edit mode detected correctly when `submitted_at` present; create mode when absent
- [ ] Edit mode subtitle "Update your intake..." visible; no lock state
- [ ] `beforeunload` fires with confirmation message when `formState.isDirty === true`
- [ ] Auto-save still fires every 60 s in edit mode; topbar indicator updates (UXR-004)
- [ ] SCR-007b shows "Originally submitted: {date}" in edit mode
- [ ] "Confirm & submit intake" calls PUT in edit mode; POST in create mode
- [ ] PUT success → navigate to dashboard + toast "Intake updated successfully."
- [ ] HTTP 409 → toast with Refresh CTA; no overwrite
- [ ] Clearing required field → inline error + submit disabled (UXR-601)

---

## Implementation Checklist

- [ ] Modify `ManualIntakePage.tsx`: read `submittedAt` and `intakeId` from `GET /api/intake/status`; set `isEditMode` state
- [ ] Conditionally render edit-mode subtitle in SCR-007
- [ ] Store `currentUpdatedAt` from status response in component state for optimistic concurrency
- [ ] Implement `beforeunload` event listener tied to `formState.isDirty`
- [ ] Pass `{ isEditMode, intakeId, originalSubmittedAt, updatedAt }` via navigation state to SCR-007b
- [ ] Modify `IntakeReviewPage.tsx`: read navigation state; show original submission date when in edit mode
- [ ] Route "Confirm & submit intake" to `putIntakeUpdate()` when `isEditMode === true`
- [ ] Add `putIntakeUpdate(intakeId, fields, updatedAt)` to `intakeApi.ts`
- [ ] Handle HTTP 409 → toast "Your intake was updated in another session — please refresh" with Refresh button
- [ ] **[UI Tasks - MANDATORY]** Reference wireframes during implementation
- [ ] **[UI Tasks - MANDATORY]** Validate UI matches wireframes before marking task complete
