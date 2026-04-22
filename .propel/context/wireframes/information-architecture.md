---
title: Information Architecture — PropelIQ Health
version: 1.0.0
date: 2026-04-17
fidelity: High
screen-type: Web (Responsive)
viewport: 1440×900px (desktop primary)
source: .propel/context/docs/figma_spec.md
design-system: .propel/context/docs/designsystem.md
---

# Information Architecture - PropelIQ Health

## 1. Wireframe Specification

**Fidelity Level**: High
**Screen Type**: Web — Responsive (320px / 768px / 1024px / 1440px)
**Viewport**: 1440 × 900px (desktop primary)
**Framework**: React 18 + TypeScript + TailwindCSS
**Design System**: `.propel/context/docs/designsystem.md`

---

## 2. System Overview

PropelIQ Health is a Unified Patient Access & Clinical Intelligence Platform for a single healthcare practice. It serves three personas — Patient, Staff, and Admin — across a single React SPA with role-based routing. The platform covers patient self-service (registration, intake, booking), staff operations (walk-in management, queue monitoring, AI-assisted clinical intelligence), and admin governance (user management, audit logs).

AI features use a Trust-First architecture: all AI-generated suggestions (clinical extraction, ICD-10/CPT codes) are visually distinguished and require mandatory Staff verification before finalisation.

**Technology Stack**: React 18 / TypeScript / TailwindCSS (frontend) | ASP.NET Core 9 (API) | PostgreSQL 16 + pgvector (data) | Ollama + Llama 3.2 3B + nomic-embed-text (AI, local)

---

## 3. Wireframe References

### Generated Hi-Fi HTML Wireframes

| Screen ID | Screen Name | File Path | Priority | UC Source |
|---|---|---|---|---|
| SCR-001 | Login | [wireframe-SCR-001-login.html](./Hi-Fi/wireframe-SCR-001-login.html) | P0 | UC-001 |
| SCR-002 | Registration | [wireframe-SCR-002-registration.html](./Hi-Fi/wireframe-SCR-002-registration.html) | P0 | UC-001 |
| SCR-003 | Email Verification | [wireframe-SCR-003-email-verification.html](./Hi-Fi/wireframe-SCR-003-email-verification.html) | P0 | UC-001 |
| SCR-004 | Patient Dashboard | [wireframe-SCR-004-patient-dashboard.html](./Hi-Fi/wireframe-SCR-004-patient-dashboard.html) | P0 | UC-002, UC-003 |
| SCR-005 | Intake Method Selection | [wireframe-SCR-005-intake-method.html](./Hi-Fi/wireframe-SCR-005-intake-method.html) | P0 | UC-002 |
| SCR-006 | AI-Assisted Intake Chat | [wireframe-SCR-006-ai-intake-chat.html](./Hi-Fi/wireframe-SCR-006-ai-intake-chat.html) | P0 | UC-002 |
| SCR-007 | Manual Intake Form | [wireframe-SCR-007-manual-intake.html](./Hi-Fi/wireframe-SCR-007-manual-intake.html) | P0 | UC-002 |
| SCR-007b | Intake Review & Summary | [wireframe-SCR-007b-intake-review.html](./Hi-Fi/wireframe-SCR-007b-intake-review.html) | P0 | UC-002 |
| SCR-008 | Booking Calendar | [wireframe-SCR-008-booking-calendar.html](./Hi-Fi/wireframe-SCR-008-booking-calendar.html) | P0 | UC-003 |
| SCR-009 | Booking & Insurance Form | [wireframe-SCR-009-booking-insurance.html](./Hi-Fi/wireframe-SCR-009-booking-insurance.html) | P0 | UC-003 |
| SCR-010 | Appointment Confirmation | [wireframe-SCR-010-confirmation.html](./Hi-Fi/wireframe-SCR-010-confirmation.html) | P0 | UC-003 |
| SCR-011 | Staff Home Dashboard | [wireframe-SCR-011-staff-dashboard.html](./Hi-Fi/wireframe-SCR-011-staff-dashboard.html) | P0 | UC-004, UC-005, UC-009 |
| SCR-012 | Walk-In Booking Panel | [wireframe-SCR-012-walkin-booking.html](./Hi-Fi/wireframe-SCR-012-walkin-booking.html) | P0 | UC-004 |
| SCR-013 | Patient Search / Create | [wireframe-SCR-013-patient-search.html](./Hi-Fi/wireframe-SCR-013-patient-search.html) | P0 | UC-004 |
| SCR-014 | Same-Day Queue View | [wireframe-SCR-014-queue-view.html](./Hi-Fi/wireframe-SCR-014-queue-view.html) | P0 | UC-005, UC-009 |
| SCR-015 | Clinical Documents Upload | [wireframe-SCR-015-documents-upload.html](./Hi-Fi/wireframe-SCR-015-documents-upload.html) | P1 | UC-007 |
| SCR-016 | 360° Patient View | [wireframe-SCR-016-patient-360.html](./Hi-Fi/wireframe-SCR-016-patient-360.html) | P1 | UC-007 |
| SCR-017 | Conflict Acknowledgement Panel | [wireframe-SCR-017-conflict-ack.html](./Hi-Fi/wireframe-SCR-017-conflict-ack.html) | P1 | UC-007 |
| SCR-018 | Medical Coding Panel | [wireframe-SCR-018-coding-panel.html](./Hi-Fi/wireframe-SCR-018-coding-panel.html) | P1 | UC-008 |
| SCR-019 | Admin User Management List | [wireframe-SCR-019-admin-users.html](./Hi-Fi/wireframe-SCR-019-admin-users.html) | P1 | UC-010 |
| SCR-020 | Admin User Detail / Edit | [wireframe-SCR-020-user-detail.html](./Hi-Fi/wireframe-SCR-020-user-detail.html) | P1 | UC-010 |
| SCR-021 | Audit Log Viewer | [wireframe-SCR-021-audit-log.html](./Hi-Fi/wireframe-SCR-021-audit-log.html) | P2 | UC-010 |

