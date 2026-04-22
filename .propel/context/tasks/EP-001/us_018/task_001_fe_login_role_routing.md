---
title: "Task — Login Page (SCR-001), Role-Based Route Guards, Axios Token Interceptor & Logout Flow"
task_id: task_001
story_id: us_018
epic: EP-001
layer: Frontend
status: Not Started
date: 2026-04-21
---

# Task - task_001

## Requirement Reference
- User Story: [us_018] — Shared Login Page with Role-Based Routing
- Story Location: `.propel/context/tasks/EP-001/us_018/us_018.md`
- Acceptance Criteria:
  - AC-1: On 200 from `POST /api/auth/login`, SPA reads JWT role claim and navigates to SCR-004 (Patient), SCR-011 (Staff), or SCR-019 (Admin)
  - AC-2: HTTP 401 response → display generic error banner "Invalid credentials"; no field-level error disclosure
  - AC-3/AC-4: Staff-only or Admin-only route access by lower-privilege role → SPA displays "Access denied" message; RBAC guard blocks navigation
  - AC-5: Expired access token → client silently refreshes via `POST /api/auth/refresh` and retries original request (Axios interceptor); user sees no login prompt unless refresh token is also expired
  - AC-6: "Sign out" → `POST /api/auth/logout` → clear tokens from local storage; navigate to SCR-001
- Edge Cases:
  - EC-2: Redis blocklist → second tab's next API call returns 401; Axios interceptor in both tabs redirects to login
  - EC-3: Redis unavailable on logout → HTTP 503 → error toast "Could not sign out — try again"; tokens NOT cleared; user stays on current screen

## Design References (Frontend Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **UI Impact** | Yes |
| **Figma URL** | N/A |
| **Wireframe Status** | AVAILABLE |
| **Wireframe Type** | HTML |
| **Wireframe Path/URL** | .propel/context/wireframes/Hi-Fi/wireframe-SCR-001-login.html |
| **Screen Spec** | figma_spec.md#SCR-001 |
| **UXR Requirements** | UXR-001, UXR-003, UXR-201, UXR-202, UXR-204, UXR-501, UXR-601 |
| **Design Tokens** | wireframe-shared.css (--color-teal-500, --color-navy-600, --neutral-*, --space-*, --shadow-2, --radius-xl, --color-error, --color-error-bg) |

### CRITICAL: Wireframe Implementation Requirement
**Wireframe Status = AVAILABLE** — MUST reference `.propel/context/wireframes/Hi-Fi/wireframe-SCR-001-login.html` during implementation:
- `max-w-[440px]` centered auth card; teal 56×56 logo mark; `h1` "PropelIQ Health"; subtitle "Unified Patient Access Platform"
- `h2` "Sign in"; `p.sub` "Enter your credentials to access the platform."
- `#error-banner` — `role="alert"` hidden by default; shown (not field-specific) on 401 with text "Incorrect email or password. Please try again."
- `#email` — `type="email"`, `autocomplete="email"`, `aria-required="true"`
- `#password` — `type="password"`, `autocomplete="current-password"`, `aria-required="true"` + "Forgot password?" link aligned right
- `#btn-login` — `btn-primary btn-lg w-full`; on click → disabled + spinner (UXR-501); navigates to role-based dashboard on 200
- `#link-register` — "Create account" link → `/register`
- MUST implement states: Default, Loading (spinner on button after click), Error (error-banner visible)
- No field-level errors on login — only banner-level error (AC-2/UXR-201)

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18.x |
| Language | TypeScript | 5.x |
| Styling | TailwindCSS | 3.4.x |
| Routing | React Router | 6.x |
| HTTP Client | Axios | 1.x |
| Build | Vite | 5.x |
| State | React Context / localStorage | N/A |
| AI/ML | N/A | N/A |
| Mobile | N/A | N/A |

## AI References (AI Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |

## Mobile References (Mobile Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |
| **Platform Target** | N/A |

