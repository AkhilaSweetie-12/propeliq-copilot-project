---
title: "Task — Registration & Email Verification Screens (SCR-002, SCR-003) with Inline Validation & Mobile Layout"
task_id: task_001
story_id: us_017
epic: EP-001
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_017] — Patient Self-Registration with Email Verification
- Story Location: `.propel/context/tasks/EP-001/us_017/us_017.md`
- Acceptance Criteria:
  - AC-1: On successful `POST /api/auth/register` (201), SPA displays "Check your email to verify your account" (transitions to SCR-003)
  - AC-2: Inline validation errors per failing rule on field blur — no API call until all client-side rules pass; per-rule error messages displayed beneath the field
  - AC-3: HTTP 409 response → display inline error "An account with this email already exists" on the email field
  - AC-5: Expired token (HTTP 400) → SCR-003 shows "Resend verification email" button; clicking triggers `POST /api/auth/resend-verification`
  - AC-6: SCR-002 renders as single-column layout at ≤ 768 px (UXR-303)
- Edge Cases:
  - EC-1: Submit button disabled immediately on first click (disabled + spinner); prevents duplicate POST

## Design References (Frontend Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-002-registration.html, .propel/context/wireframes/Hi-Fi/wireframe-SCR-003-email-verification.html |
| **Screen Spec** | figma_spec.md#SCR-002, figma_spec.md#SCR-003 |
| **UXR Requirements** | UXR-201, UXR-202, UXR-204, UXR-301, UXR-303, UXR-501, UXR-601 |
| **Design Tokens** | wireframe-shared.css (--color-teal-500, --color-navy-600, --neutral-*, --space-*, --shadow-2, --radius-xl) |

### CRITICAL: Wireframe Implementation Requirement
**Wireframe Status = AVAILABLE** — MUST reference both wireframe files during implementation:
- SCR-002: `max-width: 480px` auth card, grid-2 name fields, password strength meter (4 bar segments), Terms & Conditions checkbox, `btn-primary` "Create account" button, `btn-secondary` "Back to sign in" link
- SCR-003: `max-width: 440px` card, centered email icon (72×72 teal circle), email highlight span, `btn-primary` "Resend verification email", `btn-ghost` "← Back to sign in", 60-second resend cooldown text
- MUST implement all states: Default, Loading (submit spinner), Error (inline validation), Validation (per-rule errors)
- MUST validate at 375px, 768px, 1440px breakpoints

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18.x |
| Language | TypeScript | 5.x |
| Styling | TailwindCSS | 3.4.x |
| Routing | React Router | 6.x |
| Build | Vite | 5.x |
| HTTP Client | Fetch API / Axios | N/A |
| AI/ML | N/A | N/A |
| Mobile | N/A | N/A |

## AI References (AI Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |
| **AI Pattern** | N/A |
| **Prompt Template Path** | N/A |
| **Guardrails Config** | N/A |
| **Model Provider** | N/A |

## Mobile References (Mobile Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |
| **Platform Target** | N/A |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

## Task Overview
Implement the SCR-002 `RegistrationPage` React component and SCR-003 `EmailVerificationPage` component matching the wireframe layouts. SCR-002 includes: first/last name fields (2-column grid collapsing to single column at ≤ 768 px per UXR-303), email, password with 4-segment strength meter, confirm-password, Terms & Conditions checkbox, submit button with disabled+spinner state on click, and per-rule inline blur validation. SCR-003 shows the "Check your email" state with a 60-second resend cooldown and calls `POST /api/auth/resend-verification` on button click.

## Dependent Tasks
- `us_006 task_002_fe_playwright_e2e_scaffold.md` — Playwright scaffold must exist; e2e smoke test for registration flow references this screen
- `us_005` (EP-TECH) — JWT auth infrastructure provides the API endpoints that this form calls

## Impacted Components
- `/web/src/pages/auth/RegistrationPage.tsx` — CREATE: SCR-002 form component
- `/web/src/pages/auth/EmailVerificationPage.tsx` — CREATE: SCR-003 post-registration & token-expired states
- `/web/src/hooks/useRegistrationForm.ts` — CREATE: form state, blur validation, submit handler
- `/web/src/api/auth.ts` — MODIFY or CREATE: `registerUser()`, `resendVerification()` API functions
- `/web/src/router.tsx` — MODIFY: add `/register` → `RegistrationPage` and `/verify-email` → `EmailVerificationPage` routes