### Component Inventory Reference

**See**: [component-inventory.md](./component-inventory.md) for detailed component documentation including complete specifications, states, responsive behaviour, and reusability analysis.

### Shared Resources

| Resource | File Path | Description |
|---|---|---|
| Shared CSS | [wireframe-shared.css](./Hi-Fi/wireframe-shared.css) | Design tokens, component base styles, layout shell |
| Navigation Map | [navigation-map.md](./navigation-map.md) | Cross-screen navigation index |
| Design Tokens Applied | [design-tokens-applied.md](./design-tokens-applied.md) | Token application reference |

---

## 4. User Personas & Flows

### Persona 1: Patient

- **Role**: Registered patient using the self-service web portal
- **Goals**: Complete pre-appointment intake, book appointments, upload clinical documents, receive confirmations
- **Key Screens**: SCR-001, SCR-002, SCR-003, SCR-004, SCR-005, SCR-006, SCR-007, SCR-007b, SCR-008, SCR-009, SCR-010, SCR-015
- **Primary Flow** (FL-001 + FL-002 + FL-003): Login → Patient Dashboard → Intake Method → AI Chat or Manual Form → Review → Booking Calendar → Insurance → Confirmation
- **Wireframe References**: wireframe-SCR-001 through wireframe-SCR-010, wireframe-SCR-015

### Persona 2: Staff

- **Role**: Front-desk or call-centre staff member
- **Goals**: Register walk-in patients, manage same-day queue, view clinical intelligence, verify AI-extracted data, map ICD-10/CPT codes
- **Key Screens**: SCR-001, SCR-011, SCR-012, SCR-013, SCR-014, SCR-015, SCR-016, SCR-017, SCR-018
- **Primary Flow** (FL-004 + FL-005 + FL-006): Login → Staff Dashboard → Walk-In Flow or Queue View → Patient 360° → Conflict Ack → Medical Coding
- **Wireframe References**: wireframe-SCR-011 through wireframe-SCR-018

