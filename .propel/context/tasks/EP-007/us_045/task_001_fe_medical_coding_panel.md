---
title: "Task — FE SCR-018 Medical Coding Panel — ICD-10 & CPT Tables, Trust-First Badges, Source Evidence Drawer, Per-Row Actions & Finalise Flow"
task_id: task_001
story_id: us_045
epic: EP-007
layer: Frontend
status: Not Started
date: 2026-04-22
---

# Task - task_001 — FE SCR-018 Medical Coding Panel — ICD-10 & CPT Tables, Trust-First Badges, Source Evidence Drawer, Per-Row Actions & Finalise Flow

## Requirement Reference

- **User Story**: us_045
- **Story Location**: .propel/context/tasks/EP-007/us_045/us_045.md
- **Acceptance Criteria**:
  - AC-1: SCR-018 calls `POST /api/patients/{id}/coding/request` if no suggestions exist, else `GET /api/patients/{id}/coding/suggestions`; skeleton loading with "Generating code suggestions…" subtitle while generating (UXR-502); on HTTP 200 renders two tables: ICD-10 Diagnosis Codes (confidence DESC) + CPT Procedure Codes (confidence DESC); each row: Code, Description, AI Confidence (visual progress bar — green ≥ 80%, amber 60–79%, red < 60%), Status badge, Actions; if GET returns `{ status: "generating" }` → poll every 3 s up to 30 s; timeout → "Code generation is taking longer than expected." with Retry CTA (UXR-603, FR-033)
  - AC-2: `needs_review=false` rows → amber "AI Suggested" badge + `--neutral-100` muted bg; `needs_review=true` rows → amber "Needs Review" badge + `--color-warning-50` yellow bg (distinct style); no auto-accept; all start Pending; colour + text label (not colour alone) — WCAG 1.4.1 (UXR-403, UXR-201)
  - AC-3: "View source" click → right-side Source Evidence drawer (420px, `role="complementary"`, `aria-label="Source evidence for code [CODE]"`); slides in; content from `source_evidence` field (no extra API call); shows: highlighted quote with amber left-border + `color.semantic.ai.bg`; source doc name + page number; AI reasoning paragraph; × or Escape closes drawer; focus returns to trigger button; one drawer at a time; collapsed by default (UXR-104)
  - AC-4: Accept → `PATCH /suggestions/{id} { status: "Accepted" }` → green solid badge + green row tint; Edit ghost button replaces Accept/Reject; `audit_logs CodeReviewed` by API; Modify → inline edit input pre-filled; Save → `PATCH { status: "Modified", final_code }` → blue "Modified" badge; Reject → `PATCH { status: "Rejected" }` → struck-through + red badge + optional replacement input; button press feedback ≤ 200ms (UXR-501)
  - AC-5: "Finalise & submit codes" disabled (grey, tooltip: "Review all code suggestions before finalising") while any row Pending; all reviewed → button enabled; click → confirmation modal "Finalise codes for [patient name]? This will record your final code selections."; confirm → `POST /coding/finalise`; on HTTP 200 `{ agreement_rate }` → success banner "Codes finalised — AI Agreement Rate: X%" (green, persists); all action buttons disabled read-only; `audit_logs CodingFinalised` by API (AIR-Q01, FR-033)

- **Edge Cases**:
  - Edge Case: Finalise clicked with Pending rows → button disabled; tooltip shown; no API call
  - Edge Case: Staff navigates away mid-review → each PATCH persisted immediately; on return GET reflects saved state; Pending rows remain actionable
  - Edge Case: 3-second poll times out after 30 s → timeout state with "Retry" CTA; Retry calls `POST /coding/request` again
  - Edge Case: Patient role navigates to SCR-018 URL → React Router guard; redirect to SCR-004; "no permission" toast
  - Edge Case: Low Agreement Rate returned → finalisation succeeds normally; no blocking alert; banner shows actual rate

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A — inferred from figma_spec.md |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | `.propel/context/wireframes/Hi-Fi/wireframe-SCR-018-coding-panel.html` |
| **Screen Spec** | SCR-018 |
| **UXR Requirements** | UXR-104, UXR-201, UXR-403, UXR-501, UXR-502, UXR-603 |
| **Design Tokens** | `--neutral-100` AI Suggested muted bg; `--color-warning-50` Needs Review yellow bg; `conf-high` green progress fill (≥ 80%); `conf-mid` amber fill (60–79%); `conf-low` red fill (< 60%); `evidence-quote` amber left-border 4px + `var(--color-ai-bg)` bg; `evidence-drawer` 420px fixed right; `badge-success` Accepted; blue Modified badge; red struck-through Rejected; `code-cell` monospace navy font |

