---
title: Navigation Map — PropelIQ Health
version: 1.0.0
date: 2026-04-17
source: .propel/context/docs/figma_spec.md (Sections 6 & 11)
---

# Navigation Map - PropelIQ Health

Cross-screen navigation index derived from FL-001 through FL-007 in `figma_spec.md`.

---

## Navigation Index

| From Screen | Element / Action | Target Screen | Flow | Notes |
|---|---|---|---|---|
| SCR-001 | Click "Create account" link | SCR-002 | FL-001 | New patient only |
| SCR-001 | Submit login (role=Patient) | SCR-004 | FL-001 | Role-based routing |
| SCR-001 | Submit login (role=Staff) | SCR-011 | FL-001 | Role-based routing |
| SCR-001 | Submit login (role=Admin) | SCR-019 | FL-001 | Role-based routing |
| SCR-002 | Submit registration | SCR-003 | FL-001 | POST /auth/register |
| SCR-002 | Click "Back to login" | SCR-001 | FL-001 | Cancel registration |
| SCR-003 | Click email verification link | SCR-001 | FL-001 | Token verified; redirect to login |
| SCR-003 | Click "Resend email" | SCR-003 | FL-001 | Stays on same screen; toast |
| SCR-004 | Click "Complete intake" CTA | SCR-005 | FL-002 | Intake not yet completed |
| SCR-004 | Click "Book appointment" CTA | SCR-008 | FL-003 | Booking flow entry |
| SCR-004 | Click "Upload documents" | SCR-015 | FL-005 (patient) | Document upload |
| SCR-005 | Click "AI-Assisted" card | SCR-006 | FL-002 | AI intake path |
| SCR-005 | Click "Manual Form" card | SCR-007 | FL-002 | Manual intake path |
| SCR-006 | Click "Switch to manual" | SCR-007 | FL-002 | Pre-populated from chat |
| SCR-006 | Complete chat → "Confirm" | SCR-007b | FL-002 | Review before submit |
| SCR-007 | Click "Switch to AI" | SCR-006 | FL-002 | Pre-populated from form |
| SCR-007 | Click "Review answers" | SCR-007b | FL-002 | Review before submit |
| SCR-007b | Click "Confirm" | SCR-004 | FL-002 | Intake complete; dashboard updated |
| SCR-007b | Click "Edit" | SCR-007 | FL-002 | Back to form for correction |
| SCR-008 | Click available slot | SCR-009 | FL-003 | Slot selected |
| SCR-008 | No slots → "Join waitlist" | SCR-009 | FL-003 | Waitlist variant |
| SCR-009 | Submit booking form | SCR-010 | FL-003 | POST /appointments/book |
| SCR-009 | Slot conflict modal → "Choose new" | SCR-008 | FL-003 | Reset selection |
| SCR-009 | Click "Back" | SCR-008 | FL-003 | Return to calendar |
| SCR-010 | Click "Back to dashboard" | SCR-004 | FL-003 | Booking complete |
| SCR-010 | Click "Add to calendar" | SCR-010 | FL-003 | External API (non-nav, toast on failure) |
| SCR-011 | Click "Add walk-in" | SCR-013 | FL-004 | Patient search first |
| SCR-011 | Click "View queue" | SCR-014 | FL-004 | Direct nav |
| SCR-011 | Click patient name (queue preview) | SCR-016 | FL-005 | 360° view |
| SCR-013 | Select existing patient | SCR-012 | FL-004 | Pre-fills patient data |
| SCR-013 | Create new patient → Save | SCR-012 | FL-004 | New patient created |
| SCR-013 | Click "Cancel" | SCR-011 | FL-004 | Back to dashboard |
| SCR-012 | Submit walk-in booking | SCR-014 | FL-004 | Walk-in added to queue |
| SCR-012 | Click "Cancel" | SCR-011 | FL-004 | Back to dashboard |
| SCR-014 | Click "Mark arrived" | SCR-014 | FL-004 | Status update (same screen) |
| SCR-014 | Click patient name | SCR-016 | FL-005 | 360° patient view |
| SCR-015 | Upload complete → "View 360°" | SCR-016 | FL-005 | Navigate to view |
| SCR-016 | Conflicts detected → "Review conflicts" | SCR-017 | FL-005 | Conflict ack panel |
| SCR-016 | Click "Open coding panel" | SCR-018 | FL-006 | Precondition: 360° verified |
| SCR-017 | All acknowledged → "Done" | SCR-016 | FL-005 | Returns verified |
| SCR-017 | Click "Skip for now" | SCR-016 | FL-005 | Returns partially verified |
| SCR-018 | Finalise codes → confirm | SCR-018 | FL-006 | Agreement rate shown; stays on screen |
| SCR-019 | Click "Create user" | SCR-020 | FL-007 | Create mode |
| SCR-019 | Click user row | SCR-020 | FL-007 | Edit mode |
| SCR-019 | Sidebar → "Audit Log" | SCR-021 | FL-007 | Admin sidebar link |
| SCR-020 | Click "Save" | SCR-019 | FL-007 | Returns to list with success toast |
| SCR-020 | Deactivate confirm → "Deactivate" | SCR-019 | FL-007 | Status updated |
| SCR-020 | Click "Cancel" | SCR-019 | FL-007 | No changes made |
| SCR-021 | (Read-only) | — | — | No outbound navigation |

