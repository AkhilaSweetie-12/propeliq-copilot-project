---
title: "Task — FE AI-Assisted Intake Chat Screen (SCR-005, SCR-006)"
task_id: task_001
story_id: us_022
epic: EP-002
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE AI-Assisted Intake Chat Screen (SCR-005, SCR-006)

## Requirement Reference

- **User Story**: us_022
- **Story Location**: .propel/context/tasks/EP-002/us_022/us_022.md
- **Acceptance Criteria**:
  - AC-1: Patient selects "AI-Assisted" on SCR-005 → SCR-006 loads; calls `GET /api/intake/status`; if existing intake → greeting acknowledging captured fields; if none → first question about chief complaint
  - AC-3: While LLM is generating (`POST /api/intake/chat` in-flight) → `TypingIndicator` (3 animated dots, `aria-label="AI is typing"`, `role="status"`) renders; send button disabled; indicator replaced by AI response bubble on API return
  - AC-5: HTTP 503 from API → system bubble in chat with message "AI intake is temporarily unavailable — please switch to the manual form" + "Switch to Manual Form" button; no captured data lost
  - AC-6: All five sections complete → "Review answers →" → SCR-007b; confirm button calls `POST /api/intake/submit` → HTTP 200 → navigate to SCR-004
- **Edge Cases**:
  - Patient closes browser mid-conversation → incremental UPSERTs mean data is already persisted; on next load `GET /api/intake/status` resumes from last field
  - Guard Layer misses PHI → second NER pass; patient-facing experience unaffected

---

## Design References (Frontend Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-005-intake-method.html, .propel/context/wireframes/Hi-Fi/wireframe-SCR-006-ai-intake-chat.html |
| **Screen Spec** | .propel/context/docs/figma_spec.md#SCR-005, .propel/context/docs/figma_spec.md#SCR-006 |
| **UXR Requirements** | UXR-504 (typing indicator 3 dots while LLM generating — SCR-006), UXR-403 (AI-suggested field chips use "AI Suggested" badge + muted bg in SCR-006 sidebar), UXR-004 (auto-save indicator in topbar after each tool-call UPSERT — "✓ Saved X seconds ago"), UXR-501 (send button spinner >500 ms) |
| **Design Tokens** | designsystem.md#colors, designsystem.md#typography, designsystem.md#spacing |

### CRITICAL: Wireframe Implementation Requirement

**Wireframe Status = AVAILABLE** — MUST open both wireframes and match layout, spacing, typography, and colors. Implement all screen states: SCR-005 Default; SCR-006 Default, Loading (TypingIndicator), Error (circuit breaker 503 system bubble). Validate at 375 px, 768 px, 1440 px.

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript | React 18, TypeScript 5 |
| Frontend | TailwindCSS | 3.x |
| Backend | ASP.NET Core Web API | .NET 9 |
| AI/ML | Ollama (llama3.2:3b-instruct-q8_0) | local |
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

> This task is the SPA UI layer only. AI pipeline logic is in task_002 and task_003.

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

Implement two screens for the AI-assisted intake path: SCR-005 (Intake Method Selection) and SCR-006 (AI-Assisted Intake Chat). SCR-005 presents two card options: "AI-Assisted" and "Manual Form". SCR-006 is a chat interface: a scrollable message log, patient text input, send button, and a sidebar showing field-completion chips with "AI Suggested" badges. A `TypingIndicator` component (3 animated dots) renders while awaiting LLM response. On API HTTP 503, a system bubble appears with a fallback button. On completion, "Review answers →" routes to SCR-007b.

---

## Dependent Tasks

- task_002 (BE AI Guard + Ollama API) — `POST /api/intake/chat` and `GET /api/intake/status` must be available; can develop in parallel against mocked API

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `app/src/pages/intake/IntakeMethodPage.tsx` | CREATE | SCR-005 method selection page |
| `app/src/pages/intake/AiIntakeChatPage.tsx` | CREATE | SCR-006 chat page container |
| `app/src/components/intake/ChatMessageList.tsx` | CREATE | Scrollable chat log rendering user/AI/system bubbles |
| `app/src/components/intake/TypingIndicator.tsx` | CREATE | 3 animated dots, `role="status"`, `aria-label="AI is typing"` |
| `app/src/components/intake/FieldCompletionSidebar.tsx` | CREATE | Sidebar showing intake section chips with AI Suggested badges |
| `app/src/api/intakeApi.ts` | CREATE | Typed API client: `getIntakeStatus`, `postIntakeChat`, `postIntakeSubmit` |
| `app/src/router/AppRouter.tsx` | MODIFY | Add `/intake`, `/intake/ai`, `/intake/review` routes (Patient-role-guarded) |

---

## Implementation Plan

1. **SCR-005** — Two card buttons: "Start AI chat" (navigates to `/intake/ai`) and "Fill manually" (navigates to `/intake/manual`). Card design per wireframe: icon, title, description. Patient-role-guarded route.

2. **SCR-006 page init** — On mount, call `GET /api/intake/status`. If existing row → render initial AI greeting bubble acknowledging captured fields from API response. If none → render first-question bubble. Set `sessionId` from API response in component state.