> **CRITICAL — Wireframe Implementation:**
> - Reference `wireframe-SCR-018-coding-panel.html` for: table column widths, confidence bar dimensions (80px track, 6px height), evidence drawer width (420px), drawer header `color-ai-bg` background, quote amber left-border style, finalise bar position (bottom sticky)
> - Implement all row states: Pending (AI Suggested / Needs Review), Accepted (green tint), Modified (blue badge), Rejected (struck-through + red badge)
> - Implement all page states: Loading (skeleton + "Generating…"), Active (tables), Error (full-page + Retry), Finalised (success banner + read-only)
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

Implement the SCR-018 Medical Coding Panel React page. The page orchestrates a request/poll/display flow: trigger `POST /coding/request` if needed, poll `GET /suggestions` every 3 s during generation (30 s timeout), then render two sortable code tables (ICD-10 + CPT) with Trust-First visual hierarchy. A 420px right-side Source Evidence drawer (UXR-104) slides in on "View source" with highlighted clinical text excerpts. Per-row Accept/Modify/Reject actions call `PATCH` immediately with optimistic UI updates. The "Finalise & submit codes" button is disabled until all rows are reviewed; confirmation modal triggers `POST /finalise` and renders an Agreement Rate success banner. A Staff-only route guard prevents Patient access.

---

## Dependent Tasks

