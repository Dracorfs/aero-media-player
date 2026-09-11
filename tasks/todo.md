# Todo: Player-as-Landing-Page with a Spotify Sidebar

Full design, rationale, risks and open questions: `tasks/plan.md`.
Work top to bottom — dependencies are already in order. Do not skip checkpoints.

Project-wide bar for every task: `npm test` green, `npm run typecheck` clean, no unrelated
files touched, new behaviour covered by a test next to the file it tests.

---

## Phase 1: Auth plumbing (server + popup)

### [x] Task 1: Report auth status and add sign-out — S
`src/server/spotify-api.ts`, `src/server/spotify-api.test.ts`

- [x] `getAuthStatus()` returns `{ isSignedIn: boolean }`, true only with `accessToken` +
      `refreshToken` + `expiresAt` present
- [x] Resolves (never rejects) on an empty session; still throws on missing-env-var/config failure
- [x] `signOut()` clears the session and resolves `void`
- [x] Tests: full session → true, empty → false, partial (no refresh token) → false
- [x] Verify: `npx vitest run src/server/spotify-api.test.ts && npm run typecheck`

### [x] Task 2: Carry OAuth `state` + flow mode through authorize and callback — M
`src/server/spotify-auth.ts`, `src/server/spotify-auth.test.ts`, `src/routes/callback.tsx`, `src/routes/login.tsx`

- [x] `buildAuthorizeUrl({ data: { mode } })` adds a `state` param and sets a `{ state, mode }`
      httpOnly cookie (`sameSite: 'lax'`, 10 min, `secure` in production — mirror `PKCE_COOKIE`)
- [x] `/login` validates a `mode` search param and forwards it
- [x] `/callback` rejects a `state` mismatch with the existing "Login failed, please try again."
      treatment
- [x] `mode: 'popup'` renders "You're signed in — closing this window…", posts
      `{ type: 'aero-auth-complete' }` to `window.opener` targeted at `window.location.origin`,
      then `window.close()`; if the close is blocked the message persists with a link to `/`
- [x] No mode → unchanged server-side redirect to `/`
- [x] Both auth cookies deleted on completion, success or failure
- [x] `MissingEnvVarError` still reaches `errorComponent`
- [x] Tests: authorize URL carries `state`; mismatch rejected; popup mode returned not redirected
- [x] Verify: `npx vitest run src/server/spotify-auth.test.ts`; manually hit `/login` directly and
      confirm the non-popup flow still lands on `/` signed in

### [x] Task 3: `useSpotifyAuthPopup` — open, listen, fall back — S
`src/client/useSpotifyAuthPopup.ts`, `src/client/useSpotifyAuthPopup.test.ts` — depends on Task 2

- [x] `startSignIn()` opens `/login?mode=popup` in a named ~520×720 window
- [x] Ignores messages whose `origin !== window.location.origin` or whose `data.type` is wrong
- [x] Matching message fires `onComplete` once
- [x] `popup.closed` polling (500 ms) also fires `onComplete` once
- [x] `onComplete` fires at most once per attempt; listener + interval cleaned up on completion
      and unmount
- [x] `window.open` → `null` sets `isPopupBlocked` and leaves `isPending` false
- [x] Tests: matching message, wrong origin ignored, closed-popup path, no double fire, blocked flag
- [x] Verify: `npx vitest run src/client/useSpotifyAuthPopup.test.ts && npm run typecheck`

### [x] Checkpoint A: Auth plumbing
- [x] `npm test` and `npm run typecheck` pass
- [ ] Real-Spotify manual run: popup opens, authorizes, closes itself, opener is notified
      (deferred to Checkpoint C — nothing called the popup until Task 8 wired it)
- [ ] **Confirm the session cookie set inside the popup is visible to the opener** (highest-risk
      assumption in the plan — fail fast here)

---

## Phase 2: The player runs without a session

### [x] Task 4: Gate `usePlaybackSDK` behind `enabled` — S
`src/client/usePlaybackSDK.ts`, `src/client/usePlaybackSDK.test.ts`

- [x] `{ enabled: false }` injects no script, builds no `Spotify.Player`, calls no `getAccessToken`
- [x] While disabled: `state === null`, `isActiveDevice === false`, `error === null`, controls no-op
- [x] false → true initializes; true → false calls `disconnect()`
- [x] Token getter still read through a ref — a new getter identity must not re-create the player
- [x] Omitting the options argument preserves today's behaviour exactly
- [x] Tests: disabled mounts nothing; enabling initializes; disabling disconnects; getter identity
      churn does not re-initialize
- [x] Verify: `npx vitest run src/client/usePlaybackSDK.test.ts`

### [x] Task 5: Idle visualizer frame and inert `PlayerChrome` — M
`src/client/useIdleProgress.ts` (+test), `src/client/PlayerChrome.tsx`, `.css`, `.test.tsx`

- [x] `useIdleProgress(duration)` ticks at 250 ms and wraps to ~0 at `duration` (does not clamp
      like `useLiveProgress`)
