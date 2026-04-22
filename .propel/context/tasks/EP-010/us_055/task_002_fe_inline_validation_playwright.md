---
title: "Task — FE Interaction Feedback: Inline Blur-Triggered Field Validation on 5 Form Screens & Playwright Performance Assertions"
task_id: task_002
story_id: us_055
epic: EP-010
layer: Frontend
status: Not Started
date: 2026-04-22
---

# Task - task_002 — FE Interaction Feedback: Inline Blur-Triggered Field Validation on 5 Form Screens & Playwright Performance Assertions

## Requirement Reference

- **User Story**: us_055
- **Story Location**: .propel/context/tasks/EP-010/us_055/us_055.md
- **Acceptance Criteria**:
  - AC-3: Blur-triggered inline validation on SCR-002, SCR-006, SCR-007, SCR-009, SCR-013; on field blur: border → `2px solid var(--color-error)` + `✕` icon appended; descriptive static error message rendered beneath field (not server-sourced — OWASP A07); `aria-describedby` links field to error message; error clears on next valid blur; form submit re-validates all fields + `focus()` on first failing field (UXR-503)
  - AC-4 (partial): Exactly 1 API call per async-submit button click verified by Playwright `waitForRequest` count assertion (UXR-501)
  - AC-5: Playwright: button `[aria-busy="true"]` within 200ms of async click on SCR-002, SCR-007, SCR-009, SCR-018; skeleton `.skeleton` within 200ms of navigation to 5 skeleton screens; no blank flash at 50ms post-navigation; double-click on SCR-009 "Confirm Booking" → exactly 1 `POST /api/appointments` (UXR-501, UXR-502, UXR-503)