### Persona 3: Admin

- **Role**: Platform administrator
- **Goals**: Manage user accounts, deactivate accounts, view audit logs, maintain platform security
- **Key Screens**: SCR-001, SCR-019, SCR-020, SCR-021
- **Primary Flow** (FL-007): Login → User Management List → User Detail → Edit or Deactivate
- **Wireframe References**: wireframe-SCR-019 through wireframe-SCR-021

### User Flow Diagrams

| Flow | Flow ID | Entry | Exit | Wireframe Files |
|---|---|---|---|---|
| Registration & Login | FL-001 | SCR-001 | SCR-004 / SCR-011 / SCR-019 | SCR-001, SCR-002, SCR-003 |
| Patient Intake | FL-002 | SCR-004 | SCR-004 (updated) | SCR-005, SCR-006, SCR-007, SCR-007b |
| Appointment Booking | FL-003 | SCR-004 | SCR-004 (updated) | SCR-008, SCR-009, SCR-010 |
| Walk-In & Queue Management | FL-004 | SCR-011 | SCR-014 | SCR-012, SCR-013, SCR-014 |
| Clinical Docs & 360° View | FL-005 | SCR-016 | SCR-016 (verified) | SCR-015, SCR-016, SCR-017 |
| Medical Code Mapping | FL-006 | SCR-018 | SCR-018 (finalised) | SCR-018 |
| Admin User Management | FL-007 | SCR-019 | SCR-019 | SCR-019, SCR-020, SCR-021 |

---

## 5. Screen Hierarchy

### Level 1: Public (Unauthenticated)

- **SCR-001 Login** (P0 — Critical) — [wireframe-SCR-001-login.html](./Hi-Fi/wireframe-SCR-001-login.html)
  - Description: Shared login page for all three personas; role-based routing on success
  - User Entry Point: Yes (application root `/`)
  - Key Components: TextField ×2, Button-Primary, Button-Ghost, Link (Forgot Password)

- **SCR-002 Registration** (P0 — Critical) — [wireframe-SCR-002-registration.html](./Hi-Fi/wireframe-SCR-002-registration.html)
  - Description: New patient self-registration form
  - Parent Screen: SCR-001
  - Key Components: TextField ×4, Button-Primary, Checkbox (Terms)

- **SCR-003 Email Verification** (P0 — Critical) — [wireframe-SCR-003-email-verification.html](./Hi-Fi/wireframe-SCR-003-email-verification.html)
  - Description: Post-registration email verification pending screen with resend option
  - Parent Screen: SCR-002
  - Key Components: Alert-Info, Button-Primary (Resend), Link (Return to Login)

### Level 2: Patient Portal (role=Patient)

- **SCR-004 Patient Dashboard** (P0 — Critical) — [wireframe-SCR-004-patient-dashboard.html](./Hi-Fi/wireframe-SCR-004-patient-dashboard.html)
  - Description: Patient landing page with upcoming appointment, intake status, insurance status
  - User Entry Point: Yes (post-login, role=Patient)
  - Key Components: Card ×3, Button-Primary (Book appointment), Badge ×1

- **SCR-005 Intake Method Selection** (P0 — Critical) — [wireframe-SCR-005-intake-method.html](./Hi-Fi/wireframe-SCR-005-intake-method.html)
  - Description: Two-card selection between AI-Assisted chat and Manual form intake
  - Parent Screen: SCR-004
  - Key Components: Card-Selectable ×2, Button-Primary ×2

- **SCR-006 AI-Assisted Intake Chat** (P0 — Critical) — [wireframe-SCR-006-ai-intake-chat.html](./Hi-Fi/wireframe-SCR-006-ai-intake-chat.html)
  - Description: Multi-turn conversational AI intake with typing indicator and auto-save
  - Parent Screen: SCR-005
  - Key Components: ChatBubble ×N, TextField (message), Button (Send), TypingIndicator, AutoSave indicator

