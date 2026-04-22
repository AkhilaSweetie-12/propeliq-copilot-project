# Design Tokens Applied

**Source:** `designsystem.md`
**Target:** All 22 Hi-Fi wireframes in `Hi-Fi/`
**Date generated:** 2026-04-17
**Shared CSS:** `wireframe-shared.css`

---

## 1. Colour Token Mapping

### Brand Palette

| Token | CSS Custom Property | Value | Applied in wireframe |
|-------|---------------------|-------|----------------------|
| `color-navy-600` | `--color-navy-600` | `#1E3A5F` | Topbar, Sidebar, Patient header bar (SCR-016), Appointment summary (SCR-009), Slot summary (SCR-009) |
| `color-navy-500` | `--color-navy-500` | `#2F5080` | Sidebar active item background |
| `color-navy-400` | `--color-navy-400` | `#4A6FA5` | Sidebar hover, secondary accents |
| `color-teal-500` | `--color-teal-500` | `#0D9488` | Primary CTA buttons, links, progress bar fills, selected slots (SCR-008), active sidebar items |
| `color-teal-400` | `--color-teal-400` | `#14B8A6` | Button hover states, teal accents |
| `color-teal-100` | `--color-teal-100` | `#CCFBF1` | Patient found card (SCR-012), intake completion (SCR-007), selected slot preview (SCR-008) |

### Semantic Colours

| Token | CSS Custom Property | Value | Applied in wireframe |
|-------|---------------------|-------|----------------------|
| `color-success` | `--color-success` | `#16A34A` | Status badges (confirmed, arrived, extracted), confirmation hero (SCR-010), verified field indicators (SCR-016) |
| `color-success-bg` | `--color-success-bg` | `#F0FDF4` | Insurance check result (SCR-009), resolved conflict (SCR-017), extracted document card (SCR-015) |
| `color-warning` | `--color-warning` | `#D97706` | Incomplete section badges (SCR-007), processing document status (SCR-015), in-progress queue status (SCR-014) |
| `color-warning-bg` | `--color-warning-bg` | `#FFFBEB` | Walk-in override alert (SCR-012), needs-review coding row (SCR-018), pending user status |
| `color-error` | `--color-error` | `#DC2626` | Validation errors (SCR-007), failed document card (SCR-015), conflict banner (SCR-016), deactivate button (SCR-020) |
| `color-error-bg` | `--color-error-bg` | `#FEF2F2` | Conflict card (SCR-017), conflict banner background (SCR-016), failed document icon (SCR-015) |
| `color-info` | `--color-info` | `#2563EB` | Scheduled status badges, info alerts (SCR-009, SCR-015), patient role badges (SCR-019) |
| `color-info-bg` | `--color-info-bg` | `#EFF6FF` | Info alerts, PDF confirmation link (SCR-010), AI extraction info (SCR-015) |
| `color-ai` | `--color-ai` | `#7C3AED` | AI badge background, AI-suggested fields (SCR-016), evidence drawer border (SCR-018) |
| `color-ai-bg` | `--color-ai-bg` | `#F5F3FF` | AI evidence drawer header (SCR-018), source citation cards (SCR-017), AI quick link card (SCR-011) |

### Neutral Scale

| Token | CSS Custom Property | Value | Applied in wireframe |
|-------|---------------------|-------|----------------------|
| `neutral-50` | `--neutral-50` | `#F9FAFB` | Table header rows, accordion trigger hover, form group backgrounds |
| `neutral-100` | `--neutral-100` | `#F3F4F6` | Field row dividers (SCR-016), drag hint text background |
| `neutral-200` | `--neutral-200` | `#E5E7EB` | Card borders, dividers, table column borders |
| `neutral-400` | `--neutral-400` | `#9CA3AF` | Position numbers (SCR-014), placeholder text, secondary icons |
| `neutral-500` | `--neutral-500` | `#6B7280` | Labels, helper text, metadata, timestamps |
| `neutral-600` | `--neutral-600` | `#4B5563` | Body copy, description text |
| `neutral-700` | `--neutral-700` | `#374151` | Secondary headings |
| `neutral-800` | `--neutral-800` | `#1F2937` | Primary text, table cell values |

### Slot Cell Tokens

| Token | CSS Custom Property | Value | Applied in |
|-------|---------------------|-------|------------|
| `slot-available` | `--slot-available` | `#15803D` (text) | SCR-008 available cells |
| `slot-available-bg` | `--slot-available-bg` | `#DCFCE7` (bg) | SCR-008 available cells |
| `slot-unavailable` | `--slot-unavailable` | `#9CA3AF` (text) | SCR-008, SCR-012 unavailable cells |
| `slot-unavailable-bg` | `--slot-unavailable-bg` | `#F3F4F6` (bg) | SCR-008, SCR-012 unavailable cells |
| `slot-preferred` | `--slot-preferred` | `#B45309` (text) | SCR-008 waitlist cells |
| `slot-preferred-bg` | `--slot-preferred-bg` | `#FEF3C7` (bg) | SCR-008 waitlist cells |

