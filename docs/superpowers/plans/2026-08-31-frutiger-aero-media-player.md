# Frutiger Aero Media Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TanStack Start web app where a user logs in with their own Spotify
account, the browser tab becomes a Spotify Connect playback device via the Web
Playback SDK, and a full-screen Three.js visualizer renders a Frutiger Aero
glossy chrome/glass bars-and-wave animation driven by playback position, a
best-effort tempo, and album-art color extraction.

**Architecture:** Single TanStack Start app (Vite + Vinxi/Nitro), no database.
Spotify OAuth (Authorization Code + PKCE) handled by server functions; tokens
live in a sealed, httpOnly session cookie. The client uses the Spotify Web
Playback SDK directly for transport control and playback state; a WebGL
visualizer and a glass-panel UI render on top, driven purely by derived state
(no raw audio access — Spotify's stream is DRM-protected).

**Tech Stack:** TanStack Start (`@tanstack/react-start`, `@tanstack/react-router`),
React 19, TypeScript, Vite, Three.js, Spotify Web Playback SDK, Vitest +
`@testing-library/react` for tests.

## Global Constraints

- The Web Playback SDK requires the logged-in Spotify account to have an active
  Premium subscription. Initialization fails with an `account_error` event
  otherwise — this must be handled as a first-class UI state, not an exception.
- There is no raw audio/frequency data available from Spotify under any
  circumstance (DRM). All visualizer "reactivity" is derived from playback
  position, best-effort tempo, and album-art color — never real audio analysis.
- The Spotify Audio Features endpoint (tempo) was deprecated for apps created
  after November 2024 and may return `403`. Any code that calls it must degrade
  to a default of 120 BPM and must never surface this as a user-facing error.
- As of the February 2026 Spotify Dev Mode changes, new apps are capped at 5
  manually allowlisted users and the app owner's account must carry an active
  Premium subscription or the app stops working. This is a Spotify Dashboard
  configuration step, not something this codebase needs to work around.
- Session tokens (access token, refresh token) must never be readable from
  client-side JavaScript. They live only in a sealed, httpOnly session cookie
  managed server-side. The client only ever receives a short-lived Web Playback
  SDK access token, minted on demand by a server function.
- Scope is Now Playing only: no in-app library/playlist browsing, no
  multi-preset visualizer switcher, no deployment/hosting configuration (local
  dev only for now).

---

## Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/router.tsx`
- Create: `src/routes/__root.tsx`
- Create: `src/routes/index.tsx`
- Create: `src/smoke.test.ts`
- Create: `.env.example`
- Create: `.gitignore`

**Interfaces:**
- Produces: a running dev server at `http://localhost:3000` rendering the
  placeholder index route, and a working `npm test` command. Every later task
  builds on this.

- [ ] **Step 1: Initialize the package and install dependencies**

```bash
npm init -y
npm i @tanstack/react-start @tanstack/react-router react react-dom three
npm i -D vite @vitejs/plugin-react vite-tsconfig-paths typescript \
  @types/node @types/react @types/react-dom @types/three \
  @types/spotify-web-playback-sdk \
  vitest jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "skipLibCheck": true,
    "strictNullChecks": true,
    "strict": true
  },
  "include": ["src", "vitest.setup.ts"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: { port: 3000 },
  plugins: [tsConfigPaths(), tanstackStart(), viteReact()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

If `npm run dev` fails immediately after this scaffold with a plugin error,
TanStack Start's Vite plugin API has moved since this plan was written — check
the current shape at
https://tanstack.com/start/latest/docs/framework/react/build-from-scratch
and adjust this file to match before continuing.

- [ ] **Step 4: Write `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom'

process.env.SPOTIFY_CLIENT_ID ||= 'test-client-id'
process.env.SPOTIFY_REDIRECT_URI ||= 'http://127.0.0.1:3000/callback'
process.env.SESSION_SECRET ||= 'test-session-secret-at-least-32-chars-long'
```

- [ ] **Step 5: Write `src/router.tsx`**

```tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  })
}
```

- [ ] **Step 6: Write `src/routes/__root.tsx`**

```tsx
import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Aero Media Player' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Write a placeholder `src/routes/index.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <p>Aero Media Player scaffold is running.</p>,
})
```

This will be replaced with the real Now Playing screen in Task 11.

- [ ] **Step 8: Write a smoke test to confirm the test runner works**

`src/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 9: Run the smoke test**

Run: `npx vitest run`
Expected: 1 test file, 1 test, PASS.

- [ ] **Step 10: Write `.env.example`**

```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
SESSION_SECRET=replace_with_a_long_random_string
```

- [ ] **Step 11: Write `.gitignore`**

```
node_modules
dist
.output
.vinxi
.env
src/routeTree.gen.ts
```

- [ ] **Step 12: Add scripts and `"type": "module"` to `package.json`**

Open the `package.json` written by `npm init -y` and merge in:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "test": "vitest run"
  }
}
```

- [ ] **Step 13: Verify the dev server runs**

Run: `npm run dev`, then in another terminal: `curl -s http://localhost:3000 | grep -o "Aero Media Player scaffold is running."`
Expected: the placeholder text is found in the response. Stop the dev server
afterward.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.setup.ts \
  src/router.tsx src/routes/__root.tsx src/routes/index.tsx src/smoke.test.ts \
  .env.example .gitignore
git commit -m "chore: scaffold TanStack Start app with Vitest"
```

---

## Task 2: PKCE helper

**Files:**
- Create: `src/server/pkce.ts`
- Test: `src/server/pkce.test.ts`

**Interfaces:**
- Produces: `generateCodeVerifier(): string` and
  `generateCodeChallenge(verifier: string): Promise<string>`, both consumed by
  Task 3's `spotify-auth.ts`.

- [ ] **Step 1: Write the failing test**

`src/server/pkce.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'

