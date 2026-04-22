---
title: Component Inventory — PropelIQ Health
version: 1.0.0
date: 2026-04-17
fidelity: High
framework: React 18 + TypeScript + TailwindCSS
design-system: .propel/context/docs/designsystem.md
---

# Component Inventory - PropelIQ Health

## Component Specification

**Fidelity Level**: High
**Screen Type**: Web — Responsive
**Viewport**: 1440px (desktop primary)
**Framework**: React 18 + TypeScript + TailwindCSS
**Design System Reference**: `.propel/context/docs/designsystem.md`

---

## Component Summary

| Component Name | Type | Screens Used | Priority | Implementation Status |
|---|---|---|---|---|
| TopBar | Layout | All authenticated (SCR-003–SCR-021) | High | Pending |
| Sidebar | Navigation | SCR-004–SCR-021 | High | Pending |
| Breadcrumb | Navigation | SCR-004–SCR-021 (depth ≥ 2) | High | Pending |
| Button | Interactive | All SCR | High | Pending |
| TextField | Interactive | SCR-002, SCR-006–007, SCR-009, SCR-012, SCR-013, SCR-020 | High | Pending |
| Textarea | Interactive | SCR-007 | Medium | Pending |
| Select | Interactive | SCR-007, SCR-009, SCR-013, SCR-020 | Medium | Pending |
| Checkbox | Interactive | SCR-002 | Medium | Pending |
| FileUpload | Interactive | SCR-015 | Medium | Pending |
| Card | Content | SCR-004–SCR-005, SCR-010–SCR-011 | High | Pending |
| MetricCard | Content | SCR-011 | High | Pending |
| Table | Content | SCR-014, SCR-018, SCR-019, SCR-021 | High | Pending |
| Accordion | Content | SCR-016 | Medium | Pending |
| CalendarGrid | Content | SCR-008 | High | Pending |
| ChatBubble | Content | SCR-006 | Medium | Pending |
| DataList | Content | SCR-007b | Medium | Pending |
| Badge | Feedback | All SCR (contextual) | High | Pending |
| AIBadge | Feedback | SCR-016, SCR-017, SCR-018 | High | Pending |
| RiskBadge | Feedback | SCR-014 | High | Pending |
| Modal | Feedback | SCR-008, SCR-009, SCR-012, SCR-014, SCR-017, SCR-018, SCR-020 | High | Pending |
| Dialog (Confirm) | Feedback | SCR-012, SCR-014, SCR-017, SCR-018, SCR-020 | High | Pending |
| Drawer | Feedback | SCR-015, SCR-018 | Medium | Pending |
| Toast | Feedback | SCR-008, SCR-010, SCR-014 | High | Pending |
| Alert | Feedback | SCR-003, SCR-009, SCR-016 | Medium | Pending |
| Skeleton | Feedback | SCR-008, SCR-014, SCR-016, SCR-018, SCR-019 | High | Pending |
| TypingIndicator | Feedback | SCR-006 | Medium | Pending |
| ProgressBar | Feedback | SCR-017 | Medium | Pending |
| SourceEvidenceExpander | Specialist | SCR-018 | High | Pending |
| SlotCell | Specialist | SCR-008 | High | Pending |
| EmptyState | Feedback | SCR-008, SCR-014, SCR-015, SCR-019, SCR-021 | High | Pending |

---

## Detailed Component Specifications

### Layout Components

#### TopBar

- **Type**: Layout
- **Used In Screens**: All authenticated screens (SCR-003 to SCR-021)
- **Wireframe References**: All Hi-Fi wireframe files (shared layout)
- **Description**: Persistent header bar with logo, role badge, user avatar, and logout. Sticky at top (z-index 100).
- **Variants**: Default (all roles) — role badge colour varies: Patient=info-blue, Staff=success-green, Admin=navy
- **Interactive States**: Logout button — Default, Hover (neutral-100 bg)
- **Responsive Behaviour**:
  - Desktop (1440px): Full logo + wordmark + role badge + avatar + logout text
  - Tablet (768px): Logo + icon only + avatar + logout icon
  - Mobile (375px): Logo icon only + avatar; logout in avatar dropdown
