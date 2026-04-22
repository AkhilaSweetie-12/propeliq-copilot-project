---
title: "Task — FE SCR-015 Clinical Documents Upload Screen — Status Badges, Upload Zone, Polling & Empty State"
task_id: task_001
story_id: us_039
epic: EP-006-I
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE SCR-015 Clinical Documents Upload Screen — Status Badges, Upload Zone, Polling & Empty State

## Requirement Reference

- **User Story**: us_039
- **Story Location**: .propel/context/tasks/EP-006-I/us_039/us_039.md
- **Acceptance Criteria**:
  - AC-1: SCR-015 renders a document list with per-document status badge (`Pending/Processing` → "Processing" badge + progress bar, `Extracted` → "Extracted" badge + extraction preview, `Failed` → "Extraction Failed" badge + "Enter data manually" CTA); empty state with "Upload your first document" illustration + CTA when no documents; PDF preview overlay on row click (UXR-103, UXR-604, FR-026)
  - AC-2: Client-side validator rejects non-PDF files before any network request; inline error "Only PDF files are supported" displayed beneath upload zone; file input clears; no `POST /api/documents` sent (FR-026, UC-007 extension 2a)
  - AC-4: After successful `POST /api/documents` returns HTTP 202, update document row badge to "Processing" and show progress spinner for that document immediately (NFR-016, UXR-501)
  - AC-5: Patient may only view/upload their own profile documents; Staff may access any patient profile; RBAC enforcement via JWT claims handled by API — FE shows HTTP 403 with appropriate error message
  - Edge Case: User uploads multiple PDFs sequentially; each upload is independent — a failure on one does not prevent others; each document has its own status badge
  - Edge Case: User navigates away while document shows "Processing" — status auto-refreshes on return via 10-second polling (GET /api/documents?patient_id=X) while any document is in Pending/Processing state

- **Edge Cases**:
  - Edge Case: `/uploads` directory unavailable → API returns HTTP 500; FE displays full-page error state with retry CTA (UXR-603)
  - Edge Case: `<input accept=".pdf">` extension-only check does not replace server-side MIME check; this task implements client-side guard only

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A — inferred from figma_spec.md |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | `.propel/context/wireframes/Hi-Fi/wireframe-SCR-015-documents-upload.html` |
| **Screen Spec** | SCR-015 |
| **UXR Requirements** | UXR-103, UXR-501, UXR-603, UXR-604 |
| **Design Tokens** | teal upload-zone dashed border; `badge-success` Extracted; `badge-warning` Processing; `badge-error` Failed; `color-error-bg` doc-icon failed; `color-warning-bg` doc-icon processing; `color-success-bg` doc-icon extracted; progress-bar-track/fill; shadow-2 card hover |

> **CRITICAL — Wireframe Implementation:**
> - Reference `wireframe-SCR-015-documents-upload.html` for all layout, spacing, badge colors, upload-zone styling, doc-card structure, progress bar pattern, and empty state illustration positioning
> - Implement all states shown: Extracted (green badge + extraction preview), Processing (amber badge + progress bar), Failed (red badge + error text + "Enter data manually" CTA)
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

Implement the SCR-015 Clinical Documents page as a React component. The page loads the patient's document list from `GET /api/documents?patient_id=X`, renders per-document status cards with the correct badge and state, and auto-polls every 10 seconds while any document remains in Pending/Processing state. The upload zone accepts PDF only (client-side validation), sends `multipart/form-data` via `POST /api/documents`, and immediately renders the new document card in "Processing" state on HTTP 202. Empty state, full-page error state (UXR-603), and PDF preview overlay are also implemented.

---

## Dependent Tasks

- US_016 (Foundational EP-DATA-II) — `clinical_documents` entity migrated; `GET /api/documents` and `POST /api/documents` endpoints available
- us_039 task_002 — Backend upload API must be implemented before end-to-end testing; FE can be developed with an MSW mock for the 202 response

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `Client/src/pages/DocumentsUpload.tsx` (SCR-015) | CREATE | Main page; document list; polling logic; upload trigger |
| `Client/src/components/documents/DocumentCard.tsx` | CREATE | Per-document card; props: `{ document_id, file_name, upload_date, file_size, upload_status, extracted_preview? }`; renders badge + state-specific content |
| `Client/src/components/documents/UploadZone.tsx` | CREATE | Dashed teal upload zone; drag-and-drop + click-to-browse; `accept=".pdf"` + client-side type check; multi-file sequential submit |
| `Client/src/components/documents/DocumentsEmptyState.tsx` | CREATE | Illustration + "Upload your first document" CTA (UXR-604) |
| `Client/src/components/documents/PdfPreviewOverlay.tsx` | CREATE | Modal overlay opened on document row click; renders PDF preview via `<iframe>` or `react-pdf`; `aria-modal="true"` |
| `Client/src/hooks/useDocumentPolling.ts` | CREATE | `useEffect` + `setInterval(10000)` polls `GET /api/documents?patient_id=X` while any `upload_status` is `Pending` or `Processing`; stops on all terminal states |

---

## Implementation Plan