describe('generateCodeVerifier', () => {
  it('returns a URL-safe string of sufficient length', () => {
    const verifier = generateCodeVerifier()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('returns a different value each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier())
  })
})

describe('generateCodeChallenge', () => {
  it('is deterministic for the same verifier', async () => {
    const verifier = 'fixed-test-verifier-value-for-hashing'
    const challengeA = await generateCodeChallenge(verifier)
    const challengeB = await generateCodeChallenge(verifier)
    expect(challengeA).toBe(challengeB)
    expect(challengeA).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(challengeA).not.toContain('=')
  })

  it('differs for different verifiers', async () => {
    const challengeA = await generateCodeChallenge('verifier-one-value-xxxxxxxxxxxx')
    const challengeB = await generateCodeChallenge('verifier-two-value-yyyyyyyyyyyy')
    expect(challengeA).not.toBe(challengeB)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/server/pkce.test.ts`
Expected: FAIL — `./pkce` has no exported member `generateCodeVerifier`.

- [ ] **Step 3: Write the implementation**

`src/server/pkce.ts`:

```ts
import { webcrypto } from 'node:crypto'

const VERIFIER_BYTE_LENGTH = 64

export function generateCodeVerifier(): string {
  const bytes = webcrypto.getRandomValues(new Uint8Array(VERIFIER_BYTE_LENGTH))
  return base64UrlEncode(bytes)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await webcrypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/pkce.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/pkce.ts src/server/pkce.test.ts
git commit -m "feat: add PKCE verifier/challenge generation"
```

---

## Task 3: Spotify OAuth token exchange and login route

**Files:**
- Create: `src/server/spotify-auth.ts`
- Test: `src/server/spotify-auth.test.ts`
- Create: `src/routes/login.tsx`

**Interfaces:**
- Consumes: `generateCodeVerifier`, `generateCodeChallenge` from
  `src/server/pkce.ts` (Task 2).
- Produces: `buildAuthorizeUrl` (a `createServerFn`, no input, returns
  `Promise<string>`), `exchangeCodeForTokens(code: string, verifier: string):
  Promise<SpotifyTokens>`, `refreshAccessToken(refreshToken: string):
  Promise<SpotifyTokens>`, and the `SpotifyTokens` type
  (`{ accessToken: string; refreshToken: string; expiresAt: number }`) — all
  consumed by Task 4 (`callback.tsx`) and Task 5 (`spotify-api.ts`).

- [ ] **Step 1: Write the failing test**

`src/server/spotify-auth.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { exchangeCodeForTokens, refreshAccessToken } from './spotify-auth'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('exchangeCodeForTokens', () => {
  it('returns tokens on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
      }),
    )

    const tokens = await exchangeCodeForTokens('some-code', 'some-verifier')

    expect(tokens.accessToken).toBe('at')
    expect(tokens.refreshToken).toBe('rt')
    expect(tokens.expiresAt).toBeGreaterThan(Date.now())
  })

  it('throws when Spotify responds with a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }))

    await expect(exchangeCodeForTokens('bad-code', 'verifier')).rejects.toThrow('400')
  })
})

describe('refreshAccessToken', () => {
  it('reuses the old refresh token when Spotify does not return a new one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-at', expires_in: 3600 }),
      }),
    )

    const tokens = await refreshAccessToken('old-rt')

    expect(tokens.accessToken).toBe('new-at')
    expect(tokens.refreshToken).toBe('old-rt')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/server/spotify-auth.test.ts`
Expected: FAIL — module `./spotify-auth` does not exist.

- [ ] **Step 3: Write the implementation**

`src/server/spotify-auth.ts`:

```ts
import { createServerFn } from '@tanstack/react-start'
import { setCookie } from '@tanstack/react-start/server'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
export const PKCE_COOKIE = 'spotify_pkce_verifier'

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ')

export interface SpotifyTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export const buildAuthorizeUrl = createServerFn({ method: 'GET' }).handler(async () => {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)

  setCookie(PKCE_COOKIE, verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  })

  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`
})

export async function exchangeCodeForTokens(code: string, verifier: string): Promise<SpotifyTokens> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      code_verifier: verifier,
    }),
  })

  if (!response.ok) {
    throw new Error(`Spotify token exchange failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.SPOTIFY_CLIENT_ID!,
    }),
  })

  if (!response.ok) {
    throw new Error(`Spotify token refresh failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/spotify-auth.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the login route**

`src/routes/login.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildAuthorizeUrl } from '../server/spotify-auth'

export const Route = createFileRoute('/login')({
  loader: async () => {
    const url = await buildAuthorizeUrl()
    throw redirect({ href: url })
  },
})
```

- [ ] **Step 6: Commit**

```bash
git add src/server/spotify-auth.ts src/server/spotify-auth.test.ts src/routes/login.tsx
git commit -m "feat: add Spotify OAuth token exchange and login route"
```

---

## Task 4: Session storage and OAuth callback route

**Files:**
- Create: `src/server/session.ts`
- Create: `src/routes/callback.tsx`

**Interfaces:**
- Consumes: `exchangeCodeForTokens`, `PKCE_COOKIE`, `SpotifyTokens` from
  `src/server/spotify-auth.ts` (Task 3).
- Produces: `getSpotifySession(): Promise<{ data: Partial<SpotifySession> }>`,
  `setSpotifySession(tokens: SpotifyTokens): Promise<void>`,
  `clearSpotifySession(): Promise<void>` — all consumed by Task 5's
  `spotify-api.ts`.

- [ ] **Step 1: Verify the session API surface before writing code**

TanStack Start's session helpers have had API churn across versions. Confirm
the exact exported names in your installed version before writing
`session.ts`:

Run:
```bash
grep -rn "useSession\|updateSession\|clearSession" node_modules/@tanstack/react-start/dist/**/server*.d.ts
```

If the exported names differ from `useSession`, `updateSession`, `clearSession`
used below, adjust Step 2 to match what's actually exported.

- [ ] **Step 2: Write `src/server/session.ts`**

```ts
import { useSession, updateSession, clearSession } from '@tanstack/react-start/server'
import type { SpotifyTokens } from './spotify-auth'

export type SpotifySession = SpotifyTokens

const sessionConfig = {
  password: process.env.SESSION_SECRET!,
  name: 'aero_media_player_session',
  maxAge: 60 * 60 * 24 * 30,
}

export async function getSpotifySession() {
  return useSession<Partial<SpotifySession>>(sessionConfig)
}

export async function setSpotifySession(tokens: SpotifyTokens): Promise<void> {
  await updateSession(sessionConfig, tokens)
}

export async function clearSpotifySession(): Promise<void> {
  await clearSession(sessionConfig)
}
```

- [ ] **Step 3: Write the callback route**

`src/routes/callback.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, deleteCookie } from '@tanstack/react-start/server'
import { exchangeCodeForTokens, PKCE_COOKIE } from '../server/spotify-auth'
import { setSpotifySession } from '../server/session'