## Implementation Plan

1. **Create `useRegistrationForm` hook** (AC-2, EC-1) — encapsulates all form state and validation logic:
   ```typescript
   // /web/src/hooks/useRegistrationForm.ts
   import { useState, useCallback } from 'react';

   interface RegistrationFields {
     firstName: string;
     lastName: string;
     email: string;
     password: string;
     confirmPassword: string;
     termsAccepted: boolean;
   }

   interface FieldErrors {
     firstName?: string;
     lastName?: string;
     email?: string;
     password?: string[];   // AC-2: per-rule array for password
     confirmPassword?: string;
     terms?: string;
   }

   // AC-2: password complexity rules — 8+ chars, uppercase, lowercase, digit, symbol
   const PASSWORD_RULES = [
     { id: 'length',    label: 'At least 8 characters',    test: (v: string) => v.length >= 8 },
     { id: 'upper',     label: 'One uppercase letter',     test: (v: string) => /[A-Z]/.test(v) },
     { id: 'lower',     label: 'One lowercase letter',     test: (v: string) => /[a-z]/.test(v) },
     { id: 'digit',     label: 'One number',               test: (v: string) => /\d/.test(v) },
     { id: 'symbol',    label: 'One symbol (!@#$…)',       test: (v: string) => /[^A-Za-z0-9]/.test(v) },
   ] as const;

   export function useRegistrationForm() {
     const [fields, setFields] = useState<RegistrationFields>({
       firstName: '', lastName: '', email: '', password: '', confirmPassword: '', termsAccepted: false,
     });
     const [touched, setTouched] = useState<Partial<Record<keyof RegistrationFields, boolean>>>({});
     const [isSubmitting, setIsSubmitting] = useState(false);
     const [apiError, setApiError] = useState<{ field?: string; message: string } | null>(null);

     const validateField = useCallback((name: keyof RegistrationFields, value: string | boolean): string | string[] | undefined => {
       switch (name) {
         case 'firstName':
         case 'lastName':
           return !value ? 'This field is required.' : undefined;
         case 'email':
           return !value ? 'Email is required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string) ? 'Enter a valid email address.' : undefined;
         case 'password': {
           const failing = PASSWORD_RULES.filter(r => !r.test(value as string)).map(r => r.label);
           return failing.length > 0 ? failing : undefined;
         }
         case 'confirmPassword':
           return value !== fields.password ? 'Passwords do not match.' : undefined;
         case 'termsAccepted':
           return !value ? 'You must accept the terms to continue.' : undefined;
         default:
           return undefined;
       }
     }, [fields.password]);

     const handleBlur = useCallback((name: keyof RegistrationFields) => {
       setTouched(prev => ({ ...prev, [name]: true }));
     }, []);

     const handleChange = useCallback((name: keyof RegistrationFields, value: string | boolean) => {
       setFields(prev => ({ ...prev, [name]: value }));
       // Clear API error when user edits the email field (AC-3 — 409 error dismissal)
       if (name === 'email') setApiError(null);
     }, []);

     return {
       fields, touched, isSubmitting, setIsSubmitting, apiError, setApiError,
       handleBlur, handleChange, validateField, PASSWORD_RULES,
     };
   }
   ```

2. **Create `RegistrationPage.tsx`** (AC-1, AC-2, AC-3, AC-6, EC-1) — matches SCR-002 wireframe layout exactly:
   - **Layout**: `max-w-[480px]` centered auth card; logo mark (teal 56×56 rounded square); `h2` "Create your account"
   - **Name fields**: `grid grid-cols-2 gap-4` → `sm:grid-cols-1` at ≤ 768 px (UXR-303 / AC-6); `id="fname"`, `id="lname"`
   - **Email field**: `id="reg-email"`, `type="email"`, `autocomplete="email"`, `aria-required="true"`; on blur — validate; API 409 maps to field-level error
   - **Password field**: `id="reg-password"`, `autocomplete="new-password"`; 4-segment strength bar below (`.pw-strength`); `aria-describedby="pw-hint"` live strength label
   - **Confirm password field**: `id="confirm-password"`, `autocomplete="new-password"`
   - **Terms checkbox**: `id="terms"`, `aria-required="true"`
   - **Submit button** `id="btn-register"`: on click → `disabled={true}` + spinner immediately (EC-1); calls `registerUser()`; on 201 → navigate to `/verify-email?email=<encoded>`; on 409 → set email field error "An account with this email already exists" (AC-3)
   - **"Back to sign in" link** → `<Link to="/login">`
   - All fields use `aria-describedby` pointing to error message `id` (UXR-204)
   - Inline errors render on blur (UXR-601) with red border class + error icon + message beneath field