- [x] Idle frame uses `DEFAULT_TRACK_DYNAMICS.bpm`, default palette from `useAlbumPalette(undefined)`,
      `gainToIntensity(DEFAULT_TRACK_DYNAMICS.gain)`, `isPlaying: true`
- [x] `PlayerChrome` accepts `isDisabled`: prev/play/next, seek, volume and settings all `disabled`;
      title reads "Sign in with Spotify to start playing"; readout shows `0:00`
- [x] Fullscreen and cinema controls stay enabled while disabled
- [x] Space / `f` shortcuts do not trigger playback while disabled
- [x] Enabled `PlayerChrome` unchanged — existing tests pass untouched
- [x] Tests: disabled attributes present, placeholder title, `onTogglePlay` not called on click or Space
- [x] Verify: `npx vitest run src/client/PlayerChrome.test.tsx src/client/useIdleProgress.test.ts`

### [x] Checkpoint B: Signed-out player
- [ ] `/` signed out renders the animating player instead of redirecting (verify in the browser)
- [ ] Network tab: no `sdk.scdn.co` request, no Connect device registered while signed out
      (covered by unit tests; confirm in the browser)
- [x] `npm test` green

---

## Phase 3: The sidebar

### [x] Task 6: `Sidebar` component — signed-out and signed-in content — M
`src/client/Sidebar.tsx`, `Sidebar.css`, `Sidebar.test.tsx`, `PlaylistPicker.tsx`, `PlaylistPicker.css`

- [x] Props: `isOpen`, `onClose`, `isSignedIn`, `onSignIn`, `onSignOut`, `onSelectTrack`,
      `isPopupBlocked`, `isSigningIn`
- [x] Signed out: "Sign in with Spotify" wired to `onSignIn`; pending state from `isSigningIn`;
      `isPopupBlocked` also renders a link to `/login`
- [x] Signed in: `PlaylistPicker` with `onSelectTrack` forwarded, plus "Sign off" → `onSignOut`
- [x] Screen-reader-labelled close control calls `onClose`
- [x] `isOpen === false` slides it off-canvas by transform, nothing left clickable
- [x] Embedded `PlaylistPicker` drops its standalone card chrome (border/shadow/fixed width),
      fills the panel, scrolls its own list
- [x] Reuses the existing glass tokens and `#0a2a35` text; legible at 360 px wide
- [x] Tests: signed-out sign-in click, signed-in picker + sign-off click, close click, blocked fallback
- [x] Verify: `npx vitest run src/client/Sidebar.test.tsx src/client/PlaylistPicker.test.tsx`

### [x] Task 7: `useSidebar` + extracted `useRevealOnMouseMove` + reveal handle — M
`src/client/useRevealOnMouseMove.ts` (+test), `src/client/useSidebar.ts` (+test), `src/client/useCinemaMode.ts` — depends on Task 6

- [x] `useRevealOnMouseMove(active)`: hidden on activation (no flash), shown on first move,
      hidden 2000 ms after the last move, timer reset by movement, hidden immediately when
      `active` goes false
- [x] `useCinemaMode` delegates to it and **`useCinemaMode.test.ts` passes unmodified**
- [x] `useSidebar()` starts open; exposes `open`, `close`, `toggle`
- [x] While closed, a reveal control appears on mouse move and reopens the sidebar; absent while open
- [x] Reveal control is screen-reader labelled and styled like the cinema-mode reveal button
- [x] Verify: `npx vitest run src/client/useCinemaMode.test.ts src/client/useRevealOnMouseMove.test.ts src/client/useSidebar.test.ts`

### [x] Task 8: Wire `/` — sidebar open by default, sign-in/sign-off, device gate removed — M
`src/routes/index.tsx`, `src/client/PlayerChrome.css` — depends on Tasks 1–7

- [x] `beforeLoad` redirect to `/login` deleted; loader returns `getAuthStatus()` so SSR renders
      the right sidebar state with no signed-out flash
- [x] A config failure (e.g. missing `SPOTIFY_CLIENT_ID`) still surfaces as an error, not "signed out"
- [x] Signed out: sidebar open on sign-in view, idle visualizer running, chrome inert
- [x] Popup completion triggers `router.invalidate()` → sidebar flips to the picker, no page reload
- [x] `usePlaybackSDK` gets `enabled: isSignedIn`
- [x] `!isActiveDevice` and `!state` full-screen messages removed; player stays on screen
- [x] Picking a track starts playback in this tab and the chrome goes live
- [x] "Sign off" → `signOut()` → invalidate → SDK disconnects → sidebar reopens on sign-in view
- [x] `authentication_error` invalidates status and opens the sidebar instead of navigating to `/login`;
      `account_error` Premium message unchanged
- [x] `.player-chrome` is offset while the sidebar is open so the transport stays centered in the
      free space
- [x] Verify: `npm test && npm run typecheck && npm run build`

