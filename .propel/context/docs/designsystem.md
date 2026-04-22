---
title: Design System — Unified Patient Access & Clinical Intelligence Platform
version: 1.0.0
date: 2026-04-17
status: Draft
source: .propel/context/docs/spec.md
figma-spec: .propel/context/docs/figma_spec.md
---

# Design Reference — PropelIQ Health

## UI Impact Assessment

**Has UI Changes**: [x] Yes
**UI Impact Type**: New UI

---

## 1. Design Tokens

### 1.1 Color Palette

#### Brand Palette

| Token | Value | Usage |
|---|---|---|
| `color.brand.navy.600` | `#1E3A5F` | Primary text, sidebar background, key headings |
| `color.brand.navy.700` | `#162D4A` | Sidebar active item background, footer |
| `color.brand.navy.400` | `#2F5080` | Secondary text, hover states on nav |
| `color.brand.teal.500` | `#0D9488` | Primary CTA buttons, active badges, links |
| `color.brand.teal.400` | `#14B8A6` | Hover state for primary button, icons |
| `color.brand.teal.100` | `#CCFBF1` | AI Suggested background mist, info badge bg |
| `color.brand.white` | `#FFFFFF` | Page background, card background, input bg |

#### Semantic Colours (Light Mode)

| Token | Value | Role |
|---|---|---|
| `color.semantic.success` | `#16A34A` | Success toasts, verified badge, arrived status |
| `color.semantic.success.bg` | `#DCFCE7` | Success badge background |
| `color.semantic.warning` | `#D97706` | Medium no-show risk badge, preferred slot colour |
| `color.semantic.warning.bg` | `#FEF3C7` | Warning badge background |
| `color.semantic.error` | `#DC2626` | Error borders, error messages, failed badge |
| `color.semantic.error.bg` | `#FEE2E2` | Error badge background, error field background |
| `color.semantic.info` | `#2563EB` | Info alerts, patient role badge |
| `color.semantic.info.bg` | `#DBEAFE` | Info badge background |
| `color.semantic.ai` | `#7C3AED` | AI Suggested badge border |
| `color.semantic.ai.bg` | `#F5F3FF` | AI Suggested field background (Trust-First muted) |

#### Neutral Scale

| Token | Value | Usage |
|---|---|---|
| `color.neutral.50` | `#F9FAFB` | Page background, table zebra row |
| `color.neutral.100` | `#F3F4F6` | Input disabled background, section divider |
| `color.neutral.200` | `#E5E7EB` | Border, divider line |
| `color.neutral.300` | `#D1D5DB` | Placeholder icon, skeleton base |
| `color.neutral.400` | `#9CA3AF` | Placeholder text, helper text |
| `color.neutral.500` | `#6B7280` | Secondary body text, label |
| `color.neutral.600` | `#4B5563` | Primary body text |
| `color.neutral.700` | `#374151` | Strong body text |
| `color.neutral.800` | `#1F2937` | Headings, critical text |
| `color.neutral.900` | `#111827` | Maximum contrast text |

#### Slot Calendar Colours (UXR-101)

| Token | Value | Role |
|---|---|---|
| `color.slot.available` | `#16A34A` | Available slot cell background |
| `color.slot.available.bg` | `#DCFCE7` | Available slot cell fill |
| `color.slot.unavailable` | `#9CA3AF` | Unavailable slot (greyed) |
| `color.slot.unavailable.bg` | `#F3F4F6` | Unavailable slot fill |
| `color.slot.preferred` | `#D97706` | Waitlist / preferred slot amber |
| `color.slot.preferred.bg` | `#FEF3C7` | Preferred slot fill |

---

### 1.2 Typography

#### Font Families

| Token | Value | Usage |
|---|---|---|
| `font.family.heading` | `Inter, system-ui, sans-serif` | All headings H1–H6 |
| `font.family.body` | `Inter, system-ui, sans-serif` | All body text, labels, inputs |
| `font.family.mono` | `JetBrains Mono, Consolas, monospace` | Code values, ICD-10/CPT code cells, audit log entries |

#### Type Scale

