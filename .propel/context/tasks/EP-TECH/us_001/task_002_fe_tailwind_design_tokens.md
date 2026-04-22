---
title: "Task — TailwindCSS Installation & Design Token Configuration from designsystem.md"
task_id: task_002
story_id: us_001
epic: EP-TECH
layer: Frontend
status: Not Started
date: 2026-04-20
---

# Task - task_002

## Requirement Reference
- User Story: [us_001] — React 18 + TypeScript + TailwindCSS SPA Scaffold
- Story Location: `.propel/context/tasks/EP-TECH/us_001/us_001.md`
- Acceptance Criteria:
  - AC-4: TailwindCSS configured with design token values from `designsystem.md`; compiled CSS reflects correct colours, spacing, and typography tokens; `grep` of production CSS bundle reports zero hard-coded hex values outside the Tailwind config file
  - Edge Case 3: Dynamic class names added to `safelist` in `tailwind.config.ts`; CI lint step `npx tailwindcss --dry-run` verifies no critical classes are purged

## Design References (Frontend Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No |
| **Figma URL** | N/A |
| **Wireframe Status** | N/A |
| **Wireframe Type** | N/A |
| **Wireframe Path/URL** | N/A |
| **Screen Spec** | N/A |
| **UXR Requirements** | N/A |
| **Design Tokens** | `.propel/context/docs/designsystem.md` — Section 1: Colors, Typography, Spacing, Border Radius, Shadows, Grid |

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18.x |
| Frontend | TypeScript | 5.x |
| Build Tool | Vite | 5.x |
| CSS Framework | TailwindCSS | 3.4.x |
| PostCSS | postcss | 8.x |
| PostCSS plugin | autoprefixer | 10.x |
| AI/ML | N/A | N/A |
| Vector Store | N/A | N/A |
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
Install TailwindCSS 3.4 with PostCSS and Autoprefixer into the `/client` SPA scaffold (from task_001). Populate `tailwind.config.ts` with the complete design token set from `designsystem.md` — brand palette, semantic colours, neutral scale, slot calendar colours, typography scale (font families, type scale), spacing scale, border radii, shadow/elevation tokens, and the 3-breakpoint grid. Configure the `safelist` array to prevent dynamic class names from being purged. Add an ESLint `no-restricted-syntax` rule that blocks hard-coded hex colour values, pixel sizes, and arbitrary Tailwind bracket syntax in component files. Add a CI step to verify zero critical class purge.

## Dependent Tasks
- `task_001_fe_vite_react_typescript_scaffold.md` — must be complete; Vite project and `package.json` must exist before Tailwind can be installed.

## Impacted Components
- `/client/package.json` — add `tailwindcss`, `postcss`, `autoprefixer` dev dependencies
- `/client/tailwind.config.ts` — new file (design token definitions)
- `/client/postcss.config.cjs` — new file (Tailwind + Autoprefixer PostCSS pipeline)
- `/client/src/index.css` — new file (Tailwind directives `@tailwind base/components/utilities`)
- `/client/src/main.tsx` — MODIFY to import `'./index.css'`
- `/client/.eslintrc.cjs` — MODIFY to add `no-restricted-syntax` rule for hard-coded styles

## Implementation Plan

1. **Install TailwindCSS and PostCSS dependencies**:
   ```bash
   cd /client && npm install -D tailwindcss@3.4 postcss@8 autoprefixer@10
   ```

2. **Create `postcss.config.cjs`** in `/client`:
   ```js
   module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
   ```