const completeLogin = createServerFn({ method: 'GET' })
  .inputValidator((data: { code?: string; error?: string }) => data)
  .handler(async ({ data }) => {
    if (data.error || !data.code) {
      throw new Error(data.error ?? 'Missing authorization code')
    }

    const verifier = getCookie(PKCE_COOKIE)
    if (!verifier) {
      throw new Error('Missing PKCE verifier cookie')
    }

    const tokens = await exchangeCodeForTokens(data.code, verifier)
    await setSpotifySession(tokens)
    deleteCookie(PKCE_COOKIE)
  })

export const Route = createFileRoute('/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  loaderDeps: ({ search }) => ({ code: search.code, error: search.error }),
  loader: async ({ deps }) => {
    await completeLogin({ data: deps })
    throw redirect({ to: '/' })
  },
})
```

- [ ] **Step 4: Register the app and configure environment variables**

This step can't be automated — it requires a human with a Spotify account:

1. Go to the Spotify Developer Dashboard and create an app.
2. Set the Redirect URI to exactly `http://127.0.0.1:3000/callback` (must
   match `SPOTIFY_REDIRECT_URI` exactly, including using `127.0.0.1` rather
   than `localhost`).
3. Under app settings, enable the Web Playback SDK / Web API as needed and
   allowlist the Spotify account(s) that will use the app (up to 5, per the
   February 2026 Dev Mode limits — see Global Constraints).
4. Copy `.env.example` to `.env` and fill in `SPOTIFY_CLIENT_ID` from the
   dashboard, and generate a `SESSION_SECRET` with:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

- [ ] **Step 5: Manually verify the OAuth round trip**

Run: `npm run dev`, visit `http://127.0.0.1:3000/login` in a browser.
Expected: redirected to Spotify's consent screen, then back to
`http://127.0.0.1:3000/` after approving. No error page.

- [ ] **Step 6: Commit**

```bash
git add src/server/session.ts src/routes/callback.tsx
git commit -m "feat: add session storage and OAuth callback route"
```

---

## Task 5: Playback token minting and auth-gated index route

**Files:**
- Modify: `src/server/spotify-api.ts` (create)
- Test: `src/server/spotify-api.test.ts` (create)
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: `getSpotifySession`, `setSpotifySession`, `clearSpotifySession`
  from `src/server/session.ts` (Task 4); `refreshAccessToken` from
  `src/server/spotify-auth.ts` (Task 3).
- Produces: `isExpiringSoon(expiresAt: number, now?: number): boolean` (pure,
  tested) and `getPlaybackToken` (a `createServerFn`, no input, returns
  `Promise<string>`) — consumed by Task 7's `usePlaybackSDK` and by
  `routes/index.tsx`'s auth gate.

- [ ] **Step 1: Write the failing test**

`src/server/spotify-api.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isExpiringSoon } from './spotify-api'

describe('isExpiringSoon', () => {
  it('is true once within the 60s buffer of expiry', () => {
    const now = 1_000_000
    expect(isExpiringSoon(now + 30_000, now)).toBe(true)
  })

  it('is false when well before expiry', () => {
    const now = 1_000_000
    expect(isExpiringSoon(now + 5 * 60_000, now)).toBe(false)
  })

  it('is true when already expired', () => {
    const now = 1_000_000
    expect(isExpiringSoon(now - 1000, now)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/server/spotify-api.test.ts`
Expected: FAIL — module `./spotify-api` does not exist.

- [ ] **Step 3: Write the implementation**

`src/server/spotify-api.ts`:

```ts
import { createServerFn } from '@tanstack/react-start'
import { getSpotifySession, setSpotifySession, clearSpotifySession } from './session'
import { refreshAccessToken } from './spotify-auth'

const EXPIRY_BUFFER_MS = 60_000

export function isExpiringSoon(expiresAt: number, now = Date.now()): boolean {
  return expiresAt - EXPIRY_BUFFER_MS <= now
}

export const getPlaybackToken = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSpotifySession()
  const { accessToken, refreshToken, expiresAt } = session.data

  if (!accessToken || !refreshToken || expiresAt === undefined) {
    throw new Error('Not authenticated')
  }

  if (isExpiringSoon(expiresAt)) {
    try {
      const refreshed = await refreshAccessToken(refreshToken)
      await setSpotifySession(refreshed)
      return refreshed.accessToken
    } catch (err) {
      await clearSpotifySession()
      throw err
    }
  }

  return accessToken
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/spotify-api.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Auth-gate the index route**

Modify `src/routes/index.tsx` (replacing the Task 1 placeholder's route
definition, keep the component as-is for now — it gets replaced in Task 11):

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getPlaybackToken } from '../server/spotify-api'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      await getPlaybackToken()
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <p>Aero Media Player scaffold is running.</p>,
})
```