3. **Create `EmailVerificationPage.tsx`** (AC-1, AC-5, EC-2) — matches SCR-003 wireframe:
   - **States**: `pending` (default — email sent after registration) and `expired` (navigated from `GET /api/auth/verify` response 400)
   - **Layout**: `max-w-[440px]` centered; teal 72×72 email icon circle; `h2` "Check your email"
   - Email address displayed in `font-weight: 600` span (extracted from route state or query param)
   - `alert alert-info` spam folder hint
   - **"Resend verification email" button** `id="btn-resend"`: 60-second cooldown timer (countdown displayed); disabled during cooldown and during API call; calls `resendVerification(email)` on click (AC-5)
   - **"← Back to sign in" link** → `<Link to="/login">`
   - On `expired` state: show additional banner "Your verification link has expired. Request a new one."

4. **Create / modify `api/auth.ts`** — typed API functions:
   ```typescript
   // /web/src/api/auth.ts
   export async function registerUser(payload: {
     firstName: string; lastName: string; email: string; password: string;
   }): Promise<void> {
     const res = await fetch('/api/auth/register', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(payload),
     });
     if (res.status === 409) throw new ApiError(409, 'An account with this email already exists.');
     if (!res.ok) throw new ApiError(res.status, 'Registration failed. Please try again.');
   }

   export async function resendVerification(email: string): Promise<void> {
     const res = await fetch('/api/auth/resend-verification', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ email }),
     });
     if (!res.ok) throw new ApiError(res.status, 'Failed to resend verification email.');
   }

   export class ApiError extends Error {
     constructor(public readonly status: number, message: string) { super(message); }
   }
   ```

5. **Add routes to `router.tsx`**:
   ```typescript
   // Add to route configuration:
   { path: '/register', element: <RegistrationPage /> },
   { path: '/verify-email', element: <EmailVerificationPage /> },
   ```

6. **Implement 4-segment password strength meter** (SCR-002 wireframe) — real-time as user types:
   ```typescript
   // Strength score = number of PASSWORD_RULES passing (0-5)
   // Map to 4 bars: 0-1 = 0 active, 2 = 1 active (red), 3 = 2 active (orange), 4 = 3 active (yellow), 5 = 4 active (teal)
   // Labels: 0 = "Too weak", 1 = "Weak", 2 = "Fair", 3 = "Good", 4 = "Strong"
   const strengthColors = ['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-teal-500'];
   ```
   The 4 `.pw-bar` segments use TailwindCSS conditional colour classes based on the passing rule count.

7. **Implement 60-second resend cooldown** (SCR-003, AC-5):
   ```typescript
   const [cooldown, setCooldown] = useState(0);
   // After successful resend, set cooldown = 60 and decrement with setInterval every second
   // Button disabled while cooldown > 0 or isResending === true
   // Display: "Resend in {cooldown}s" while cooling down
   ```

8. **Implement responsive name-field collapse** (AC-6, UXR-303):
   ```tsx
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
     {/* First name */}
     {/* Last name */}
   </div>
   ```
   At ≤ 768 px (`sm:` breakpoint in Tailwind defaults to 640 px; adjust to `md:` = 768 px or use custom breakpoint `max-md:grid-cols-1`) — verify against wireframe annotation `UXR-303: ≤ 768 px → single column`.