- **SCR-007 Manual Intake Form** (P0 — Critical) — [wireframe-SCR-007-manual-intake.html](./Hi-Fi/wireframe-SCR-007-manual-intake.html)
  - Description: Structured intake form with all required clinical fields
  - Parent Screen: SCR-005 or SCR-006 (switch)
  - Key Components: TextField ×8, Select ×2, Textarea ×2, Button ×2

- **SCR-007b Intake Review & Summary** (P0 — Critical) — [wireframe-SCR-007b-intake-review.html](./Hi-Fi/wireframe-SCR-007b-intake-review.html)
  - Description: Read-only review of all intake fields before confirmation
  - Parent Screen: SCR-007 or SCR-006
  - Key Components: DataList ×5, Button-Primary (Confirm), Button-Secondary (Edit)

- **SCR-008 Booking Calendar** (P0 — Critical) — [wireframe-SCR-008-booking-calendar.html](./Hi-Fi/wireframe-SCR-008-booking-calendar.html)
  - Description: Interactive appointment slot calendar with availability colour coding
  - Parent Screen: SCR-004
  - Key Components: CalendarGrid, SlotCell ×N (Available/Unavailable/Preferred), Button-Primary

- **SCR-009 Booking & Insurance Form** (P0 — Critical) — [wireframe-SCR-009-booking-insurance.html](./Hi-Fi/wireframe-SCR-009-booking-insurance.html)
  - Description: Insurance details entry + optional preferred slot selection + pre-check result
  - Parent Screen: SCR-008
  - Key Components: TextField ×2, Select ×1, Alert (pre-check), Button-Primary, Button-Secondary

- **SCR-010 Appointment Confirmation** (P0 — Critical) — [wireframe-SCR-010-confirmation.html](./Hi-Fi/wireframe-SCR-010-confirmation.html)
  - Description: Final booking confirmation with PDF link and calendar sync button
  - Parent Screen: SCR-009
  - Key Components: Card (summary), Button-Primary (Add to calendar), Button-Secondary (Back)

- **SCR-015 Clinical Documents Upload** (P1 — Core) — [wireframe-SCR-015-documents-upload.html](./Hi-Fi/wireframe-SCR-015-documents-upload.html)
  - Description: Drag-and-drop PDF upload with per-document extraction status tracking
  - Parent Screen: SCR-004 or SCR-016 (Staff)
  - Key Components: FileUpload zone, Card (document) ×N, Badge (Processing/Extracted/Failed)

### Level 3: Staff Dashboard (role=Staff)

- **SCR-011 Staff Home Dashboard** (P0 — Critical) — [wireframe-SCR-011-staff-dashboard.html](./Hi-Fi/wireframe-SCR-011-staff-dashboard.html)
  - Description: Staff entry page with today's metrics, queue preview, and quick actions
  - User Entry Point: Yes (post-login, role=Staff)
  - Key Components: MetricCard ×3, Table (queue top-5), Button-Primary (Add walk-in)

- **SCR-012 Walk-In Booking Panel** (P0 — Critical) — [wireframe-SCR-012-walkin-booking.html](./Hi-Fi/wireframe-SCR-012-walkin-booking.html)
  - Description: Staff-facing panel to book a walk-in against an available slot
  - Parent Screen: SCR-013
  - Key Components: Search input, PatientCard, TextField ×4, Button ×3

- **SCR-013 Patient Search / Create** (P0 — Critical) — [wireframe-SCR-013-patient-search.html](./Hi-Fi/wireframe-SCR-013-patient-search.html)
  - Description: Real-time patient search by name/DOB; inline new patient creation form
  - Parent Screen: SCR-011
  - Key Components: SearchInput (debounced), PatientResultCard ×N, TextField ×4, Select ×1

