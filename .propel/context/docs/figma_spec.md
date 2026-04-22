---
title: Figma Design Specification — Unified Patient Access & Clinical Intelligence Platform
version: 1.1.0
date: 2026-04-22
status: Draft
source: .propel/context/docs/spec.md
workflow: create-figma-spec
---

# Figma Design Specification - PropelIQ Health

## 1. Figma Specification

**Platform**: Web Responsive (React SPA)
**Breakpoints**: Mobile 320–767px | Tablet 768–1023px | Desktop 1024px+
**Design Tool**: Figma
**Design System File**: `.propel/context/docs/designsystem.md`
**Color Mode**: Light (primary) — Dark mode deferred to Phase 2

---

## 2. Source References

### Primary Source

| Document | Path | Purpose |
|---|---|---|
| Requirements Specification | `.propel/context/docs/spec.md` | Personas, use cases (UC-001–UC-010), FR-XXX |
| Architecture Design | `.propel/context/docs/design.md` | NFR, technology stack, AI constraints |
| UML Models | `.propel/context/docs/models.md` | Sequence diagrams for flow reference |

### Optional Sources

| Document | Path | Purpose |
|---|---|---|
| Wireframes | `.propel/context/wireframes/Hi-Fi/` | High-fidelity HTML wireframes generated for SCR-001 through SCR-021 |
| Design Assets | `.propel/context/Design/` | Optional visual assets (not required for MVP handoff) |

### Related Documents

| Document | Path | Purpose |
|---|---|---|
| Design System | `.propel/context/docs/designsystem.md` | Tokens, branding, component specifications |

---

## 3. UX Requirements

### UXR Requirements Table

| UXR-ID | Category | Requirement | Acceptance Criteria | Screens Affected |
|---|---|---|---|---|
| UXR-001 | Usability | System MUST allow any user to reach any primary feature within 3 clicks from their role-specific dashboard | Click-path audit for each persona's top 3 tasks passes | All SCR |
| UXR-002 | Usability | System MUST display contextual breadcrumb navigation on all screens deeper than the dashboard | Breadcrumb present and accurately reflects path on all depth ≥ 2 screens | SCR-004–SCR-021 |
| UXR-003 | Usability | System MUST provide a persistent, role-sensitive top navigation bar exposing primary sections for each role (Patient, Staff, Admin) | Navigation renders correct links per role; inaccessible sections are hidden | All SCR |
| UXR-004 | Usability | System MUST auto-save patient intake form data every 60 seconds to prevent data loss on session timeout | Auto-save indicator updates every 60 s; data survives browser refresh | SCR-006, SCR-007 |
| UXR-101 | Usability | System MUST expose the booking calendar with a clear visual distinction between Available (green), Unavailable (grey), and Preferred-waitlisted (amber) slots | Color-blind-safe slot legend renders; slots use colour + icon (not colour alone) | SCR-008 |
| UXR-102 | Usability | System MUST surface the no-show risk indicator (Low / Medium / High) as a colour-coded badge on each appointment row in the Staff queue with a text label | Badges render in all three states; label always visible (not tooltip-only) | SCR-011, SCR-014 |
| UXR-103 | Usability | System MUST display the AI extraction status of each uploaded clinical document (Processing / Extracted / Failed) with a progress indicator while processing | Progress indicator renders during extraction; final status icon updates on completion | SCR-015 |
| UXR-104 | Usability | System MUST present AI-suggested ICD-10 and CPT codes with the supporting source-text excerpt visually highlighted and collapsed by default, expandable on demand | Expand/collapse interaction works; source text is visually linked to the code suggestion | SCR-018 |
| UXR-201 | Accessibility | System MUST comply with WCAG 2.2 AA standards across all screens, including colour contrast ≥ 4.5:1 for body text and ≥ 3:1 for UI components | WAVE / axe automated audit reports 0 critical violations; manual keyboard navigation verified | All SCR |
| UXR-202 | Accessibility | System MUST provide keyboard-navigable focus order on all interactive elements, with a visible focus ring on every focused element | Tab order is logical; focus ring visible at all zoom levels | All SCR |
| UXR-203 | Accessibility | System MUST provide descriptive ARIA labels on all icon-only buttons, status badges, and progress indicators | Screen reader announces full label for icon buttons and badge states | All SCR |
| UXR-204 | Accessibility | System MUST associate every form field with a visible label element and provide descriptive error messages linked via aria-describedby | axe form-field association audit passes; error IDs match describedby values | SCR-002, SCR-006, SCR-007, SCR-009, SCR-013, SCR-020 |
| UXR-301 | Responsiveness | System MUST adapt all screens to three breakpoints: Mobile (320–767px), Tablet (768–1023px), Desktop (1024px+) using a 4-column / 8-column / 12-column grid respectively | Responsive audit at each breakpoint passes; no horizontal scroll on any screen |All SCR |
| UXR-302 | Responsiveness | System MUST replace the sidebar navigation with a collapsible hamburger menu on screens narrower than 768px | Hamburger menu renders at <768px; sidebar renders at ≥768px | All SCR |
| UXR-303 | Responsiveness | System MUST stack multi-column form layouts to a single column on mobile (< 768px) | All two-column form groups collapse to single column at 767px breakpoint | SCR-002, SCR-006, SCR-009, SCR-013 |
| UXR-401 | Visual Design | System MUST use only design tokens defined in designsystem.md; no hard-coded colour, spacing, or typography values are permitted | Zero hard-coded values detected in design file token inspection | All SCR |
| UXR-402 | Visual Design | System MUST display a consistent page header pattern (logo, role label, user avatar, logout) across all authenticated screens | Header component present and consistent across all SCR-003 onwards | SCR-003–SCR-021 |
| UXR-403 | Visual Design | System MUST use a Trust-First visual hierarchy for AI-generated content: AI output MUST be visually distinguished from human-verified data using an "AI Suggested" badge and a muted background colour | AI-suggested items render with badge and muted-bg; verified items render with solid border | SCR-016, SCR-017, SCR-018 |
| UXR-501 | Interaction | System MUST provide visual feedback for all user-initiated actions within 200ms (button press state, spinner for operations > 500ms) | Button active state renders ≤200ms; spinner appears within 500ms of async actions | All SCR |
| UXR-502 | Interaction | System MUST display a skeleton loading state (not a blank screen) when fetching content on page load or navigation | Skeleton renders on all data-fetching screens; no blank flash > 200ms | SCR-008, SCR-014, SCR-016, SCR-018, SCR-019 |
| UXR-503 | Interaction | System MUST present a session-expiry warning modal 2 minutes before the 15-minute inactivity timeout, offering the user an option to extend the session | Warning modal triggers at 13 min inactivity; extension button resets timer | All authenticated SCR |
| UXR-504 | Interaction | System MUST animate the AI conversational intake chat with a typing-indicator (3 dots) while the LLM is generating a response | Typing indicator renders between user message submission and LLM response | SCR-006 |
| UXR-601 | Error Handling | System MUST display inline validation errors immediately on field blur (not only on form submit), with a red border, error icon, and descriptive message beneath the field | Inline error renders on blur; message is actionable and specific | SCR-001, SCR-002, SCR-006, SCR-007, SCR-009, SCR-013, SCR-020 |
| UXR-602 | Error Handling | System MUST display a non-blocking toast notification for non-critical failures (calendar sync failure, SMS delivery failure) that auto-dismisses after 5 seconds | Toast renders in bottom-right; auto-dismisses in 5 s; does not block primary flow | SCR-008, SCR-010, SCR-014 |
| UXR-603 | Error Handling | System MUST display a full-page error state with a retry CTA when a critical API call fails (patient view load, queue load, login failure) | Error state renders with descriptive message and retry button; retry re-triggers the request | SCR-008, SCR-014, SCR-016, SCR-018 |
| UXR-604 | Error Handling | System MUST display an empty-state illustration and a contextual CTA when a list or data view has no records (no appointments, no documents, no users) | Empty state renders with illustration and CTA; CTA links to appropriate action | SCR-008, SCR-014, SCR-015, SCR-019, SCR-021 |