- **Implementation Notes**: Height 64px (`--topbar-height`); `box-shadow: var(--shadow-1)` on scroll; `role="banner"` ARIA
- **UXR**: UXR-402, UXR-503

#### Sidebar

- **Type**: Layout / Navigation
- **Used In Screens**: SCR-004–SCR-021
- **Description**: Role-specific left navigation sidebar, 240px wide, navy background. Collapses on tablet/mobile to hamburger drawer.
- **Variants**: Patient sidebar, Staff sidebar, Admin sidebar (different nav items per role)
- **Interactive States**: Nav item — Default (neutral-300 text), Hover (rgba white 7%), Active (teal-500 bg + white text)
- **Responsive Behaviour**:
  - Desktop (≥1024px): Fixed 240px sidebar, always visible
  - Tablet (768–1023px): Hidden; hamburger button in TopBar opens slide-over drawer
  - Mobile (<768px): Same as tablet; drawer overlays full height
- **Implementation Notes**: `aria-label="Primary navigation"`, `role="navigation"`; active item uses `aria-current="page"`; `--color-navy-700` background
- **UXR**: UXR-003, UXR-302

---

### Navigation Components

#### Breadcrumb

- **Type**: Navigation
- **Used In Screens**: SCR-004–SCR-021 (all depth ≥ 2 screens)
- **Description**: Shows current location path with clickable parent links. Collapsed on mobile (last 2 levels).
- **Variants**: Standard (full path), Compact (mobile, last 2 levels)
- **Interactive States**: Link — Default, Hover (teal-500), Current (neutral-700 non-link)
- **Responsive Behaviour**:
  - Desktop/Tablet: Full path; `›` separator character
  - Mobile: Truncated to parent + current; ellipsis for deeper paths
- **Implementation Notes**: `nav aria-label="Breadcrumb"`, `ol` list structure per WCAG; current item has `aria-current="page"`
- **UXR**: UXR-002

#### Tabs

- **Type**: Navigation
- **Used In Screens**: SCR-016 (360° view sections), SCR-019 (user filter tabs)
- **Description**: Horizontal tab strip for in-page section navigation.
- **Variants**: Default, Scrollable (mobile)
- **Interactive States**: Default (neutral-500), Hover (teal-500), Active (teal-500 text + teal bottom border)
- **Responsive Behaviour**:
  - Desktop: Full tab labels visible
  - Mobile: Horizontally scrollable tab strip; `-webkit-overflow-scrolling: touch`
