---
title: "Task — React Router SPA Route Manifest with 404 Fallback + Vite /api Proxy"
task_id: task_003
story_id: us_001
epic: EP-TECH
layer: Frontend
status: Not Started
date: 2026-04-20
---

# Task - task_003

## Requirement Reference
- User Story: [us_001] — React 18 + TypeScript + TailwindCSS SPA Scaffold
- Story Location: `.propel/context/tasks/EP-TECH/us_001/us_001.md`
- Acceptance Criteria:
  - AC-5: React Router configured with a catch-all fallback route; navigating to an undefined path renders a 404 fallback page without a full browser reload and without a JavaScript console error
  - AC-6: Vite proxy rule for `/api` — `fetch('/api/health')` from the SPA is proxied to `http://localhost:5000/api/health` and returns the response without CORS errors
  - Edge Case 2: Backend API unreachable → Vite proxy returns HTTP 502; SPA renders non-blocking toast ("API unavailable — please retry") without crashing or triggering an unhandled error boundary

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
| **Design Tokens** | N/A — design tokens in task_002 |

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18.x |
| Frontend | TypeScript | 5.x |
| Build Tool | Vite | 5.x |
| Router | React Router DOM | 6.x |
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
Install React Router DOM v6, configure a `createBrowserRouter` route manifest in the SPA, and wire a catch-all `path="*"` fallback that renders a `NotFoundPage` component without a browser reload or JavaScript console error. Update `vite.config.ts` to add a `/api` proxy rule forwarding all `/api/*` requests to `http://localhost:5000`. Implement a lightweight API health check on app mount that triggers a non-blocking toast notification when the backend returns a non-2xx response or is unreachable (502), without crashing the app or triggering the React error boundary.

## Dependent Tasks
- `task_001_fe_vite_react_typescript_scaffold.md` — must be complete; Vite project, `App.tsx`, and `vite.config.ts` must exist.
- `task_002_fe_tailwind_design_tokens.md` — should be complete so the `NotFoundPage` and toast can use design token classes; if running in parallel, use placeholder inline classes (swap to tokens after task_002 merges).

## Impacted Components
- `/client/vite.config.ts` — MODIFY: add `server.proxy` rule for `/api`
- `/client/src/App.tsx` — MODIFY: replace placeholder shell with `RouterProvider` + `createBrowserRouter` route manifest
- `/client/src/routes/index.tsx` — CREATE: route definitions with lazy page imports and `*` catch-all
- `/client/src/pages/NotFoundPage.tsx` — CREATE: 404 fallback page component
- `/client/src/components/Toast.tsx` — CREATE: minimal toast notification component (non-blocking, design-token-styled)
- `/client/src/hooks/useApiHealth.ts` — CREATE: custom hook calling `GET /api/health` on mount with 502 toast trigger
- `/client/src/main.tsx` — no change (router is wired via `App.tsx`)

## Implementation Plan

1. **Install React Router DOM v6**:
   ```bash
   cd /client && npm install react-router-dom@6
   ```

2. **Create route manifest** at `src/routes/index.tsx`:
   - Use `createBrowserRouter` with `React.lazy` for all page imports
   - Route entries: `/` (placeholder `HomePage` for now — real pages added in feature epics), `*` → `NotFoundPage`
   - Wrap each lazy route in `<Suspense fallback={<div aria-busy="true" aria-label="Loading" />}>`
   - Export as `const router = createBrowserRouter([...])` — typed as `ReturnType<typeof createBrowserRouter>`

3. **Create `NotFoundPage` component** at `src/pages/NotFoundPage.tsx`:
   - Renders: heading "Page not found" + body text "The page you're looking for doesn't exist." + `<Link to="/">Go to homepage</Link>` using React Router `<Link>` (no `<a href>` hard redirect)
   - Styled with Tailwind design token classes (navy/teal palette, text tokens from task_002)
   - Confirms no `console.error` is emitted — React Router v6 catch-all routes do NOT emit errors for unknown paths (verify with a Playwright test in task validation)

4. **Update `App.tsx`** to use `RouterProvider`:
   ```tsx
   import { RouterProvider } from 'react-router-dom';
   import { router } from './routes';
   export default function App() {
     return <RouterProvider router={router} />;
   }
   ```

5. **Update `vite.config.ts`** — add `server.proxy`:
   ```ts
   server: {
     port: 3000,
     proxy: {
       '/api': {
         target: 'http://localhost:5000',
         changeOrigin: true,
         secure: false,
         configure: (proxy) => {
           proxy.on('error', (_err, _req, res) => {
             // Proxy errors (e.g., backend unreachable) respond with 502;
             // the SPA fetch call receives the 502 and handles it in useApiHealth
             if (!res.headersSent) {
               (res as import('http').ServerResponse).writeHead(502);
               (res as import('http').ServerResponse).end('Backend unreachable');
             }
           });
         },
       },
     },
   },
   ```

6. **Create minimal `Toast` component** at `src/components/Toast.tsx`:
   - Accepts `message: string` and `onDismiss: () => void` props
   - Renders as a fixed bottom-right overlay (`fixed bottom-6 right-6 z-50`) with `role="status"` and `aria-live="polite"`
   - Auto-dismisses after 5 seconds via `useEffect(() => { const t = setTimeout(onDismiss, 5000); return () => clearTimeout(t); }, [])`
   - Styled with Tailwind classes — navy background, white text, warning icon
   - This is a scaffold placeholder; full toast system (ToastProvider context) is implemented in us_056 (EP-010); this task delivers the minimal hook-triggered instance for the proxy error case only