---

## 4. Personas Summary

| Persona | Role | Primary Goals | Key Screens |
|---|---|---|---|
| Patient | Registered patient using the web portal | Book appointments, complete intake, upload clinical PDFs | SCR-001, SCR-002, SCR-004–SCR-010, SCR-015 |
| Staff | Front-desk or call-centre staff member | Manage walk-ins, queue, mark arrivals, view 360° patient data, verify codes | SCR-011–SCR-014, SCR-016–SCR-018 |
| Admin | Platform administrator | Manage user accounts (Staff + Patient), view audit logs | SCR-001, SCR-019–SCR-021 |

---

## 5. Information Architecture

### Site Map

```text
PropelIQ Health
+-- Public
|   +-- SCR-001: Login
|   +-- SCR-002: Register
|   +-- SCR-003: Email Verification
+-- Patient Portal (authenticated, role=Patient)
|   +-- SCR-004: Patient Dashboard
|   +-- Intake
|   |   +-- SCR-005: Intake Method Selection
|   |   +-- SCR-006: AI-Assisted Intake Chat
|   |   +-- SCR-007: Manual Intake Form
|   |   +-- SCR-007b: Intake Review & Summary
|   +-- Appointments
|   |   +-- SCR-008: Booking Calendar
|   |   +-- SCR-009: Booking Confirmation & Insurance Pre-Check
|   |   +-- SCR-010: Appointment Confirmation Detail
|   +-- Clinical Documents
|       +-- SCR-015: Clinical Documents Upload Page
+-- Staff Dashboard (authenticated, role=Staff)
|   +-- SCR-011: Staff Home Dashboard
|   +-- SCR-012: Walk-In Booking Panel
|   +-- SCR-013: Patient Search / Create Patient
|   +-- SCR-014: Same-Day Queue View
|   +-- SCR-016: 360-Degree Patient View
|   +-- SCR-017: Conflict Acknowledgement Panel
|   +-- SCR-018: Medical Coding Panel
+-- Admin Panel (authenticated, role=Admin)
    +-- SCR-019: User Management List
    +-- SCR-020: User Detail / Edit
    +-- SCR-021: Audit Log Viewer
```