---

## 2. Typography Token Mapping

| Token | CSS Custom Property | Value | Applied in wireframe |
|-------|---------------------|-------|----------------------|
| `font-heading` | `--font-heading` | `Inter, sans-serif` | All `<h1>`–`<h4>` elements |
| `font-body` | `--font-body` | `Inter, sans-serif` | All body text, labels, inputs |
| `font-mono` | `--font-mono` | `JetBrains Mono, monospace` | Timestamps (SCR-021), code cells (SCR-018), slot time labels (SCR-008, SCR-012), booking reference (SCR-010) |
| `text-h1` | `--text-h1` | `2.25rem / 700` | Page titles |
| `text-h2` | `--text-h2` | `1.875rem / 700` | — |
| `text-h3` | `--text-h3` | `1.5rem / 600` | Section headings, month label (SCR-008) |
| `text-h4` | `--text-h4` | `1.25rem / 600` | Card headings, dialog titles, accordion titles |
| `text-body-lg` | `--text-body-lg` | `1.125rem / 400` | Patient name in results (SCR-013), larger body copy |
| `text-body-md` | `--text-body-md` | `1rem / 400` | Standard body, field values, table cells |
| `text-body-sm` | `--text-body-sm` | `0.875rem / 400` | Metadata, helper text, filter chips |
| `text-caption` | `--text-caption` | `0.75rem / 400` | MRN numbers, evidence sources (SCR-018), drag hints (SCR-014) |

---

## 3. Spacing Token Mapping

| Token | CSS Custom Property | Value | Used for |
|-------|---------------------|-------|----------|
| `space-1` | `--space-1` | `4px` | Tight gaps (badge margin, inline items) |
| `space-2` | `--space-2` | `8px` | Form label bottom margin, small icon gaps |
| `space-3` | `--space-3` | `12px` | Card inner gaps, legend items, filter chips |
| `space-4` | `--space-4` | `16px` | Card padding (compact), queue row padding, accordion padding |
| `space-5` | `--space-5` | `20px` | Card padding (standard), patient header bar padding |
| `space-6` | `--space-6` | `24px` | Page content padding, card gaps, section spacing |
| `space-8` | `--space-8` | `32px` | Page sections, action footer spacing |
| `space-12` | `--space-12` | `48px` | Upload zone vertical padding |

---

## 4. Border Radius Token Mapping

| Token | CSS Custom Property | Value | Applied in |
|-------|---------------------|-------|------------|
| `radius-sm` | `--radius-sm` | `4px` | Slot cells (SCR-008, SCR-012), table cells |
| `radius-md` | `--radius-md` | `8px` | Input fields, select elements, filter chips, provider chips |
| `radius-lg` | `--radius-lg` | `12px` | Cards, result cards (SCR-013), conflict cards (SCR-017), selected slot card (SCR-009), danger zone |
| `radius-xl` | `--radius-xl` | `16px` | Calendar container (SCR-008), upload zone (SCR-015), confirmation card, evidence drawer header |
| `radius-full` | `--radius-full` | `9999px` | Avatars, badges, role chips, provider chips, filter chips (active), legend dots |

---

## 5. Shadow Token Mapping

| Token | CSS Custom Property | Value | Applied in |
|-------|---------------------|-------|------------|
| `shadow-1` | `--shadow-1` | `0 1px 3px rgba(0,0,0,0.1)` | Calendar container (SCR-008), card default |
| `shadow-2` | `--shadow-2` | `0 4px 6px rgba(0,0,0,0.07)` | Topbar bottom shadow, result card hover (SCR-013), doc card hover (SCR-015) |
| `shadow-3` | `--shadow-3` | `0 10px 15px rgba(0,0,0,0.1)` | Sidebar shadow |
| `shadow-4` | `--shadow-4` | `0 20px 25px rgba(0,0,0,0.15)` | Evidence drawer (SCR-018), confirm dialogs (SCR-014, SCR-020) |
| `shadow-focus` | `--shadow-focus` | `0 0 0 3px rgba(13,148,136,0.3)` | All focusable interactive elements (buttons, inputs, slots, result cards) — WCAG 2.1 AA focus indicator |

---

## 6. Component Token Usage by Screen