## Task Overview
Implement the SCR-001 `LoginPage` component matching the wireframe, an `AuthContext` that stores access/refresh tokens and exposes the current user's role, role-based route guards (`RequireRole` component) protecting the three dashboard routes, an Axios interceptor that silently refreshes expired access tokens (AC-5), and logout flow with error handling for Redis 503 (EC-3).

## Dependent Tasks
- `us_017 task_001` — `EmailVerificationPage` and `/register` route already created; `api/auth.ts` with `ApiError` class exists and will be extended
- `us_005` (EP-TECH) — Backend JWT issuance infrastructure; JWT role claim `"role"` in payload

## Impacted Components
- `/web/src/pages/auth/LoginPage.tsx` — CREATE: SCR-001 form component
- `/web/src/context/AuthContext.tsx` — CREATE: auth state (accessToken, refreshToken, user role/id); login, logout, refreshToken actions
- `/web/src/api/auth.ts` — MODIFY: add `loginUser()`, `logoutUser()`, `refreshAccessToken()` functions
- `/web/src/api/axiosInstance.ts` — CREATE: Axios instance with request interceptor (attach Bearer token) + response interceptor (401 → silent refresh → retry)
- `/web/src/components/auth/RequireRole.tsx` — CREATE: route guard; wraps protected routes; renders "Access denied" on role mismatch (AC-3/AC-4)
- `/web/src/router.tsx` — MODIFY: wrap dashboard routes with `<RequireRole>`; add `/login` → `LoginPage`
- `/web/src/utils/jwtUtils.ts` — CREATE: `decodeJwtPayload()`, `getJwtRole()`, `isJwtExpired()` helpers

## Implementation Plan

1. **Create `jwtUtils.ts`** — lightweight JWT decode (no external library needed for HS256 payload read):
   ```typescript
   // /web/src/utils/jwtUtils.ts
   interface JwtPayload {
     sub: string;       // userId
     role: 'Patient' | 'Staff' | 'Admin';
     jti: string;       // JWT ID for blocklist
     exp: number;       // expiry epoch seconds
   }

   export function decodeJwtPayload(token: string): JwtPayload {
     const base64Url = token.split('.')[1];
     const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
     return JSON.parse(atob(base64)) as JwtPayload;
   }

   export function getJwtRole(token: string): JwtPayload['role'] {
     return decodeJwtPayload(token).role;
   }

   export function isJwtExpired(token: string): boolean {
     const { exp } = decodeJwtPayload(token);
     return Date.now() / 1000 >= exp;
   }
   ```
   > **Note**: Only the payload is decoded for role/expiry inspection. Signature verification occurs server-side — client-side decode is for routing purposes only (OWASP A01 — authorisation decisions are always enforced at the API).

2. **Create `AuthContext.tsx`** — global auth state with React Context:
   ```typescript
   // /web/src/context/AuthContext.tsx
   interface AuthState {
     accessToken: string | null;
     refreshToken: string | null;
     userId: string | null;
     role: 'Patient' | 'Staff' | 'Admin' | null;
   }

   interface AuthContextValue extends AuthState {
     login: (accessToken: string, refreshToken: string) => void;
     logout: () => void;
     setNewAccessToken: (accessToken: string) => void;
   }

   export const AuthContext = createContext<AuthContextValue | null>(null);

   export function AuthProvider({ children }: { children: ReactNode }) {
     // Initialise from localStorage on mount (persist across page reload)
     const [state, setState] = useState<AuthState>(() => {
       const accessToken = localStorage.getItem('access_token');
       const refreshToken = localStorage.getItem('refresh_token');
       if (accessToken && !isJwtExpired(accessToken)) {
         const { sub: userId, role } = decodeJwtPayload(accessToken);
         return { accessToken, refreshToken, userId, role };
       }
       return { accessToken: null, refreshToken: null, userId: null, role: null };
     });

     const login = useCallback((accessToken: string, refreshToken: string) => {
       localStorage.setItem('access_token', accessToken);
       localStorage.setItem('refresh_token', refreshToken);
       const { sub: userId, role } = decodeJwtPayload(accessToken);
       setState({ accessToken, refreshToken, userId, role });
     }, []);

     const logout = useCallback(() => {
       localStorage.removeItem('access_token');
       localStorage.removeItem('refresh_token');
       setState({ accessToken: null, refreshToken: null, userId: null, role: null });
     }, []);

     const setNewAccessToken = useCallback((accessToken: string) => {
       localStorage.setItem('access_token', accessToken);
       const { sub: userId, role } = decodeJwtPayload(accessToken);
       setState(prev => ({ ...prev, accessToken, userId, role }));
     }, []);

     return (
       <AuthContext.Provider value={{ ...state, login, logout, setNewAccessToken }}>
         {children}
       </AuthContext.Provider>
     );
   }

   export function useAuth(): AuthContextValue {
     const ctx = useContext(AuthContext);
     if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
     return ctx;
   }
   ```