- **Edge Cases**:
  - Edge Case: Conditional form fields (e.g. insurance type toggle on SCR-009) that appear after interaction → register blur validation handler on mount of the conditional field; unmounting field clears its validation error
  - Edge Case: Error messages are static strings (no server response data echoed in UI) — protects against reflected XSS/OWASP A07; server 400 validation errors map to the same static client-side message strings
  - Edge Case: Tab-through a required field without input → blur fires on empty field → validation error appears; ensures keyboard-only users are not silently skipping required fields

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes — SCR-002, SCR-006, SCR-007, SCR-009, SCR-013 (inline validation) |
| **Figma URL** | .propel/context/docs/figma_spec.md — UXR-503 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-002-onboarding-intake.html, wireframe-SCR-006-intake-start.html, wireframe-SCR-007-intake-form.html, wireframe-SCR-009-confirm-booking.html, wireframe-SCR-013-walkin-intake.html; wireframe-shared.css defines `.form-error-message`, `.form-input.error` states |
| **Screen Spec** | SCR-002, SCR-006, SCR-007, SCR-009, SCR-013 |
| **UXR Requirements** | UXR-503 |
| **Design Tokens** | `var(--color-error)` (red-600 from `tailwind.config.ts`); 2px solid border; `✕` icon |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React 18 + TypeScript 5 | — |
| Forms | React Hook Form v7 | — |
| Styling | TailwindCSS 3.x | — |
| Testing | Playwright | — |

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
| **Mobile Impact** | Yes — inline validation applies at all breakpoints; error message must not overflow narrow viewports |
| **Platform Target** | Web (responsive) |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Implement a `useFieldValidation` hook (or align with React Hook Form v7's built-in blur-mode validation) to trigger field-level validation on blur for 5 form screens. Apply 2px solid error border, `✕` icon, and `aria-describedby`-linked static error message beneath invalid fields. Clear error on next valid blur. Re-validate all fields on submit and auto-focus the first failing field. Add Playwright test suite covering: 200ms button loading state, 200ms skeleton appearance, no blank flash at 50ms, and double-click protection with exactly-1-request assertion.

---

## Dependent Tasks

- us_055 task_001 (EP-010) — `<Button isLoading>` and skeleton components must exist before Playwright tests in this task can pass
- US_001 (EP-TECH) — React Hook Form v7 installed; 5 form screens scaffolded

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `client/src/hooks/useFieldValidation.ts` | CREATE | Blur-triggered validation; integrates with React Hook Form `mode: 'onBlur'`; re-validates on submit; focuses first error |
| `client/src/components/shared/FormField.tsx` | MODIFY OR CREATE | Wrapper that renders label + input + `aria-describedby` error message span; error state applies `border-red-600 border-2` + `✕` icon |
| `client/src/features/auth/OnboardingIntake.tsx` (SCR-002) | MODIFY | Use `useFieldValidation` / React Hook Form blur mode |
| `client/src/features/intake/IntakeStart.tsx` (SCR-006) | MODIFY | Use `useFieldValidation` / React Hook Form blur mode |
| `client/src/features/intake/IntakeForm.tsx` (SCR-007) | MODIFY | Use `useFieldValidation` / React Hook Form blur mode |
| `client/src/features/booking/ConfirmBooking.tsx` (SCR-009) | MODIFY | Use `useFieldValidation` / React Hook Form blur mode |
| `client/src/features/queue/WalkInIntake.tsx` (SCR-013) | MODIFY | Use `useFieldValidation` / React Hook Form blur mode |
| `client/tests/interaction/interaction-feedback.spec.ts` | CREATE | Playwright: 200ms button state; 200ms skeleton; 50ms blank-flash; double-click single-request |

---

## Implementation Plan

1. Configure React Hook Form on all 5 form screens with `mode: 'onBlur'`:
   ```tsx
   const { register, handleSubmit, formState: { errors } } = useForm({ mode: 'onBlur' });
   ```
   This triggers validation on field blur automatically using React Hook Form v7's built-in blur validation.

2. Create/update `FormField.tsx` shared wrapper:
   ```tsx
   interface FormFieldProps {
     id: string;
     label: string;
     error?: string;
     children: ReactNode; // the <input> or <select>
   }
   ```
   - Render: `<label htmlFor={id}>` + cloned `children` with `aria-describedby={errorId}` + `className` error border (`border-red-600 border-2`) when `error` truthy
   - When error: append `<XCircleIcon className="absolute right-3 top-3 text-red-600 w-5 h-5" aria-hidden="true" />` + `<p id={errorId} role="alert" className="text-red-600 text-sm mt-1">{error}</p>`
   - Error messages are static strings from `validationMessages.ts` (not from server response)

3. Create `client/src/lib/validationMessages.ts`:
   ```ts
   export const VALIDATION_MESSAGES = {
     required: 'This field is required.',
     emailFormat: 'Please enter a valid email address.',
     dateOfBirth: 'Please enter a valid date of birth.',
     phone: 'Please enter a valid phone number.',
     insuranceMemberId: 'Please enter your insurance member ID.',
     // ... other field-specific messages
   } as const;
   ```
   All messages are static (no echoed server data) — protects against OWASP A07 reflected content

4. Apply `mode: 'onBlur'` + `FormField` wrapper on all 5 screens with appropriate React Hook Form validation rules:
   - SCR-002: required name, DOB, email, phone fields
   - SCR-006/SCR-007: intake form fields with conditional validation
   - SCR-009: required appointment confirmation details; handle conditional insurance type field (register on mount when visible; unregister on unmount)
   - SCR-013: walk-in intake required fields

5. For form submit `handleSubmit`: React Hook Form re-validates all fields; after `handleSubmit` validation error, `setFocus(firstErrorField)` explicitly:
   ```tsx
   const onSubmit = handleSubmit(data => { /* ... */ }, (errors) => {
     const firstErrorField = Object.keys(errors)[0];
     if (firstErrorField) setFocus(firstErrorField as any);
   });
   ```

6. Create `interaction-feedback.spec.ts` Playwright tests:
   ```ts
   test('Button enters aria-busy within 200ms of async click on SCR-009', async ({ page }) => {
     // Navigate to SCR-009; click submit button; measure time to aria-busy
     const start = Date.now();
     await page.click('[data-testid="confirm-booking-submit"]');
     await page.waitForSelector('[aria-busy="true"]', { timeout: 200 });
     expect(Date.now() - start).toBeLessThanOrEqual(200);
   });

   test('Double-click on SCR-009 submit → exactly 1 POST /api/appointments', async ({ page }) => {
     const requests: string[] = [];
     page.on('request', req => {
       if (req.url().includes('/api/appointments') && req.method() === 'POST') requests.push(req.url());
     });
     await page.dblclick('[data-testid="confirm-booking-submit"]');
     await page.waitForTimeout(500);
     expect(requests).toHaveLength(1);
   });

   test('Skeleton visible within 200ms of navigating to SCR-008', async ({ page }) => {
     await page.goto('/booking');
     await page.waitForSelector('.skeleton', { timeout: 200 });
   });

   test('No blank flash at 50ms on SCR-014', async ({ page }) => {
     await page.goto('/queue');
     await page.waitForTimeout(50);
     const screenshot = await page.screenshot();
     // Assert screenshot is not all-white (presence of skeleton cells)
     expect(screenshot.length).toBeGreaterThan(50000); // non-blank page
   });
   ```

7. Repeat skeleton + timing assertions for SCR-014, SCR-016, SCR-018, SCR-019 in the same spec file

---

## Current Project State

```
client/
├── src/
│   ├── hooks/useFieldValidation.ts          ← CREATE
│   ├── lib/validationMessages.ts             ← CREATE
│   ├── components/shared/FormField.tsx       ← MODIFY/CREATE
│   └── features/
│       ├── auth/OnboardingIntake.tsx (SCR-002)     ← MODIFY (blur validation)
│       ├── intake/IntakeStart.tsx (SCR-006)         ← MODIFY
│       ├── intake/IntakeForm.tsx (SCR-007)           ← MODIFY
│       ├── booking/ConfirmBooking.tsx (SCR-009)      ← MODIFY
│       └── queue/WalkInIntake.tsx (SCR-013)          ← MODIFY
└── tests/interaction/
    └── interaction-feedback.spec.ts          ← CREATE
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `client/src/hooks/useFieldValidation.ts` | Blur-mode React Hook Form integration; focus-first-error on submit |
| CREATE | `client/src/lib/validationMessages.ts` | Static validation message strings (no server data) |
| MODIFY | `client/src/components/shared/FormField.tsx` | Error border + `✕` icon + `aria-describedby` error span |
| MODIFY | `client/src/features/auth/OnboardingIntake.tsx` | Blur validation via React Hook Form + `FormField` wrapper |
| MODIFY | `client/src/features/intake/IntakeStart.tsx` | Blur validation |
| MODIFY | `client/src/features/intake/IntakeForm.tsx` | Blur validation + conditional field register/unregister |
| MODIFY | `client/src/features/booking/ConfirmBooking.tsx` | Blur validation + double-submit protection |
| MODIFY | `client/src/features/queue/WalkInIntake.tsx` | Blur validation |
| CREATE | `client/tests/interaction/interaction-feedback.spec.ts` | Playwright: 200ms loading state; 200ms skeleton; 50ms blank flash; single-request double-click |

---

## External References

- [React Hook Form — Validation modes](https://react-hook-form.com/docs/useform#mode)
- [React Hook Form — `setFocus`](https://react-hook-form.com/docs/useform/setfocus)
- [Playwright — `waitForRequest`, `waitForSelector`](https://playwright.dev/docs/api/class-page)
- [OWASP A07:2021 — Identification and Authentication Failures](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm run lint`
- `cd client && npx playwright test tests/interaction/interaction-feedback.spec.ts`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] SCR-009: blur on empty "Patient Name" field → error border + `✕` icon + "This field is required." message appears
- [ ] SCR-009: re-enter valid name + blur → error clears
- [ ] SCR-009: submit with 3 empty fields → all 3 fields show errors; focus moves to first failing field
- [ ] SCR-009: error messages are NOT server-sourced (all defined in `validationMessages.ts`)
- [ ] SCR-007: conditional field appears → blur on it → validation works; field unmounts → its error clears
- [ ] `aria-describedby` on each invalid field points to its error message `id`
- [ ] Playwright: `[aria-busy="true"]` within 200ms of async button click on SCR-002, SCR-007, SCR-009, SCR-018
- [ ] Playwright: `.skeleton` elements in DOM within 200ms of navigation to SCR-008, SCR-014, SCR-016, SCR-018, SCR-019
- [ ] Playwright: screenshot at 50ms → no all-white page on any of 5 skeleton screens
- [ ] Playwright: double-click on SCR-009 submit → exactly 1 `POST /api/appointments` request recorded

---

## Implementation Checklist

- [ ] Create `validationMessages.ts` with all static error strings (no server data)
- [ ] Update `FormField.tsx`: error prop → 2px red border + `✕` icon + `role="alert"` error `<p>` with `aria-describedby`
- [ ] Apply React Hook Form `mode: 'onBlur'` on SCR-002, SCR-006, SCR-007, SCR-009, SCR-013
- [ ] Add `setFocus(firstErrorField)` in `handleSubmit` error callback on all 5 screens
- [ ] Handle conditional field on SCR-009 (SCR-007): register on mount, unregister on unmount
- [ ] Create Playwright `interaction-feedback.spec.ts`: 200ms button loading state (4 screens)
- [ ] Add 200ms skeleton assertions for 5 screens; 50ms blank-flash screenshot checks
- [ ] Add double-click → single-request assertion for SCR-009 Confirm Booking