- **Implementation Notes**: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`

---

### Content Components

#### Card

- **Type**: Content
- **Used In Screens**: SCR-004, SCR-005, SCR-010, SCR-011
- **Description**: White panel with border, radius-lg, and shadow-1. Interactive variant has hover shadow-2.
- **Variants**: Default, Selectable (hover + selected border), Confirmation (success border)
- **Interactive States**: Default (shadow-1), Hover on selectable (shadow-2), Selected (teal-500 border 2px)
- **Responsive Behaviour**:
  - Desktop: Fixed width per grid column
  - Mobile: Full width, stacked
- **Implementation Notes**: `border-radius: var(--radius-lg)`; `padding: var(--space-6)`

#### MetricCard

- **Type**: Content
- **Used In Screens**: SCR-011 (Staff Dashboard — 3 metrics)
- **Description**: Compact card showing a numeric KPI with label and optional trend indicator.
- **Variants**: Default, With Trend (green/red arrow)
- **Interactive States**: None (static)
- **Responsive Behaviour**:
  - Desktop: 3-column grid
  - Tablet: 2-column grid
  - Mobile: Single column
- **Implementation Notes**: `.metric-grid` CSS class; value uses `--text-h1` font-size

#### CalendarGrid

- **Type**: Content / Interactive
- **Used In Screens**: SCR-008 (Booking Calendar)
- **Description**: Week or month grid of appointment time slots. Each cell is coloured by availability state.
- **Variants**: SlotCell — Available (teal), Unavailable (grey), Preferred (amber), Selected (teal filled)
- **Interactive States**: Available slot — Default, Hover (opacity 0.8), Selected (teal bg); Unavailable — static (no hover)
- **Responsive Behaviour**:
  - Desktop: Full week grid (7 days × time slots)
  - Mobile: Single-day view with swipe navigation
- **Implementation Notes**: Cells use `role="gridcell"` + `aria-label="[time] - [Available/Unavailable]"` (UXR-202); colour NEVER sole indicator — icon also present (UXR-101); cell min-size 44px touch target
- **UXR**: UXR-101, UXR-202

#### ChatBubble

- **Type**: Content
- **Used In Screens**: SCR-006 (AI-Assisted Intake Chat)
- **Description**: Conversational chat message display. User messages right-aligned (teal-100 bg); AI messages left-aligned (neutral-100 bg).
- **Variants**: User, AI, TypingIndicator (3 animated dots)
- **Interactive States**: None (static display); new messages announced via `aria-live="polite"`
- **Responsive Behaviour**:
  - All sizes: Max-width 70% of container; no layout change
- **Implementation Notes**: TypingIndicator uses CSS `bounce` animation on 3 dots; `aria-label="AI is typing"` while indicator shows (UXR-504)
- **UXR**: UXR-504

#### Accordion

- **Type**: Content / Interactive
- **Used In Screens**: SCR-016 (360° Patient View — 5 clinical sections)
- **Description**: Collapsible sections for Vitals, Medications, Allergies, Diagnoses, Surgical History. Chevron rotates 90° on open.
- **Variants**: Default (collapsed), Open, With AIBadge in header (section has unverified AI data)
- **Interactive States**: Header — Default, Hover (neutral-50 bg), Open (chevron rotated, body visible)
- **Responsive Behaviour**: Consistent across all breakpoints; header height stays 48px
- **Implementation Notes**: `role="button"`, `aria-expanded`, `aria-controls` per WCAG accordion pattern

#### Table

- **Type**: Content
- **Used In Screens**: SCR-014, SCR-018, SCR-019, SCR-021
- **Description**: Data table with sticky header, hover row highlight, and inline action controls.
- **Variants**: Standard, With Inline Actions, With Status Badges, Compact (audit log)
- **Interactive States**: Row hover (neutral-50 bg); sortable header (sort icon)
- **Responsive Behaviour**:
  - Desktop: Full columns visible
  - Mobile: Horizontal scroll; min-width per column defined
- **Implementation Notes**: `role="table"`, `scope="col"` on `<th>`; `aria-sort` for sortable columns; pagination with `aria-label`

#### DataList

- **Type**: Content
- **Used In Screens**: SCR-007b (Intake Review)
- **Description**: Read-only label-value pair list for reviewing intake form fields.
- **Variants**: Standard, With Edit Link
- **Interactive States**: None (static)
- **Responsive Behaviour**: Single column; label above value on mobile
- **Implementation Notes**: `<dl>` / `<dt>` / `<dd>` semantic HTML

---

### Interactive Components

#### Button

- **Type**: Interactive
- **Used In Screens**: All SCR
- **Description**: Primary call-to-action and secondary/tertiary action buttons.
- **Variants**: Primary, Secondary, Ghost, Danger × S/M/L
- **Interactive States**: Default, Hover (10% darken/lighten), Focus (shadow-focus ring), Active (5% darken), Disabled (opacity 0.4), Loading (spinner replaces label)
- **Responsive Behaviour**:
  - Desktop/Tablet: Sized per variant
  - Mobile: Full-width on primary CTAs; minimum 44px height
- **Implementation Notes**: `min-height: 44px` always (touch target UXR-201); `aria-busy="true"` + `aria-label="Loading"` in loading state; `aria-disabled="true"` in disabled state
- **UXR**: UXR-501

#### TextField

- **Type**: Interactive
- **Used In Screens**: SCR-002, SCR-006 (message input), SCR-007, SCR-009, SCR-012, SCR-013, SCR-020
- **Description**: Labelled text input with helper text, inline validation, and error state.
- **Variants**: Text, Email, Password, Search, Number
- **Interactive States**: Default (neutral-200 border), Focus (teal-500 border + shadow-focus), Error (error border + error-bg), Disabled (neutral-100 bg), Read-only
- **Responsive Behaviour**: Full width on all breakpoints; stacked label above input always
- **Implementation Notes**: `<label>` always associated via `for`/`id`; error message linked via `aria-describedby` (UXR-204); required shown as `*` + `aria-required="true"`; inline validation on `onBlur` (UXR-601)
- **UXR**: UXR-204, UXR-601

#### Select

- **Type**: Interactive
- **Used In Screens**: SCR-007 (insurance type, medication type), SCR-009, SCR-013 (role), SCR-020
- **Description**: Dropdown select component with label, placeholder, and error state.
- **Variants**: Default, Multi-select (not used in v1)
- **Interactive States**: Default, Focus (teal border), Error, Disabled
- **Responsive Behaviour**: Full width; `min-height: 44px`
- **Implementation Notes**: Native `<select>` for accessibility; custom styling via CSS; `aria-describedby` for errors

#### FileUpload

- **Type**: Interactive
- **Used In Screens**: SCR-015 (Clinical Documents Upload)
- **Description**: Drag-and-drop file zone with file card list showing extraction status per uploaded PDF.
- **Variants**: Default, Drag-over (teal border), With Files (card list below zone)
- **Interactive States**: Default, Drag-over, Error (size/type violation)
- **Responsive Behaviour**: Full width; reduced padding on mobile
- **Implementation Notes**: `accept=".pdf"`, `max size = 10MB` client-side validated; `aria-label="Upload clinical PDF document"`; document cards show name, size, status badge
- **UXR**: UXR-103

---

### Feedback Components

#### Badge

- **Type**: Feedback
- **Used In Screens**: All SCR (contextual)
- **Description**: Pill-shaped label for status, role, and type indication.
- **Variants**: Success, Warning, Error, Info, AI, Neutral, Navy
- **Interactive States**: Static (no hover for standard badge); clickable badge has hover + focus ring
- **Responsive Behaviour**: Consistent across breakpoints; text never truncated
- **Implementation Notes**: `role="status"` for dynamic badges; colour NEVER sole indicator — text always included (UXR-202, UXR-102)
- **UXR**: UXR-102, UXR-203

#### AIBadge

- **Type**: Feedback / Specialist
- **Used In Screens**: SCR-016, SCR-017, SCR-018
- **Description**: Special Trust-First badge labelling AI-suggested (unverified) content. Purple border + bg with sparkle icon.
- **Variants**: AI Suggested (default), Verified (success badge + check icon)
- **Interactive States**: Static
- **Implementation Notes**: `aria-label="AI Suggested — requires Staff verification"`; field wrapped in `ai-suggested-field` div for visual muted background (UXR-403)
- **UXR**: UXR-403

#### RiskBadge

- **Type**: Feedback / Specialist
- **Used In Screens**: SCR-014 (Same-Day Queue), SCR-011 (preview)
- **Description**: No-show risk level badge — Low/Medium/High. Uses colour + icon + text (colour-blind safe).
- **Variants**: Low (success), Medium (warning), High (error)
- **Interactive States**: Static; optional tooltip on hover with "Risk factors: …"
- **Implementation Notes**: Always includes text label per UXR-102; icon: ↓ Low, — Medium, ↑ High; `aria-label="No-show risk: [level]"`
- **UXR**: UXR-102

#### Modal

- **Type**: Feedback / Overlay
- **Used In Screens**: SCR-008, SCR-009, SCR-012, SCR-014, SCR-017, SCR-018, SCR-020
- **Description**: Centred overlay dialog with semi-transparent backdrop.
- **Variants**: Default (480px), Large (640px), Confirmation/Alert (with warning icon)
- **Interactive States**: Open/Closed
- **Responsive Behaviour**:
  - Desktop: Centred, fixed width
  - Mobile: Bottom sheet (full width, rounded top corners)
- **Implementation Notes**: Focus trap (`focus-trap` library); `role="dialog"`, `aria-modal="true"`, `aria-labelledby` header ID; ESC closes informational modals; `prefers-reduced-motion` — disable entrance animation

#### Toast

- **Type**: Feedback
- **Used In Screens**: SCR-008, SCR-010, SCR-014 (non-critical failures); all screens (success confirmations)
- **Description**: Non-blocking notification that auto-dismisses after 5 seconds.
- **Variants**: Success, Warning, Error, Info
- **Interactive States**: Visible → Auto-dismiss (5s) | Manual dismiss (×)
- **Responsive Behaviour**: Bottom-right corner desktop; bottom-full-width mobile
- **Implementation Notes**: `role="alert"`, `aria-live="assertive"` for error; `aria-live="polite"` for success; stacking via flex-col container
- **UXR**: UXR-602

#### Skeleton

- **Type**: Feedback
- **Used In Screens**: SCR-008, SCR-014, SCR-016, SCR-018, SCR-019
- **Description**: Animated shimmer placeholder shown during data-fetching operations.
- **Variants**: Line, Title, Rect, Card skeleton
- **Interactive States**: Animating → replaced by real content
- **Implementation Notes**: `aria-hidden="true"` + `aria-label="Loading…"` on container; CSS shimmer animation; renders if load time > 300ms (UXR-502)
- **UXR**: UXR-502

#### TypingIndicator

- **Type**: Feedback / Specialist
- **Used In Screens**: SCR-006 (AI Chat)
- **Description**: Three animated bouncing dots indicating the AI is generating a response.
- **Variants**: Active (animating), Absent (hidden between AI turns)
- **Interactive States**: N/A
- **Implementation Notes**: `aria-label="AI is typing"`, `role="status"`; CSS `bounce` keyframes with staggered delays (UXR-504)
- **UXR**: UXR-504

#### SourceEvidenceExpander

- **Type**: Specialist
- **Used In Screens**: SCR-018 (Medical Coding Panel)
- **Description**: Right-side drawer that shows the source clinical text excerpt that supports an AI code suggestion, with the relevant passage highlighted.
- **Variants**: Collapsed (default), Expanded (drawer visible)
- **Interactive States**: Trigger (ghost button "View source" inline in table row) → Drawer opens
- **Responsive Behaviour**:
  - Desktop: Side drawer (360px) overlaps content
  - Mobile: Bottom sheet, full width
- **Implementation Notes**: Collapsed by default (UXR-104); `role="dialog"`, focus moves to drawer on open; source excerpt text uses `mark` element with `color-ai-bg` background
- **UXR**: UXR-104

#### EmptyState

- **Type**: Feedback
- **Used In Screens**: SCR-008 (no slots), SCR-014 (empty queue), SCR-015 (no documents), SCR-019 (no users), SCR-021 (no logs)
- **Description**: Centred illustration + heading + description + contextual CTA when a view has no data.
- **Variants**: Per-screen CTA (varies)
- **Interactive States**: CTA button inherits Button states
- **Implementation Notes**: Illustration SVG with `role="img"` + `aria-label`; CTA links to appropriate action (UXR-604)
- **UXR**: UXR-604

---

## Component Relationships

```text
AppShell
+-- TopBar
|   +-- Logo (link to role dashboard)
|   +-- RoleBadge
|   +-- Avatar (+ dropdown: Profile, Logout)
|   +-- LogoutButton
+-- AppMain
    +-- Sidebar
    |   +-- SidebarSectionLabel
    |   +-- SidebarNavList
    |       +-- SidebarNavItem (with active state)
    +-- PageContent
        +-- Breadcrumb
        +-- PageHeader (title + subtitle + CTA)
        +-- [Screen-specific content]
            +-- Card / MetricCard / Table / CalendarGrid / ChatBubble / ...
            +-- [Overlays triggered from screen]
                +-- Modal / Dialog / Drawer / Toast