### Navigation Patterns

| Pattern | Type | Desktop Behavior | Mobile Behavior |
|---|---|---|---|
| Primary Nav | Left sidebar (collapsible) | Fixed 240px sidebar with section labels | Hamburger menu → slide-over drawer |
| Secondary Nav | Breadcrumb + page title | Full breadcrumb below top bar | Shortened breadcrumb (last 2 levels) |
| Utility Nav | Top bar — role badge, avatar, logout | Persistent top bar | Persistent top bar (compact) |
| In-Page Tabs | Horizontal tabs | Tab strip below page title | Scrollable tab strip |

---

## 6. Screen Inventory

### Screen List

| Screen ID | Screen Name | Derived From | Personas Covered | Priority | States Required |
|---|---|---|---|---|---|
| SCR-001 | Login | UC-001 | Patient, Staff, Admin | P0 | Default, Loading, Error, Validation |
| SCR-002 | Registration | UC-001 | Patient | P0 | Default, Loading, Error, Validation |
| SCR-003 | Email Verification | UC-001 | Patient | P0 | Default, Loading, Error |
| SCR-004 | Patient Dashboard | UC-002, UC-003 | Patient | P0 | Default, Loading, Empty |
| SCR-005 | Intake Method Selection | UC-002 | Patient | P0 | Default |
| SCR-006 | AI-Assisted Intake Chat | UC-002 | Patient | P0 | Default, Loading, Error |
| SCR-007 | Manual Intake Form | UC-002 | Patient | P0 | Default, Loading, Error, Validation |
| SCR-007b | Intake Review & Summary | UC-002 | Patient | P0 | Default, Loading |
| SCR-008 | Booking Calendar | UC-003 | Patient | P0 | Default, Loading, Empty, Error |
| SCR-009 | Booking & Insurance Form | UC-003 | Patient | P0 | Default, Loading, Error, Validation |
| SCR-010 | Appointment Confirmation | UC-003 | Patient | P0 | Default |
| SCR-011 | Staff Home Dashboard | UC-004, UC-005, UC-009 | Staff | P0 | Default, Loading, Empty |
| SCR-012 | Walk-In Booking Panel | UC-004 | Staff | P0 | Default, Loading, Error, Validation |
| SCR-013 | Patient Search / Create | UC-004 | Staff | P0 | Default, Loading, Empty, Error, Validation |
| SCR-014 | Same-Day Queue View | UC-005, UC-009 | Staff | P0 | Default, Loading, Empty, Error |
| SCR-015 | Clinical Documents Upload | UC-007 | Patient, Staff | P1 | Default, Loading, Empty, Error |
| SCR-016 | 360-Degree Patient View | UC-007 | Staff | P1 | Default, Loading, Empty, Error |
| SCR-017 | Conflict Acknowledgement Panel | UC-007 | Staff | P1 | Default, Loading |
| SCR-018 | Medical Coding Panel | UC-008 | Staff | P1 | Default, Loading, Empty, Error |
| SCR-019 | Admin User Management List | UC-010 | Admin | P1 | Default, Loading, Empty, Error |
| SCR-020 | Admin User Detail / Edit | UC-010 | Admin | P1 | Default, Loading, Error, Validation |
| SCR-021 | Audit Log Viewer | UC-010 | Admin | P2 | Default, Loading, Empty |

### Priority Legend

- **P0**: Critical path — core booking and authentication flows (MVP)
- **P1**: Core functionality — clinical intelligence and staff tools
- **P2**: Operational — audit and compliance views

### Screen-to-Persona Coverage Matrix

| Screen | Patient | Staff | Admin | Notes |
|---|---|---|---|---|
| SCR-001 | Primary | Primary | Primary | Shared login page |
| SCR-002 | Primary | — | — | Patient-only registration |
| SCR-003 | Primary | — | — | Email verification |
| SCR-004 | Primary | — | — | Patient landing page |
| SCR-005–007b | Primary | — | — | Intake flow |
| SCR-008–010 | Primary | — | — | Booking flow |
| SCR-011 | — | Primary | — | Staff entry point |
| SCR-012–013 | — | Primary | — | Walk-in flow |
| SCR-014 | — | Primary | — | Daily operations |
| SCR-015 | Primary | Secondary | — | Upload from patient; Staff can also upload |
| SCR-016–018 | — | Primary | — | Clinical intelligence |
| SCR-019–021 | — | — | Primary | Admin-only panel |

### Modal / Overlay Inventory