| Token | Size | Weight | Line-Height | Used In |
|---|---|---|---|---|
| `text.h1` | 32px / 2rem | 700 | 40px | Page titles (login, dashboard headers) |
| `text.h2` | 24px / 1.5rem | 600 | 32px | Section headings, modal titles |
| `text.h3` | 20px / 1.25rem | 600 | 28px | Card headings, accordion titles |
| `text.h4` | 18px / 1.125rem | 600 | 24px | Sub-section headings, form group labels |
| `text.body.lg` | 16px / 1rem | 400 | 24px | Primary body copy |
| `text.body.md` | 14px / 0.875rem | 400 | 20px | Form labels, table cells, description text |
| `text.body.sm` | 12px / 0.75rem | 400 | 16px | Helper text, badge labels, timestamps |
| `text.caption` | 11px / 0.6875rem | 400 | 16px | Footer notes, legal, accessibility annotations |
| `text.mono.md` | 14px / 0.875rem | 400 | 20px | ICD-10/CPT code cells, audit log values |
| `text.button.lg` | 16px / 1rem | 600 | 24px | Large button labels |
| `text.button.md` | 14px / 0.875rem | 600 | 20px | Default button labels |
| `text.button.sm` | 12px / 0.75rem | 600 | 16px | Small button labels, badge text |

---

### 1.3 Spacing

**Base Unit**: 4px

| Token | Value | Common Usage |
|---|---|---|
| `space.1` | 4px | Tight inline gaps, icon-to-label gap |
| `space.2` | 8px | Form field internal padding (vertical), badge padding |
| `space.3` | 12px | Small section gap, compact list item padding |
| `space.4` | 16px | Standard component padding, card internal padding |
| `space.5` | 20px | Medium gap between related components |
| `space.6` | 24px | Section gap, form group vertical spacing |
| `space.8` | 32px | Page section separator, large card padding |
| `space.10` | 40px | Page content top margin |
| `space.12` | 48px | Page vertical section gap |
| `space.16` | 64px | Hero / onboarding section padding |

---

### 1.4 Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius.sm` | 4px | Tags, chips, small badges |
| `radius.md` | 8px | Input fields, buttons, cards |
| `radius.lg` | 12px | Modal panels, large cards |
| `radius.xl` | 16px | Drawer panels, bottom sheets |
| `radius.full` | 9999px | Avatar circles, pill badges, toggle |

---

### 1.5 Elevation / Shadows

| Token | Value | Usage |
|---|---|---|
| `shadow.1` | `0 1px 2px rgba(0,0,0,0.05)` | Cards (resting), input fields |
| `shadow.2` | `0 2px 8px rgba(0,0,0,0.08)` | Dropdown menus, tooltip |
| `shadow.3` | `0 4px 16px rgba(0,0,0,0.12)` | Modals, drawers (overlay state) |
| `shadow.4` | `0 8px 24px rgba(0,0,0,0.15)` | Sticky top bar (on scroll), full-screen modal |
| `shadow.focus` | `0 0 0 3px rgba(13,148,136,0.4)` | Focus ring (teal, all interactive elements) |

---

### 1.6 Grid System

| Breakpoint | Columns | Gutter | Margin |
|---|---|---|---|
| Mobile (< 768px) | 4 | 16px | 16px |
| Tablet (768–1023px) | 8 | 24px | 24px |
| Desktop (≥ 1024px) | 12 | 24px | 32px |

---

## 2. Component Library Reference

### 2.1 Button

| Variant | Background | Text | Border | Usage |
|---|---|---|---|---|
| Primary | `color.brand.teal.500` | white | none | Primary CTA actions |
| Secondary | white | `color.brand.teal.500` | `color.brand.teal.500` 1.5px | Secondary actions |
| Ghost | transparent | `color.neutral.600` | none | Tertiary / inline actions |
| Danger | `color.semantic.error` | white | none | Destructive actions (deactivate, reject) |

**States**: Default → Hover (10% darken) → Focus (shadow.focus ring) → Active (5% darken) → Disabled (opacity 0.4) → Loading (spinner replaces label)

**Sizes**: S (32px height, space.3 h-padding) | M (40px height, space.4 h-padding) | L (48px height, space.6 h-padding)

**Touch Target**: Minimum 44 × 44px on mobile (visual padding applied)

---

### 2.2 TextField

**Structure**: Label → Input → Helper/Error text

| State | Border | Background |
|---|---|---|
| Default | `color.neutral.200` 1.5px | white |
| Focus | `color.brand.teal.500` 2px + shadow.focus | white |
| Error | `color.semantic.error` 2px | `color.semantic.error.bg` |
| Disabled | `color.neutral.200` 1.5px | `color.neutral.100` |

- Label: `text.body.md` weight 500, `color.neutral.700`
- Placeholder: `color.neutral.400`
- Error message: `text.body.sm`, `color.semantic.error`, with ⚠ icon
- Required indicator: red asterisk * after label

---

### 2.3 Badge