3. **Create `tailwind.config.ts`** in `/client` — populate all tokens from `designsystem.md`:

   **Brand palette** (`theme.extend.colors`):
   ```ts
   navy: { 400: '#2F5080', 600: '#1E3A5F', 700: '#162D4A' },
   teal: { 100: '#CCFBF1', 400: '#14B8A6', 500: '#0D9488' },
   ```

   **Semantic colours** (flat keys under `colors`):
   ```ts
   success: { DEFAULT: '#16A34A', bg: '#DCFCE7' },
   warning: { DEFAULT: '#D97706', bg: '#FEF3C7' },
   error: { DEFAULT: '#DC2626', bg: '#FEE2E2' },
   info: { DEFAULT: '#2563EB', bg: '#DBEAFE' },
   ai: { DEFAULT: '#7C3AED', bg: '#F5F3FF' },
   ```

   **Neutral scale**:
   ```ts
   neutral: { 50:'#F9FAFB',100:'#F3F4F6',200:'#E5E7EB',300:'#D1D5DB',400:'#9CA3AF',500:'#6B7280',600:'#4B5563',700:'#374151',800:'#1F2937',900:'#111827' },
   ```

   **Slot colours**:
   ```ts
   slot: { available:'#16A34A','available-bg':'#DCFCE7', unavailable:'#9CA3AF','unavailable-bg':'#F3F4F6', preferred:'#D97706','preferred-bg':'#FEF3C7' },
   ```

   **Typography** (`theme.extend.fontFamily`, `theme.extend.fontSize`):
   - `fontFamily.heading` / `fontFamily.body`: `['Inter', 'system-ui', 'sans-serif']`
   - `fontFamily.mono`: `['JetBrains Mono', 'Consolas', 'monospace']`
   - `fontSize` entries matching the type scale (h1 through caption, mono.md, button.sm/md/lg) with `[size, { lineHeight, fontWeight }]` tuple format

   **Spacing** (`theme.extend.spacing`): map `space-1` through `space-16` to the 4px-base scale values from `designsystem.md` sections 1.3

   **Border radius** (`theme.extend.borderRadius`): `sm:4px`, `md:8px`, `lg:12px`, `xl:16px`, `full:9999px`

   **Box shadows** (`theme.extend.boxShadow`): `shadow-1` through `shadow-4` + `shadow-focus` using rgba values from designsystem.md section 1.5

   **Screens breakpoints** (`theme.screens`): `sm: '320px'` (mobile), `md: '768px'` (tablet), `lg: '1024px'` (desktop)

   **`content` array**: `['./index.html', './src/**/*.{ts,tsx}']`

4. **Configure `safelist`** in `tailwind.config.ts`:
   - Include `sr-only` and `focus:not-sr-only` (accessibility classes from us_051)
   - Include all `badge-*`, `risk-*`, `conf-*` pattern classes used dynamically (e.g., `risk-high`, `risk-medium`, `risk-low`)
   - Use pattern-based safelist: `{ pattern: /^(badge|risk|conf|slot|ai|btn)-.+/, variants: ['hover', 'focus', 'aria-*'] }`

5. **Create `src/index.css`** with:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

6. **Modify `src/main.tsx`** to import `'./index.css'` as the first import line.

7. **Add ESLint `no-restricted-syntax` rule** in `.eslintrc.cjs` to block:
   - `JSXAttribute[name.name='style'][value.type!='JSXExpressionContainer']` — direct `style="..."` as a JSX attribute
   - Any JSX `style` prop where the object contains keys matching `color|background|borderColor|fontSize|padding|margin` with literal string/number values containing `#` or `px` — rule message: `"Hard-coded style value detected — use TailwindCSS design token classes instead (see designsystem.md)"`
   - Arbitrary Tailwind bracket syntax in `className` string literals matching pattern `\[#[0-9a-fA-F]+\]` or `\[\d+px\]`

8. **Verify token completeness**: run `npm run build` and confirm the compiled CSS references all brand colour tokens (spot-check by grepping the output CSS for `navy`, `teal`, `neutral` class names). Run `grep -rn '#[0-9a-fA-F]\{3,6\}' src/` and confirm zero results (no hard-coded hex in source components).

## Current Project State
```
/client/
├── package.json              # Created in task_001 (React 18, Vite 5, TS 5)
├── vite.config.ts            # Created in task_001 (port 3000, path alias)
├── tsconfig.json             # Created in task_001 (strict mode, @/* alias)
├── index.html                # Created in task_001
├── .nvmrc                    # Created in task_001
├── .eslintrc.cjs             # Created in task_001 (TS-eslint + react-hooks)
└── src/
    ├── main.tsx              # Created in task_001 (createRoot mount)
    ├── App.tsx               # Created in task_001 (Suspense shell)
    └── vite-env.d.ts         # Created in task_001
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/client/tailwind.config.ts` | Full token-mapped Tailwind config sourcing all values from designsystem.md |
| CREATE | `/client/postcss.config.cjs` | PostCSS pipeline: tailwindcss + autoprefixer plugins |
| CREATE | `/client/src/index.css` | Tailwind base/components/utilities directives |
| MODIFY | `/client/src/main.tsx` | Add `import './index.css'` as first import |
| MODIFY | `/client/package.json` | Add `tailwindcss@3.4`, `postcss@8`, `autoprefixer@10` to devDependencies |
| MODIFY | `/client/.eslintrc.cjs` | Add `no-restricted-syntax` rule for hard-coded colour/size style props and arbitrary Tailwind bracket values |

