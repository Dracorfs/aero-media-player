# Aero Media Player

A Frutiger Aero visualizer for your own Spotify playback. Log in with Spotify,
the browser tab becomes a Spotify Connect device via the Web Playback SDK, and a
full-screen Three.js scene (glossy chrome bars + glass wave) animates from the
track's playback position, a best-effort tempo, and colors extracted from the
album art.

Built with TanStack Start (Vite), React 19, TypeScript, and Three.js. Local dev
only — there is no deployment configuration.

## Requirements

- Node.js 20+ and npm
- A **Spotify Premium** account. The Web Playback SDK refuses to initialize on
  free accounts (the app shows "Spotify Premium is required to use this player").

## 1. Register a Spotify app

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   and click **Create app**.
2. Give it any name/description.
3. Set the **Redirect URI** to exactly:

   ```
   http://127.0.0.1:3000/callback
   ```

   Use `127.0.0.1`, not `localhost` — Spotify rejects `localhost` redirect URIs
   for new apps, and the value must match `SPOTIFY_REDIRECT_URI` character for
   character.
4. Under **APIs used**, tick **Web Playback SDK** (and Web API).
5. Save, then copy the **Client ID**. This app uses the Authorization Code flow
   with **PKCE**, so no client secret is needed or stored.

### Dev Mode limits (February 2026 rules)

A newly created app lives in **Development Mode**, which means:

- Only **up to 5 users** can use it, and each one must be added by hand under
  **Settings → User Management** (Spotify display name + the account's email).
  Your own account included — if it isn't allowlisted, login fails.
- The **app owner's account must hold an active Premium subscription**, or the
  app stops working entirely.

Quota-extension requests are not part of this project's scope.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Value |
| --- | --- |
| `SPOTIFY_CLIENT_ID` | Client ID from the dashboard |
| `SPOTIFY_REDIRECT_URI` | `http://127.0.0.1:3000/callback` (must match the dashboard exactly) |
| `SESSION_SECRET` | A long random string (32+ chars) used to seal the session cookie |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### How `.env` is actually loaded

Vite only exposes `VITE_`-prefixed variables, and only on `import.meta.env` —
it never writes to `process.env`, which is what all the server code here reads.
This app's `vite.config.ts` therefore calls Vite's own `loadEnv(mode, cwd, '')`
and copies the result into `process.env` for the dev/build process (real
environment variables always win over `.env`). No `dotenv` dependency is needed,
and nothing from `.env` is injected into the client bundle.

If a required variable is missing, the server throws a named, explicit error
(`Missing required env var: SPOTIFY_CLIENT_ID. Copy .env.example to .env and fill
it in.`) rather than silently bouncing you to the login page.

## 3. Run it

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:3000** (again: `127.0.0.1`, not `localhost` — the OAuth
redirect URI is host-specific and the session cookie is scoped to the host you
started on).

First run: you'll be redirected to Spotify to authorize, then back to the app.
The app registers a Connect device named **Aero Media Player**. Pick it from any
Spotify client's device menu, or press **Play here** to transfer playback to this
tab.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Production build (client + SSR) |
| `npm test` | Vitest run (unit + component tests) |
| `npm run typecheck` | `tsc --noEmit` |

## Known limitations

- **Safari + `127.0.0.1`:** the session cookie is issued with `secure: true` in
  production mode; Safari does not treat plain-HTTP `127.0.0.1` as a secure
  context the way Chrome does, so a production-mode build served over HTTP on
  `127.0.0.1` can fail to persist the login session in Safari. Use Chrome for
  local development, or serve over HTTPS.
- **Tempo is best-effort.** Spotify deprecated the Audio Features endpoint for
  apps created after November 2024; it commonly returns `403`. The visualizer
  silently falls back to 120 BPM.
- **No real audio analysis.** Spotify's stream is DRM-protected and exposes no
  frequency data, so all visual reactivity is derived from playback position,
  tempo, and album-art color.
- **Now Playing only.** No library or playlist browsing, no visualizer preset
  switcher.