- us_044 task_001 — `POST /coding/request`, `GET /suggestions`, `PATCH /suggestions/{id}`, `POST /finalise` APIs; FE can be built against MSW mocks
- us_043 task_001 — SCR-016 "Medical Coding" navigation link must route to SCR-018; Trust-First badge component pattern established there

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Client/src/pages/MedicalCodingPanel.tsx` (SCR-018) | CREATE | Main page; request/poll orchestration; tables; finalise flow |
| `Client/src/components/coding/CodeSuggestionsTable.tsx` | CREATE | Renders one code type table (ICD-10 or CPT); sorted by confidence DESC; per-row badge + actions |
| `Client/src/components/coding/CodeRow.tsx` | CREATE | Single suggestion row; status state machine (Pending/Accepted/Modified/Rejected/NeedsReview); action buttons |
| `Client/src/components/coding/ConfidenceBar.tsx` | CREATE | 80px visual progress bar; 3-tier colour (green/amber/red); `aria-valuenow` accessibility |
| `Client/src/components/coding/SourceEvidenceDrawer.tsx` | CREATE | 420px right-side drawer; `role="complementary"`; quote highlights; focus management; Escape close |
| `Client/src/components/coding/FinaliseConfirmationModal.tsx` | CREATE | Confirmation dialog; `role="dialog"`; `aria-modal`; Confirm → POST /finalise |
| `Client/src/components/coding/AgreementRateBanner.tsx` | CREATE | Green success banner after finalise; persists on screen; shows rate % |
| `Client/src/components/coding/CodingPanelSkeleton.tsx` | CREATE | Skeleton tables with "Generating code suggestions…" subtitle (UXR-502) |
| `Client/src/hooks/useCodingSuggestionPolling.ts` | CREATE | 3 s interval poll; 30 s timeout; transitions to error/timeout state |

---

## Implementation Plan

1. Implement `MedicalCodingPanel.tsx`: on mount call `GET /suggestions`; if HTTP 202 `{ status: "generating" }` → show `CodingPanelSkeleton` + start `useCodingSuggestionPolling`; if HTTP 200 with rows → render two `CodeSuggestionsTable` (ICD-10, CPT); if HTTP 200 `{ status: "failed" }` → full-page error + "Retry code generation" CTA; if no suggestions exist → call `POST /coding/request` first

2. Implement `useCodingSuggestionPolling`: `setInterval(3000)`; poll `GET /suggestions`; on HTTP 200 with rows → stop polling + update state; on timeout (30 s) → stop + set `timedOut=true` state showing timeout message + Retry CTA; clear interval on unmount

3. Implement `CodeSuggestionsTable.tsx`: receives `{ codeType, suggestions }` props; renders `<table>` with columns: Code, Description, AI Confidence, Status, Actions; maps each suggestion to `<CodeRow>`; `role="region"` + `aria-label="ICD-10 diagnosis codes"` / `"CPT procedure codes"` per table

4. Implement `CodeRow.tsx`: props `{ suggestion, onAccept, onModify, onReject, onViewSource }`; state: `rowStatus` (Pending / Accepted / Modified / Rejected); badge rendering per status; confidence bar; Actions cell:
   - Pending → Accept + Reject buttons + "View source" ghost
   - Accepted → Edit ghost button + "View source" ghost; green row tint (`bg-green-50`)
   - Modified → "View source" ghost; blue "Modified" badge; shows `final_code`
   - Rejected → "View source" ghost; red "Rejected" badge + `line-through` on Description; optional replacement input
   - NeedsReview variant (same actions, different badge + `bg-warning-50`)

5. Implement `ConfidenceBar.tsx`: props `{ confidence: number }`; compute width `${confidence * 100}%`; colour class: `conf-high` ≥ 0.8, `conf-mid` 0.6–0.79, `conf-low` < 0.6; `aria-valuenow={Math.round(confidence * 100)}` `aria-valuemin={0}` `aria-valuemax={100}` `aria-label="AI confidence"`

6. Implement `SourceEvidenceDrawer.tsx`: `position: fixed; right: 0; width: 420px; height: 100vh`; `role="complementary"`; `aria-label="Source evidence for code {code}"`; slides in via CSS transition; content from `suggestion.source_evidence` (no API call); render `<blockquote>` with amber left-border + `color-ai-bg` for each excerpt; source doc name + page italic below quote; AI reasoning paragraph; × button calls `onClose`; `useEffect` to add `keydown` listener for Escape → `onClose` + return focus to trigger ref; enforce single-drawer: parent passes `openDrawerCode` state

7. Implement `FinaliseConfirmationModal.tsx`: `role="dialog"` `aria-modal="true"` `aria-labelledby`; text "Finalise codes for [patientName]? This will record your final code selections."; Confirm → `POST /finalise`; on HTTP 200 → close modal + show `AgreementRateBanner` + set all rows read-only; Cancel → close modal

8. Implement disabled Finalise button guard: `disabled={suggestions.some(s => s.status === "Pending")}`; `title="Review all code suggestions before finalising"` for tooltip; grey styling when disabled

9. Add Staff/Admin route guard for SCR-018 in router; redirect Patient to SCR-004 + "no permission" toast (reuse `ToastContext` from us_037)

---

## Current Project State

```
Client/
└── src/
    ├── pages/           # DocumentsUpload (SCR-015), PatientView360 (SCR-016), ConflictAcknowledgement (SCR-017)
    ├── components/
    │   ├── documents/
    │   ├── feedback/    # CalendarSyncFailureToast
    │   └── view360/
    ├── context/         # ToastContext
    └── hooks/           # useDocumentPolling, useView360Polling, useToast
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `Client/src/pages/MedicalCodingPanel.tsx` | SCR-018 main page; request/poll/render orchestration |
| CREATE | `Client/src/components/coding/CodeSuggestionsTable.tsx` | Table wrapper per code type |
| CREATE | `Client/src/components/coding/CodeRow.tsx` | Per-row state machine + actions |
| CREATE | `Client/src/components/coding/ConfidenceBar.tsx` | 3-tier visual confidence bar |
| CREATE | `Client/src/components/coding/SourceEvidenceDrawer.tsx` | 420px right-side drawer; focus management |
| CREATE | `Client/src/components/coding/FinaliseConfirmationModal.tsx` | Confirmation dialog + POST /finalise |
| CREATE | `Client/src/components/coding/AgreementRateBanner.tsx` | Green success banner + rate display |
| CREATE | `Client/src/components/coding/CodingPanelSkeleton.tsx` | Skeleton tables + "Generating…" subtitle |
| CREATE | `Client/src/hooks/useCodingSuggestionPolling.ts` | 3 s poll; 30 s timeout |
| MODIFY | `Client/src/App.tsx` (or router file) | Add Staff-only route `/patients/:id/coding` → SCR-018 |