7. **Create `useApiHealth` hook** at `src/hooks/useApiHealth.ts`:
   - On mount, calls `fetch('/api/health', { signal: AbortController signal with 5s timeout })`
   - If response is non-2xx or fetch throws (network error / 502): sets `apiUnavailable: boolean = true` state
   - Returns `{ apiUnavailable }` — the consuming component (`App.tsx`) conditionally renders the `<Toast>` when `apiUnavailable === true`
   - The hook does NOT throw — it swallows the error and sets state; the app continues rendering normally

8. **Wire `useApiHealth` in `App.tsx`**:
   ```tsx
   const { apiUnavailable } = useApiHealth();
   return (
     <>
       <RouterProvider router={router} />
       {apiUnavailable && (
         <Toast
           message="API unavailable — please retry"
           onDismiss={() => { /* reset state via callback */ }}
         />
       )}
     </>
   );
   ```

## Current Project State
```
/client/
├── package.json              # task_001: React 18, Vite 5, TS 5
├── vite.config.ts            # task_001: port 3000, path alias — WILL BE MODIFIED
├── tsconfig.json             # task_001: strict mode, @/* alias
├── tailwind.config.ts        # task_002: full design tokens
├── postcss.config.cjs        # task_002
├── src/
│   ├── index.css             # task_002: @tailwind directives
│   ├── main.tsx              # task_001 + task_002: createRoot + CSS import
│   ├── App.tsx               # task_001: Suspense shell — WILL BE MODIFIED
│   └── vite-env.d.ts         # task_001
└── .eslintrc.cjs             # task_001 + task_002: TS-eslint + no-hardcoded-style
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/client/src/routes/index.tsx` | `createBrowserRouter` manifest with lazy page imports and `*` catch-all to `NotFoundPage` |
| CREATE | `/client/src/pages/NotFoundPage.tsx` | 404 fallback page — heading + body + `<Link to="/">` — no console.error |
| CREATE | `/client/src/components/Toast.tsx` | Minimal toast component (fixed bottom-right, role="status", 5s auto-dismiss) for proxy 502 error case |
| CREATE | `/client/src/hooks/useApiHealth.ts` | Hook: `fetch('/api/health')` on mount with 5s timeout; sets `apiUnavailable` on 502/network error |
| MODIFY | `/client/src/App.tsx` | Replace Suspense placeholder with `<RouterProvider router={router} />` + conditional `<Toast>` for `apiUnavailable` |
| MODIFY | `/client/vite.config.ts` | Add `server.proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true, error → 502 } }` |
| MODIFY | `/client/package.json` | Add `react-router-dom@6` to dependencies |

## External References
- React Router v6 `createBrowserRouter` guide: https://reactrouter.com/en/main/routers/create-browser-router
- React Router v6 catch-all `path="*"` route: https://reactrouter.com/en/main/route/route#path
- React Router v6 lazy route loading: https://reactrouter.com/en/main/route/lazy
- Vite `server.proxy` configuration: https://vitejs.dev/config/server-options#server-proxy
- `http-proxy` error event (used in Vite proxy `configure`): https://github.com/http-party/node-http-proxy#error-handling
- React `AbortController` with `fetch` timeout pattern: https://developer.mozilla.org/en-US/docs/Web/API/AbortController

## Build Commands
```bash
# Install React Router DOM v6
cd /client && npm install react-router-dom@6

# Type check after changes
npx tsc --noEmit

# Dev server (proxy active when backend is running)
npm run dev

# Verify 404 route (open http://localhost:3000/undefined-page — should render NotFoundPage)
# Verify proxy (curl http://localhost:3000/api/health — proxied to :5000)
```

## Implementation Validation Strategy
- [ ] Navigate to `http://localhost:3000/undefined-page` — renders "Page not found" heading; browser console reports zero errors
- [ ] Navigate from `/undefined-page` back to `/` via the "Go to homepage" link — no full page reload (SPA navigation confirmed by React Router)
- [ ] `fetch('/api/health')` with backend running on port 5000 returns the real health response; no CORS error in browser console
- [ ] With backend stopped: `fetch('/api/health')` receives 502; `Toast` with "API unavailable — please retry" renders in the bottom-right; app does not crash or show the React error boundary
- [ ] `npx tsc --noEmit` reports zero type errors after all changes
- [ ] `npm run lint` exits 0

## Implementation Checklist
- [ ] Install `react-router-dom@6` via npm
- [ ] Create `src/routes/index.tsx` with `createBrowserRouter`: define `/` route (lazy `HomePage` placeholder) and `*` catch-all (lazy `NotFoundPage`)
- [ ] Create `src/pages/NotFoundPage.tsx`: heading + description + `<Link to="/">` — Tailwind design token classes
- [ ] Create `src/components/Toast.tsx`: `role="status"` `aria-live="polite"`, fixed bottom-right, 5s auto-dismiss via `useEffect`
- [ ] Create `src/hooks/useApiHealth.ts`: `fetch('/api/health')` with 5s `AbortController` timeout; sets `apiUnavailable` state on non-2xx or thrown error
- [ ] Update `src/App.tsx`: replace Suspense placeholder shell with `<RouterProvider router={router} />` + conditional `{apiUnavailable && <Toast .../>}`
- [ ] Update `vite.config.ts`: add `server.proxy['/api']` targeting `http://localhost:5000` with `changeOrigin: true` and proxy error handler returning 502
- [ ] Run `npx tsc --noEmit` — confirm zero errors
- [ ] Run `npm run lint` — confirm zero violations
- [ ] Manually verify: navigate to `/undefined-page` → NotFoundPage renders, zero console errors
- [ ] Manually verify: stop backend, refresh page → Toast "API unavailable" appears, app remains interactive