| Name | Type | Trigger | Parent Screen(s) | Priority |
|---|---|---|---|---|
| Session Expiry Warning | Modal | 13 min inactivity | All authenticated | P0 |
| Booking Confirmation Review | Modal | Before final booking submit | SCR-009 | P0 |
| Slot Conflict Warning | Modal | Slot taken mid-booking | SCR-008, SCR-009 | P0 |
| Walk-In Override Confirm | Dialog | No available slot override | SCR-012 | P0 |
| Conflict Acknowledge Confirm | Dialog | Staff acknowledges PHI conflict | SCR-017 | P1 |
| Patient Arrival Override Confirm | Dialog | Marking arrived (not today) | SCR-014 | P0 |
| Code Finalise Confirm | Dialog | Before finalising codes | SCR-018 | P1 |
| Deactivate User Confirm | Dialog | Admin deactivates account | SCR-020 | P1 |
| PDF Preview Overlay | Drawer | View uploaded clinical PDF | SCR-015 | P1 |
| Toast — Non-critical Failure | Toast | Calendar/SMS failure | SCR-008, SCR-010, SCR-014 | P0 |
| Source Evidence Expand | Inline Drawer | Expand AI code evidence | SCR-018 | P1 |

---

## 7. Content & Tone

### Voice & Tone

- **Overall Tone**: Professional, clear, and reassuring — clinical context demands accuracy over casualness.
- **Error Messages**: Non-blaming, specific, and actionable. Example: *"We couldn't verify your insurance ID. Please check the details and try again — this won't stop your booking."*
- **Empty States**: Guiding and encouraging. Example: *"No documents uploaded yet. Upload a clinical PDF to build your 360° Patient View."*
- **Success Messages**: Brief and confirmatory. Example: *"Appointment confirmed. A PDF confirmation has been sent to your email."*
- **AI Output Labels**: Always labelled *"AI Suggested"* — never presented as clinically confirmed without Staff verification badge.

### Content Guidelines

- **Headings**: Sentence case throughout (matches healthcare conventions — Title Case reserved for product name).
- **CTAs**: Action-oriented verbs. Use *"Book appointment"*, *"Upload document"*, *"Verify codes"*, *"Mark arrived"* — never *"Submit"* alone.
- **Labels**: Concise and clinical. Use *"Chief complaint"*, *"Medication history"*, *"Insurance provider"* — no abbreviations without expansion on first use.
- **Placeholder Text**: Helpful examples only. E.g., `e.g. BlueCross Shield` for insurance name, `e.g. chest pain, shortness of breath` for chief complaint.

---

## 8. Data & Edge Cases

### Data Scenarios

| Scenario | Description | Handling |
|---|---|---|
| No appointments | Patient has no upcoming bookings | Empty state + "Book your first appointment" CTA |
| No documents | Patient has no clinical PDFs uploaded | Empty state + "Upload your first document" CTA |
| Empty queue | Staff same-day queue has no appointments | Empty state + "Add a walk-in" CTA |
| No code suggestions yet | Coding job not yet complete | Loading skeleton + "Generating suggestions…" label |
| AI extraction failed | Document extraction returned error | Error badge + "Enter data manually" fallback CTA |
| New patient (no history) | No-show risk has no prior data | Medium risk badge with tooltip "New patient — default risk" |
| First-time Admin | No users beyond self | Empty user list + "Invite staff" CTA |
| Large queue (50+ entries) | Same-day queue overflows viewport | Virtualised list; sticky date header; search/filter |
| Long clinical note | Extracted field text > 500 chars | Truncated with "Show more" expand toggle |

### Edge Cases

| Case | Screen(s) Affected | Solution |
|---|---|---|
| Preferred slot taken before swap | SCR-010, toast | Toast: "Your preferred slot was taken before we could swap. Choose a new preferred slot." |
| Insurance name/ID too long | SCR-009 | Truncate at 60 chars; tooltip with full value |
| Session timeout mid-intake | SCR-006, SCR-007 | Auto-save + expiry modal; resume from last saved state |
| PDF upload > 10 MB | SCR-015 | Client-side size validation before upload; error below file input |
| Multiple conflicts on 360° view | SCR-017 | Paginated conflict cards; "X of Y acknowledged" progress indicator |
| Confidence score < 0.6 (coding) | SCR-018 | "Needs Review" pill badge instead of code suggestion; manual entry field |
| User deactivated mid-session | All authenticated | Force logout on next API call; redirect to login with message |

---

## 9. Branding & Visual Direction

*Full design tokens in `designsystem.md`.*

### Branding Assets

- **Logo**: PropelIQ Health wordmark + icon — SVG, placed in top-left of sidebar/header.
- **Icon Style**: Outlined (24px grid) with 2px stroke — Heroicons or Phosphor Icons (open source, MIT).
- **Illustration Style**: Flat, minimal SVG illustrations for empty states and onboarding. Medical/healthcare theme.
- **Photography Style**: Not applicable for Phase 1 (data-centric application).
- **Brand Personality**: Trustworthy, clinical precision, modern healthcare — navy primary + teal accent + white background.

---

## 10. Component Specifications

### Required Components per Screen