3. **Create `axiosInstance.ts`** — request + response interceptors (AC-5, EC-2, EC-3):
   ```typescript
   // /web/src/api/axiosInstance.ts
   import axios, { AxiosError } from 'axios';

   export const apiClient = axios.create({ baseURL: '/api' });

   // Request interceptor: attach Bearer token from localStorage
   apiClient.interceptors.request.use(config => {
     const token = localStorage.getItem('access_token');
     if (token) config.headers.Authorization = `Bearer ${token}`;
     return config;
   });

   // Response interceptor: handle 401 token_expired → silent refresh → retry
   let isRefreshing = false;
   let refreshSubscribers: Array<(token: string) => void> = [];

   function onRefreshed(token: string) {
     refreshSubscribers.forEach(cb => cb(token));
     refreshSubscribers = [];
   }

   apiClient.interceptors.response.use(
     res => res,
     async (error: AxiosError) => {
       const originalRequest = error.config as typeof error.config & { _retry?: boolean };

       if (error.response?.status === 401 && !originalRequest._retry) {
         // Check WWW-Authenticate header for token_expired signal (AC-5)
         const wwwAuth = error.response.headers['www-authenticate'] ?? '';
         const isExpired = wwwAuth.includes('token_expired');

         if (isExpired) {
           originalRequest._retry = true;

           if (isRefreshing) {
             // Queue subsequent 401s until refresh completes
             return new Promise<string>(resolve => { refreshSubscribers.push(resolve); })
               .then(newToken => {
                 originalRequest.headers!.Authorization = `Bearer ${newToken}`;
                 return apiClient(originalRequest);
               });
           }

           isRefreshing = true;
           try {
             const refreshToken = localStorage.getItem('refresh_token');
             if (!refreshToken) throw new Error('No refresh token');
             const { data } = await axios.post('/api/auth/refresh', { refreshToken });
             const newAccessToken: string = data.access_token;
             localStorage.setItem('access_token', newAccessToken);
             onRefreshed(newAccessToken);
             originalRequest.headers!.Authorization = `Bearer ${newAccessToken}`;
             return apiClient(originalRequest);
           } catch {
             // Refresh token also expired — force logout
             localStorage.removeItem('access_token');
             localStorage.removeItem('refresh_token');
             window.location.href = '/login';
             return Promise.reject(error);
           } finally {
             isRefreshing = false;
           }
         }

         // Non-expired 401 (e.g. blocklist hit — EC-2) → force logout
         localStorage.removeItem('access_token');
         localStorage.removeItem('refresh_token');
         window.location.href = '/login';
       }

       return Promise.reject(error);
     }
   );
   ```
   > The `isRefreshing` flag and `refreshSubscribers` queue prevent multiple simultaneous refresh calls when several requests expire concurrently (thundering herd prevention).