### [ ] Checkpoint C: Full flow (real Spotify Premium account)
- [ ] Cold load → sidebar open with "Sign in with Spotify" over a live idle player
- [ ] Sign in via popup → popup closes → sidebar becomes the picker with "Sign off", no reload
- [ ] Pick a track → audio plays in this tab, chrome live, visualizer reacting
- [ ] Close sidebar → mouse move reveals the reopen control → click reopens
- [ ] Sign off → SDK disconnects (device gone from other Spotify clients) → sidebar reopens signed out
- [ ] Reload while signed in → lands straight on the player with the sidebar state intact
- [ ] **Review with the user before Phase 4**

---

## Phase 4: Polish

### [x] Task 9: "Play here" — transfer playback to this device (optional) — S
`src/server/spotify-api.ts` (+test), `src/client/usePlaybackSDK.ts`, `src/client/Sidebar.tsx` — depends on Task 8

- [x] `transferPlayback({ deviceId })` calls `PUT /me/player` with `device_ids` (and
      `play: true`), throws descriptively on a non-OK response
- [x] `playHere()` on the SDK hook uses the current device id, and *rejects with a reason*
      when the device isn't ready — changed from the planned silent no-op, since a button
      that does nothing when clicked tells the user nothing
- [x] Sidebar shows "Play here" only while signed in and not the active device
- [x] Failures are caught in the sidebar and rendered as a message, never thrown into the
      render tree; a stale failure clears once the transfer is no longer offered
- [x] Verify: `npx vitest run src/server/spotify-api.test.ts src/client/usePlaybackSDK.test.ts`
- [ ] Manual: move playback from the desktop app to the tab

### [x] Task 10: Refresh README for the new landing/auth flow — XS
`README.md` — depends on Task 8

- [x] "Run it" describes the player-with-sidebar landing page and popup sign-in
- [x] "No library or playlist browsing" limitation corrected (own playlists only, and why
      followed playlists are excluded in Dev Mode)
- [x] Sign-off and mouse-move sidebar reopen each documented in a sentence
- [x] Popup-blocker caveat noted
- [x] Intro rewritten: the page is the player, not a login that leads to one
- [ ] Verify: read through against the running app (the stale "redirected to Spotify on
      first run" claim is gone)

## Phase 5: Post-review fixes (from the first real sign-in run)

### [x] Task 11: Pin the app to the OAuth origin — S
`src/server/origin.ts` (+test), `src/routes/__root.tsx`

The reported failure: opened on `localhost:3000`, the popup came back on
`127.0.0.1:3000` (Spotify's fixed redirect URI), so the two tabs had separate
cookie jars and couldn't postMessage. The popup became a second signed-in copy
of the app while the original tab waited forever.

- [x] `canonicalOrigin()` derives the one usable origin from `SPOTIFY_REDIRECT_URI`
- [x] `canonicalRedirectFor()` is pure and unit-tested (same origin → null; other host,
      port or scheme → canonical origin with path and query preserved)
- [x] Root `beforeLoad` redirects document requests on any other host, server-side only
      (client navigations can't change origin, and checking would cost a round trip each)
- [x] Verified against a running dev server: `localhost:3000/` → 307 →
      `http://127.0.0.1:3000/`; `/login?mode=popup` keeps its query; canonical origin → 200

### [x] Task 12: Recover a lost sign-in handoff — XS
`src/client/useSpotifyAuthPopup.ts` (+test)

- [x] Re-checks auth status when the opener regains focus while a sign-in is in flight,
      without settling it — so a swallowed message or a refused self-close can't leave the
      tab waiting forever
- [x] A later message or popup close still settles the same sign-in exactly once

### [x] Task 13: Fix SSR of the signed-out player — XS
`src/client/useFullscreen.ts`, `src/client/PlayerChrome.test.tsx`

- [x] `useFullscreen` no longer reads `document` in a `useState` initializer — it was
      latent until the landing page started server-rendering for signed-out visitors,
      and threw `document is not defined` on every SSR of `/`
- [x] Reads `Boolean(document.fullscreenElement)` on mount instead, which also fixes
      browsers (and jsdom) reporting `undefined` as "fullscreen"
- [x] Verified: the dev server renders `/` with no SSR errors, and the HTML contains the
      open sidebar and the disabled chrome

### [x] Task 14: Library shortcut — XS
`src/client/useMediaShortcuts.ts` (+test), `src/client/PlayerChrome.tsx`, `src/routes/index.tsx`

- [x] `l` toggles the sidebar, alongside Space and `f`; ignored with modifiers held
      (so Cmd/Ctrl+L still belongs to the browser) and while typing in a field
- [x] Stays live while the chrome is disabled — the sidebar is where signing in happens
- [x] The third callback is optional, so existing callers are unaffected

### [ ] Checkpoint D: Complete
- [x] `npm test` (240 passing), `npm run typecheck`, `npm run build` all clean
- [ ] Every box above checked
- [ ] Open questions in `tasks/plan.md` answered or consciously deferred