| Screen ID | Components Required | Notes |
|---|---|---|
| SCR-001 | TextField ×2, Button ×2, Link ×1 | Email + password; Login + Google; Forgot password |
| SCR-002 | TextField ×4, Button ×2, Checkbox ×1 | Name, email, password, confirm-password; Register + Cancel; Terms |
| SCR-003 | Alert (info), Button ×2, Link ×1 | Verification pending; Resend + Return to login |
| SCR-004 | Card ×3, Button ×1, Badge ×1 | Upcoming appt, intake status, insurance status; Book now |
| SCR-005 | Card ×2, Button ×2 | AI option card + Manual option card |
| SCR-006 | Chat bubble ×N, TextField ×1, Button ×1, TypingIndicator | Conversation list; message input; send |
| SCR-007 | TextField ×8, Select ×2, Textarea ×2, Button ×2 | All intake fields; Save + Cancel |
| SCR-007b | DataList ×5, Button ×2 | Review fields; Confirm + Edit |
| SCR-008 | CalendarGrid, Badge ×3, Button ×1, Modal (slot detail) | Slot grid; Available/Unavailable/Waitlisted badges |
| SCR-009 | TextField ×2, Select ×1, Button ×2, Alert ×1 | Insurance name + ID; Confirm + Back; pre-check result |
| SCR-010 | Card (confirmation), Button ×2, PDF preview link | Appointment detail; Add to calendar + Back to dashboard |
| SCR-011 | Metric card ×4, Table (queue preview), Button ×2 | Today stats; Queue top-5; Add walk-in + Refresh |
| SCR-012 | Card (patient), Select ×2, Textarea ×2, SlotGrid, Button ×3 | Patient summary; provider + urgency; chief complaint + notes; slot mini-grid; confirm/override/cancel |
| SCR-013 | SearchInput ×1, Card (result) ×N, InlineCreateForm, Button ×3 | Debounced patient search; select existing; create new; guest fallback |
| SCR-014 | Table (queue), Badge (risk), Button ×2, Dropdown | Appointment rows; risk badge; Arrived + Reorder; status filter |
| SCR-015 | FileUpload, Card (document) ×N, Badge (status), Button ×2 | Drag-drop upload; document cards; Processing/Extracted/Failed |
| SCR-016 | Accordion ×5, Badge (AI/Verified), Button ×1, Alert (conflict) | Vitals/Meds/Allergies/Diagnoses/Surgery; verify button |
| SCR-017 | Card (conflict) ×N, Button ×2, ProgressBar | Conflict cards; Acknowledge + Skip; X of Y progress |
| SCR-018 | Table (codes), Badge (AI/Needs Review), Drawer (evidence), Button ×3 | ICD-10 + CPT rows; evidence drawer; Accept/Modify/Reject |
| SCR-019 | Table (users), Badge (role/status), Button ×2, SearchInput | User rows; role + status badges; Create + Filter |
| SCR-020 | TextField ×3, Select ×2, Button ×3 | Name, email, role, status; Save + Deactivate + Cancel |
| SCR-021 | Table (audit log), Badge (action type), Filter panel | Log rows; action badge; date/actor filters |

### Component Summary

| Category | Components | Variants |
|---|---|---|
| Actions | Button | Primary, Secondary, Ghost, Danger × S/M/L × Default/Hover/Focus/Active/Disabled/Loading |
| Inputs | TextField, Textarea, Select, Checkbox, Radio, Toggle, FileUpload | Default, Focus, Error, Disabled |
| Navigation | TopBar, Sidebar, Breadcrumb, Tabs, HamburgerMenu | Desktop/Mobile variants |
| Content | Card, Table, TableRow, Accordion, DataList, CalendarGrid, ChatBubble | Variants per usage |
| Feedback | Modal, Dialog (confirm), Drawer, Toast, Alert, Badge, ProgressBar, Skeleton, TypingIndicator | Types + States |
| Specialist | AIBadge (Trust-First), RiskBadge (Low/Med/High), SlotCell, SourceEvidenceExpander | Platform-specific |

### Component Constraints

- Use only tokens from `designsystem.md` — no hard-coded values.
- All interactive components support: Default, Hover, Focus, Active, Disabled, Loading states.
- Naming convention: `C/<Category>/<ComponentName>` (e.g., `C/Feedback/AIBadge`).
- Touch targets ≥ 44 × 44px on all interactive elements (mobile).

---

## 11. Prototype Flows

### FL-001 — Patient Registration and Login

**Flow ID**: FL-001
**Derived From**: UC-001
**Personas Covered**: Patient, Staff, Admin
**Description**: New user registers, verifies email, and logs in to their role-specific dashboard.

#### Flow Sequence

```text
1. Entry: SCR-001 Login / Default
   - Trigger: User navigates to application root

   +-- Existing user -> credentials entered
   |       v
   |   SCR-001 / Loading (authenticating)
   |       v
   |   Role-specific dashboard (SCR-004 / SCR-011 / SCR-019) / Default
   |
   +-- New user -> clicks "Create account"
           v
       SCR-002 Registration / Default
           v
       SCR-002 / Loading (submitting registration)
           v
       SCR-003 Email Verification / Default
           v
       (User clicks email link)
           v
       SCR-003 / Loading (verifying token)
           v
       SCR-001 Login / Default (redirect with success toast)
           v
       SCR-004 Patient Dashboard / Default
```