4. **Extend `api/auth.ts`** with login, logout, refresh functions:
   ```typescript
   // Add to /web/src/api/auth.ts (existing file from us_017):

   export async function loginUser(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
     const res = await fetch('/api/auth/login', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ email, password }),
     });
     if (res.status === 401) throw new ApiError(401, 'Invalid credentials.');
     if (!res.ok) throw new ApiError(res.status, 'Login failed. Please try again.');
     const data = await res.json();
     return { accessToken: data.access_token, refreshToken: data.refresh_token };
   }

   export async function logoutUser(accessToken: string, refreshToken: string): Promise<void> {
     const res = await fetch('/api/auth/logout', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
       body: JSON.stringify({ refreshToken }),
     });
     if (res.status === 503) throw new ApiError(503, 'Could not sign out — try again.');
     // Other non-ok responses: still allow client-side logout (token cleanup)
   }

   export async function refreshAccessToken(refreshToken: string): Promise<string> {
     const res = await fetch('/api/auth/refresh', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ refreshToken }),
     });
     if (!res.ok) throw new ApiError(res.status, 'Session expired. Please log in again.');
     const data = await res.json();
     return data.access_token as string;
   }
   ```

5. **Create `LoginPage.tsx`** (AC-1, AC-2) — matches SCR-001 wireframe exactly:
   - **Layout**: `max-w-[440px]` centered; logo mark (teal 56×56); `h1` "PropelIQ Health"; subtitle "Unified Patient Access Platform"
   - **Error banner** `id="error-banner"` `role="alert"`: hidden when no error; visible with text "Incorrect email or password. Please try again." on 401 (AC-2/UXR-201); NOT field-specific
   - **Email field** `id="email"`: `type="email"`, `autocomplete="email"`, `aria-required="true"`
   - **Password field** `id="password"`: `type="password"`, `autocomplete="current-password"`, `aria-required="true"`; "Forgot password?" link aligned right below field
   - **Submit button** `id="btn-login"`: on click → immediately `disabled + spinner` (UXR-501 — ≤ 200 ms press feedback); on 200 → role-based navigation (AC-1):
     - `role === 'Patient'` → `navigate('/dashboard/patient')`
     - `role === 'Staff'` → `navigate('/dashboard/staff')`
     - `role === 'Admin'` → `navigate('/dashboard/admin')`
   - **"Create account" link** `id="link-register"` → `<Link to="/register">`
   - On any error → re-enable button and clear spinner

   ```typescript
   // Role-based navigation logic in LoginPage submit handler:
   const ROLE_ROUTES: Record<'Patient' | 'Staff' | 'Admin', string> = {
     Patient: '/dashboard/patient',
     Staff:   '/dashboard/staff',
     Admin:   '/dashboard/admin',
   };

   const handleSubmit = async (e: FormEvent) => {
     e.preventDefault();
     setIsLoading(true);
     setError(null);
     try {
       const { accessToken, refreshToken } = await loginUser(email, password);
       auth.login(accessToken, refreshToken);
       const role = getJwtRole(accessToken);
       navigate(ROLE_ROUTES[role]);
     } catch (err) {
       if (err instanceof ApiError && err.status === 401) {
         setError('Invalid credentials.');
       } else {
         setError('Login failed. Please try again.');
       }
     } finally {
       setIsLoading(false);
     }
   };
   ```

6. **Create `RequireRole.tsx`** — route guard component (AC-3, AC-4):
   ```typescript
   // /web/src/components/auth/RequireRole.tsx
   interface RequireRoleProps {
     allowedRoles: Array<'Patient' | 'Staff' | 'Admin'>;
     children: ReactNode;
   }

   export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
     const { role, accessToken } = useAuth();

     // Not authenticated at all → redirect to login
     if (!accessToken || !role) return <Navigate to="/login" replace />;

     // Authenticated but wrong role → "Access denied" (AC-3/AC-4)
     if (!allowedRoles.includes(role)) {
       return (
         <div className="flex items-center justify-center min-h-screen">
           <div className="text-center p-8">
             <h2 className="text-xl font-semibold text-neutral-800">Access denied</h2>
             <p className="text-neutral-500 mt-2">You do not have permission to view this page.</p>
             <Link to="/login" className="mt-4 inline-block text-teal-600 underline">Return to sign in</Link>
           </div>
         </div>
       );
     }

     return <>{children}</>;
   }
   ```