- **SCR-014 Same-Day Queue View** (P0 — Critical) — [wireframe-SCR-014-queue-view.html](./Hi-Fi/wireframe-SCR-014-queue-view.html)
  - Description: Live same-day appointment queue with risk badges and arrival marking
  - Parent Screen: SCR-011
  - Key Components: Table (queue), RiskBadge ×N, Button (Arrived/Reorder), Dropdown (filter)

- **SCR-016 360° Patient View** (P1 — Core) — [wireframe-SCR-016-patient-360.html](./Hi-Fi/wireframe-SCR-016-patient-360.html)
  - Description: Staff view of patient clinical history with AI-suggested fields awaiting verification
  - Parent Screen: SCR-014
  - Key Components: Accordion ×5, AIBadge, Badge (Verified), Alert (conflict), Button (Verify)

- **SCR-017 Conflict Acknowledgement Panel** (P1 — Core) — [wireframe-SCR-017-conflict-ack.html](./Hi-Fi/wireframe-SCR-017-conflict-ack.html)
  - Description: Step-through panel for Staff to acknowledge data conflicts in the 360° view
  - Parent Screen: SCR-016
  - Key Components: ConflictCard ×N, Button ×2, ProgressBar

- **SCR-018 Medical Coding Panel** (P1 — Core) — [wireframe-SCR-018-coding-panel.html](./Hi-Fi/wireframe-SCR-018-coding-panel.html)
  - Description: ICD-10 and CPT code suggestions from RAG pipeline with evidence expansion
  - Parent Screen: SCR-016
  - Key Components: Table (codes), AIBadge, Badge (Needs Review), SourceEvidenceDrawer, Button ×3

### Level 4: Admin Panel (role=Admin)

- **SCR-019 Admin User Management List** (P1 — Core) — [wireframe-SCR-019-admin-users.html](./Hi-Fi/wireframe-SCR-019-admin-users.html)
  - Description: Paginated user list with role/status filtering and create action
  - User Entry Point: Yes (post-login, role=Admin)
  - Key Components: Table (users), Badge (role + status), Button (Create), SearchInput

- **SCR-020 Admin User Detail / Edit** (P1 — Core) — [wireframe-SCR-020-user-detail.html](./Hi-Fi/wireframe-SCR-020-user-detail.html)
  - Description: User detail view and edit form for role/status management; deactivation action
  - Parent Screen: SCR-019
  - Key Components: TextField ×3, Select ×2, Button ×3 (Save / Deactivate / Cancel)

- **SCR-021 Audit Log Viewer** (P2 — Important) — [wireframe-SCR-021-audit-log.html](./Hi-Fi/wireframe-SCR-021-audit-log.html)
  - Description: Read-only paginated audit log with date/actor/action-type filters
  - Parent Screen: SCR-019 (sidebar link)
  - Key Components: Table (log), Badge (action type), Filter panel (date + actor + type)

### Screen Priority Legend

- **P0**: Critical path — core booking and authentication flows (MVP)
- **P1**: Core functionality — clinical intelligence and staff tools
- **P2**: Operational — audit and compliance views

### Modal / Overlay Inventory

| Modal Name | Type | Trigger | Parent Screen(s) | Wireframe Reference | Priority |
|---|---|---|---|---|---|
| Session Expiry Warning | Modal | 13 min inactivity | All authenticated | Inline in shared CSS | P0 |
| Booking Confirmation Review | Modal | Before final booking submit | SCR-009 | SCR-009 (modal variant) | P0 |
| Slot Conflict Warning | Modal | Slot taken mid-booking | SCR-008, SCR-009 | SCR-008 (modal variant) | P0 |
| Walk-In Override Confirm | Dialog | No available slot | SCR-012 | SCR-012 (dialog variant) | P0 |
| Conflict Acknowledge Confirm | Dialog | Staff acknowledges | SCR-017 | SCR-017 | P1 |
| Patient Arrival Override Confirm | Dialog | Mark arrived (not today) | SCR-014 | SCR-014 (dialog variant) | P0 |
| Code Finalise Confirm | Dialog | Before finalising codes | SCR-018 | SCR-018 (dialog variant) | P1 |
| Deactivate User Confirm | Dialog | Admin deactivates | SCR-020 | SCR-020 (dialog variant) | P1 |
| PDF Preview Overlay | Drawer | View uploaded PDF | SCR-015 | SCR-015 (drawer variant) | P1 |
| Source Evidence Expand | Inline Drawer | Expand AI code evidence | SCR-018 | SCR-018 (drawer variant) | P1 |

