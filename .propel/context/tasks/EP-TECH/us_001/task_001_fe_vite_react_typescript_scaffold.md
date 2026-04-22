---
title: "Task — Vite Project Init, React 18 + TypeScript Strict Config & Bundle Optimisation"
task_id: task_001
story_id: us_001
epic: EP-TECH
layer: Frontend
status: Not Started
date: 2026-04-20
---

# Task - task_001

## Requirement Reference
- User Story: [us_001] — React 18 + TypeScript + TailwindCSS SPA Scaffold
- Story Location: `.propel/context/tasks/EP-TECH/us_001/us_001.md`
- Acceptance Criteria:
  - AC-1: `npm install && npm run dev` starts Vite dev server at `http://localhost:3000` within 5 seconds with zero errors
  - AC-2: `npm run build` reports zero TypeScript type errors; production bundle (gzipped initial shell) ≤ 500 KB
  - AC-3: Time-to-Interactive < 3 seconds on standard broadband (NFR-002 baseline from scaffold)
  - Edge Case 1: `predev` npm script validates Node.js ≥ 20 and exits with code 1 + descriptive message if incompatible

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
| **Design Tokens** | N/A — design tokens applied in task_002 |

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18.x |
| Frontend | TypeScript | 5.x (strict mode) |
| Build Tool | Vite | 5.x |
| Runtime | Node.js | 20 LTS |
| Package Manager | npm | 10.x |
| Backend (proxy target) | ASP.NET Core 9 API | Port 5000 |
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
Initialise the `/client` directory as a Vite 5 + React 18 + TypeScript 5 SPA project. Configure TypeScript in strict mode with path aliases, set up the Vite dev server to serve at port 3000, configure production build output to `/client/dist`, add route-based code splitting via `React.lazy` and `Suspense` to keep the initial gzipped shell ≤ 500 KB, and enforce Node.js ≥ 20 via a `predev` npm lifecycle hook.

## Dependent Tasks
- None — this is the first task in the project; no prior tasks must complete first.

## Impacted Components
- `/client/` — new directory (entire SPA scaffold)
- `/client/package.json` — new file
- `/client/vite.config.ts` — new file
- `/client/tsconfig.json` — new file
- `/client/tsconfig.node.json` — new file
- `/client/index.html` — new file (Vite SPA entry point)
- `/client/src/main.tsx` — new file (React root mount)
- `/client/src/App.tsx` — new file (root component, route shell)
- `/client/.nvmrc` — new file (Node 20 version pin)

## Implementation Plan

1. **Initialise Vite project** in `/client` using `npm create vite@5 . -- --template react-ts`; confirm Vite 5.x and React 18.x are installed.

2. **Configure TypeScript strict mode** in `tsconfig.json`:
   - Set `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`
   - Add path alias: `"@/*": ["./src/*"]` under `compilerOptions.paths`
   - Set `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "Bundler"`

3. **Configure `vite.config.ts`**:
   - Set `server.port = 3000`
   - Add path alias `@` → `./src` (matching tsconfig) via `resolve.alias`
   - Set `build.target = "es2022"`
   - Enable `build.sourcemap = false` for production (CI build speed)
   - Configure `build.rollupOptions.output.manualChunks` for route-level code splitting (react-router-dom in a separate vendor chunk)

4. **Add Node.js version gate** in `package.json`:
   - Add `"engines": { "node": ">=20" }`
   - Add `"predev"` script: `"node -e \"const v=process.versions.node.split('.');if(parseInt(v[0])<20){console.error('ERROR: Requires Node.js >= 20 (found ' + process.versions.node + ')');process.exit(1);}\""`
   - Create `.nvmrc` with content `20` at `/client/.nvmrc`

5. **Scaffold minimal SPA shell** in `src/main.tsx` and `src/App.tsx`:
   - `main.tsx`: `ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)`
   - `App.tsx`: placeholder routes shell (to be expanded in task_003); exports a single `<div id="app-shell">` with a `<Suspense fallback={null}>` wrapper ready for lazy routes
   - Confirm zero TypeScript errors with `npx tsc --noEmit`

6. **Validate bundle size** after `npm run build`:
   - Run `ls -lh dist/assets/*.js | awk '{print $5, $9}'` and confirm the largest gzipped initial chunk ≤ 500 KB
   - Add `build.reportCompressedSize = true` in `vite.config.ts` so Vite prints gzip sizes in CI output
   - Document the baseline size in a `BUNDLE_BASELINE.md` note in `/client/` (not a generated artefact — a developer note)