#### Required Interactions

- Password complexity meter (real-time, on SCR-002 password field)
- Generic error on invalid login (no field-level hint)
- "Resend verification email" link on SCR-003

---

### FL-002 — Patient Intake (AI-Assisted or Manual)

**Flow ID**: FL-002
**Derived From**: UC-002
**Personas Covered**: Patient
**Description**: Patient completes pre-appointment intake choosing AI chat or manual form, with mid-flow switching.

#### Flow Sequence

```text
1. Entry: SCR-004 Patient Dashboard / Default
   - Trigger: Patient clicks "Complete intake"

   v
2. SCR-005 Intake Method Selection / Default
   - Patient selects method

   +-- AI-Assisted
   |       v
   |   SCR-006 AI Chat / Default
   |       |  (multi-turn, typing indicator per response)
   |       |
   |       +-- Switch to manual -> SCR-007 Manual Form / Default (pre-populated)
   |       v
   |   SCR-007b Intake Review / Default
   |
   +-- Manual Form
           v
       SCR-007 Manual Form / Default
           |
           +-- Switch to AI -> SCR-006 AI Chat / Default (pre-populated)
           v
       SCR-007b Intake Review / Default

   v
3. SCR-007b / Default — review all fields
   v
4. SCR-004 Patient Dashboard / Default (intake complete badge)
```

#### Required Interactions

- Auto-save indicator on SCR-006 and SCR-007 (60-second interval)
- Switch method button persistent in header of SCR-006 and SCR-007
- Session expiry warning modal at 13 min inactivity

---

### FL-003 — Appointment Booking with Preferred Slot Swap

**Flow ID**: FL-003
**Derived From**: UC-003
**Personas Covered**: Patient
**Description**: Patient books an available slot, optionally registers a preferred slot, and receives PDF confirmation.

#### Flow Sequence

```text
1. Entry: SCR-004 Patient Dashboard / Default
   - Trigger: Patient clicks "Book appointment"

   v
2. SCR-008 Booking Calendar / Default
   - Patient selects available slot

   +-- No slots available -> SCR-008 / Empty state ("Join waitlist" CTA)
   v
3. SCR-009 Booking & Insurance Form / Default
   - Patient enters insurance details; optionally selects preferred unavailable slot
   - Insurance pre-check result shown inline (non-blocking)

   +-- Slot taken during checkout -> Slot Conflict Modal -> SCR-008
   v
4. Booking Confirmation Modal / Default (before final submit)
   v
5. SCR-010 Appointment Confirmation / Default
   - PDF sent by email; calendar sync triggered (non-blocking)
   - Toast if calendar sync fails

   v
6. SCR-004 Patient Dashboard / Default (appointment card appears)
```

#### Required Interactions

- Slot colour legend on SCR-008 (UXR-101)
- Inline insurance pre-check result with icon (matched ✓ / unmatched ✗ / not found ?)
- Preferred slot selection (click unavailable slot with "Set as preferred" option)

---

### FL-004 — Staff Walk-In Booking and Queue Management

**Flow ID**: FL-004
**Derived From**: UC-004, UC-005
**Personas Covered**: Staff
**Description**: Staff registers a walk-in patient (existing or new), adds to queue, and marks arrival.

#### Flow Sequence

```text
1. Entry: SCR-011 Staff Dashboard / Default
   - Trigger: Staff clicks "Add walk-in"

   v
2. SCR-013 Patient Search / Default
   - Staff searches by name or DOB

   +-- Existing patient found -> select -> SCR-012 Walk-In Booking Panel / Default
   +-- No patient found -> SCR-013 / Default (create patient form)
           v
       New patient created -> SCR-012 Walk-In Booking Panel / Default
   +-- Proceed without account -> SCR-012 (guest profile flag)

   v
3. SCR-012 Walk-In Booking Panel / Default
   - Staff selects slot

   +-- No slot available -> Walk-In Override Confirm Dialog -> forced insert
   v
4. SCR-014 Same-Day Queue View / Default (walk-in appears at bottom)

   (Later — patient arrives)
   v
5. SCR-014 / Default
   - Staff clicks "Mark arrived" on appointment row

   +-- Not scheduled today -> Patient Arrival Override Confirm Dialog
   v
6. SCR-014 / Default (status badge updated to "Arrived")
```

#### Required Interactions

- Real-time search on SCR-013 (debounced, 300ms)
- Risk badge visible per row on SCR-014 (UXR-102)
- Drag-to-reorder queue entries on SCR-014 (desktop only)

---

### FL-005 — Clinical Document Upload and 360° Patient View

**Flow ID**: FL-005
**Derived From**: UC-007
**Personas Covered**: Staff (primary), Patient (upload)
**Description**: Staff reviews 360° Patient View built from AI-extracted clinical documents; acknowledges conflicts.

#### Flow Sequence