**Modal Behaviour Notes**:
- All modals trap focus (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`)
- Desktop: centred overlay modal; Mobile: bottom sheet / full-screen
- ESC key and overlay click dismiss all informational modals
- Confirmation dialogs require explicit button click to dismiss

---

## 6. Navigation Architecture

```text
PropelIQ Health  (root /)
│
├── Public (unauthenticated)
│   ├── /login         → SCR-001  [wireframe-SCR-001-login.html]
│   ├── /register      → SCR-002  [wireframe-SCR-002-registration.html]
│   └── /verify-email  → SCR-003  [wireframe-SCR-003-email-verification.html]
│
├── Patient Portal  /patient/*  (role=Patient)
│   ├── /patient/dashboard           → SCR-004  [wireframe-SCR-004-patient-dashboard.html]
│   ├── /patient/intake              → SCR-005  [wireframe-SCR-005-intake-method.html]
│   ├── /patient/intake/ai-chat      → SCR-006  [wireframe-SCR-006-ai-intake-chat.html]
│   ├── /patient/intake/manual       → SCR-007  [wireframe-SCR-007-manual-intake.html]
│   ├── /patient/intake/review       → SCR-007b [wireframe-SCR-007b-intake-review.html]
│   ├── /patient/booking/calendar    → SCR-008  [wireframe-SCR-008-booking-calendar.html]
│   ├── /patient/booking/insurance   → SCR-009  [wireframe-SCR-009-booking-insurance.html]
│   ├── /patient/booking/confirmed   → SCR-010  [wireframe-SCR-010-confirmation.html]
│   └── /patient/documents           → SCR-015  [wireframe-SCR-015-documents-upload.html]
│
├── Staff Portal  /staff/*  (role=Staff)
│   ├── /staff/dashboard             → SCR-011  [wireframe-SCR-011-staff-dashboard.html]
│   ├── /staff/walkin                → SCR-012  [wireframe-SCR-012-walkin-booking.html]
│   ├── /staff/patients/search       → SCR-013  [wireframe-SCR-013-patient-search.html]
│   ├── /staff/queue                 → SCR-014  [wireframe-SCR-014-queue-view.html]
│   ├── /staff/patients/:id/documents→ SCR-015  [wireframe-SCR-015-documents-upload.html]
│   ├── /staff/patients/:id/360      → SCR-016  [wireframe-SCR-016-patient-360.html]
│   ├── /staff/patients/:id/conflicts→ SCR-017  [wireframe-SCR-017-conflict-ack.html]
│   └── /staff/patients/:id/coding   → SCR-018  [wireframe-SCR-018-coding-panel.html]
│
└── Admin Panel  /admin/*  (role=Admin)
    ├── /admin/users                 → SCR-019  [wireframe-SCR-019-admin-users.html]
    ├── /admin/users/:id             → SCR-020  [wireframe-SCR-020-user-detail.html]
    └── /admin/audit-log             → SCR-021  [wireframe-SCR-021-audit-log.html]
```

### Navigation Patterns

| Pattern | Type | Desktop Behaviour | Mobile Behaviour |
|---|---|---|---|
| Primary Nav | Left sidebar (240px fixed) | Always visible, collapsible | Hidden; hamburger → slide-over drawer |
| Secondary Nav | Breadcrumb below top bar | Full path | Last 2 levels only |
| Utility Nav | Top bar (role badge, avatar, logout) | Persistent | Persistent (compact) |
| In-Page Tabs | Horizontal tab strip | Full label tabs | Scrollable tab strip |

---

## 7. Interaction Patterns

### Pattern 1: Form Inline Validation (UXR-601)

- **Trigger**: Field loses focus (`onBlur`)
- **Flow**: Field blur → validate → show error if invalid (red border + error message beneath)
- **Screens Involved**: SCR-002, SCR-007, SCR-009, SCR-012, SCR-013, SCR-020
- **Feedback**: Red 2px border, red error icon, descriptive message below field ≤200ms
- **Components**: TextField (Error state), FieldError

### Pattern 2: AI Trust-First Content Display (UXR-403)

- **Trigger**: AI extraction or code suggestion loaded
- **Flow**: Data received → render with AIBadge + muted `color.semantic.ai.bg` background
- **Screens Involved**: SCR-016, SCR-017, SCR-018
- **Feedback**: AIBadge visible; muted background; "View source" expand control for evidence
- **Components**: AIBadge, SourceEvidenceExpander, ai-suggested-field class

### Pattern 3: Booking Slot Selection (UXR-101)

- **Trigger**: Patient clicks a slot cell on the calendar
- **Flow**: Slot click → highlight with teal border → confirm button activates
- **Screens Involved**: SCR-008, SCR-009
- **Feedback**: Selected slot gets `slot-selected` class (teal fill); legend visible at all times
- **Components**: CalendarGrid, SlotCell variants, Badge (legend)

### Pattern 4: Session Expiry Warning (UXR-503)

- **Trigger**: 13 minutes of inactivity (JavaScript timer reset on interaction)
- **Flow**: Timer fires → modal appears with "Extend Session" + "Logout" options
- **Screens Involved**: All authenticated screens (SCR-003 through SCR-021)
- **Feedback**: Modal overlay; 2-minute countdown visible in modal body
- **Components**: Modal, Button-Primary (Extend), Button-Ghost (Logout)

### Pattern 5: Non-Critical Failure Toast (UXR-602)

- **Trigger**: Calendar sync failure, SMS delivery failure
- **Flow**: API failure → toast appears bottom-right → auto-dismisses in 5 seconds
- **Screens Involved**: SCR-008, SCR-010, SCR-014
- **Feedback**: Toast (warning variant) with × dismiss; primary flow continues unblocked
- **Components**: Toast (warning)

---

## 8. Error Handling

### Error Scenario 1: Invalid Login Credentials

- **Trigger**: POST /auth/login returns 401
- **Error Screen/State**: SCR-001 — Error state (generic banner, no field-level hint)
- **User Action**: Retry with corrected credentials or use Forgot Password
- **Recovery Flow**: SCR-001 (error) → SCR-001 (default, retry) | or → Forgot Password flow

### Error Scenario 2: Form Validation Failure

- **Trigger**: Required field empty or format invalid on form submit or blur
- **Error Screen/State**: Inline — red border + error message per field (UXR-601)
- **User Action**: Correct highlighted field(s) and resubmit
- **Recovery Flow**: Inline correction on same screen; no navigation

### Error Scenario 3: Slot Taken During Checkout

- **Trigger**: POST /appointments/book returns 409 (slot taken since SCR-008 load)
- **Error Screen/State**: SCR-009 — Slot Conflict Modal overlay
- **User Action**: Close modal and return to SCR-008 to choose another slot
- **Recovery Flow**: Modal → SCR-008 (reset selection)

### Error Scenario 4: Critical API Failure (queue / patient view load)

- **Trigger**: GET /queue or GET /patients/:id/360 returns 5XX
- **Error Screen/State**: Full-page error state (UXR-603): descriptive message + Retry CTA
- **User Action**: Click "Retry" to re-trigger the failed request
- **Recovery Flow**: Retry button → re-fetch → (success) resume | (fail) error persists

### Error Scenario 5: AI Extraction Failed

- **Trigger**: Background extraction job returns failed status
- **Error Screen/State**: SCR-015 — document card shows "Failed" badge + "Enter manually" CTA
- **User Action**: Click CTA to navigate to SCR-007 with manual entry enabled
- **Recovery Flow**: SCR-015 (failed) → SCR-007 (manual form, pre-loaded with document metadata)

---

## 9. Responsive Strategy

| Breakpoint | Width | Layout Changes | Navigation Changes | Component Adaptations |
|---|---|---|---|---|
| Mobile | 320–767px | Single column, stacked forms | Hamburger menu, no sidebar | Cards stack; buttons full-width; tables scroll horizontally |
| Tablet | 768–1023px | 2-column grid (where applicable) | Sidebar hidden; hamburger | Metric grid 2×2; accordion stays |
| Desktop | 1024–1439px | Multi-column, full sidebar | Sidebar visible (240px) | Full table columns; calendar full grid |
| Large Desktop | 1440px+ | Max-width 1200px centred | Sidebar + max-width container | Same as desktop with more whitespace |

### Responsive Wireframe Variants

- All wireframes are desktop-first (1440px) — responsive via media queries in `wireframe-shared.css`
- Mobile-specific behaviours documented in component-inventory.md per component
- No separate mobile wireframe files; single responsive HTML per screen

---

## 10. Accessibility

### WCAG Compliance

- **Target Level**: WCAG 2.2 AA
- **Color Contrast**: Text ≥ 4.5:1; UI components ≥ 3:1 (verified against design tokens)
- **Keyboard Navigation**: Full tab order on all interactive elements; logical sequence
- **Screen Reader Support**: ARIA labels on all icon buttons, status badges, progress indicators
- **Focus Ring**: `var(--shadow-focus)` — 3px teal ring on all interactive elements

### Accessibility by Screen Category

| Screen Category | Key A11y Features |
|---|---|
| Auth (SCR-001–003) | Autocomplete hints; generic error messages (no field-level hints for security); focus on first field on load |
| Intake (SCR-005–007b) | ARIA live region for AI typing indicator; auto-save announced to screen reader; aria-describedby on all fields |
| Booking (SCR-008–010) | Slot grid uses role="grid"; available/unavailable communicated via aria-label (not colour alone) per UXR-202 |
| Staff Queue (SCR-014) | Risk badges include text label (not colour only) per UXR-102; drag-reorder has keyboard alternative |
| AI Views (SCR-016–018) | AI badges use aria-label="AI Suggested"; evidence drawer uses role="dialog" |
| Admin (SCR-019–021) | Read-only audit log — no edit controls; role and status badges have aria-label |

### Focus Order

- Login / Register forms: Email → Password → Submit (→ secondary link)
- Booking Calendar: Month nav → slot cells (arrow keys within grid) → Book button
- AI Chat: Message input → Send (loop); new AI message announced via aria-live="polite"
- Tables: Column headers → row cells (standard tabindex); action buttons within row

---

## 11. Content Strategy

### Content Hierarchy

- **H1**: Page title (one per screen, e.g., "Book an appointment", "Same-day queue")
- **H2**: Major section headers within page (e.g., accordion titles, card group labels)
- **H3–H4**: Sub-section and card headings
- **Body Text**: Form labels, descriptions, table cells — sentence case, clinical vocabulary
- **Placeholder Content**: All wireframes use realistic healthcare placeholder content (not lorem ipsum)

### Content Types by Screen

| Screen | Content Types |
|---|---|
| SCR-001 Login | Form (2 fields), links |
| SCR-004 Patient Dashboard | Data cards (appointment, intake, insurance status) |
| SCR-006 AI Chat | Conversational text, AI-generated clinical questions |
| SCR-008 Booking Calendar | Date/time grid, availability labels |
| SCR-014 Queue | Tabular data, badges, timestamps |
| SCR-016 360° View | Structured clinical data (vitals, meds, allergies), AI badges |
| SCR-018 Coding Panel | ICD-10/CPT codes, descriptions, confidence scores |
| SCR-021 Audit Log | Timestamped event log, actor identifiers, action types |