- [ ] **Step 6: Manually verify the auth gate**

Run: `npm run dev`. In a browser with no session cookie, visit
`http://127.0.0.1:3000/`.
Expected: redirected to `/login`. After completing login (Task 4's flow),
visiting `/` again shows the placeholder text instead of redirecting.

- [ ] **Step 7: Commit**

```bash
git add src/server/spotify-api.ts src/server/spotify-api.test.ts src/routes/index.tsx
git commit -m "feat: mint/refresh playback tokens and auth-gate the index route"
```

---

## Task 6: Best-effort tempo lookup and playback transfer

**Files:**
- Modify: `src/server/spotify-api.ts`
- Modify: `src/server/spotify-api.test.ts`

**Interfaces:**
- Produces: `fetchTempo(trackId: string, accessToken: string): Promise<number>`
  (pure, tested), `getTempo` (a `createServerFn` taking `{ trackId: string }`,
  returns `Promise<number>`), and `transferPlaybackHere` (a `createServerFn`
  taking `{ deviceId: string }`, returns `Promise<void>`) — `getTempo` and
  `transferPlaybackHere` are consumed by Task 11's `routes/index.tsx` and
  Task 7's `usePlaybackSDK` respectively.

- [ ] **Step 1: Write the failing test**

Append to `src/server/spotify-api.test.ts`:

```ts
import { fetchTempo } from './spotify-api'
import { vi, afterEach } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchTempo', () => {
  it('returns the tempo from a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tempo: 128.4 }) }),
    )

    expect(await fetchTempo('track-1', 'token')).toBe(128.4)
  })

  it('falls back to 120 BPM on a non-ok response (e.g. deprecated-endpoint 403)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))

    expect(await fetchTempo('track-1', 'token')).toBe(120)
  })

  it('falls back to 120 BPM when the fetch itself throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    )

    expect(await fetchTempo('track-1', 'token')).toBe(120)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/server/spotify-api.test.ts`
Expected: FAIL — `fetchTempo` is not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/server/spotify-api.ts`:

```ts
const DEFAULT_BPM = 120

export async function fetchTempo(trackId: string, accessToken: string): Promise<number> {
  try {
    const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return DEFAULT_BPM

    const body = (await response.json()) as { tempo?: number }
    return typeof body.tempo === 'number' ? body.tempo : DEFAULT_BPM
  } catch {
    return DEFAULT_BPM
  }
}

export const getTempo = createServerFn({ method: 'GET' })
  .inputValidator((data: { trackId: string }) => data)
  .handler(async ({ data }) => {
    const session = await getSpotifySession()
    if (!session.data.accessToken) return DEFAULT_BPM
    return fetchTempo(data.trackId, session.data.accessToken)
  })

export const transferPlaybackHere = createServerFn({ method: 'POST' })
  .inputValidator((data: { deviceId: string }) => data)
  .handler(async ({ data }) => {
    const session = await getSpotifySession()
    if (!session.data.accessToken) return

    await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session.data.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_ids: [data.deviceId], play: true }),
    })
  })
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/spotify-api.test.ts`
Expected: PASS, 6 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/server/spotify-api.ts src/server/spotify-api.test.ts
git commit -m "feat: add best-effort tempo lookup and playback-transfer server functions"
```

---

## Task 7: Playback state mapping and Web Playback SDK hook

**Files:**
- Create: `src/client/playbackState.ts`
- Test: `src/client/playbackState.test.ts`
- Create: `src/client/usePlaybackSDK.ts`
- Test: `src/client/usePlaybackSDK.test.ts`

**Interfaces:**
- Consumes: `transferPlaybackHere` from `src/server/spotify-api.ts` (Task 6).
- Produces: `PlaybackState` type
  (`{ trackId, name, artists, albumArtUrl, progressMs, durationMs, isPlaying }`),
  `toPlaybackState(sdkState: Spotify.PlaybackState): PlaybackState`, and
  `usePlaybackSDK(getAccessToken: () => Promise<string>)` returning
  `{ state: PlaybackState | null, isActiveDevice: boolean, error:
  'account_error' | 'initialization_error' | null, togglePlay, skipNext,
  skipPrevious, seek(positionMs), setVolume(volume), playHere }` — all
  consumed by Task 11's `routes/index.tsx`.

- [ ] **Step 1: Write the failing test for `toPlaybackState`**

`src/client/playbackState.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toPlaybackState } from './playbackState'

function mockSdkState(overrides: Partial<{ paused: boolean; position: number; duration: number }> = {}) {
  return {
    paused: overrides.paused ?? false,
    position: overrides.position ?? 15000,
    duration: overrides.duration ?? 200000,
    track_window: {
      current_track: {
        id: 'track-123',
        name: 'Test Track',
        artists: [{ name: 'Artist One' }, { name: 'Artist Two' }],
        album: { images: [{ url: 'https://example.com/art.jpg' }] },
      },
    },
  } as unknown as Spotify.PlaybackState
}

describe('toPlaybackState', () => {
  it('maps track metadata and playback position', () => {
    const state = toPlaybackState(mockSdkState())

    expect(state).toEqual({
      trackId: 'track-123',
      name: 'Test Track',
      artists: 'Artist One, Artist Two',
      albumArtUrl: 'https://example.com/art.jpg',
      progressMs: 15000,
      durationMs: 200000,
      isPlaying: true,
    })
  })

  it('reports isPlaying false when the SDK reports paused', () => {
    const state = toPlaybackState(mockSdkState({ paused: true }))
    expect(state.isPlaying).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/client/playbackState.test.ts`