| Variant | Background | Text Colour | Border | Usage |
|---|---|---|---|---|
| Success | `color.semantic.success.bg` | `color.semantic.success` | none | Verified, Arrived, Active |
| Warning | `color.semantic.warning.bg` | `color.semantic.warning` | none | Medium risk, Pending |
| Error | `color.semantic.error.bg` | `color.semantic.error` | none | Failed, High risk, Inactive |
| Info | `color.semantic.info.bg` | `color.semantic.info` | none | Patient role, Processing |
| AI Suggested | `color.semantic.ai.bg` | `color.semantic.ai` | `color.semantic.ai` 1px | All AI-generated outputs |
| Neutral | `color.neutral.100` | `color.neutral.500` | none | Default status, Unavailable |

**Radius**: `radius.full` | **Font**: `text.body.sm` weight 600 | **Padding**: space.1 × space.2

---

### 2.4 Card

- Background: white
- Border: 1px solid `color.neutral.200`
- Border Radius: `radius.lg`
- Shadow: `shadow.1` (resting), `shadow.2` (hover on interactive cards)
- Padding: `space.6`

---

### 2.5 Table

- Header background: `color.neutral.50`
- Header text: `text.body.md` weight 600, `color.neutral.700`
- Row border: 1px bottom `color.neutral.200`
- Row hover: `color.neutral.50`
- Zebra row: `color.neutral.50` (even rows — optional)
- Cell text: `text.body.md`, `color.neutral.600`
- Sticky header on scroll

---

### 2.6 Modal

- Overlay: `rgba(0,0,0,0.5)` full-screen
- Panel: white, `radius.xl`, `shadow.3`
- Width: 480px (default) / 640px (large) / full-screen mobile
- Header: `text.h3`, close × button top-right
- Footer: action buttons right-aligned
- Trap focus within modal (ARIA `role=dialog`, `aria-modal=true`)

---

### 2.7 Toast

- Position: bottom-right, 16px from viewport edges
- Width: 320px
- Background: `color.neutral.800`
- Text: white, `text.body.md`
- Auto-dismiss: 5 seconds
- Manual dismiss: × button
- Variants: Success (teal left border), Warning (amber), Error (red), Info (blue)

---

### 2.8 Skeleton

- Base: `color.neutral.200`
- Shimmer: animated gradient left-to-right 1.5s linear infinite
- Used on: all data-fetching screens before content loads
- Shapes: line (text), rect (card), circle (avatar)

---

### 2.9 AI Trust-First Pattern Components

#### AIBadge

- Label: `"AI Suggested"` | Background: `color.semantic.ai.bg` | Border: `color.semantic.ai`
- Icon: Sparkle (outlined) 16px preceding label
- Always displayed on unverified AI-generated field values

#### SourceEvidenceExpander

- Trigger: `"View source"` ghost button inline with code row
- Drawer: right-side panel, 360px wide
- Content: highlighted excerpt from source clinical document
- Highlight: `color.semantic.ai.bg` background on source text span
- Collapsed by default (UXR-104)

#### RiskBadge

- Variants: Low (success), Medium (warning), High (error)
- Always includes text label — never colour-only (UXR-102)
- Icon: chevron-up for High, minus for Medium, chevron-down for Low

---

### 2.10 CalendarGrid

- Grid: 5×5 to 5×7 (Mon–Fri or Mon–Sun, configurable)
- Slot cell size: 48px × 32px (desktop) / 40px × 28px (mobile)
- Slot states: Available (teal bg), Unavailable (grey bg), Preferred (amber bg)
- Each cell: colour fill + icon indicator (✓ / — / ★) for colour-blind safety (UXR-101)
- Selected state: teal border 2px + shadow.focus
- Day header: `text.body.sm` weight 600, `color.neutral.500`
- Time header: `text.mono.md`, `color.neutral.500`

---

### 2.11 ChatBubble (AI Intake)

**User bubble**: right-aligned, `color.brand.teal.100` background, `radius.lg radius.sm on bottom-right`
**AI bubble**: left-aligned, `color.neutral.100` background, `radius.lg radius.sm on bottom-left`
**Typing indicator**: left-aligned AI bubble with 3 animated dots (400ms each, sequential)
**Timestamp**: `text.caption`, `color.neutral.400`, below each bubble group

---

### 2.12 Accordion

- Header: flex row, chevron right → rotates 90° when expanded
- Header height: 48px, `text.h4`, `color.neutral.700`
- Border bottom: `color.neutral.200`
- Panel padding: `space.4`
- AI badge displayed in header if section contains AI-suggested data

---

### 2.13 FileUpload