---

## External References

- [WCAG 2.1 — 1.4.1 Use of Color (colour + label required)](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)
- [ARIA — complementary landmark role](https://www.w3.org/TR/wai-aria-1.2/#complementary)
- [ARIA — dialog pattern with focus trap](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [React Router v6 — protected routes](https://reactrouter.com/en/main/start/concepts)

---

## Build Commands

- `cd Client && npm run build`
- `cd Client && npm test`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] **[UI Tasks]** Visual comparison against `wireframe-SCR-018-coding-panel.html` at 375px, 768px, 1440px
- [ ] **[UI Tasks]** Run `/analyze-ux` to validate wireframe alignment
- [ ] Skeleton renders with "Generating code suggestions…" on initial load; no blank flash (UXR-502)
- [ ] ICD-10 table sorted confidence DESC; CPT table sorted confidence DESC
- [ ] Confidence bar: ≥ 80% green fill; 60–79% amber fill; < 60% red fill; `aria-valuenow` present
- [ ] `needs_review=false` row → amber "AI Suggested" badge + neutral-100 bg; both colour and text present (UXR-201 a11y)
- [ ] `needs_review=true` row → amber "Needs Review" badge + warning-50 yellow bg; visually distinct from AI Suggested
- [ ] "View source" → Source Evidence drawer slides in (420px); `role="complementary"`; quote rendered with amber left-border; only one drawer open at a time; Escape closes and returns focus to trigger
- [ ] Accept → PATCH sent; row turns green tint; "Accepted" green badge; Accept/Reject replaced by "Edit"
- [ ] Modify → inline edit input opens; Save → PATCH with `final_code`; "Modified" blue badge
- [ ] Reject → PATCH sent; struck-through row; "Rejected" red badge; optional replacement input appears
- [ ] "Finalise & submit codes" disabled while any row Pending; tooltip text present
- [ ] All rows reviewed → Finalise button enabled; click → confirmation modal with patient name
- [ ] Confirm → POST /finalise; success banner shows "Codes finalised — AI Agreement Rate: X%"; all action buttons become disabled
- [ ] 30 s polling timeout → timeout state message + Retry CTA; Retry calls POST /coding/request
- [ ] Patient JWT at SCR-018 URL → redirect to SCR-004; "no permission" toast

---

## Implementation Checklist

- [ ] Scaffold `MedicalCodingPanel.tsx`: GET on mount; POST if no suggestions; skeleton while generating; error state on failure
- [ ] Implement `useCodingSuggestionPolling`: 3 s interval; 30 s absolute timeout; stop on unmount; expose `isTimedOut`
- [ ] Implement `CodeSuggestionsTable.tsx` with `role="region"` + `aria-label` per code type; correct column headers with `scope="col"`
- [ ] Implement `CodeRow.tsx` full status state machine; all 4 status visual variants + NeedsReview variant; optimistic update on PATCH (update local state before API returns, roll back on error)
- [ ] Implement `ConfidenceBar.tsx`: 80px track; 6px height; 3-tier fill colour; `aria-valuenow/min/max`; `aria-hidden` on decorative bar per wireframe
- [ ] Implement `SourceEvidenceDrawer.tsx`: CSS `transform: translateX(0)` slide-in; focus trap; Escape listener; `aria-label="Source evidence for code {code}"`; quote amber left-border 4px; parent `openDrawerCode` state enforces single-drawer
- [ ] Implement `FinaliseConfirmationModal.tsx`: focus trap; accessible labels; POST /finalise; handle HTTP 200 → banner; HTTP 400 AllCodesMustBeReviewed → error in modal
- [ ] Implement `AgreementRateBanner.tsx`: green persistent banner; displays `{rate}%`; `role="status"` for screen reader
- [ ] Implement `CodingPanelSkeleton.tsx`: matches two-table layout from wireframe
- [ ] Add Staff/Admin route guard in router
- [ ] **[UI Tasks - MANDATORY]** Reference wireframe from Design References table during implementation
- [ ] **[UI Tasks - MANDATORY]** Validate UI matches wireframe before marking task complete
