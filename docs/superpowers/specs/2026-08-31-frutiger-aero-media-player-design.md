# Frutiger Aero Media Player — Design

## Summary

A TanStack Start web app that replicates the Windows Media Player Frutiger Aero-era
visualizer aesthetic (glossy chrome/glass bars and wave ribbons) while playing the
user's own Spotify account's music. The user logs in with their Spotify account; the
app acts as a Spotify Connect playback device and full-screen visualizer/now-playing
UI for whatever is playing.

Scope: personal/small-group use (a handful of allowlisted Spotify accounts), run
locally for now, no public deployment.

## Constraints

- Spotify's Web Playback SDK streams DRM-protected audio. There is no raw PCM /
  frequency-spectrum access via the Web Audio API, on any plan, ever. True
  FFT-reactive bars (what WMP did against local audio files) are not achievable
  against Spotify.
- Spotify deprecated the Audio Analysis / Audio Features endpoints (tempo, energy,
  beat grid, segments) for API apps created after November 2024. This app may or may
  not get access — it must be treated as best-effort and degrade gracefully.
- The Web Playback SDK requires a Spotify Premium account to initialize.
- New Spotify apps run in "Development Mode": a hard cap of 25 manually allowlisted
  users, no Spotify review needed. Matches this project's scope.

Given these constraints, "reactive" visuals are procedural: driven by playback
position (from SDK state events), a best-effort tempo, and colors extracted from the
current track's album art — not by real audio analysis.

## Architecture

TanStack Start app (TypeScript), single deployable unit — router + server functions,
no separate backend service.

- **Auth**: `/login` redirects into Spotify's OAuth Authorization Code + PKCE flow. A
  server function handles the callback, exchanges the code for access/refresh
  tokens, and stores them server-side keyed to an httpOnly session cookie. All
  Spotify Web API calls that need the refresh token (token refresh, best-effort
  audio-features lookups) happen from server functions. The browser only ever holds
  the short-lived access token the Web Playback SDK itself requires to open its
  streaming connection; the server mints and refreshes that token on request.
- **Playback**: Client-side. Spotify's Web Playback SDK registers the browser tab as
  a Spotify Connect device ("Aero Media Player"). The user starts playback either by
  selecting this device from any other Spotify client (phone, desktop app), or via
  this app's own transport controls once a track is already active on the account.
- **Visualizer**: A full-screen Three.js WebGL canvas behind the transport UI,
  driven by:
  1. A synced playback-position clock, updated from the SDK's `player_state_changed`
     events and interpolated between updates via `requestAnimationFrame`.
  2. Tempo, if the Audio Features endpoint is available to this app at runtime;
     otherwise a fixed default BPM pulse (see Error Handling).
  3. Dominant colors extracted from the current track's album art, recomputed on
     every track change.
- **UI chrome**: Plain HTML/CSS glass-panel overlay (track title/artist,
  play/pause/skip/seek/volume) in Frutiger Aero glossy-panel styling, layered above
  the canvas.

## Components

- `routes/login.tsx` — Spotify OAuth kickoff (redirect to the authorize URL with a
  PKCE challenge).
- `routes/callback.tsx` — server function exchanges the auth code for tokens,
  creates the session, redirects to `/`.
- `routes/index.tsx` — the Now Playing screen: mounts `<Visualizer>` and
  `<PlayerChrome>`, gated behind a session check (redirects to `/login` if there is
  no valid session).
- `server/spotify-session.ts` — session cookie read/write, server-side token
  storage, refresh-token exchange logic. Server-only module.
- `server/spotify-api.ts` — thin wrapper around the Spotify Web API calls used
  server-side: minting a client access token, fetching track/album info, a
  best-effort audio-features lookup with graceful fallback on 403, token refresh.
- `client/usePlaybackSDK.ts` — hook wrapping the Spotify Web Playback SDK: device
  registration, player state events (track, position, paused, duration), and
  transport actions (play/pause/skip/seek/volume) proxied straight to the SDK.
- `client/useAlbumPalette.ts` — given the current track's album art URL, extracts N
  dominant colors via canvas pixel sampling and returns a palette for the visualizer
  to lerp toward on track change.
- `client/Visualizer/` — the Three.js scene: glossy bars + wave ribbon mesh, shader
  materials for the chrome/glass look, bloom post-processing. Consumes
  `{ progressMs, durationMs, bpm, palette, isPlaying }` and animates purely from
  that state — no raw audio buffer is ever involved.
- `client/PlayerChrome.tsx` — the glass-panel transport controls overlay.

## Data flow

1. Login completes → session cookie established, holding the refresh token
   server-side.
2. `/` loads → a server function returns a short-lived Web Playback SDK access token
   to the client.
3. The SDK connects, registers the device, and starts emitting
   `player_state_changed` events (track metadata, position, paused, duration) — the
   client hook turns these into the state `Visualizer` and `PlayerChrome` consume.
4. On track change: the client requests that track's audio-features, best-effort
   (album art URL is already present in the SDK state, so `useAlbumPalette` extracts
   colors client-side with no server round trip — the art is a public CDN image).
5. The visualizer's render loop ticks on `requestAnimationFrame`, animating from
   interpolated elapsed-time-since-last-known-position plus bpm/palette (the SDK
   does not push a 60fps position stream, only discrete state-change events).
6. Transport actions (play/pause/skip/seek/volume) go straight from `PlayerChrome`
   to the SDK player instance to Spotify — no server hop once the SDK is connected.
7. When the access token nears expiry, the client transparently requests a fresh one
   from a server function before any SDK call can fail on it.

## Error handling

- No/expired session → redirect to `/login`.
- Account isn't Premium → the SDK's init fails with an account-error event; show a
  clear "Spotify Premium required" screen instead of a broken canvas.
- Audio-features fetch returns 403 (expected for apps created after Nov 2024) →
  silently fall back to a default BPM (120); never surface this as a user-facing
  error.
- SDK disconnects, or playback transfers to another device → show a "not the active
  device" state with a "Play here" affordance, instead of a frozen visualizer.
- Album art fetch or palette extraction fails → fall back to a fixed default
  Frutiger Aero palette (aqua/silver).
- Token refresh fails (access revoked) → clear the session, redirect to `/login`.

## Testing

- Unit tests for palette extraction (fixed test image → deterministic output) and
  the PKCE/token-exchange helpers (mocked Spotify responses, including the
  audio-features 403 fallback path).
- Hook tests for `usePlaybackSDK`'s state-reducer logic: given a sequence of mock
  `player_state_changed` events, assert the correct derived state. The SDK itself is
  mocked, not exercised for real.
- No automated test for the WebGL visualizer's visual output — verified manually;
  this is a "run it and look at it" kind of correctness.
- Manual end-to-end smoke test: log in → start playback from phone → device shows up
  in Spotify Connect → visualizer renders → transport controls work.

## Out of scope (this spec)

- In-app library/playlist browsing or search (user selects tracks from their own
  Spotify client; this app is a visualizer + device, not a library UI).
- Multiple visualizer presets/switcher (one signature preset only for v1).
- Any deployment/hosting configuration (local dev only for now).
- Spotify Extended Quota Mode submission (Development Mode's 25-user cap is
  sufficient for this scope).