- Zone: dashed border 2px `color.neutral.300`, `radius.lg`, `color.neutral.50` background
- Drag-over state: `color.brand.teal.500` border 2px, `color.brand.teal.100` background
- Accepted file card: file name + size + status badge (Processing / Extracted / Failed)
- Error (size/type): inline error below the zone
- Max file size constraint: 10MB (client-side enforced)

---

## 3. Brand Guidelines

### Logo Usage

- Full wordmark (PropelIQ Health) + icon — SVG only
- Minimum clear space: `space.4` (16px) on all sides
- On dark (navy) sidebar: white wordmark variant
- On white background: navy wordmark variant
- Do not alter colours, proportions, or add effects

### Icon System

| Library | Style | Size Grid | Stroke |
|---|---|---|---|
| Heroicons v2 (MIT) | Outlined | 24px | 1.5px |
| Heroicons v2 (MIT) | Solid | 20px | N/A (fill) |

- Use **Outlined** for interactive icons (buttons, navigation)
- Use **Solid** for status indicators and filled badge icons
- Always pair icon-only buttons with ARIA label + tooltip (UXR-203)

### Illustration Style

- Flat SVG, 2-colour (navy + teal), clean geometric
- Used for: empty states, onboarding banners
- Not used for: clinical content, patient-specific views (privacy sensitivity)

---

## 4. Accessibility Requirements

| Requirement | Standard | Enforcement |
|---|---|---|
| Colour contrast (text) | ≥ 4.5:1 | All body and label text against background |
| Colour contrast (UI) | ≥ 3:1 | Borders, icons, button fills |
| Focus ring | Visible, 3px teal (`shadow.focus`) | All interactive elements |
| Keyboard navigation | Full coverage, logical tab order | All screens |
| ARIA roles | `role=dialog` (modal), `role=alert` (toast), `role=status` (progress) | All dynamic regions |
| Touch targets | ≥ 44 × 44px | All clickable elements on mobile |
| No colour-only communication | Text label OR icon ALWAYS accompanies colour | Slot grid, risk badges, status badges |
| Screen reader | All icons have `aria-label` or `title` | All icon-only buttons |

**WCAG Level**: AA (WCAG 2.2)

---

## 5. Design Review Checklist

- [ ] Figma file follows page structure in figma_spec.md Section 13
- [ ] All design tokens reference this document (no hard-coded values)
- [ ] AI Trust-First pattern applied on SCR-016, SCR-017, SCR-018
- [ ] Slot calendar uses colour + icon (UXR-101)
- [ ] Risk badges include text label (UXR-102)
- [ ] Source evidence drawer collapsed by default (UXR-104)
- [ ] Session expiry modal wired in all authenticated prototype flows
- [ ] Responsive layouts tested at 320px, 768px, 1024px, 1440px
- [ ] Colour contrast verified on all badge and semantic colour combinations
- [ ] Focus ring visible in all interactive states

---

## 6. Design Asset References

### Figma Project

| Asset | Description | Status |
|---|---|---|
| Figma Project File | PropelIQ Health UI Kit + Screens | Not yet created (generate-figma phase) |
| Token Library | Colour, typography, spacing tokens | Defined in this document |
| Component Library | All C/ components | Defined in this document |

### Design Images

| Asset | Path | Description |
|---|---|---|
| Brand Logo SVG | `.propel/context/Design/logo/propeliq-health-logo.svg` | To be created |
| Empty State Illustrations | `.propel/context/Design/illustrations/` | To be created (flat SVG set) |
| Screenshot References | `.propel/context/Design/screenshots/` | To be populated post-Figma generation |

---

## 7. Task Design Mapping

```yaml
SCR-001:
  title: "Login Screen"
  ui_impact: true
  components_affected:
    - TextField (email, password)
    - Button (Primary - Login, Ghost - Register)
    - Link (Forgot password)
  visual_validation_required: true

SCR-006:
  title: "AI-Assisted Intake Chat"
  ui_impact: true
  components_affected:
    - ChatBubble (user + AI variants)
    - TypingIndicator
    - TextField (message input)
    - Button (Send)
  visual_validation_required: true
  ai_trust_first: false

SCR-016:
  title: "360-Degree Patient View"
  ui_impact: true
  components_affected:
    - Accordion
    - AIBadge
    - Badge (Verified)
    - Alert (Conflict)
    - Button (Verify)
  ai_trust_first: true
  visual_validation_required: true

SCR-018:
  title: "Medical Coding Panel"
  ui_impact: true
  components_affected:
    - Table
    - AIBadge
    - SourceEvidenceExpander
    - Badge (Needs Review, AI Suggested, Accepted)
    - Button (Accept, Modify, Reject)
    - Dialog (Finalise Confirm)
  ai_trust_first: true
  visual_validation_required: true
```