## External References
- TailwindCSS 3.4 installation with Vite: https://tailwindcss.com/docs/guides/vite
- TailwindCSS `theme.extend` — adding custom tokens: https://tailwindcss.com/docs/theme
- TailwindCSS `safelist` configuration — dynamic class names: https://tailwindcss.com/docs/content-configuration#safelisting-classes
- TailwindCSS content configuration (`content` array): https://tailwindcss.com/docs/content-configuration
- PostCSS 8 configuration: https://postcss.org/api/
- Design token source: `.propel/context/docs/designsystem.md` (Section 1.1–1.6)

## Build Commands
```bash
# Install Tailwind and PostCSS
cd /client && npm install -D tailwindcss@3.4 postcss@8 autoprefixer@10

# Verify Tailwind is processing correctly (dry-run purge check)
npx tailwindcss -i ./src/index.css -o /dev/null --dry-run 2>&1 | grep -i "error\|warning" || echo "OK"

# Build and check for hard-coded hex in source
npm run build
grep -rn '#[0-9a-fA-F]\{3,6\}' src/ --include="*.tsx" --include="*.ts" && echo "FAIL: hard-coded hex found" || echo "PASS: no hard-coded hex"

# Lint check (must exit 0)
npm run lint
```

## Implementation Validation Strategy
- [ ] `npm run dev` starts and Tailwind classes render correctly in the browser (brand colours visible)
- [ ] `npm run build` completes; production CSS does not contain any hex values except those originating from `tailwind.config.ts`
- [ ] `grep -rn '#[0-9a-fA-F]\{3,6\}' src/` reports zero matches (no hard-coded hex in component source)
- [ ] `npx tailwindcss --dry-run` runs without purge warnings for safelist patterns
- [ ] `npm run lint` exits 0; introducing a `style={{ color: '#FF0000' }}` in a test component triggers the ESLint violation

## Implementation Checklist
- [ ] Install `tailwindcss@3.4 postcss@8 autoprefixer@10` as dev dependencies
- [ ] Create `postcss.config.cjs` with tailwindcss + autoprefixer
- [ ] Create `tailwind.config.ts` — populate brand palette (`navy`, `teal`) from designsystem.md section 1.1
- [ ] Add semantic colours (`success`, `warning`, `error`, `info`, `ai`) with DEFAULT and bg variants
- [ ] Add neutral scale (`neutral.50` through `neutral.900`)
- [ ] Add slot calendar colours (`slot.available`, `slot.unavailable`, `slot.preferred` with `-bg` variants)
- [ ] Add fontFamily (`heading`, `body`, `mono`) from designsystem.md section 1.2
- [ ] Add fontSize entries for all type scale tokens (h1–h4, body.lg/md/sm, caption, mono.md, button.sm/md/lg)
- [ ] Add spacing scale (`space-1` through `space-16`) from designsystem.md section 1.3
- [ ] Add borderRadius tokens (`sm`, `md`, `lg`, `xl`, `full`) from designsystem.md section 1.4
- [ ] Add boxShadow tokens (`shadow-1` through `shadow-4`, `shadow-focus`) from designsystem.md section 1.5
- [ ] Set `screens` breakpoints: `sm:320px`, `md:768px`, `lg:1024px`
- [ ] Configure `safelist` with pattern-based entries for `badge-*`, `risk-*`, `conf-*`, `slot-*`, `sr-only`
- [ ] Set `content: ['./index.html', './src/**/*.{ts,tsx}']`
- [ ] Create `src/index.css` with `@tailwind base/components/utilities`
- [ ] Add `import './index.css'` to `src/main.tsx`
- [ ] Add `no-restricted-syntax` ESLint rule for hard-coded style values in `.eslintrc.cjs`
- [ ] Run `grep -rn '#...' src/` — confirm zero hard-coded hex results
- [ ] Run `npm run build` — confirm CSS compiles correctly