7. **Implement logout flow in a `useLogout` hook** (AC-6, EC-3):
   ```typescript
   // /web/src/hooks/useLogout.ts
   export function useLogout() {
     const auth = useAuth();
     const navigate = useNavigate();
     const [isLoggingOut, setIsLoggingOut] = useState(false);

     const logout = useCallback(async () => {
       setIsLoggingOut(true);
       try {
         if (auth.accessToken && auth.refreshToken) {
           await logoutUser(auth.accessToken, auth.refreshToken);
         }
         auth.logout();          // clear tokens from context + localStorage
         navigate('/login');     // AC-6: navigate to SCR-001
       } catch (err) {
         if (err instanceof ApiError && err.status === 503) {
           // EC-3: Redis unavailable — show error toast; do NOT clear tokens
           showToast('Could not sign out — try again.');
           setIsLoggingOut(false);
           return;
         }
         // Non-503 error: still clear client-side tokens and redirect
         auth.logout();
         navigate('/login');
       } finally {
         setIsLoggingOut(false);
       }
     }, [auth, navigate]);

     return { logout, isLoggingOut };
   }
   ```
   > EC-3: On HTTP 503 the client tokens are NOT cleared — user stays on current screen with error toast. On any other error, tokens are cleared (silent security assumption: server-side logout may have partially succeeded).

8. **Update `router.tsx`** — add `/login`, wrap dashboards with `<RequireRole>`:
   ```typescript
   // Route configuration additions:
   { path: '/login', element: <LoginPage /> },
   {
     path: '/dashboard/patient',
     element: <RequireRole allowedRoles={['Patient']}><PatientDashboard /></RequireRole>
   },
   {
     path: '/dashboard/staff',
     element: <RequireRole allowedRoles={['Staff', 'Admin']}><StaffDashboard /></RequireRole>
   },
   {
     path: '/dashboard/admin',
     element: <RequireRole allowedRoles={['Admin']}><AdminDashboard /></RequireRole>
   },
   // Root redirect based on auth state:
   { path: '/', element: <Navigate to="/login" replace /> },
   ```

## Current Project State
```
/web/src/
├── pages/auth/
│   ├── LoginPage.tsx          # NOT YET CREATED — this task
│   ├── RegistrationPage.tsx   # CREATED (us_017 task_001)
│   └── EmailVerificationPage.tsx  # CREATED (us_017 task_001)
├── context/
│   └── AuthContext.tsx        # NOT YET CREATED — this task
├── api/
│   ├── auth.ts                # CREATED (us_017); MODIFY — add loginUser, logoutUser, refreshAccessToken
│   └── axiosInstance.ts       # NOT YET CREATED — this task
├── components/auth/
│   └── RequireRole.tsx        # NOT YET CREATED — this task
├── hooks/
│   ├── useRegistrationForm.ts # CREATED (us_017 task_001)
│   └── useLogout.ts           # NOT YET CREATED — this task
├── utils/
│   └── jwtUtils.ts            # NOT YET CREATED — this task
└── router.tsx                 # MODIFY — add /login route, wrap dashboards
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/web/src/pages/auth/LoginPage.tsx` | SCR-001: email/password fields, error banner (no field discrimination), disabled+spinner on submit, role-based navigate on 200 |
| CREATE | `/web/src/context/AuthContext.tsx` | Auth state (tokens, userId, role); `login()`, `logout()`, `setNewAccessToken()`; localStorage persistence |
| CREATE | `/web/src/api/axiosInstance.ts` | Axios instance with Bearer token request interceptor; 401+`token_expired` → silent refresh+retry; non-recoverable 401 → redirect to `/login` |
| MODIFY | `/web/src/api/auth.ts` | Add `loginUser()`, `logoutUser()`, `refreshAccessToken()` functions |
| CREATE | `/web/src/components/auth/RequireRole.tsx` | Role guard: unauthenticated → `/login` redirect; wrong role → "Access denied" render |
| CREATE | `/web/src/hooks/useLogout.ts` | Logout orchestration: `POST /api/auth/logout`; 503 → toast, no token clear; other errors → clear tokens + navigate |
| CREATE | `/web/src/utils/jwtUtils.ts` | `decodeJwtPayload()`, `getJwtRole()`, `isJwtExpired()` — client-side decode only (routing, not auth enforcement) |
| MODIFY | `/web/src/router.tsx` | Add `/login`, wrap `/dashboard/patient|staff|admin` with `<RequireRole>` |