Expected: FAIL — module `./playbackState` does not exist.

- [ ] **Step 3: Write `src/client/playbackState.ts`**

```ts
export interface PlaybackState {
  trackId: string
  name: string
  artists: string
  albumArtUrl: string | undefined
  progressMs: number
  durationMs: number
  isPlaying: boolean
}

export function toPlaybackState(sdkState: Spotify.PlaybackState): PlaybackState {
  const track = sdkState.track_window.current_track
  return {
    trackId: track.id ?? '',
    name: track.name,
    artists: track.artists.map((artist) => artist.name).join(', '),
    albumArtUrl: track.album.images[0]?.url,
    progressMs: sdkState.position,
    durationMs: sdkState.duration,
    isPlaying: !sdkState.paused,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/client/playbackState.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the failing test for `usePlaybackSDK`**

`src/client/usePlaybackSDK.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlaybackSDK } from './usePlaybackSDK'

class FakePlayer {
  listeners = new Map<string, (payload: unknown) => void>()
  connect = vi.fn()
  disconnect = vi.fn()
  togglePlay = vi.fn()

  addListener(event: string, callback: (payload: unknown) => void) {
    this.listeners.set(event, callback)
  }

  emit(event: string, payload: unknown) {
    this.listeners.get(event)?.(payload)
  }
}

