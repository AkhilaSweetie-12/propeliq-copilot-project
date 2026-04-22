---
title: "Task — FE Patient Search, Create Account & Guest Flow (SCR-013)"
task_id: task_001
story_id: us_032
epic: EP-004
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE Patient Search, Create Account & Guest Flow (SCR-013)

## Requirement Reference

- **User Story**: us_032
- **Story Location**: .propel/context/tasks/EP-004/us_032/us_032.md
- **Acceptance Criteria**:
  - AC-1: Single search input with 300 ms debounce; `GET /api/patients/search?query=X` triggered after debounce; inline loading spinner; results as patient card list (name, DOB, MRN, last visit) (FL-004); suppress API call for query < 2 chars
  - AC-2: "Select" on a result card → store `patient_id` in state; navigate to SCR-012 with patient summary in Router state (no extra API call)
  - AC-3: Empty result → show "Create new patient account" button + "Proceed without account (guest)" link; "Create new patient account" expands inline form (first name, last name, DOB, phone, optional email)
  - AC-4: Inline validation on blur; "Create & Continue" calls `POST /api/patients`; on HTTP 201 navigate to SCR-012 with new `patient_id` pre-loaded
  - AC-5: "Proceed without account (guest)" → navigate to SCR-012 with `{ patient_id: null, guest_profile: true }`
  - Edge Case: `POST /api/patients` failure → inline error "Unable to create account — please try again"; form data preserved; button re-enables

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | .propel/context/docs/figma_spec.md#SCR-013 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-013-patient-search.html |
| **Screen Spec** | SCR-013 Patient Search / Create Patient |
| **UXR Requirements** | UXR-201 (WCAG 2.2 AA: search input `aria-label`, result list `role="list"`, patient cards keyboard-focusable with `tabindex="0"`), UXR-204 (every form field with visible label + `aria-describedby` error ID), UXR-303 (two-column form collapses to single column at < 768 px), UXR-501 (inline spinner during debounced search — not skeleton), UXR-601 (inline validation on blur — red border + error icon + message beneath field) |
| **Design Tokens** | Brand navy=`#1E3A5F`, teal accent=`#0D9488`, error=`#EF4444`, guest badge=`#9CA3AF` |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18 |
| Language | TypeScript | 5 |
| Forms | React Hook Form | v7 |
| Routing | React Router | v6 |
| Styling | TailwindCSS | 3.x |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |

---

## Mobile References

| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |

---

## Task Overview

Build `PatientSearchPage` (`/staff/walkin/search`, Staff-only). Single search input with 300 ms debounce; inline spinner; patient result cards. Three terminal paths: (1) select existing patient → navigate to SCR-012 with state; (2) create new patient via inline form → HTTP 201 → navigate to SCR-012; (3) guest mode → navigate to SCR-012 with `guest_profile: true`. Route guard: non-Staff redirect. Full on-blur inline validation on creation form.

---

## Dependent Tasks

- us_031 task_001 — `#btn-add-walkin` navigates here; must exist first
- us_032 task_002 (BE patient search + create API) — provides endpoints

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `src/pages/PatientSearchPage.tsx` | CREATE | SCR-013; debounced search; three path logic |
| `src/components/staff/PatientResultCard.tsx` | CREATE | Patient result card with name, DOB, MRN, last visit; "Select" button |
| `src/components/staff/NewPatientForm.tsx` | CREATE | Inline expandable form; React Hook Form; all required fields; on-blur validation |
| `src/api/patientsApi.ts` | CREATE | `searchPatients(query): Promise<PatientResult[]>`; `createPatient(data): Promise<CreatePatientResponse>` |
| `src/App.tsx` / router | MODIFY | Register `/staff/walkin/search` route protected by `StaffGuard` |

---

## Implementation Checklist

- [ ] On `PatientSearchPage` mount, verify `auth.role === 'Staff'` via `useAuth()`; non-Staff users redirected to role-appropriate home
- [ ] Implement 300 ms debounced search: suppress API call if query length < 2; show inline spinner while `searchPatients(query)` is in-flight; render `PatientResultCard` list with `role="list"` (UXR-201); each card keyboard-focusable (`tabindex="0"`) with Enter firing the same handler as "Select"
- [ ] On "Select" click: store selected patient object in navigate state; call `navigate("/staff/walkin/panel", { state: { patient_id, patientMeta } })` — no extra API call (UXR-501)
- [ ] On empty result: show "Create new patient account" button and "Proceed without account (guest)" link; "Create new patient account" expands `NewPatientForm` inline (no navigation)
- [ ] `NewPatientForm` uses React Hook Form `mode: "onBlur"`; required fields: first name, last name, DOB, phone; optional: email; inline error on blur (UXR-601, UXR-204 `aria-describedby`); "Create & Continue" disabled until all required fields valid
- [ ] On "Create & Continue" submit: call `createPatient(formData)`; show loading state on button; on HTTP 201 navigate to `/staff/walkin/panel` with `{ patient_id, patientMeta }`; on error display "Unable to create account — please try again" inline; preserve form data; re-enable button
- [ ] "Proceed without account (guest)" link: `navigate("/staff/walkin/panel", { state: { patient_id: null, guest_profile: true } })` immediately on click; no API call

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm test`

---

## Implementation Validation Strategy

- [ ] Single keystroke (< 2 chars) → no API call; hint "Enter at least 2 characters to search" visible
- [ ] Valid query → debounced API call fires after 300 ms; inline spinner shown
- [ ] "Select" → navigation to SCR-012 with `patientMeta` in state; no extra API call
- [ ] Empty results → "Create new patient account" + guest link visible
- [ ] Required field blank on blur → inline error with `aria-describedby`
- [ ] HTTP 201 on create → navigate to SCR-012 with new `patient_id`
- [ ] API failure → inline error; form preserved; button re-enables
- [ ] Guest path → navigate to SCR-012 with `{ patient_id: null, guest_profile: true }`
- [ ] Non-Staff JWT → redirect without reaching SCR-013