## External References
- SCR-001 wireframe: `.propel/context/wireframes/Hi-Fi/wireframe-SCR-001-login.html`
- figma_spec.md#SCR-001 (states: Default, Loading, Error): `.propel/context/docs/figma_spec.md`
- UXR-501 (button press state ≤ 200 ms, spinner for latency > 500 ms): `.propel/context/docs/figma_spec.md`
- UXR-201 (accessible error state — banner-level, no field disambiguation): `.propel/context/docs/figma_spec.md`

## Implementation Validation Strategy
- [ ] `LoginPage` renders matching SCR-001 wireframe: logo mark, h1, h2, email+password fields, "Sign in" button, "Create account" link
- [ ] Clicking "Sign in" immediately disables button and shows spinner (UXR-501 — ≤ 200 ms visual feedback)
- [ ] Mock `POST /api/auth/login` returning 401 → error banner visible; no field-level error; button re-enabled
- [ ] Mock returning 200 with `role=Patient` JWT → navigate to `/dashboard/patient` (AC-1)
- [ ] Mock returning 200 with `role=Staff` JWT → navigate to `/dashboard/staff`
- [ ] Mock returning 200 with `role=Admin` JWT → navigate to `/dashboard/admin`
- [ ] Navigate to `/dashboard/staff` while `role=Patient` → "Access denied" rendered (AC-3)
- [ ] Navigate to `/dashboard/admin` while `role=Staff` → "Access denied" rendered (AC-4)
- [ ] Navigate to any protected route with no token → redirect to `/login`
- [ ] Mock expired token 401 with `WWW-Authenticate: Bearer error="token_expired"` → Axios interceptor calls refresh, retries original request silently (AC-5)
- [ ] Mock refresh token 401 → forced redirect to `/login`
- [ ] `POST /api/auth/logout` returns 503 → error toast shown; tokens NOT cleared from localStorage (EC-3)

## Implementation Checklist
- [ ] **[MANDATORY]** Reference SCR-001 wireframe during implementation — match `max-w-[440px]`, logo mark, error banner `role="alert"` with text "Incorrect email or password. Please try again.", password field "Forgot password?" link, button layout
- [ ] `LoginPage` error state: banner only — NEVER show which field is wrong (AC-2/OWASP A07)
- [ ] `AuthContext` persists tokens in `localStorage` and rehydrates on mount; expired access token on mount does NOT set `role` in state
- [ ] `axiosInstance` `isRefreshing` flag prevents thundering-herd on concurrent 401s
- [ ] `RequireRole` enforces role check in React Router for all three dashboard paths (AC-3, AC-4)
- [ ] `useLogout` does NOT clear tokens on HTTP 503 (EC-3 — Redis unavailable must not silently succeed)
- [ ] `jwtUtils.ts` decode is for client-side routing only — comment explicitly states server-side enforcement is authoritative (OWASP A01)
- [ ] All `ROLE_ROUTES` mapping is exhaustive (`Patient | Staff | Admin`) — TypeScript exhaustive check via `Record<>` type
- [ ] **[MANDATORY]** Run `/analyze-ux` after implementation to verify wireframe alignment