```text
1. Entry: SCR-016 360° Patient View / Default (from Staff Dashboard patient card)
   - Trigger: Staff clicks patient name on queue

   +-- No documents uploaded -> SCR-016 / Empty ("Upload a document to begin")
   v
2. SCR-015 Clinical Documents Upload / Default (if upload needed)
   - Drag-and-drop PDF upload
   - Document card shows Processing → Extracted / Failed status (UXR-103)

   v
3. SCR-016 360° Patient View / Default (data populated)
   - Accordion sections: Vitals, Medications, Allergies, Diagnoses, Surgery
   - AI Suggested badges on unverified fields (UXR-403)

   +-- Conflicts detected -> SCR-017 Conflict Acknowledgement Panel / Default
   |       v
   |   Staff reviews and acknowledges each conflict
   |       v
   |   SCR-016 / Default (is_verified = true, verified badge)
   |
   +-- No conflicts -> auto-verified banner on SCR-016
```

#### Required Interactions

- Document extraction progress indicator per uploaded file
- Conflict card with "Acknowledged" + "Dismiss" actions on SCR-017
- Progress indicator "X of Y acknowledged" on SCR-017

---

### FL-006 — Medical Code Mapping (Trust-First)

**Flow ID**: FL-006
**Derived From**: UC-008
**Personas Covered**: Staff
**Description**: Staff requests ICD-10 and CPT code suggestions, reviews with evidence, and finalises.

#### Flow Sequence

```text
1. Entry: SCR-018 Medical Coding Panel / Default
   - Trigger: Staff opens coding panel from patient record
   - Precondition: 360° View must be verified

   +-- View not verified -> Alert: "Verify patient view first" + link to SCR-016
   v
2. SCR-018 / Loading (skeleton while AI generates suggestions)
   v
3. SCR-018 / Default (suggestions loaded)
   - ICD-10 rows + CPT rows, each with: code, description, AI confidence, "AI Suggested" badge
   - "Needs Review" badge for confidence < 0.6
   - Expand evidence drawer per suggestion (UXR-104)

   v
4. Staff reviews each code:
   Accept -> row turns green, badge becomes "Accepted"
   Modify -> inline edit field opens; staff enters final code
   Reject -> row struck through; staff enters replacement

   v
5. Code Finalise Confirm Dialog
   v
6. SCR-018 / Default (codes finalised; Agreement Rate displayed)
```

#### Required Interactions

- Evidence drawer slides in from right on "View source" click
- Inline edit field for modified code (UXR-104)
- Agreement Rate metric displayed post-finalisation

---

### FL-007 — Admin User Management

**Flow ID**: FL-007
**Derived From**: UC-010
**Personas Covered**: Admin
**Description**: Admin creates, updates, or deactivates Staff and Patient accounts.

#### Flow Sequence

```text
1. Entry: SCR-019 User Management List / Default
   - Trigger: Admin navigates to /admin/users

   v
2. Admin searches by name/email/role (filter + search bar)

   +-- Create new user -> SCR-020 User Detail / Default (create mode)
   |       v
   |   Save -> SCR-019 / Default (new user in list, success toast)
   |
   +-- Select existing user -> SCR-020 User Detail / Default (edit mode)
           v
       Edit role/status -> Save -> SCR-019 (updated, success toast)
           v
       Or: Deactivate User Confirm Dialog -> SCR-019 (status=Inactive badge)

   Sidebar link:
   v
3. SCR-021 Audit Log Viewer / Default
   - Paginated, filterable (date, actor, action type)
```

#### Required Interactions

- Role badge colour on SCR-019 (Patient=blue, Staff=green, Admin=purple)
- Status badge (Active=teal, Inactive=grey) on SCR-019
- Read-only audit log (no edit/delete actions on SCR-021)

---

## 12. Export Requirements

### JPG Export Settings

| Setting | Value |
|---|---|
| Format | JPG |
| Quality | High (85%) |
| Scale — Mobile | 2× |
| Scale — Web | 2× |
| Color Profile | sRGB |

### Export Naming Convention

`PropelIQHealth__Web__<ScreenID>_<ScreenName>__<State>__v1.jpg`

### Export Manifest (Sample)

| Screen | State | Filename |
|---|---|---|
| SCR-001 Login | Default | PropelIQHealth__Web__SCR-001_Login__Default__v1.jpg |
| SCR-001 Login | Loading | PropelIQHealth__Web__SCR-001_Login__Loading__v1.jpg |
| SCR-001 Login | Error | PropelIQHealth__Web__SCR-001_Login__Error__v1.jpg |
| SCR-001 Login | Validation | PropelIQHealth__Web__SCR-001_Login__Validation__v1.jpg |
| SCR-008 BookingCalendar | Default | PropelIQHealth__Web__SCR-008_BookingCalendar__Default__v1.jpg |
| SCR-014 QueueView | Default | PropelIQHealth__Web__SCR-014_QueueView__Default__v1.jpg |
| SCR-016 PatientView360 | Default | PropelIQHealth__Web__SCR-016_PatientView360__Default__v1.jpg |