1. Implement `GET /api/documents?patient_id=X` API call in `DocumentsUpload.tsx`; map response to document list state; trigger polling hook
2. Implement `DocumentCard.tsx` with conditional rendering per `upload_status`: `Processing` → amber badge + progress bar, `Extracted` → green badge + extraction preview row, `Failed` → red badge + error text + "Enter data manually" CTA button
3. Implement `UploadZone.tsx` with `<input type="file" accept=".pdf" multiple>`; `onChange` handler checks `file.type === 'application/pdf'` and `file.name.endsWith('.pdf')`; reject non-PDF with inline error "Only PDF files are supported" displayed below zone; iterate valid files sequentially and call `POST /api/documents` for each
4. Implement `useDocumentPolling.ts`: poll while `documents.some(d => ['Pending', 'Processing'].includes(d.upload_status))`; stop on unmount; stop when all reach terminal state
5. Implement `DocumentsEmptyState.tsx`: illustration area + "Upload your first document" link/button
6. Implement `PdfPreviewOverlay.tsx`: triggered by "View" button on Extracted card; modal with `aria-modal="true"` and `role="dialog"` + `aria-labelledby`; close on `Esc` or × button
7. Add full-page error state: if initial `GET /api/documents` fails with HTTP 500 → render error state with retry CTA (UXR-603)

---

## Current Project State

```
Client/
└── src/
    ├── pages/           # Existing pages (BookingCalendar, QueueView, etc.)
    ├── components/      # Existing shared components
    └── hooks/           # Existing custom hooks
```

> Update this tree during implementation to reflect new files created.

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `Client/src/pages/DocumentsUpload.tsx` | SCR-015 page container; data fetch + polling orchestration |
| CREATE | `Client/src/components/documents/DocumentCard.tsx` | Per-document card; status-driven conditional rendering |
| CREATE | `Client/src/components/documents/UploadZone.tsx` | Drag-drop + click upload; client-side PDF validation |
| CREATE | `Client/src/components/documents/DocumentsEmptyState.tsx` | Empty state illustration + CTA (UXR-604) |
| CREATE | `Client/src/components/documents/PdfPreviewOverlay.tsx` | PDF preview modal; accessible dialog |
| CREATE | `Client/src/hooks/useDocumentPolling.ts` | 10s polling hook; stops on terminal state |
| MODIFY | `Client/src/App.tsx` (or router file) | Add route for SCR-015 `/documents` |

---

## External References

- [WCAG 2.1 — File upload accessibility patterns](https://www.w3.org/WAI/WCAG21/Understanding/)
- [MDN — File API: checking file type via type property](https://developer.mozilla.org/en-US/docs/Web/API/File/type)

---

## Build Commands

- `cd Client && npm run build`
- `cd Client && npm test`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] **[UI Tasks]** Visual comparison against `wireframe-SCR-015-documents-upload.html` completed at 375px, 768px, 1440px
- [ ] **[UI Tasks]** Run `/analyze-ux` to validate wireframe alignment
- [ ] Document list loads on page mount; status badges render correctly for all three states (Extracted, Processing, Failed)
- [ ] "Enter data manually" CTA visible only on Failed state document cards
- [ ] "View" button opens PDF preview overlay; overlay closes on Esc and × button
- [ ] Upload zone rejects `.docx` / `.jpg` / `.exe` immediately with "Only PDF files are supported" inline error; no network request made
- [ ] Upload zone accepts `.pdf`; sends `POST /api/documents` with `multipart/form-data`; on 202 response renders Processing badge immediately
- [ ] Multiple PDF selection: each uploaded sequentially; individual failures do not block subsequent uploads
- [ ] Polling starts when any document is Processing; stops when all reach terminal state; stops on page unmount
- [ ] Empty state renders with illustration + CTA when document list is empty
- [ ] HTTP 500 on initial load renders full-page error state with retry CTA (UXR-603)
- [ ] `role="list"` + `role="listitem"` on document list; progress bar has `aria-valuenow`/`aria-valuemin`/`aria-valuemax` per wireframe

---

## Implementation Checklist

- [ ] Scaffold `DocumentsUpload.tsx` page; fetch `GET /api/documents?patient_id=X` on mount; render loading skeleton while fetching
- [ ] Implement `DocumentCard.tsx` with all three `upload_status` variants; match wireframe doc-card spacing, badge colors, icon backgrounds
- [ ] Implement `UploadZone.tsx`: teal dashed border matching wireframe; `accept=".pdf"` on `<input>`; client-side MIME + extension check; inline error message on rejection; sequential `POST /api/documents` per file
- [ ] Implement `useDocumentPolling.ts`: 10s interval; clear on unmount; cease polling when no Pending/Processing docs remain
- [ ] Implement `DocumentsEmptyState.tsx` with illustration placeholder and "Upload your first document" CTA (UXR-604)
- [ ] Implement `PdfPreviewOverlay.tsx`: accessible modal; keyboard trap; Esc closes; `aria-modal="true"`, `role="dialog"`, `aria-labelledby` pointing to file name heading
- [ ] Add SCR-015 route in router; guard by authentication (redirect to login if unauthenticated)
- [ ] **[UI Tasks - MANDATORY]** Reference wireframe from Design References table during implementation
- [ ] **[UI Tasks - MANDATORY]** Validate UI matches wireframe before marking task complete
