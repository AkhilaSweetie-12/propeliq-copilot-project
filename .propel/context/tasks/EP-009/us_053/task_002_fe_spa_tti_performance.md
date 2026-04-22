---
title: "Task — FE SPA Performance: Critical CSS Inline, Route-Based Code Splitting, Cache-Control Headers & Lighthouse CI TTI < 3s"
task_id: task_002
story_id: us_053
epic: EP-009
layer: Frontend
status: Not Started
date: 2026-04-22
---

# Task - task_002 — FE SPA Performance: Critical CSS Inline, Route-Based Code Splitting, Cache-Control Headers & Lighthouse CI TTI < 3s

## Requirement Reference

- **User Story**: us_053
- **Story Location**: .propel/context/tasks/EP-009/us_053/us_053.md
- **Acceptance Criteria**:
  - AC-1: Lighthouse CI (v12) TTI < 3 seconds for any public entry point (`/login`, `/register`) on broadband (≥ 10 Mbps); achieved through: (a) SPA shell `index.html` inlines critical CSS (above-the-fold typography, topbar, login card styles) via `vite-plugin-critical` or manual `<style>` injection at build time; (b) every route beyond login shell is a lazily loaded chunk via `React.lazy` + `Suspense`; (c) all content-hashed assets served with `Cache-Control: public, max-age=31536000, immutable`; (d) ASP.NET Core static files middleware configured to serve pre-compressed `.gz` and `.br` variants from Vite `dist/`; Lighthouse CI check runs on every PR targeting `main`; fails PR if TTI ≥ 3s (NFR-002)
  - AC-5 (partial): Lighthouse CI reports TTI < 3 seconds for SCR-001 (Login) and SCR-004 (Patient Dashboard) on simulated broadband (10 Mbps) (NFR-002)

- **Edge Cases**:
  - Edge Case: Lazy-loaded chunk fails to load mid-session (network interruption) → `Suspense` error boundary catches chunk-loading failure; displays full-page error state with "Retry" button (UXR-603 from EP-010); `window.location.reload()` on retry; `Cache-Control: immutable` headers ensure chunk served from browser cache on retry if network recovered
  - Edge Case: Lighthouse CI TTI flaky on slow CI runner → config uses `--preset=desktop` with 10 Mbps simulated connection (not default slow 4G); 200ms tolerance buffer (`assert.ttiFastEnough: [warn, {minScore: 0.9}]` — TTI < 3.2s tolerated, < 3.0s passes); 3 sequential runs; median value used if flakiness persists; methodology documented in `README.md`

---

## Design References

| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes — affects how the SPA shell loads (critical CSS inlining, code split boundaries) |
| **Figma URL** | N/A |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-001-login.html (above-the-fold styles reference) |
| **Screen Spec** | SCR-001 (Login) — primary entry point; SCR-004 (Patient Dashboard) — authenticated entry |
| **UXR Requirements** | NFR-002 (SPA TTI < 3s) |
| **Design Tokens** | Critical CSS: topbar styles, login card, typography (from `tailwind.config.ts` via us_053 task_001) |

---

## Applicable Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React 18 + TypeScript 5 | — |
| Build | Vite | — |
| Styling | TailwindCSS 3.x | — |
| Compression | `vite-plugin-compression` (gzip + brotli) | — |
| Critical CSS | `vite-plugin-critical` or manual `<style>` injection | — |
| Backend | ASP.NET Core 9 static files middleware | .NET 9 |
| Performance CI | Lighthouse CI (`@lhci/cli`) | v12 |

---

## AI References

| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |
| **AI Pattern** | N/A |
| **Prompt Template Path** | N/A |
| **Guardrails Config** | N/A |
| **Model Provider** | N/A |

---

## Mobile References

| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | Yes — TTI < 3s on broadband applies to all entry points including mobile browser; 44px touch targets (enforced in us_051/us_052) |
| **Platform Target** | Web (SPA) |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

---

## Task Overview

Optimise the Vite production build for SPA Time-to-Interactive below 3 seconds. Configure `vite-plugin-critical` (or manual inline `<style>`) to extract and inline above-the-fold CSS into `index.html`. Implement `React.lazy` + `Suspense` route-based code splitting for all routes beyond the login shell. Configure `vite-plugin-compression` to emit `.gz` and `.br` variants for all assets. Update ASP.NET Core static files middleware to serve pre-compressed files and add `Cache-Control: public, max-age=31536000, immutable` headers on content-hashed assets. Wire Lighthouse CI into GitHub Actions to measure TTI on `/login` and `/dashboard` on every PR.

---

## Dependent Tasks

- US_001 (EP-TECH) — React 18 + Vite SPA scaffold; existing route definitions; ASP.NET Core static files serving
- us_053 task_001 (EP-009) — Vite production bundle relies on tokenised TailwindCSS build; critical CSS extraction depends on populated `tailwind.config.ts`

---

## Impacted Components