### Total Export Count

- **Screens**: 22 (21 primary + 1 review screen)
- **States per screen**: ~4 average (some screens have fewer states)
- **Estimated Total JPGs**: ~88

---

## 13. Figma File Structure

### Page Organization

```text
PropelIQ Health — Figma File
+-- 00_Cover
|   +-- Project info, version, date, personas
+-- 01_Foundations
|   +-- Color tokens (Light mode)
|   +-- Typography scale
|   +-- Spacing scale (4px base)
|   +-- Border radius tokens
|   +-- Elevation / shadow levels
|   +-- Grid definitions (4/8/12 col)
+-- 02_Components
|   +-- C/Actions/Button (variants + states)
|   +-- C/Actions/Link
|   +-- C/Inputs/TextField, Textarea, Select, Checkbox, Toggle, FileUpload
|   +-- C/Navigation/TopBar, Sidebar, Breadcrumb, Tabs, HamburgerMenu
|   +-- C/Content/Card, Table, Accordion, CalendarGrid, ChatBubble, DataList
|   +-- C/Feedback/Modal, Dialog, Drawer, Toast, Alert, Badge, Skeleton, TypingIndicator, ProgressBar
|   +-- C/Specialist/AIBadge, RiskBadge, SlotCell, SourceEvidenceExpander
+-- 03_Patterns
|   +-- Auth form pattern
|   +-- Intake form + chat pattern
|   +-- Calendar booking pattern
|   +-- AI Trust-First content pattern
|   +-- Error / Empty / Loading patterns
+-- 04_Screens
|   +-- SCR-001 Login (Default, Loading, Error, Validation)
|   +-- SCR-002 Registration (Default, Loading, Error, Validation)
|   +-- SCR-003 Email Verification (Default, Loading, Error)
|   +-- SCR-004 Patient Dashboard (Default, Loading, Empty)
|   +-- SCR-005 Intake Method Selection (Default)
|   +-- SCR-006 AI Intake Chat (Default, Loading, Error)
|   +-- SCR-007 Manual Intake Form (Default, Loading, Error, Validation)
|   +-- SCR-007b Intake Review (Default, Loading)
|   +-- SCR-008 Booking Calendar (Default, Loading, Empty, Error)
|   +-- SCR-009 Booking & Insurance Form (Default, Loading, Error, Validation)
|   +-- SCR-010 Appointment Confirmation (Default)
|   +-- SCR-011 Staff Dashboard (Default, Loading, Empty)
|   +-- SCR-012 Walk-In Booking Panel (Default, Loading, Error, Validation)
|   +-- SCR-013 Patient Search / Create (Default, Loading, Empty, Error, Validation)
|   +-- SCR-014 Same-Day Queue View (Default, Loading, Empty, Error)
|   +-- SCR-015 Clinical Documents Upload (Default, Loading, Empty, Error)
|   +-- SCR-016 360° Patient View (Default, Loading, Empty, Error)
|   +-- SCR-017 Conflict Acknowledgement Panel (Default, Loading)
|   +-- SCR-018 Medical Coding Panel (Default, Loading, Empty, Error)
|   +-- SCR-019 Admin User List (Default, Loading, Empty, Error)
|   +-- SCR-020 Admin User Detail / Edit (Default, Loading, Error, Validation)
|   +-- SCR-021 Audit Log Viewer (Default, Loading, Empty)
+-- 05_Prototype
|   +-- FL-001: Registration & Login
|   +-- FL-002: Patient Intake
|   +-- FL-003: Appointment Booking
|   +-- FL-004: Walk-In & Queue Management
|   +-- FL-005: Clinical Documents & 360° View
|   +-- FL-006: Medical Code Mapping
|   +-- FL-007: Admin User Management
+-- 06_Handoff
    +-- Token usage rules
    +-- Component guidelines
    +-- Responsive breakpoint specs
    +-- AI Trust-First pattern guide
    +-- Accessibility checklist (WCAG 2.2 AA)
    +-- Edge case documentation
```

---

## 14. Quality Checklist

### Pre-Export Validation

- [ ] All screens have required states (Default/Loading/Empty/Error/Validation as applicable)
- [ ] All components use design tokens — no hard-coded values
- [ ] Colour contrast ≥ 4.5:1 for body text, ≥ 3:1 for UI components (WCAG AA)
- [ ] Focus states defined for all interactive elements
- [ ] Touch targets ≥ 44 × 44px on mobile
- [ ] AI Suggested badge and Trust-First pattern applied to all AI output screens (SCR-016, SCR-017, SCR-018)
- [ ] Session expiry modal wired in all authenticated flows
- [ ] Prototype flows FL-001 through FL-007 wired and functional
- [ ] Naming conventions followed (`SCR-XXX`, `FL-XXX`, `C/Category/Name`)
- [ ] Export manifest complete

### Post-Generation

- [ ] `designsystem.md` updated with Figma token references
- [ ] Export manifest generated
- [ ] Handoff documentation complete in 06_Handoff page