## Current Project State
```
/web/src/
├── pages/
│   └── auth/
│       ├── LoginPage.tsx          # existing (if scaffolded)
│       ├── RegistrationPage.tsx   # NOT YET CREATED — this task
│       └── EmailVerificationPage.tsx # NOT YET CREATED — this task
├── hooks/
│   └── useRegistrationForm.ts     # NOT YET CREATED — this task
├── api/
│   └── auth.ts                    # WILL BE CREATED OR MODIFIED
└── router.tsx                     # WILL BE MODIFIED
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/web/src/pages/auth/RegistrationPage.tsx` | SCR-002 form: 2→1-col name grid, email, password + strength meter, confirm-password, terms checkbox, disabled-on-submit button; blur validation; 409 → email error; navigate to `/verify-email` on 201 |
| CREATE | `/web/src/pages/auth/EmailVerificationPage.tsx` | SCR-003: email icon, sent-to address, spam hint, resend button with 60s cooldown, back-to-login link; expired state banner |
| CREATE | `/web/src/hooks/useRegistrationForm.ts` | Form state, `PASSWORD_RULES` array, per-rule blur validation, `touched` tracking, `isSubmitting` flag |
| CREATE | `/web/src/api/auth.ts` | `registerUser()`, `resendVerification()`, `ApiError` class with `status` property |
| MODIFY | `/web/src/router.tsx` | Add `/register` → `RegistrationPage`, `/verify-email` → `EmailVerificationPage` routes |

## External References
- SCR-002 wireframe: `.propel/context/wireframes/Hi-Fi/wireframe-SCR-002-registration.html`
- SCR-003 wireframe: `.propel/context/wireframes/Hi-Fi/wireframe-SCR-003-email-verification.html`
- figma_spec.md#SCR-002 (states: Default, Loading, Error, Validation): `.propel/context/docs/figma_spec.md`
- UXR-303 (≤ 768 px single-column collapse): `.propel/context/docs/figma_spec.md#UXR-303`
- UXR-601 (inline validation on blur): `.propel/context/docs/figma_spec.md#UXR-601`
- UXR-204 (aria-describedby for error messages): `.propel/context/docs/figma_spec.md#UXR-204`
- React Hook Form patterns (uncontrolled approach alternative): https://react-hook-form.com/

## Build Commands
```bash
cd web
npm run dev      # Vite dev server — http://localhost:3000
npm run build    # Production build
npm run typecheck  # tsc --noEmit
```

## Implementation Validation Strategy
- [ ] `RegistrationPage` renders at 375px — name fields single-column; all fields visible; no horizontal scroll (AC-6/UXR-303)
- [ ] `RegistrationPage` renders at 768px — name fields transition from 1-column to 2-column at exact breakpoint
- [ ] Password blur with `"password"` → shows failing rules for "One uppercase letter", "One number", "One symbol" beneath field (AC-2)
- [ ] Submit with all fields valid → button enters disabled+spinner state; page does NOT re-enable button during API call (EC-1)
- [ ] Mock `POST /api/auth/register` returning 201 → navigates to `/verify-email` (AC-1)
- [ ] Mock returning 409 → email field shows "An account with this email already exists"; form re-enables (AC-3)
- [ ] `EmailVerificationPage` "Resend" button triggers `POST /api/auth/resend-verification`; button shows 60s countdown after success (AC-5)
- [ ] All form fields have `aria-describedby` pointing to visible error message IDs (UXR-204)

## Implementation Checklist
- [ ] **[MANDATORY]** Reference SCR-002 wireframe during implementation — match `max-w-[480px]` card, logo mark, 2-column name grid, password strength bars, terms checkbox, button layout exactly
- [ ] **[MANDATORY]** Reference SCR-003 wireframe — match `max-w-[440px]` card, 72×72 teal email icon, email highlight, spam hint alert, resend button, back-to-sign-in ghost button
- [ ] Create `useRegistrationForm.ts` with `PASSWORD_RULES`, per-rule blur validation, `touched` state, `isSubmitting` flag
- [ ] Create `RegistrationPage.tsx`: 2→1-col responsive name grid; blur validation per rule; submit disabled immediately on click (EC-1); 201 → navigate; 409 → email field error
- [ ] Create `EmailVerificationPage.tsx`: pending and expired states; 60-second cooldown timer; resend API call
- [ ] Create `api/auth.ts` with `registerUser()`, `resendVerification()`, `ApiError` class
- [ ] Add `/register` and `/verify-email` routes to `router.tsx`
- [ ] Validate UI matches wireframe at 375px, 768px, 1440px breakpoints
- [ ] **[MANDATORY]** Run `/analyze-ux` after implementation to verify wireframe alignment