| Component | Action | Notes |
|-----------|--------|-------|
| `client/vite.config.ts` | MODIFY | Add `vite-plugin-critical` (inline CSS extraction); add `vite-plugin-compression` (gzip + brotli); configure `build.rollupOptions.output.manualChunks` if needed |
| `client/src/router/AppRouter.tsx` (or equivalent) | MODIFY | Wrap every non-login route in `React.lazy()` + `<Suspense>` with fallback; keep login shell eager-loaded |
| `client/src/components/shared/ErrorBoundary.tsx` | CREATE OR MODIFY | Catch `ChunkLoadError` / lazy import failure; display "Retry" button calling `window.location.reload()` |
| `Server/Program.cs` | MODIFY | Configure `StaticFiles` with custom `ResponseHeadersMiddleware` adding `Cache-Control: public, max-age=31536000, immutable` on content-hashed assets; configure `UseStaticFiles` to serve `.gz`/`.br` with `EnableEncodingDetection` |
| `Server/StaticFilesOptions.cs` | CREATE OR MODIFY | Custom `StaticFileResponseContext` handler: if filename contains content hash pattern → add immutable cache header; configure `FileExtensionContentTypeProvider` for `.br` |
| `.github/workflows/lighthouse-ci.yml` | CREATE | GitHub Actions workflow: build SPA, serve locally, run `lhci autorun` against `/login` + `/dashboard`; `--preset=desktop`; 10 Mbps throttle; fails PR if TTI ≥ 3.0s (3.2s tolerance) |
| `lighthouserc.json` | CREATE | Lighthouse CI config: `assert.ttiFastEnough`, `preset: desktop`, `url: ['/login', '/dashboard']`, `numberOfRuns: 3`, median strategy |

---

## Implementation Plan

1. Install `vite-plugin-compression` (`npm install --save-dev vite-plugin-compression`); configure in `vite.config.ts` to emit `.gz` (gzip threshold 1024 bytes) and `.br` (brotli threshold 1024 bytes) alongside all CSS/JS assets in `dist/`

2. Configure critical CSS inlining: attempt `vite-plugin-critical` (`npm install --save-dev vite-plugin-critical`); configure plugin to extract above-the-fold CSS (topbar height, login card, body font, background colour) and inline as `<style>` in `index.html`; if `vite-plugin-critical` does not produce acceptable output, manually identify above-the-fold styles and inject as a `<style>` block in `index.html` template via Vite's `transformIndexHtml` hook

3. Implement route-based code splitting in `AppRouter.tsx`:
   ```tsx
   // Eager load (login shell)
   import LoginPage from '../features/auth/LoginPage';
   import RegisterPage from '../features/auth/RegisterPage';
   
   // Lazy load all other routes
   const PatientDashboard = React.lazy(() => import('../features/patients/PatientDashboard'));
   const BookingCalendar = React.lazy(() => import('../features/booking/BookingCalendar'));
   // ... all other routes
   
   <Routes>
     <Route path="/login" element={<LoginPage />} />
     <Route path="/register" element={<RegisterPage />} />
     <Route path="/*" element={
       <Suspense fallback={<LoadingSpinner />}>
         <AuthenticatedRoutes />
       </Suspense>
     } />
   </Routes>
   ```

4. Create or update `ErrorBoundary.tsx`: catch `ChunkLoadError` (error name contains "Loading chunk" or `error.name === 'ChunkLoadError'`); render full-page error state with "Something went wrong loading this page" message and "Retry" button (`onClick={() => window.location.reload()}`); wrap all `<Suspense>` boundaries with this error boundary

5. Update ASP.NET Core `Program.cs` static files middleware:
   - Configure `app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = ctx => { ... } })` to add `Cache-Control: public, max-age=31536000, immutable` header for any asset filename containing a content hash pattern (regex: `\.[a-f0-9]{8,}\.(js|css|woff2)$`)
   - Configure ASP.NET Core to serve pre-compressed files: `app.UseStaticFiles()` with `StaticFileOptions.ContentTypeProvider` adding `.br` → `application/x-br` type; configure response compression middleware to serve `.gz` when `Accept-Encoding: gzip` and `.br` when `Accept-Encoding: br` by checking for compressed file on disk before serving original
   - Alternatively use `Microsoft.AspNetCore.ResponseCompression` middleware with `BrotliCompressionProvider` and `GzipCompressionProvider` for runtime compression (simpler if pre-compressed serving proves complex)

6. Create `lighthouserc.json`:
   ```json
   {
     "ci": {
       "collect": {
         "url": ["http://localhost:4173/login", "http://localhost:4173/dashboard"],
         "numberOfRuns": 3,
         "settings": {
           "preset": "desktop",
           "throttling": { "downloadThroughputKbps": 10240, "uploadThroughputKbps": 10240 }
         }
       },
       "assert": {
         "assertions": {
           "interactive": ["error", { "maxNumericValue": 3000 }]
         }
       }
     }
   }
   ```

7. Create `.github/workflows/lighthouse-ci.yml`: trigger `on: pull_request` targeting `main`; steps: checkout, install Node, `npm run build` in `client/`, serve dist with `npx vite preview` or `serve`, run `npx lhci autorun --config=lighthouserc.json`; fail workflow if any TTI assertion fails; upload Lighthouse report as artifact