3. **Message send** — On submit: append patient message bubble immediately; set `isSending = true`; disable send button; render `TypingIndicator`. Call `POST /api/intake/chat { message, session_id }`. On 2xx: remove indicator, append AI response bubble, update `FieldCompletionSidebar` chips from `extracted_fields_so_far`. On 503: append system error bubble with "Switch to Manual Form" button. On other errors: inline toast.

4. **TypingIndicator** — Three CSS-animated dots (`animation: bounce`). `role="status"`, `aria-label="AI is typing"`, `aria-live="polite"`. Removes from DOM when API returns.

5. **FieldCompletionSidebar** — Renders chips for 5 sections: Demographics, Medical History, Medications, Allergies, Chief Complaint. Completed sections show teal checkmark; pending sections show grey indicator. AI-sourced sections use "AI Suggested" badge: `color.semantic.ai` (`#7C3AED`) border, `color.brand.teal.100` (`#CCFBF1`) background (UXR-403).

6. **Auto-save indicator** — After each successful tool-call UPSERT (indicated by `extracted_fields_so_far` update in API response), update topbar indicator to "✓ Saved X seconds ago" (UXR-004).

7. **"Review answers →"** — Button enabled when all 5 sections present in `extracted_fields_so_far`. Navigates to `/intake/review`.

---

## Current Project State

```
app/
  src/
    pages/
      intake/      # (to be created)
    components/
      intake/      # (to be created)
    api/
    router/
      AppRouter.tsx
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | app/src/pages/intake/IntakeMethodPage.tsx | SCR-005: two-card method selection |
| CREATE | app/src/pages/intake/AiIntakeChatPage.tsx | SCR-006 container; chat state, send handler, session management |
| CREATE | app/src/components/intake/ChatMessageList.tsx | Scrollable message log; user/AI/system bubble variants |
| CREATE | app/src/components/intake/TypingIndicator.tsx | 3-dot animated ARIA live region |
| CREATE | app/src/components/intake/FieldCompletionSidebar.tsx | Section completion chips with AI Suggested badge |
| CREATE | app/src/api/intakeApi.ts | Typed read/chat/submit API functions |
| MODIFY | app/src/router/AppRouter.tsx | Add intake routes with Patient guard |

---

## External References

- CSS bounce animation for typing indicator: https://developer.mozilla.org/en-US/docs/Web/CSS/animation
- ARIA live region for chat (`aria-live="polite"`): https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions
- React `useRef` scroll-to-bottom for chat: https://react.dev/learn/referencing-values-with-refs
- Design tokens — AI Suggested badge: border `#7C3AED`, bg `#CCFBF1`; system error bubble bg: `color.semantic.error.bg` `#FEE2E2`
- Wireframes: `wireframe-SCR-005-intake-method.html`, `wireframe-SCR-006-ai-intake-chat.html`
- figma_spec.md components SCR-006: Chat bubble ×N, TextField ×1, Button ×1, TypingIndicator

---

## Build Commands

- `cd app && npm run build` — TypeScript compile check
- `cd app && npm run lint` — ESLint validation
- `cd app && npm test -- --testPathPattern=AiIntakeChatPage|TypingIndicator` — Run component tests

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] **[UI Tasks]** Visual comparison against wireframe at 375 px, 768 px, 1440 px
- [ ] **[UI Tasks]** Run `/analyze-ux` to validate wireframe alignment
- [ ] SCR-005: Both method cards navigate correctly
- [ ] SCR-006: `TypingIndicator` renders while API in-flight; removed on response
- [ ] Send button disabled while `isSending === true`
- [ ] HTTP 503 renders system bubble with "Switch to Manual Form" button
- [ ] FieldCompletionSidebar updates chips from `extracted_fields_so_far` on each response
- [ ] AI Suggested badge renders with correct `color.semantic.ai` colour (UXR-403)
- [ ] "Review answers →" only enabled when all 5 sections are in `extracted_fields_so_far`
- [ ] Non-Patient role → redirected from intake routes

---

## Implementation Checklist

- [ ] Create `IntakeMethodPage.tsx` (SCR-005) with two option cards per wireframe
- [ ] Create `AiIntakeChatPage.tsx` with session state, `GET /api/intake/status` on mount, message list
- [ ] Create `ChatMessageList.tsx` with user/AI/system bubble variants and auto-scroll to bottom
- [ ] Create `TypingIndicator.tsx` with CSS bounce animation and ARIA live region
- [ ] Create `FieldCompletionSidebar.tsx` with 5 section chips; AI Suggested badge for AI-sourced fields
- [ ] Implement send handler: append user bubble, disable send, show indicator, call API, update chips
- [ ] Handle HTTP 503: append system error bubble with "Switch to Manual Form" button
- [ ] Implement topbar auto-save indicator update after each tool-call UPSERT (UXR-004)
- [ ] Enable "Review answers →" when all 5 sections completed; navigate to `/intake/review`
- [ ] Create `intakeApi.ts` with typed `getIntakeStatus`, `postIntakeChat`, `postIntakeSubmit`
- [ ] **[UI Tasks - MANDATORY]** Reference wireframes during implementation
- [ ] **[UI Tasks - MANDATORY]** Validate UI matches wireframes before marking task complete