describe('usePlaybackSDK', () => {
  let fakePlayer: FakePlayer

  beforeEach(() => {
    fakePlayer = new FakePlayer()
    // @ts-expect-error test stub, not the real SDK types
    window.Spotify = { Player: vi.fn(() => fakePlayer) }
  })

  it('marks the device inactive when player_state_changed receives null', () => {
    const { result } = renderHook(() => usePlaybackSDK(async () => 'token'))

    act(() => {
      fakePlayer.emit('player_state_changed', null)
    })

    expect(result.current.isActiveDevice).toBe(false)
  })

  it('sets an account_error when the SDK reports one', () => {
    const { result } = renderHook(() => usePlaybackSDK(async () => 'token'))

    act(() => {
      fakePlayer.emit('account_error', { message: 'Premium required' })
    })

    expect(result.current.error).toBe('account_error')
  })

  it('togglePlay delegates to the underlying SDK player', () => {
    const { result } = renderHook(() => usePlaybackSDK(async () => 'token'))

    act(() => {
      result.current.togglePlay()
    })

    expect(fakePlayer.togglePlay).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/client/usePlaybackSDK.test.ts`
Expected: FAIL — module `./usePlaybackSDK` does not exist.

- [ ] **Step 7: Write `src/client/usePlaybackSDK.ts`**

```ts
import { useEffect, useRef, useState } from 'react'
import { toPlaybackState, type PlaybackState } from './playbackState'
import { transferPlaybackHere } from '../server/spotify-api'

interface PlaybackSDK {
  state: PlaybackState | null
  isActiveDevice: boolean
  error: 'account_error' | 'initialization_error' | null
  togglePlay: () => void
  skipNext: () => void
  skipPrevious: () => void
  seek: (positionMs: number) => void
  setVolume: (volume: number) => void
  playHere: () => void
}

declare global {
  interface Window {
    Spotify: typeof Spotify
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

export function usePlaybackSDK(getAccessToken: () => Promise<string>): PlaybackSDK {
  const playerRef = useRef<Spotify.Player | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const [state, setState] = useState<PlaybackState | null>(null)
  const [isActiveDevice, setIsActiveDevice] = useState(false)
  const [error, setError] = useState<'account_error' | 'initialization_error' | null>(null)

  useEffect(() => {
    function initPlayer() {
      const player = new window.Spotify.Player({
        name: 'Aero Media Player',
        getOAuthToken: (callback) => {
          getAccessToken().then(callback)
        },
        volume: 0.5,
      })

      player.addListener('ready', ({ device_id }) => {
        deviceIdRef.current = device_id
      })

      player.addListener('not_ready', () => {
        deviceIdRef.current = null
      })

      player.addListener('player_state_changed', (sdkState) => {
        if (!sdkState) {
          setIsActiveDevice(false)
          return
        }
        setIsActiveDevice(true)
        setState(toPlaybackState(sdkState))
      })

      player.addListener('account_error', () => setError('account_error'))
      player.addListener('initialization_error', () => setError('initialization_error'))

      player.connect()
      playerRef.current = player
    }

    if (window.Spotify) {
      initPlayer()
    } else {
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      document.body.appendChild(script)
      window.onSpotifyWebPlaybackSDKReady = initPlayer
    }

    return () => {
      playerRef.current?.disconnect()
    }
  }, [getAccessToken])

  return {
    state,
    isActiveDevice,
    error,
    togglePlay: () => playerRef.current?.togglePlay(),
    skipNext: () => playerRef.current?.nextTrack(),
    skipPrevious: () => playerRef.current?.previousTrack(),
    seek: (positionMs) => playerRef.current?.seek(positionMs),
    setVolume: (volume) => playerRef.current?.setVolume(volume),
    playHere: () => {
      if (deviceIdRef.current) {
        transferPlaybackHere({ data: { deviceId: deviceIdRef.current } })
      }
    },
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/client/usePlaybackSDK.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 9: Commit**

```bash
git add src/client/playbackState.ts src/client/playbackState.test.ts \
  src/client/usePlaybackSDK.ts src/client/usePlaybackSDK.test.ts
git commit -m "feat: add playback state mapping and Web Playback SDK hook"
```

---

## Task 8: Album-art palette extraction

**Files:**
- Create: `src/client/extractPalette.ts`
- Test: `src/client/extractPalette.test.ts`
- Create: `src/client/useAlbumPalette.ts`

**Interfaces:**
- Produces: `extractPalette(pixels: Uint8ClampedArray, count: number):
  string[]` (pure, tested) and `useAlbumPalette(albumArtUrl: string |
  undefined): string[]` — consumed by Task 11's `routes/index.tsx`.

- [ ] **Step 1: Write the failing test**

`src/client/extractPalette.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractPalette } from './extractPalette'

function solidColorPixels(r: number, g: number, b: number, count: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(count * 4)
  for (let i = 0; i < count; i++) {
    pixels[i * 4] = r
    pixels[i * 4 + 1] = g
    pixels[i * 4 + 2] = b
    pixels[i * 4 + 3] = 255
  }
  return pixels
}

describe('extractPalette', () => {
  it('returns the single color for a solid-color image', () => {
    const pixels = solidColorPixels(200, 40, 40, 16)
    const palette = extractPalette(pixels, 4)

    expect(palette).toHaveLength(1)
    expect(palette[0]).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('ignores fully transparent pixels', () => {
    const opaque = solidColorPixels(10, 200, 10, 8)
    const transparent = new Uint8ClampedArray(8 * 4)
    const pixels = new Uint8ClampedArray([...opaque, ...transparent])

    const palette = extractPalette(pixels, 4)

    expect(palette).toEqual(['#0ac80a'])
  })

  it('returns at most `count` colors, most frequent first', () => {
    const red = solidColorPixels(220, 20, 20, 10)
    const blue = solidColorPixels(20, 20, 220, 3)
    const pixels = new Uint8ClampedArray([...red, ...blue])

    const palette = extractPalette(pixels, 1)

    expect(palette).toHaveLength(1)
    expect(palette[0]).toBe('#dc1414')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/client/extractPalette.test.ts`
Expected: FAIL — module `./extractPalette` does not exist.

- [ ] **Step 3: Write `src/client/extractPalette.ts`**

```ts
interface ColorBucket {
  r: number
  g: number
  b: number
  n: number
}

export function extractPalette(pixels: Uint8ClampedArray, count: number): string[] {
  const buckets = new Map<string, ColorBucket>()

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]
    if (alpha < 128) continue

    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`

    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
    bucket.r += r
    bucket.g += g
    bucket.b += b
    bucket.n += 1
    buckets.set(key, bucket)
  }

  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n)

  return sorted
    .slice(0, count)
    .map((bucket) => toHex(bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n))
}

function toHex(r: number, g: number, b: number): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/client/extractPalette.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write `src/client/useAlbumPalette.ts`**

This hook does the DOM/image-loading glue around `extractPalette`. It's
browser-only (needs `Image` and `<canvas>`) and is verified manually in
Task 11, not unit tested — jsdom has no real canvas 2D backend.

```ts
import { useEffect, useState } from 'react'
import { extractPalette } from './extractPalette'

const DEFAULT_PALETTE = ['#7fd8e8', '#c9d6df', '#3fa9c9', '#e8f4f8']
const SAMPLE_SIZE = 64

export function useAlbumPalette(albumArtUrl: string | undefined): string[] {
  const [palette, setPalette] = useState<string[]>(DEFAULT_PALETTE)

  useEffect(() => {
    if (!albumArtUrl) {
      setPalette(DEFAULT_PALETTE)
      return
    }

    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'

    image.onload = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SAMPLE_SIZE
        canvas.height = SAMPLE_SIZE
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('2d context unavailable')

        ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
        const extracted = extractPalette(data, 4)
        setPalette(extracted.length > 0 ? extracted : DEFAULT_PALETTE)
      } catch {
        setPalette(DEFAULT_PALETTE)
      }
    }
    image.onerror = () => {
      if (!cancelled) setPalette(DEFAULT_PALETTE)
    }
    image.src = albumArtUrl

    return () => {
      cancelled = true
    }
  }, [albumArtUrl])

  return palette
}
```

- [ ] **Step 6: Commit**

```bash
git add src/client/extractPalette.ts src/client/extractPalette.test.ts src/client/useAlbumPalette.ts
git commit -m "feat: add album-art palette extraction"
```

---

## Task 9: WebGL visualizer (Three.js glossy bars + wave)

**Files:**
- Create: `src/client/Visualizer/scene.ts`
- Create: `src/client/Visualizer/Visualizer.tsx`

**Interfaces:**
- Produces: `VisualizerFrame` type
  (`{ progressMs, durationMs, bpm, palette, isPlaying }`) and a
  `<Visualizer frame={VisualizerFrame} />` component — consumed by Task 11's
  `routes/index.tsx`.

No automated test for this task — per the design spec, WebGL visual output is
"run it and look at it" correctness, and jsdom has no real WebGL backend to
render against meaningfully.

- [ ] **Step 1: Write `src/client/Visualizer/scene.ts`**

```ts
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

const BAR_COUNT = 32

export interface VisualizerFrame {
  progressMs: number
  durationMs: number
  bpm: number
  palette: string[]
  isPlaying: boolean
}

export interface VisualizerHandle {
  setFrame: (frame: VisualizerFrame) => void
  resize: (width: number, height: number) => void
  dispose: () => void
}

export function createVisualizerScene(canvas: HTMLCanvasElement): VisualizerHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.set(0, 4, 14)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 0.4))
  const keyLight = new THREE.PointLight(0xffffff, 2, 50)
  keyLight.position.set(5, 10, 8)
  scene.add(keyLight)

  const barGeometry = new THREE.BoxGeometry(0.4, 1, 0.4)
  const barMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x7fd8e8,
    metalness: 0.6,
    roughness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    transmission: 0.2,
  })

  const bars: THREE.Mesh[] = []
  for (let i = 0; i < BAR_COUNT; i++) {
    const bar = new THREE.Mesh(barGeometry, barMaterial.clone())
    bar.position.x = (i - BAR_COUNT / 2) * 0.55
    scene.add(bar)
    bars.push(bar)
  }

  const waveGeometry = new THREE.PlaneGeometry(20, 6, 80, 1)
  const waveMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc9d6df,
    metalness: 0.3,
    roughness: 0.2,
    clearcoat: 1,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  })
  const wave = new THREE.Mesh(waveGeometry, waveMaterial)
  wave.rotation.x = -Math.PI / 2.4
  wave.position.y = -2
  scene.add(wave)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.6, 0.1))

  let frame: VisualizerFrame = {
    progressMs: 0,
    durationMs: 1,
    bpm: 120,
    palette: ['#7fd8e8', '#c9d6df', '#3fa9c9', '#e8f4f8'],
    isPlaying: false,
  }
  let rafId: number | null = null
  let lastTimestamp = performance.now()
  let elapsedProgressMs = 0

  const wavePositions = waveGeometry.attributes.position

  function animate(timestamp: number) {
    rafId = requestAnimationFrame(animate)
    const deltaMs = timestamp - lastTimestamp
    lastTimestamp = timestamp

    if (frame.isPlaying) {
      elapsedProgressMs += deltaMs
    }

    const beatMs = 60000 / frame.bpm
    const beatPhase = (elapsedProgressMs % beatMs) / beatMs
    const palette = frame.palette.length > 0 ? frame.palette : ['#7fd8e8']

    bars.forEach((bar, i) => {
      const barPhase = (beatPhase + i / BAR_COUNT) % 1
      const height = 0.6 + Math.abs(Math.sin(barPhase * Math.PI * 2)) * 3
      bar.scale.y = height
      bar.position.y = height / 2 - 1.5
      const material = bar.material as THREE.MeshPhysicalMaterial
      material.color.set(palette[i % palette.length])
    })

    for (let i = 0; i < wavePositions.count; i++) {
      const x = wavePositions.getX(i)
      const z = Math.sin(x * 0.5 + elapsedProgressMs * 0.002) * 0.4
      wavePositions.setZ(i, z)
    }
    wavePositions.needsUpdate = true

    composer.render()
  }
  rafId = requestAnimationFrame(animate)

  return {
    setFrame: (next) => {
      frame = next
    },
    resize: (width, height) => {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      composer.setSize(width, height)
    },
    dispose: () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      renderer.dispose()
      barGeometry.dispose()
      barMaterial.dispose()
      waveGeometry.dispose()
      waveMaterial.dispose()
    },
  }
}
```

- [ ] **Step 2: Write `src/client/Visualizer/Visualizer.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { createVisualizerScene, type VisualizerFrame, type VisualizerHandle } from './scene'

interface VisualizerProps {
  frame: VisualizerFrame
}

export function Visualizer({ frame }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<VisualizerHandle | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handle = createVisualizerScene(canvas)
    handleRef.current = handle

    function handleResize() {
      handle.resize(window.innerWidth, window.innerHeight)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      handle.dispose()
      handleRef.current = null
    }
  }, [])

  useEffect(() => {
    handleRef.current?.setFrame(frame)
  }, [frame])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}
    />
  )
}
```

- [ ] **Step 3: Manually verify the visualizer renders**

Temporarily replace the component in `src/routes/index.tsx` with:

```tsx
component: () => (
  <Visualizer
    frame={{ progressMs: 0, durationMs: 200000, bpm: 128, palette: ['#7fd8e8', '#3fa9c9', '#e8f4f8'], isPlaying: true }}
  />
),
```

(add the import). Run `npm run dev`, visit `http://127.0.0.1:3000/`.
Expected: a full-screen animated row of glossy chrome bars pulsing to a
128 BPM beat, over a translucent moving wave plane, with visible bloom
highlights. Revert this temporary change afterward — Task 11 wires it for
real.

- [ ] **Step 4: Commit**

```bash
git add src/client/Visualizer/scene.ts src/client/Visualizer/Visualizer.tsx
git commit -m "feat: add Three.js glossy bars-and-wave visualizer"
```

---

## Task 10: Glass-panel transport UI (PlayerChrome)

**Files:**
- Create: `src/client/PlayerChrome.tsx`
- Create: `src/client/PlayerChrome.css`

**Interfaces:**
- Produces: `<PlayerChrome trackName artists isPlaying progressMs durationMs
  onTogglePlay onSkipNext onSkipPrevious onSeek onVolumeChange />` — consumed
  by Task 11's `routes/index.tsx`.

No automated test — this is a presentational component verified visually,
same as Task 9.

- [ ] **Step 1: Write `src/client/PlayerChrome.css`**

```css
.player-chrome {
  position: fixed;
  left: 50%;
  bottom: 2rem;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.35), rgba(120, 200, 220, 0.15));
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 8px 32px rgba(0, 60, 80, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  color: #0a2a35;
  font-family: system-ui, sans-serif;
  min-width: 360px;
}

.player-chrome__title {
  font-weight: 600;
}

.player-chrome__artists {
  font-size: 0.85rem;
  opacity: 0.75;
}

.player-chrome__controls {
  display: flex;
  gap: 1.5rem;
}

.player-chrome__controls button {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  width: 2.5rem;
  height: 2.5rem;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 60, 80, 0.2);
}

.player-chrome__seek,
.player-chrome__volume {
  width: 100%;
  accent-color: #3fa9c9;
}
```

- [ ] **Step 2: Write `src/client/PlayerChrome.tsx`**

```tsx
import './PlayerChrome.css'

interface PlayerChromeProps {
  trackName: string
  artists: string
  isPlaying: boolean
  progressMs: number
  durationMs: number
  onTogglePlay: () => void
  onSkipNext: () => void
  onSkipPrevious: () => void
  onSeek: (positionMs: number) => void
  onVolumeChange: (volume: number) => void
}

export function PlayerChrome({
  trackName,
  artists,
  isPlaying,
  progressMs,
  durationMs,
  onTogglePlay,
  onSkipNext,
  onSkipPrevious,
  onSeek,
  onVolumeChange,
}: PlayerChromeProps) {
  return (
    <div className="player-chrome">
      <div className="player-chrome__track">
        <div className="player-chrome__title">{trackName}</div>
        <div className="player-chrome__artists">{artists}</div>
      </div>
      <div className="player-chrome__controls">
        <button onClick={onSkipPrevious} aria-label="Previous track">
          ⏮
        </button>
        <button onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={onSkipNext} aria-label="Next track">
          ⏭
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={durationMs}
        value={progressMs}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="player-chrome__seek"
      />
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        defaultValue={0.5}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        className="player-chrome__volume"
      />
    </div>
  )
}
```

- [ ] **Step 3: Manually verify the panel renders**

Temporarily mount `<PlayerChrome trackName="Test Track" artists="Test Artist"
isPlaying={true} progressMs={30000} durationMs={200000}
onTogglePlay={() => {}} onSkipNext={() => {}} onSkipPrevious={() => {}}
onSeek={() => {}} onVolumeChange={() => {}} />` in `src/routes/index.tsx`, run
`npm run dev`, visit `http://127.0.0.1:3000/`.
Expected: a frosted-glass, rounded panel anchored at the bottom of the screen
with track info, three circular transport buttons, and two sliders, matching
a Frutiger Aero glass-panel look. Revert this temporary change afterward.

- [ ] **Step 4: Commit**

```bash
git add src/client/PlayerChrome.tsx src/client/PlayerChrome.css
git commit -m "feat: add glass-panel transport UI"
```

---

## Task 11: Wire the Now Playing screen end-to-end

**Files:**
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: `getPlaybackToken`, `getTempo` (Task 5/6), `usePlaybackSDK`
  (Task 7), `useAlbumPalette` (Task 8), `Visualizer` (Task 9), `PlayerChrome`
  (Task 10).

- [ ] **Step 1: Replace `src/routes/index.tsx` with the full Now Playing screen**

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { getPlaybackToken, getTempo } from '../server/spotify-api'
import { usePlaybackSDK } from '../client/usePlaybackSDK'
import { useAlbumPalette } from '../client/useAlbumPalette'
import { Visualizer } from '../client/Visualizer/Visualizer'
import { PlayerChrome } from '../client/PlayerChrome'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      await getPlaybackToken()
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: Index,
})

function Index() {
  const { state, isActiveDevice, error, togglePlay, skipNext, skipPrevious, seek, setVolume, playHere } =
    usePlaybackSDK(() => getPlaybackToken())
  const palette = useAlbumPalette(state?.albumArtUrl)
  const [bpm, setBpm] = useState(120)

  useEffect(() => {
    if (!state?.trackId) return
    let cancelled = false
    getTempo({ data: { trackId: state.trackId } }).then((tempo) => {
      if (!cancelled) setBpm(tempo)
    })
    return () => {
      cancelled = true
    }
  }, [state?.trackId])

  if (error === 'account_error') {
    return <FullScreenMessage text="Spotify Premium is required to use this player." />
  }

  if (!state) {
    return <FullScreenMessage text="Waiting for playback..." />
  }

  if (!isActiveDevice) {
    return (
      <FullScreenMessage text="Aero Media Player isn't the active Spotify device.">
        <button onClick={playHere}>Play here</button>
      </FullScreenMessage>
    )
  }

  return (
    <>
      <Visualizer
        frame={{
          progressMs: state.progressMs,
          durationMs: state.durationMs,
          bpm,
          palette,
          isPlaying: state.isPlaying,
        }}
      />
      <PlayerChrome
        trackName={state.name}
        artists={state.artists}
        isPlaying={state.isPlaying}
        progressMs={state.progressMs}
        durationMs={state.durationMs}
        onTogglePlay={togglePlay}
        onSkipNext={skipNext}
        onSkipPrevious={skipPrevious}
        onSeek={seek}
        onVolumeChange={setVolume}
      />
    </>
  )
}

function FullScreenMessage({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p>{text}</p>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests from Tasks 1–8 still PASS (this task adds no new unit
tests — it's wiring).

- [ ] **Step 3: Manual end-to-end smoke test**

1. Run `npm run dev`.
2. On your phone or desktop Spotify app, make sure a Premium account matching
   one of the app's allowlisted users is signed in.
3. Visit `http://127.0.0.1:3000/` in a browser. Confirm it redirects to
   `/login`, then to Spotify's consent screen.
4. Approve. Confirm you land back on `/` and see "Waiting for playback...".
5. On your phone, open Spotify, start playing any track, then tap the
   devices icon and select "Aero Media Player".
6. Confirm the browser tab now shows the full-screen visualizer reacting to
   the (simulated) beat, with the glass transport panel showing the correct
   track name/artist and a progress bar advancing.
7. Use the transport panel's play/pause, skip, and seek controls; confirm
   playback on the phone changes accordingly.
8. Pause on the phone; confirm the panel's play/pause icon updates.
9. On the phone, transfer playback to a different device (not the browser);
   confirm the browser shows the "isn't the active Spotify device" screen
   with a working "Play here" button.

- [ ] **Step 4: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat: wire up the full Now Playing screen"
```