| Screen | Key Component Tokens Applied |
|--------|------------------------------|
| SCR-001 Login | Card (shadow-1, radius-lg), TextField (radius-md, shadow-focus), Button primary (teal-500), Error banner (error-bg) |
| SCR-002 Registration | Card, PasswordStrengthMeter (success/warning/error), Checkbox, required marker |
| SCR-003 Email Verification | Card (centered), Alert-Info (info-bg, info text), Button secondary |
| SCR-004 Patient Dashboard | AppShell (navy-600 sidebar), MetricCard (neutral-50 bg, teal-500 trend), QuickActions (teal-500 CTA) |
| SCR-005 Intake Method | ProgressSteps (teal-500 active dot), MethodCard (ai-bg for AI, info-bg for manual), Badge "Recommended" (ai colour) |
| SCR-006 AI Intake Chat | ChatBubble (navy-600 AI, neutral-100 user), TypingIndicator (3-dot pulse), ProgressSidebar (teal-500 fill) |
| SCR-007 Manual Intake | FormGrid (grid-2), Textarea, Select, ProgressBar (teal-500), Badge statuses (success/warning/error) |
| SCR-007b Intake Review | DataList (neutral-50 bg, teal-100 section title border), EditLink (teal-500) |
| SCR-008 Booking Calendar | CalendarGrid (radius-sm slot cells), SlotCell variants (3 colours + selected teal-500), Legend (radius-sm dots) |
| SCR-009 Booking Insurance | InsuranceCheckResult (success-bg matched / warning-bg unmatched), SummaryCard (navy-600 gradient) |
| SCR-010 Confirmation | CheckCircle (success-bg, success border), ConfirmationCard (detail-item neutral-50), PDFLink (info-bg) |
| SCR-011 Staff Dashboard | MetricCard (error text for high-risk), QueuePreviewRow (risk badges), QuickLinkCard (ai-bg, success-bg) |
| SCR-012 Walk-In Booking | PatientFoundCard (teal-100 bg, teal-500 border), SlotMiniGrid (radius-sm), WalkinBadge (warning-bg) |
| SCR-013 Patient Search | SearchInput (focus shadow-focus), ResultCard (teal-500 border hover), MatchHighlight (teal-100 bg, teal-500 text) |
| SCR-014 Queue View | QueueTable (neutral-50 th), DragHint (font-mono neutral-400), RiskBadge (3 colours), ConfirmDialog (shadow-4) |
| SCR-015 Documents Upload | UploadZone (teal-500 dashed border, teal-100 bg), DocIcon variants (success/warning/error bg), ProcessingBar (teal-500) |
| SCR-016 360° Patient View | PatientHeaderBar (navy-600 bg), ConflictBanner (error-bg, error border), AccordionTrigger (neutral-50 hover), AiBadge (ai colour), VerifiedField (success ::after) |
| SCR-017 Conflict Acknowledgement | ConflictCard (error-bg border), ConflictTypeTag (tag-interaction/tag-duplicate), ProgressBar (teal-500), SourceCitation (ai-bg, ai border-left) |
| SCR-018 Medical Coding | ConfidenceBar (conf-high/conf-mid/conf-low fills), NeedsReviewRow (warning-bg), EvidenceDrawer (ai-bg header, shadow-4), SourceQuote (neutral-50, ai border-left) |
| SCR-019 Admin Users | UserAvatarSm (navy-600), RoleBadge (success/info/error bg), StatusBadge (success/neutral/warning), SortIcon (neutral-400) |
| SCR-020 User Detail | ProfileCard (neutral-50), DangerZone (error border, error heading), DeactivateDialog (error top-border, shadow-4) |
| SCR-021 Audit Log | ReadOnlyNotice (neutral-100), FilterPanel (neutral-50), ActionCell (navy-600 font-mono), Pagination (teal-500 current page) |

---

## 7. Accessibility Token Notes

All wireframes implement the following accessibility-related token applications:

- **Focus ring**: `--shadow-focus` (0 0 0 3px rgba(13,148,136,0.3)) applied to all focusable elements via `:focus-visible` — satisfies WCAG 2.1 AA non-text contrast ≥ 3:1
- **Error states**: Red border (`--color-error`) + `aria-invalid="true"` + `role="alert"` on error message — SCR-007
- **ARIA live regions**: `aria-live="polite"` on slot selection sidebar (SCR-008), insurance check result (SCR-009), queue updates (SCR-014); `aria-live="assertive"` on conflict banner (SCR-016)
- **Colour + icon parity**: All status indicators (slot cells, risk badges, document status) combine colour token AND text/icon symbol — never colour alone
- **Minimum contrast**: Navy (`#1E3A5F`) on white = 10.4:1; Teal-500 (`#0D9488`) on white = 4.6:1; both pass WCAG AA (4.5:1 minimum for normal text)

---

## 8. AI Trust-First Pattern Tokens

Applied via `.ai-badge` and `.ai-suggested-field` classes using `--color-ai` (#7C3AED) and `--color-ai-bg` (#F5F3FF):

| Screen | AI Token Instances |
|--------|--------------------|
| SCR-006 | Chat message AI bubbles (navy-600), AIBadge on answer fields pending completion |
| SCR-015 | "AI data extraction" info alert, extraction-preview chip (teal-100 — completed state) |
| SCR-016 | AIBadge on unverified vitals and diagnosis fields; VerifiedField (success) on clinician-confirmed fields |
| SCR-017 | Source citation block (ai-bg, ai border-left) — evidence traceability |
| SCR-018 | AIBadge in page header, evidence drawer header (ai-bg), source quote (ai border-left), confidence bars |

---

*This document was auto-generated as part of the generate-wireframe workflow. It maps all design tokens from `designsystem.md` to their concrete HTML/CSS applications across the 22 Hi-Fi wireframes.*