7. **Create `/client/.eslintrc.cjs`** with:
   - `@typescript-eslint/recommended` + `react-hooks/recommended` rules enabled
   - Rule `"no-restricted-syntax"` for hard-coded hex/pixel inline styles (enforced fully in task_002)
   - Verify `npm run lint` exits 0

## Current Project State
```
PropelIQ-Stub-Copilot/
├── .propel/                  # Workflow configuration and context
├── brd.md                    # Business requirements document
├── README.md                 # Project overview
└── (no /client or /api yet)  # To be scaffolded by EP-TECH tasks
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/client/package.json` | npm manifest with React 18, TypeScript 5, Vite 5, predev Node version gate, engines field |
| CREATE | `/client/vite.config.ts` | Vite config: port 3000, path alias, build target ES2022, reportCompressedSize, rollupOptions vendor chunk |
| CREATE | `/client/tsconfig.json` | TypeScript strict mode config with path alias `@/*` → `./src/*` |
| CREATE | `/client/tsconfig.node.json` | Vite config TypeScript settings (composite: true) |
| CREATE | `/client/index.html` | Vite SPA entry HTML with `<div id="root">` |
| CREATE | `/client/src/main.tsx` | React 18 createRoot mount with StrictMode |
| CREATE | `/client/src/App.tsx` | Root component with Suspense wrapper, ready for lazy routes |
| CREATE | `/client/.nvmrc` | Node 20 version pin |
| CREATE | `/client/.eslintrc.cjs` | ESLint config: @typescript-eslint + react-hooks rules |
| CREATE | `/client/src/vite-env.d.ts` | Vite client type declarations |

## External References
- Vite 5 React-TypeScript template: https://vitejs.dev/guide/#scaffolding-your-first-vite-project
- Vite `build.rollupOptions.output.manualChunks` — code splitting: https://vitejs.dev/guide/build#chunking-strategy
- TypeScript strict mode reference (TS 5.x): https://www.typescriptlang.org/tsconfig#strict
- React 18 `createRoot` migration guide: https://react.dev/blog/2022/03/08/react-18-upgrade-guide#updates-to-client-rendering-apis
- Vite `server.port` configuration: https://vitejs.dev/config/server-options#server-port
- `engines` field in package.json (npm docs): https://docs.npmjs.com/cli/v10/configuring-npm/package-json#engines

## Build Commands
```bash
# Install dependencies
cd /client && npm install

# Start dev server (validates Node >= 20 via predev hook, then starts at :3000)
npm run dev

# Type-check only (zero-error validation for AC-2)
npx tsc --noEmit

# Production build (generates /client/dist, prints gzip bundle sizes)
npm run build

# Lint check (must exit 0)
npm run lint
```

## Implementation Validation Strategy
- [ ] `npm run dev` starts without errors; browser opens at `http://localhost:3000` and renders `<div id="app-shell">`
- [ ] `npm run dev` on Node 18 exits with code 1 and message "Requires Node.js >= 20"
- [ ] `npx tsc --noEmit` reports zero errors
- [ ] `npm run build` completes; `/client/dist/index.html` exists; Vite output confirms initial JS chunk gzipped ≤ 500 KB
- [ ] `npm run lint` exits 0 with zero ESLint warnings or errors

## Implementation Checklist
- [ ] Run `npm create vite@5 . -- --template react-ts` inside `/client`
- [ ] Update `tsconfig.json` with strict mode flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) and path alias `@/*`
- [ ] Update `vite.config.ts` with `server.port = 3000`, path alias, `build.target = 'es2022'`, `reportCompressedSize = true`, and `manualChunks` vendor split
- [ ] Add `"engines": { "node": ">=20" }` to `package.json`
- [ ] Add `"predev"` script to `package.json` with Node version assertion
- [ ] Create `/client/.nvmrc` with `20`
- [ ] Write minimal `src/main.tsx` (`createRoot` with `StrictMode`) and `src/App.tsx` (`Suspense` wrapper shell)
- [ ] Create `/client/.eslintrc.cjs` with `@typescript-eslint/recommended` and `react-hooks/recommended`
- [ ] Run `npx tsc --noEmit` — confirm zero errors
- [ ] Run `npm run build` — confirm bundle ≤ 500 KB gzipped and no TypeScript errors
- [ ] Run `npm run lint` — confirm zero violations