```

---

## Component States Matrix

| Component | Default | Hover | Active | Focus | Disabled | Error | Loading | Empty |
|---|---|---|---|---|---|---|---|---|
| Button | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| TextField | ✓ | — | — | ✓ | ✓ | ✓ | — | ✓ |
| Select | ✓ | — | — | ✓ | ✓ | ✓ | — | ✓ |
| Card | ✓ | ✓ (selectable) | — | ✓ (selectable) | — | — | ✓ | ✓ |
| Table | ✓ | ✓ (row) | — | ✓ (cell) | — | — | ✓ | ✓ |
| CalendarGrid | ✓ | ✓ (slot) | — | ✓ (slot) | — | — | — | ✓ |
| Modal | Open | — | — | ✓ (trap) | — | — | — | — |
| Toast | ✓ | — | — | — | — | ✓ | — | — |
| Badge | ✓ | — | — | — | — | — | — | — |
| AIBadge | ✓ | — | — | — | — | — | — | — |
| Skeleton | — | — | — | — | — | — | ✓ | — |
| FileUpload | ✓ | ✓ | ✓ (drag) | ✓ | — | ✓ | ✓ | ✓ |

---

## Reusability Analysis

| Component | Reuse Count | Screens | Recommendation |
|---|---|---|---|
| TopBar | 19 | All authenticated | Shared layout component |
| Sidebar | 19 | All authenticated | Shared layout, variant per role |
| Button | 22 | All screens | Shared base; variant system |
| TextField | 8 | SCR-002, 007, 009, 012, 013, 020 + inline | Shared base; size/variant props |
| Badge | 15 | All SCR (contextual) | Shared; variant prop |
| Card | 8 | SCR-004, 005, 010, 011, 015 | Shared base; slot composition |
| Modal | 7 | SCR-008, 009, 012, 014, 017, 018, 020 | Shared; slot composition |
| Table | 4 | SCR-014, 018, 019, 021 | Shared; column definition props |
| EmptyState | 5 | SCR-008, 014, 015, 019, 021 | Shared; CTA + message as props |
| Toast | 3+ | SCR-008, 010, 014 + general | Global; toast manager singleton |

---

## Responsive Breakpoints Summary

| Breakpoint | Width | Components Affected | Key Adaptations |
|---|---|---|---|
| Mobile | < 768px | Sidebar, Metric grid, Buttons, Tables, Modal | No sidebar; hamburger; stacked buttons; horizontal-scroll tables; bottom sheets |
| Tablet | 768–1023px | Sidebar, Metric grid, Grid layouts | Sidebar hidden; 2-col metric grid; 2-col form grids |
| Desktop | 1024–1439px | All layout | Full sidebar; multi-column layouts |
| Large | ≥ 1440px | Page content | Max-width 1200px centred; more whitespace |

---

## Implementation Priority Matrix

### High Priority (Core Components — Needed for P0 MVP)
- [ ] Button — used in all screens, critical for all flows
- [ ] TextField — all forms depend on it
- [ ] TopBar + Sidebar — layout shell for all authenticated screens
- [ ] Card — dashboard and confirmation screens
- [ ] Badge + RiskBadge — queue and status views
- [ ] Table — queue (SCR-014) and user management (SCR-019)
- [ ] CalendarGrid + SlotCell — core booking flow (SCR-008)
- [ ] Modal + Dialog — booking confirmation, slot conflict, walk-in override
- [ ] Toast — non-critical failure notifications (UXR-602)
- [ ] Skeleton — data-fetching states (UXR-502)

### Medium Priority (Core Functionality — P1 features)
- [ ] Accordion — 360° Patient View (SCR-016)
- [ ] AIBadge + SourceEvidenceExpander — Trust-First pattern (SCR-016–018)
- [ ] FileUpload — clinical document upload (SCR-015)
- [ ] ChatBubble + TypingIndicator — AI intake (SCR-006)
- [ ] ProgressBar — conflict acknowledgement (SCR-017)
- [ ] Drawer — PDF preview and source evidence (SCR-015, SCR-018)

### Low Priority (Enhancement)
- [ ] DataList — intake review (SCR-007b); can start as simple divs
- [ ] EmptyState illustrations — functionality works without SVG illustrations

---

## Framework-Specific Notes

**Detected Framework**: React 18 + TypeScript
**CSS Framework**: TailwindCSS (via class utilities) + CSS custom properties (design tokens)
**Icon Library**: Heroicons v2 (MIT) — Outlined (24px, interactive) and Solid (20px, status)

### React Patterns Applied

- Compound components for Modal (Modal.Header / Modal.Body / Modal.Footer)
- Render props for Table (column definition objects)
- Context API for Toast manager (global singleton)
- React ARIA for CalendarGrid (keyboard navigation per WAI-ARIA Grid pattern)
- Suspense + skeleton fallback for async data screens

### Component Library Mappings

| Wireframe Component | React Implementation | Customisation Required |
|---|---|---|
| Button | Custom `<Button>` | Full custom — variant + size + loading props |
| TextField | Custom `<TextField>` | label + error + aria binding |
| Select | Native `<select>` + styled | CSS custom properties |
| Modal | Custom + `focus-trap-react` | slot composition |
| CalendarGrid | Custom (React ARIA Grid) | availability state props |
| Toast | `react-hot-toast` or custom | Design token integration |
| Skeleton | Custom CSS animation | Layout-specific shapes |

---

## Accessibility Considerations

| Component | ARIA Attributes | Keyboard Navigation | Screen Reader Notes |
|---|---|---|---|
| Button | `aria-busy`, `aria-disabled`, `aria-label` | Enter / Space to activate | Loading state: "Loading" label replaces visible text |
| TextField | `aria-required`, `aria-describedby` (error), `aria-invalid` | Tab to focus, Escape to clear | Error announced on invalid (aria-live via describedby) |
| CalendarGrid | `role="grid"`, `role="gridcell"`, `aria-label` per cell | Arrow keys within grid | Slot state ("Available 10:30 AM") announced |
| Modal | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` | Tab trapped inside; Escape closes | Title announced on open |
| Accordion | `role="button"`, `aria-expanded`, `aria-controls` | Enter / Space toggles | Expanded state announced |
| AIBadge | `aria-label="AI Suggested — verify required"` | N/A (non-interactive) | Full label read by screen reader |
| RiskBadge | `aria-label="No-show risk: [level]"` | N/A | Level read with text label |
| Toast | `role="alert"` (error) / `role="status"` (info) | Esc to dismiss | Full message announced immediately |

---

## Design System Integration

**Design System Reference**: `.propel/context/docs/designsystem.md`

### Components Matching Design System

- [x] Button — matches brand colour tokens and radius-md
- [x] TextField — matches neutral border scale + focus shadow-focus
- [x] Badge — matches all semantic colour variants defined in designsystem.md
- [x] Card — matches white + neutral-200 border + shadow-1 + radius-lg
- [x] Modal — matches radius-xl + shadow-3
- [x] CalendarGrid — matches slot colour tokens (slot.available, slot.unavailable, slot.preferred)
- [x] AIBadge — matches `color.semantic.ai` and `color.semantic.ai.bg` tokens
- [x] RiskBadge — maps Low→success, Medium→warning, High→error semantic tokens

### New Components Added to Design System

- [ ] TypingIndicator — new specialist component; CSS bounce animation documented in shared CSS
- [ ] SourceEvidenceExpander — new specialist component; right drawer with `mark` highlight
- [ ] SlotCell — sub-component of CalendarGrid; slot state tokens added to designsystem.md
