---
title: "Task — Playwright /e2e Project Scaffold, SPA Smoke Test & Self-Healing Browser Install"
task_id: task_002
story_id: us_006
epic: EP-TECH
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_002

## Requirement Reference
- User Story: [us_006] — Test Framework Scaffolding (xUnit + Moq + Playwright)
- Story Location: `.propel/context/tasks/EP-TECH/us_006/us_006.md`
- Acceptance Criteria:
  - AC-3: `/e2e` Playwright project; `npx playwright test` with full stack running launches headless Chromium, navigates to `http://localhost:3000`, asserts page title contains "PropelIQ Health", reports ≥ 1 passing test in < 30 seconds
  - Edge Case 1: Playwright browser binary not installed → `pretest` script calls `playwright install chromium --with-deps` to self-heal; `devcontainer.json` `postCreateCommand` also includes `npx playwright install chromium`
  - Edge Case 4: SPA not yet at TTI when test starts → `page.waitForLoadState('networkidle')` before asserting page title

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
| **Design Tokens** | N/A |

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| E2E Framework | Playwright | 1.x |
| Language | TypeScript | 5.x |
| Browser | Chromium (headless) | bundled with Playwright |
| Package Manager | npm | 10.x |
| Node.js | Node.js | 20 LTS |
| SPA Target | React 18 (Vite) | Port 3000 |
| AI/ML | N/A | N/A |
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
Scaffold the `/e2e` Playwright TypeScript project using `npm init playwright@latest`. Configure `playwright.config.ts` with a `baseURL` of `http://localhost:3000`, headless Chromium only, a 30-second test timeout, and `reporter: [['html'], ['junit', {outputFile: '../test-results/e2e-results.xml'}]]`. Create the SPA smoke test navigating to `/`, calling `page.waitForLoadState('networkidle')`, and asserting the page title contains `"PropelIQ Health"`. Add a `pretest` script to `package.json` calling `playwright install chromium --with-deps` for self-healing (EC-1). Update `devcontainer.json` `postCreateCommand` to include the Playwright browser install.

## Dependent Tasks
- `us_001 task_001_fe_vite_react_typescript_scaffold.md` — React SPA at port 3000 must exist; Playwright targets it.
- `us_003 task_002_infra_devcontainer_postcreate.md` — `post-create.sh` will be updated to include `npx playwright install chromium`.

## Impacted Components
- `/e2e/` — CREATE directory: Playwright TypeScript project
- `/e2e/package.json` — CREATE: Playwright + `pretest` self-heal script
- `/e2e/playwright.config.ts` — CREATE: Chromium-only, baseURL port 3000, 30s timeout, JUnit XML reporter
- `/e2e/tests/smoke/spa-smoke.spec.ts` — CREATE: page title smoke test with `waitForLoadState`
- `/e2e/tsconfig.json` — CREATE: TypeScript config for the e2e project
- `/.devcontainer/post-create.sh` — MODIFY: add `npx playwright install chromium --with-deps` step

## Implementation Plan

1. **Scaffold the `/e2e` Playwright project**:
   ```bash
   mkdir e2e && cd e2e
   npm init playwright@latest . -- --quiet --browser=chromium --lang=TypeScript --no-examples
   ```
   This creates `playwright.config.ts`, `package.json`, and `tsconfig.json`.

2. **Configure `/e2e/playwright.config.ts`**:
   ```typescript
   import { defineConfig, devices } from '@playwright/test';

   export default defineConfig({
     testDir: './tests',
     timeout: 30_000,          // AC-3: total smoke test < 30 seconds
     expect: { timeout: 10_000 },
     fullyParallel: false,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 1 : 0,
     workers: 1,
     reporter: [
       ['list'],
       ['html', { open: 'never' }],
       ['junit', { outputFile: '../test-results/e2e-results.xml' }],   // CI JUnit output
     ],
     use: {
       baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
       headless: true,
       screenshot: 'only-on-failure',
       video: 'retain-on-failure',
       trace: 'on-first-retry',
     },
     projects: [
       {
         name: 'chromium',
         use: { ...devices['Desktop Chrome'] },
       },
     ],
     // No webServer block — assumes SPA is started externally (CI starts it before running tests)
   });
   ```

3. **Create `tests/smoke/spa-smoke.spec.ts`**:
   ```typescript
   import { test, expect } from '@playwright/test';

   test.describe('SPA smoke test', () => {
     test('page title contains PropelIQ Health', async ({ page }) => {
       await page.goto('/');

       // EC-4: wait for network idle before asserting — ensures SPA has reached TTI
       await page.waitForLoadState('networkidle');

       await expect(page).toHaveTitle(/PropelIQ Health/i);
     });
   });
   ```
   Note: The page `<title>` value `"PropelIQ Health"` must match the `<title>` tag in `/client/index.html`. Verify this matches — if the SPA title differs, update either the test regex or the `index.html` title.

4. **Update `/e2e/package.json`** — add `pretest` self-heal script (EC-1):
   ```json
   {
     "name": "patient-access-e2e",
     "version": "1.0.0",
     "scripts": {
       "pretest":  "npx playwright install chromium --with-deps",
       "test":     "npx playwright test",
       "test:smoke": "npx playwright test tests/smoke/",
       "report":   "npx playwright show-report"
     },
     "devDependencies": {
       "@playwright/test": "^1.0.0"
     }
   }
   ```
   `pretest` runs automatically before every `npm test` — ensures the Chromium binary is always present.

