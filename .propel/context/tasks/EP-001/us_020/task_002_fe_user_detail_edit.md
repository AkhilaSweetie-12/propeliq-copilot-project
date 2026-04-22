---
title: "Task — FE User Detail / Edit (SCR-020)"
task_id: task_002
story_id: us_020
epic: EP-001
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_002 — FE User Detail / Edit (SCR-020)

## Requirement Reference

- **User Story**: us_020
- **Story Location**: .propel/context/tasks/EP-001/us_020/us_020.md
- **Acceptance Criteria**:
  - AC-2: Admin clicks "+ Create user" → SCR-020 form (name, email, role) → submit `POST /api/admin/users` → HTTP 201 → toast "Staff account created" → return to SCR-019; HTTP 409 → inline error "Email already registered"
  - AC-3: Admin edits existing user (role or status) → submit `PATCH /api/admin/users/{id}` → HTTP 200 → toast "User updated"; Admin cannot change own role/status (AC-3 guard enforced by BE, surface as error in FE)
  - AC-4: Admin clicks "Deactivate Account" → confirmation dialog → `DELETE /api/admin/users/{id}` → HTTP 200 → navigate to SCR-019, row shows "Inactive" badge
  - AC-6: Attempting to hard-delete (with `permanent=true`) blocked at BE (HTTP 400); FE does not expose any hard-delete UI
- **Edge Cases**:
  - Admin self-deactivation attempt → BE returns HTTP 400 "Administrators cannot deactivate their own account" → FE displays inline error
  - Role change to Patient for user with active appointments → FE displays warning banner "This user has upcoming appointments — role change will take effect immediately on next login" (from API response signal)

---

## Design References (Frontend Tasks Only)

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-020-user-detail.html |
| **Screen Spec** | .propel/context/docs/figma_spec.md#SCR-020 |
| **UXR Requirements** | UXR-501 (visual feedback ≤200 ms; spinner on form submit >500 ms), UXR-204 (form fields with visible labels and `aria-describedby` error messages) |
| **Design Tokens** | designsystem.md#colors, designsystem.md#typography, designsystem.md#forms |

### CRITICAL: Wireframe Implementation Requirement

**Wireframe Status = AVAILABLE** — MUST open `.propel/context/wireframes/Hi-Fi/wireframe-SCR-020-user-detail.html` and match layout, spacing, typography, and colors. Implement all states: Default, Loading, Error, Validation. Validate at 375 px, 768 px, 1440 px.

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript | React 18, TypeScript 5 |
| Frontend | TailwindCSS | 3.x |
| Backend | ASP.NET Core Web API | .NET 9 |
| Database | PostgreSQL | 16 |
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

Implement SCR-020 — Admin User Detail / Edit screen. This screen operates in two modes: **create mode** (reached from "+ Create user" on SCR-019) and **edit mode** (reached from "Edit" link on SCR-019). In edit mode, the screen pre-populates fields from `GET /api/admin/users/{id}` and allows the Admin to update role or status. A Danger Zone section contains "Deactivate Account" triggering a confirmation dialog. No hard-delete UI is exposed. The form uses React Hook Form for validation. All fields have visible labels and `aria-describedby` error messages (UXR-204).

---

## Dependent Tasks

- task_001 (SCR-019) — Entry point for navigation to SCR-020; can be developed in parallel
- task_003 (BE Admin User Management API) — `POST`, `PATCH`, `DELETE /api/admin/users` endpoints must be available; can be developed in parallel against mocked responses

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `app/src/pages/admin/AdminUserDetailPage.tsx` | CREATE | SCR-020 page container (create + edit modes) |
| `app/src/components/admin/UserForm.tsx` | CREATE | Form fields: name, email, role Select, status Select; Save + Cancel buttons |
| `app/src/components/admin/DeactivateConfirmDialog.tsx` | CREATE | Confirmation dialog for deactivation with warning text |
| `app/src/api/adminUsersApi.ts` | MODIFY | Add `createUser`, `updateUser`, `deactivateUser`, `getUserById` typed functions |

---

## Implementation Plan