---

## Flow Navigation Chains

### FL-001 — Registration & Login

```text
SCR-001 (login)
  ├─[new user]──► SCR-002 (register)
  │                   └──► SCR-003 (verify email) ──► SCR-001 (verified)
  │
  ├─[role=Patient]──► SCR-004 (patient dashboard)
  ├─[role=Staff]────► SCR-011 (staff dashboard)
  └─[role=Admin]────► SCR-019 (admin user list)
```

### FL-002 — Patient Intake

```text
SCR-004 (patient dashboard)
  └──► SCR-005 (intake method)
          ├─[AI]──► SCR-006 (AI chat)
          │           ├─[switch]──► SCR-007 (manual form)
          │           └─[done]───► SCR-007b (review) ──► SCR-004 (done)
          └─[manual]─► SCR-007 (manual form)
                          ├─[switch]──► SCR-006 (AI chat)
                          └─[done]───► SCR-007b (review) ──► SCR-004 (done)
```

### FL-003 — Appointment Booking

```text
SCR-004 (patient dashboard)
  └──► SCR-008 (booking calendar)
          └─[slot selected]──► SCR-009 (insurance form)
                                  ├─[conflict]──► SCR-008 (reset)
                                  └─[submit]───► SCR-010 (confirmation) ──► SCR-004
```

### FL-004 — Walk-In & Queue Management

```text
SCR-011 (staff dashboard)
  └──► SCR-013 (patient search)
          ├─[existing]──► SCR-012 (walk-in panel) ──► SCR-014 (queue)
          └─[new patient]─► SCR-012 (walk-in panel) ──► SCR-014 (queue)
                                                              └─[mark arrived]──► SCR-014 (updated)
```

### FL-005 — Clinical Documents & 360° View

```text
SCR-011 / SCR-014 (staff)
  └──► SCR-016 (360° view)
          ├─[upload needed]──► SCR-015 (upload) ──► SCR-016 (populated)
          └─[conflicts found]──► SCR-017 (conflict ack) ──► SCR-016 (verified)
```

### FL-006 — Medical Code Mapping

```text
SCR-016 (360° view, verified)
  └──► SCR-018 (coding panel)
          └─[finalise]──► SCR-018 (codes finalised, agreement rate shown)
```

### FL-007 — Admin User Management

```text
SCR-019 (user list)
  ├─[create]──► SCR-020 (create mode) ──► SCR-019 (new user added)
  ├─[edit]────► SCR-020 (edit mode)   ──► SCR-019 (updated)
  └─[sidebar]─► SCR-021 (audit log)
```

---

## Dead-End Screens (Intentional Exit Points)

| Screen | Reason |
|---|---|
| SCR-010 | Booking confirmed — natural completion; CTA returns to SCR-004 |
| SCR-007b | Intake reviewed — natural completion; CTA returns to SCR-004 |
| SCR-018 | Codes finalised — natural completion; stays on screen showing results |
| SCR-021 | Read-only audit log — no user actions; navigate via sidebar |

---

## Navigation Implementation Requirements

Each HTML wireframe includes a `<!-- Navigation Map -->` comment block at the top of `<body>`:

```html
<!-- Navigation Map
| Element         | Action | Target Screen                |
|-----------------|--------|------------------------------|
| #btn-id         | click  | SCR-XXX (ScreenName)         |
| #link-id        | click  | SCR-XXX (ScreenName)         |
-->
```

All primary CTA buttons are implemented as `<a href="./wireframe-SCR-XXX-name.html">` links within the wireframe HTML for clickable prototype behaviour.