8. Verify bundle output: run `npm run build -- --report` or Rollup bundle visualiser; confirm login shell bundle < 50KB gzipped; confirm all route chunks are emitted as separate files with content hashes in filenames

---

## Current Project State

```
client/
├── vite.config.ts               ← MODIFY (critical CSS plugin, compression plugin)
├── index.html                   ← MODIFY (critical CSS <style> inline if manual)
├── lighthouserc.json            ← CREATE
└── src/router/AppRouter.tsx     ← MODIFY (React.lazy + Suspense for all non-login routes)

Server/
└── Program.cs                   ← MODIFY (Cache-Control headers; pre-compressed serving)

.github/workflows/
└── lighthouse-ci.yml            ← CREATE
```

---

## Expected Changes

| Action | File Path | Description |
|--------|-----------|-------------|
| MODIFY | `client/vite.config.ts` | `vite-plugin-critical` (critical CSS inline); `vite-plugin-compression` (gzip + brotli) |
| MODIFY | `client/src/router/AppRouter.tsx` | `React.lazy()` + `<Suspense>` for all non-login routes |
| CREATE | `client/src/components/shared/ErrorBoundary.tsx` | Catch `ChunkLoadError`; "Retry" button → `window.location.reload()` |
| MODIFY | `Server/Program.cs` | `Cache-Control: public, max-age=31536000, immutable` on hashed assets; pre-compressed `.gz`/`.br` serving |
| CREATE | `lighthouserc.json` | Lighthouse CI config: desktop preset, 10 Mbps throttle, TTI < 3000ms assertion |
| CREATE | `.github/workflows/lighthouse-ci.yml` | GitHub Actions: build + serve + `lhci autorun`; fails PR on TTI ≥ 3s |

---

## External References

- [Lighthouse CI — Getting Started](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md)
- [Vite — Code Splitting with React.lazy](https://vitejs.dev/guide/build.html#chunking-strategy)
- [vite-plugin-compression — gzip and brotli](https://github.com/vbenjs/vite-plugin-compression)
- [ASP.NET Core — Static Files with Cache-Control headers](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/static-files)
- [web.dev — Time to Interactive](https://web.dev/tti/)

---

## Build Commands

- `cd client && npm run build`
- `cd client && npx vite preview`
- `npx lhci autorun --config=lighthouserc.json`
- `cd Server && dotnet build`

---

## Implementation Validation Strategy

- [ ] Unit tests pass
- [ ] `dist/index.html` contains an inline `<style>` block with above-the-fold CSS (topbar, login card, body font)
- [ ] `dist/assets/` contains `.gz` and `.br` variants alongside all `.js` and `.css` files
- [ ] All routes beyond login are in separate JS chunks with content-hash filenames
- [ ] Login shell JS bundle: < 50KB gzipped (verify with Rollup bundle visualiser)
- [ ] Lighthouse CI run on `/login`: TTI < 3000ms (desktop preset, 10 Mbps throttle)
- [ ] Lighthouse CI run on `/dashboard`: TTI < 3000ms
- [ ] `GET /assets/index.[hash].js` HTTP response includes `Cache-Control: public, max-age=31536000, immutable`
- [ ] `GET /assets/index.[hash].js` with `Accept-Encoding: br` → serves `.br` variant (`Content-Encoding: br`)
- [ ] `GET /assets/index.[hash].js` with `Accept-Encoding: gzip` → serves `.gz` variant (`Content-Encoding: gzip`)
- [ ] Navigation to a lazily loaded route: chunk loaded via dynamic import; no white-flash or unhandled error
- [ ] Simulated chunk load failure → `ErrorBoundary` renders "Retry" button; `window.location.reload()` on click
- [ ] GitHub Actions `lighthouse-ci.yml` workflow: passes on PR with TTI < 3s; fails on PR with deliberately inflated bundle

---

## Implementation Checklist

- [ ] Install `vite-plugin-compression` and `vite-plugin-critical` (or equivalent); configure in `vite.config.ts`
- [ ] Verify critical CSS extraction: `dist/index.html` has inline `<style>` with topbar + login card + body font styles
- [ ] Wrap all non-login routes in `React.lazy()` + `<Suspense>` in `AppRouter.tsx`; keep LoginPage and RegisterPage eager
- [ ] Create `ErrorBoundary.tsx`: catch `ChunkLoadError`; display retry UI; wrap all `<Suspense>` boundaries
- [ ] Update `Server/Program.cs`: add `Cache-Control: public, max-age=31536000, immutable` for content-hashed assets; configure pre-compressed static file serving (gzip + brotli)
- [ ] Create `lighthouserc.json`: desktop preset; 10 Mbps throttle; `interactive` max 3000ms; 3 runs; median strategy
- [ ] Create `.github/workflows/lighthouse-ci.yml`: build client; serve; `lhci autorun`; upload report artifact
- [ ] Verify bundle output: login shell < 50KB gzipped; separate route chunks with content hashes
- [ ] Document Lighthouse CI methodology (preset, throttle settings, tolerance) in project `README.md`
