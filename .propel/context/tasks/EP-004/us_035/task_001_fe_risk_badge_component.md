---
title: "Task — FE RiskBadge Component with Tooltip (SCR-014 & SCR-011)"
task_id: task_001
story_id: us_035
epic: EP-004
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001 — FE RiskBadge Component with Tooltip (SCR-014 & SCR-011)

## Requirement Reference

- **User Story**: us_035
- **Story Location**: .propel/context/tasks/EP-004/us_035/us_035.md
- **Acceptance Criteria**:
  - AC-4: Each queue row renders `RiskBadge` with icon (↓ Low / — Medium / ↑ High), text label, and semantic colour (green / amber / red); BOTH icon + text always visible (never colour-alone); `aria-label="[level] no-show risk"`; NULL `no_show_risk` → grey "—" badge `aria-label="Risk not yet assessed"` (UXR-102)
  - AC-5: Hover tooltip on desktop for High-risk badge shows contributing factors: e.g., "2 prior no-shows · Booked same-day · Insurance unmatched"; tooltip is supplementary — text label always visible without hover; tooltip does NOT replace text label (FR-034, UXR-102)

**Note:** `RiskBadge` was scaffolded in us_031 task_001 as a placeholder. This task formalises the full component with tooltip variant and risk-factor string rendering. If us_031 task_001 has already been implemented, apply delta update to the existing `RiskBadge.tsx` only.

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | .propel/context/docs/figma_spec.md#SCR-014 |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-014-queue-view.html |
| **Screen Spec** | SCR-014 (primary — risk badge per row), SCR-011 (secondary — queue preview risk badges) |
| **UXR Requirements** | UXR-102 (RiskBadge: icon ↓/—/↑ + text Low/Medium/High + colour green/amber/red; `aria-label="[level] no-show risk"`; text label always visible — not tooltip-only; supplementary hover tooltip for High factor breakdown — desktop only) |
| **Design Tokens** | risk-Low=`#16A34A` (green ↓), risk-Medium=`#F59E0B` (amber —), risk-High=`#EF4444` (red ↑), risk-NULL=`#9CA3AF` (grey), tooltip-bg=`#1E3A5F` |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18 |
| Language | TypeScript | 5 |
| Styling | TailwindCSS | 3.x |
| Accessibility | WCAG 2.2 AA | — |

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

Implement (or delta-update) `RiskBadge` as a fully reusable shared component. It accepts `risk: 'Low' | 'Medium' | 'High' | null` and an optional `riskFactors: string[]` prop for the tooltip. The tooltip is rendered only when `risk === 'High'` and the device is non-touch (`:hover` CSS + `[data-tooltip]`). Text label and icon are always visible; tooltip is always supplementary. Used by both SCR-011 queue preview rows and SCR-014 full queue table rows.

---

## Dependent Tasks

- us_031 task_001 — `RiskBadge` may already exist as a stub; delta update if so
- us_034 task_001 — `QueueRow` passes `risk` + `riskFactors` props (derived from `GET /api/queue/today` `no_show_risk` + BE risk factor response)
- us_035 task_002 (BE risk engine) — provides `no_show_risk`, `risk_score`, and optionally `risk_factors` in API response

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `src/components/staff/RiskBadge.tsx` | CREATE or MODIFY (delta) | Full implementation with tooltip variant |
| `src/components/staff/QueueRow.tsx` | MODIFY | Pass `riskFactors` prop from row data to `RiskBadge` |
| `src/components/staff/QueuePreviewRow.tsx` | MODIFY | Pass `risk` prop from preview data to `RiskBadge` (no tooltip on preview rows — tooltip only on SCR-014 full queue) |

---

## Implementation Checklist

- [ ] Implement `RiskBadge` with props: `risk: 'Low' | 'Medium' | 'High' | null`, `riskFactors?: string[]`; render icon (↓ / — / ↑) + text label side-by-side; apply colour via TailwindCSS class mapping (`#16A34A` / `#F59E0B` / `#EF4444` / `#9CA3AF`); null state renders grey "—" with `aria-label="Risk not yet assessed"`
- [ ] Set `aria-label="[Low|Medium|High] no-show risk"` on the badge wrapper element; never use colour as the only differentiator — icon and text label are mandatory (UXR-102)
- [ ] Implement tooltip: render a `<span role="tooltip" id="risk-tooltip-[id]">` containing the factor string (e.g., "2 prior no-shows · Booked same-day · Insurance unmatched"); bind `aria-describedby="risk-tooltip-[id]"` on the badge; tooltip visible only on CSS `:hover` (desktop pointer) — hidden on touch devices via `@media (hover: none) { display: none }`; tooltip does NOT replace the visible text label
- [ ] Tooltip is rendered only when `riskFactors` prop is provided AND `risk === 'High'`; Medium/Low/NULL states never show a tooltip
- [ ] Export `RiskBadge` from `src/components/staff/index.ts` for import by both `QueueRow` (SCR-014) and `QueuePreviewRow` (SCR-011)
- [ ] On `QueueRow`, derive `riskFactors` string array from row data factors (e.g., `prior_no_shows > 0`, `lead_time_days < 2`, `insurance_unmatched`, `intake_incomplete`); format as human-readable strings before passing to `RiskBadge`

---

## Build Commands

- `cd client && npm run build`
- `cd client && npm test`

---

## Implementation Validation Strategy

- [ ] Low badge: green ↓ + "Low" text + `aria-label="Low no-show risk"`
- [ ] Medium badge: amber — + "Medium" text + no tooltip
- [ ] High badge: red ↑ + "High" text + supplementary tooltip on hover (desktop only)
- [ ] NULL badge: grey — + `aria-label="Risk not yet assessed"`
- [ ] Tooltip visible on hover (desktop); hidden on touch (`@media (hover: none)`)
- [ ] Text label and icon always visible — not hidden behind tooltip
- [ ] `RiskBadge` renders correctly in SCR-011 queue preview rows (no tooltip) and SCR-014 full queue rows (with tooltip when `riskFactors` provided)