1. **Route** — `/admin/users/new` (create mode) and `/admin/users/:id` (edit mode) in `AppRouter.tsx`; both Admin-role-guarded.
2. **Data loading in edit mode** — `GET /api/admin/users/:id` on mount; show skeleton/spinner until resolved. HTTP 404 → redirect to SCR-019 with toast error.
3. **Create mode form** — Fields: Name (text, required), Email (text, required, email format), Role (Select: Patient | Staff | Admin). Submit → `POST /api/admin/users`; HTTP 201 → toast "Staff account created" + navigate to SCR-019; HTTP 409 → inline error "Email already registered" on email field.
4. **Edit mode form** — Pre-populate name, email (read-only in edit mode), Role (Select), Status (Select: Active | Inactive). Admin cannot change their own role/status — disable those fields if `currentUser.id === targetUser.id`; show tooltip "Cannot modify your own account".
5. **Submit PATCH** — `PATCH /api/admin/users/{id} { role?, status? }`; HTTP 200 → toast "User updated" + refresh fields; HTTP 400 → inline error (self-deactivation guard); API response `warnings.activeAppointments === true` → show warning banner "This user has upcoming appointments — role change will take effect immediately on next login".
6. **Deactivate Account** — Danger Zone section (red border, destructive button). Click → `DeactivateConfirmDialog` with message "This action will deactivate the account. The user will no longer be able to log in." Confirm → `DELETE /api/admin/users/{id}`; HTTP 200 → navigate to SCR-019 + user row shows "Inactive" badge.
7. **Validation** — All fields validated client-side before API call: name non-empty, email valid format, role required. Per UXR-204: visible labels + `aria-describedby` linking to error message spans.
8. **Cancel button** — Navigate back to SCR-019 without saving.

---

## Current Project State

```
app/
  src/
    pages/
      admin/
        AdminUsersListPage.tsx   # from task_001
    components/
      admin/
        UserTable.tsx            # from task_001
        UserSearchFilter.tsx     # from task_001
    api/
      adminUsersApi.ts           # from task_001
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | app/src/pages/admin/AdminUserDetailPage.tsx | SCR-020 container; handles create/edit mode routing, data loading, form submission |
| CREATE | app/src/components/admin/UserForm.tsx | Controlled form with name, email, role, status fields and validation |
| CREATE | app/src/components/admin/DeactivateConfirmDialog.tsx | Confirmation dialog for deactivation; destructive CTA + cancel |
| MODIFY | app/src/api/adminUsersApi.ts | Add `getUserById`, `createUser`, `updateUser`, `deactivateUser` typed API functions |
| MODIFY | app/src/router/AppRouter.tsx | Register `/admin/users/new` and `/admin/users/:id` routes |

---

## External References

- React Hook Form v7 docs: https://react-hook-form.com/docs
- Controlled Select with React Hook Form: https://react-hook-form.com/docs/usecontroller
- ARIA for form validation errors (UXR-204): https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
- Confirmation dialog accessibility: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- Design tokens — Error: `color.semantic.error` `#DC2626`; Error bg: `#FEE2E2`; Success toast: `#16A34A`; Danger Zone border: `color.semantic.error`
- Wireframe: `.propel/context/wireframes/Hi-Fi/wireframe-SCR-020-user-detail.html`
- figma_spec.md components: TextField ×3, Select ×2, Button ×3 (Save, Deactivate, Cancel)

---

## Build Commands

- `cd app && npm run build` — TypeScript compile check
- `cd app && npm run lint` — ESLint validation
- `cd app && npm test -- --testPathPattern=AdminUserDetailPage` — Run page tests

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] **[UI Tasks]** Visual comparison against wireframe at 375 px, 768 px, 1440 px
- [ ] **[UI Tasks]** Run `/analyze-ux` to validate wireframe alignment
- [ ] Create mode: form submits `POST`, HTTP 201 shows toast + navigates to list
- [ ] Create mode: HTTP 409 shows inline email error "Email already registered"
- [ ] Edit mode: fields pre-populated from API on load
- [ ] PATCH success: toast "User updated" + fields refreshed
- [ ] Admin own-account fields disabled (role/status selects); tooltip present
- [ ] Role-change warning banner appears when API signals active appointments
- [ ] Deactivate confirmation dialog is shown before `DELETE` call
- [ ] All form fields have visible labels and `aria-describedby` error messages (UXR-204)
- [ ] Cancel navigates back to SCR-019 without mutations

---

## Implementation Checklist

- [ ] Create `AdminUserDetailPage.tsx` detecting create vs. edit mode from route params
- [ ] Implement `getUserById()` API call in edit mode on mount with skeleton loading
- [ ] Create `UserForm.tsx` with React Hook Form; fields: name (text), email (text, read-only in edit), role (Select), status (Select, edit-only)
- [ ] Disable role/status fields when editing own account; show tooltip
- [ ] Implement `POST /api/admin/users` submission with 201/409 handling
- [ ] Implement `PATCH /api/admin/users/{id}` submission with 200/400 handling; show warning banner for active-appointments signal
- [ ] Create `DeactivateConfirmDialog.tsx` with accessible dialog pattern
- [ ] Wire "Deactivate Account" button in Danger Zone to open dialog then call `DELETE`
- [ ] Add all `aria-label`, `aria-describedby`, and error message elements per UXR-204
- [ ] Register new routes in `AppRouter.tsx`
- [ ] **[UI Tasks - MANDATORY]** Reference wireframe `wireframe-SCR-020-user-detail.html` during implementation
- [ ] **[UI Tasks - MANDATORY]** Validate UI matches wireframe before marking task complete