5. **Create `/e2e/tsconfig.json`**:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "commonjs",
       "strict": true,
       "esModuleInterop": true,
       "outDir": "./dist",
       "rootDir": "."
     },
     "include": ["tests/**/*.ts", "playwright.config.ts"]
   }
   ```

6. **Update `/.devcontainer/post-create.sh`** — add Playwright browser install after `npm ci`:
   ```bash
   # ── Install Playwright browsers ────────────────────────────────────────────────
   echo "[post-create] Installing Playwright Chromium browser..."
   cd e2e
   npm ci
   npx playwright install chromium --with-deps
   cd ..
   ```
   Insert this block after the existing `cd client && npm ci && cd ..` step in `post-create.sh`.

7. **Update `/client/index.html`** — verify `<title>` matches the smoke test assertion:
   The smoke test asserts `/PropelIQ Health/i`. Ensure `index.html` has:
   ```html
   <title>PropelIQ Health</title>
   ```
   If the current title differs, update `index.html` to match. This is a one-line change.

## Current Project State
```
/
├── client/                      # us_001: React SPA (port 3000)
├── api/                         # us_002–us_005: ASP.NET Core 9 API
├── api.tests/                   # task_001 of this story: xUnit project
├── .devcontainer/
│   └── post-create.sh           # us_003: WILL BE MODIFIED
└── e2e/                         # NOT YET CREATED — created by this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/e2e/package.json` | Playwright test runner; `pretest: npx playwright install chromium --with-deps`; `test:smoke` script |
| CREATE | `/e2e/playwright.config.ts` | Chromium-only; `baseURL=http://localhost:3000`; 30s timeout; JUnit XML reporter → `../test-results/e2e-results.xml`; `headless=true` |
| CREATE | `/e2e/tsconfig.json` | TypeScript strict config for e2e project |
| CREATE | `/e2e/tests/smoke/spa-smoke.spec.ts` | `page.goto('/')`, `waitForLoadState('networkidle')`, `expect(page).toHaveTitle(/PropelIQ Health/i)` |
| MODIFY | `/.devcontainer/post-create.sh` | Add `cd e2e && npm ci && npx playwright install chromium --with-deps && cd ..` step |
| MODIFY | `/client/index.html` | Ensure `<title>PropelIQ Health</title>` matches smoke test assertion |

## External References
- Playwright TypeScript getting started: https://playwright.dev/docs/intro
- Playwright `waitForLoadState('networkidle')`: https://playwright.dev/docs/api/class-page#page-wait-for-load-state
- Playwright `toHaveTitle()` assertion: https://playwright.dev/docs/test-assertions#page-assertions-to-have-title
- Playwright CLI `install --with-deps` (self-heal): https://playwright.dev/docs/cli#install-browsers
- Playwright JUnit reporter: https://playwright.dev/docs/test-reporters#junit-reporter
- Playwright `playwright.config.ts` reference: https://playwright.dev/docs/test-configuration

## Build Commands
```bash
# Scaffold e2e project
mkdir e2e && cd e2e
npm init playwright@latest . -- --quiet --browser=chromium --lang=TypeScript --no-examples

# Install dependencies + self-heal browser binary
npm ci
npx playwright install chromium --with-deps

# Run smoke tests (requires SPA running on port 3000)
# In one terminal: cd client && npm run dev
# In another:
cd e2e
npm run test:smoke
# Expected: 1 test passed, < 30s total

# Run with JUnit XML output (CI)
npx playwright test tests/smoke/ --reporter=junit --output=../test-results/e2e-results.xml

# View HTML report (local dev)
npx playwright show-report
```

## Implementation Validation Strategy
- [ ] `npm run test:smoke` with SPA running on port 3000 reports 1 test passed in < 30 seconds
- [ ] `test-results/e2e-results.xml` is created and contains valid JUnit XML with at least one `<testcase>` element
- [ ] Deleting the Playwright browser binaries and running `npm test` triggers `pretest` which reinstalls Chromium without error
- [ ] With SPA loading slowly (throttled), `waitForLoadState('networkidle')` prevents the assertion firing before TTI — test still passes
- [ ] `/.devcontainer/post-create.sh` includes Playwright install; opening the repo in Codespaces has Chromium available after devcontainer build

## Implementation Checklist
- [ ] Scaffold `/e2e` with `npm init playwright@latest -- --browser=chromium --lang=TypeScript --no-examples`
- [ ] Configure `playwright.config.ts`: `baseURL=http://localhost:3000`, `headless=true`, `timeout=30_000`, JUnit reporter to `../test-results/e2e-results.xml`
- [ ] Add `pretest: npx playwright install chromium --with-deps` to `/e2e/package.json` scripts
- [ ] Create `tests/smoke/spa-smoke.spec.ts`: `goto('/')`, `waitForLoadState('networkidle')`, `toHaveTitle(/PropelIQ Health/i)`
- [ ] Verify `/client/index.html` `<title>` is `"PropelIQ Health"` — update if needed
- [ ] Update `/.devcontainer/post-create.sh` to include `cd e2e && npm ci && npx playwright install chromium --with-deps && cd ..`
- [ ] Run `npx playwright test tests/smoke/` with SPA running — confirm 1 test passes < 30s
