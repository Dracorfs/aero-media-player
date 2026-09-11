# Implementation Plan: Player-as-Landing-Page with a Spotify Sidebar

## Overview

Today `/` is gated: `beforeLoad` calls `getPlaybackToken()` and bounces to `/login` when
there is no session, and even once signed in a full-screen message blocks the player until
this tab becomes the active Spotify device. This plan turns `/` into the player itself —
always rendered, visualizer running — and moves every piece of account and library UI into
a left sidebar that starts open, signs in through a popup tab that closes itself, then
becomes the music picker with a "Sign off" button. The sidebar can be closed and reopened
through a mouse-move reveal, the same interaction `useCinemaMode` already implements.

Decisions confirmed with the user before planning:

- **Signed out** → live idle visualizer: backdrop + Three.js scene animate in an idle state
  and `PlayerChrome` is visible but inert.
- **Signed in, not yet the active device** → no full-screen takeover; the sidebar carries the
  playlist picker, and picking a track makes this tab the active device (as `playTrackInContext`
  already does with `device_id`).
- **Reopening the sidebar** → mouse-move reveal (cinema-mode pattern), no persistent handle.
- **Music picker** → today's `PlaylistPicker` (own playlists → tracks), no search, no
  recently-played, so no new Spotify endpoints and no new Dev Mode exposure.

## Architecture Decisions

- **Auth becomes a reported status, not a redirect.** A new `getAuthStatus()` server fn returns
  `{ isSignedIn }` and never throws for the not-authenticated case, so `/`'s loader can render
  the correct sidebar state during SSR without a flash. `/`'s `beforeLoad` redirect is deleted;
  `/login` survives as the popup target and as the no-JS fallback. Genuine config errors
  (`MissingEnvVarError`) must still surface rather than read as "signed out".
- **The popup is driven by OAuth `state`, not by a second redirect URI.** Spotify requires the
  `redirect_uri` to match the dashboard value character for character, so the popup cannot get
  its own callback path. Instead `buildAuthorizeUrl` takes `{ mode }`, mints a random `state`
  token, and stores `{ state, mode }` in a short-lived httpOnly cookie; `/callback` verifies
  `state` (a real CSRF check the flow lacks today), reads the mode back, and either redirects to
  `/` as it does now or renders a self-closing "signed in" view for the popup.
- **Popup → opener handoff is `postMessage` with a `popup.closed` fallback.** The popup posts
  `{ type: 'aero-auth-complete' }` to `window.opener` scoped to `window.location.origin`, then
  calls `window.close()`. The opener also polls `popup.closed`, so a user who dismisses the tab,
  or a browser that blocks the close, still gets the status re-checked instead of a stuck
  spinner. `window.open` returning `null` (blocked) degrades to a plain link to `/login`.
- **`usePlaybackSDK` gets an `enabled` flag rather than being conditionally mounted.** Hooks
  can't be conditional, and splitting the tree into signed-in/signed-out variants would
  duplicate the chrome and visualizer. Gating the existing mount effect on `enabled` keeps one
  render tree, injects no SDK script and registers no Connect device while signed out, and gives
  sign-off a teardown path for free (the effect's cleanup already calls `disconnect()`).
- **The reveal behaviour is extracted, not copied.** `useCinemaMode`'s mouse-move-reveal logic
  becomes `useRevealOnMouseMove(active)`, consumed by both cinema mode and the closed sidebar.
  `useCinemaMode`'s existing tests are behavioural and must pass untouched — that is the
  regression guard for the extraction.
- **The sidebar overlays; it does not reflow the layout.** It is a fixed left glass panel above
  the canvas. The only concession is an offset applied to `.player-chrome` while the sidebar is
  open, so the transport cluster stays visually centered in the space that is actually free.
- **Styling reuses the established aero vocabulary** already in `PlayerChrome.css` and
  `PlaylistPicker.css` (translucent white/cyan gradients, `backdrop-filter: blur(16px)`,
  `inset 0 1px 0 rgba(255,255,255,.6)` edge, `#0a2a35` text) rather than inventing a third
  visual language.

**Prior art:** this repo's earlier plans live in `docs/superpowers/plans/`; this plan follows
the `tasks/plan.md` + `tasks/todo.md` convention instead, which is what the build step here
consumes. Tasks are tracked in `tasks/todo.md`.

## Task List

### Phase 1: Auth plumbing (server + popup)
- [ ] Task 1: Report auth status and add sign-out
- [ ] Task 2: Carry OAuth `state` + flow mode through authorize and callback
- [ ] Task 3: `useSpotifyAuthPopup` — open, listen, fall back

### Checkpoint: Auth plumbing
- [ ] `npm test` and `npm run typecheck` pass
- [ ] Popup sign-in works end to end against real Spotify (popup closes itself, opener notified)

### Phase 2: The player runs without a session
- [ ] Task 4: Gate `usePlaybackSDK` behind `enabled`
- [ ] Task 5: Idle visualizer frame and inert `PlayerChrome`

### Checkpoint: Signed-out player
- [ ] Visiting `/` signed out shows the animating player instead of redirecting
- [ ] No Spotify SDK script request and no Connect device while signed out (Network tab)

### Phase 3: The sidebar
- [ ] Task 6: `Sidebar` component — signed-out and signed-in content
- [ ] Task 7: `useSidebar` + extracted `useRevealOnMouseMove` + reveal handle
- [ ] Task 8: Wire `/` — sidebar open by default, sign-in/sign-off, device gate removed

### Checkpoint: Full flow
- [ ] Cold load → sidebar open with "Sign in with Spotify" over a live idle player
- [ ] Sign in via popup → sidebar becomes the picker with "Sign off", no page reload
- [ ] Pick a track → playback starts in this tab, chrome goes live
- [ ] Close sidebar → mouse move reveals the reopen control → reopens
- [ ] Sign off → SDK disconnects, sidebar reopens on the sign-in view

### Phase 4: Polish
- [ ] Task 9: "Play here" — transfer playback to this device (optional)
- [ ] Task 10: Refresh README for the new landing/auth flow

### Checkpoint: Complete
- [ ] `npm test`, `npm run typecheck`, `npm run build` all clean
- [ ] Every acceptance criterion in `tasks/todo.md` checked

---

## Task 1: Report auth status and add sign-out

**Description:** Add the two server functions the new UI needs: one that reports whether the
session holds usable Spotify credentials without throwing, and one that clears the session.
`clearSpotifySession()` already exists in `src/server/session.ts` and is used internally by the
token refresh path; this exposes it as a callable endpoint.

**Acceptance criteria:**
- [ ] `getAuthStatus()` server fn returns `{ isSignedIn: boolean }`; true only when the session
      has `accessToken`, `refreshToken` and `expiresAt`
- [ ] `getAuthStatus()` resolves (never rejects) for a missing/empty session, and still throws
      for a missing-env-var/config failure so setup problems stay visible
- [ ] `signOut()` server fn clears the session and resolves `void`

**Verification:**
- [ ] Tests pass: `npx vitest run src/server/spotify-api.test.ts`
- [ ] New unit tests cover: full session → true, empty session → false, partial session
      (token but no refresh token) → false
- [ ] Typecheck: `npm run typecheck`

**Dependencies:** None

**Files likely touched:**
- `src/server/spotify-api.ts`
- `src/server/spotify-api.test.ts`

**Estimated scope:** Small (2 files)

---

## Task 2: Carry OAuth `state` + flow mode through authorize and callback

**Description:** Teach the OAuth round trip whether it was started in a popup, and add the
`state` check it is currently missing. `buildAuthorizeUrl` accepts `{ mode }`, generates a
random `state`, stores `{ state, mode }` in a short-lived httpOnly cookie alongside the PKCE
verifier, and includes `state` in the authorize URL. `/callback` verifies the returned `state`
against the cookie, reads the mode, and branches: normal flow keeps today's redirect to `/`;
popup flow renders a view that posts to `window.opener` and closes itself.

**Acceptance criteria:**
- [ ] `buildAuthorizeUrl({ data: { mode } })` includes a `state` param and sets the state cookie
      (httpOnly, `sameSite: 'lax'`, 10 min, `secure` in production — matching `PKCE_COOKIE`)
- [ ] `/callback` rejects a request whose `state` does not match the cookie, with the same
      user-facing "Login failed, please try again." treatment as a failed exchange
- [ ] `mode: 'popup'` renders "You're signed in — closing this window…", posts
      `{ type: 'aero-auth-complete' }` to `window.opener` targeted at `window.location.origin`,
      and calls `window.close()`; if the close is blocked the message stays on screen with a
      link back to `/`
- [ ] Missing/absent mode behaves exactly as today: server-side redirect to `/`
- [ ] Both auth cookies are deleted once the exchange completes, success or failure
- [ ] `MissingEnvVarError` still surfaces through `errorComponent` unchanged

**Verification:**
- [ ] Tests pass: `npx vitest run src/server/spotify-auth.test.ts`
- [ ] New tests: authorize URL carries `state`; `state` mismatch is rejected; popup mode is
      returned to the caller instead of redirecting
- [ ] Manual check: `/login` in the address bar (no popup) still lands back on `/` signed in

**Dependencies:** None (independent of Task 1)

**Files likely touched:**
- `src/server/spotify-auth.ts`
- `src/server/spotify-auth.test.ts`
- `src/routes/callback.tsx`
- `src/routes/login.tsx`

**Estimated scope:** Medium (4 files)

---

## Task 3: `useSpotifyAuthPopup` — open, listen, fall back

**Description:** The client half of the popup flow. A hook that opens `/login?mode=popup` in a
sized window, resolves when the popup reports success or is closed, and reports when the browser
blocked the popup so the caller can offer a plain link instead.

**Acceptance criteria:**
- [ ] `startSignIn()` opens `/login?mode=popup` in a named window (~520×720)
- [ ] `message` listener ignores events whose `origin !== window.location.origin` or whose
      `data.type` is not `aero-auth-complete`
- [ ] A matching message calls the `onComplete` callback once
- [ ] `popup.closed` polling (500 ms) also calls `onComplete` once, so a dismissed popup can't
      leave the UI pending
- [ ] `onComplete` fires at most once per sign-in attempt; listener and interval are cleaned up
      on completion and on unmount
- [ ] `window.open` returning `null` sets `isPopupBlocked`, and `isPending` is false in that case

**Verification:**
- [ ] Tests pass: `npx vitest run src/client/useSpotifyAuthPopup.test.ts`
- [ ] Tests cover: matching message fires callback; wrong-origin message ignored; closed-popup
      polling fires callback; callback not fired twice; blocked popup sets the flag
- [ ] Typecheck: `npm run typecheck`

**Dependencies:** Task 2 (the `?mode=popup` contract)

**Files likely touched:**
- `src/client/useSpotifyAuthPopup.ts`
- `src/client/useSpotifyAuthPopup.test.ts`

**Estimated scope:** Small (2 files)

---

## Task 4: Gate `usePlaybackSDK` behind `enabled`

**Description:** Let the player mount while signed out without touching Spotify. The hook takes
an options object with `enabled` (default true, so nothing else changes), skips SDK script
injection and `connect()` while disabled, returns inert state, and tears the player down when
`enabled` flips false — which is what sign-off needs.

**Acceptance criteria:**
- [ ] `usePlaybackSDK(getToken, { enabled: false })` injects no script, constructs no
      `Spotify.Player`, and calls no `getAccessToken`
- [ ] While disabled: `state === null`, `isActiveDevice === false`, `error === null`, and the
      control functions are safe no-ops
- [ ] Flipping `enabled` false → true initializes the player; true → false calls `disconnect()`
- [ ] The token getter is still read through a ref, so a fresh arrow function from the caller
      does not re-create the player (today's `[]`-keyed behaviour, now keyed on `[enabled]`)
- [ ] Omitting the options argument preserves current behaviour exactly

**Verification:**
- [ ] Tests pass: `npx vitest run src/client/usePlaybackSDK.test.ts`
- [ ] New tests: disabled mounts nothing; enabling initializes; disabling disconnects; re-render
      with a new getter identity does not re-initialize
- [ ] Manual check: signed out, the Network tab shows no `sdk.scdn.co` request

**Dependencies:** None

**Files likely touched:**
- `src/client/usePlaybackSDK.ts`
- `src/client/usePlaybackSDK.test.ts`

**Estimated scope:** Small (2 files)

---

## Task 5: Idle visualizer frame and inert `PlayerChrome`

**Description:** Give the signed-out landing page something alive to show. A small
`useIdleProgress(durationMs)` hook loops a progress value forever (`useLiveProgress` clamps at
`durationMs` and would freeze after one pass), feeding an idle `VisualizerFrame` built from the
existing defaults. `PlayerChrome` gains a disabled state so the bar is visible but unusable.

**Acceptance criteria:**
- [ ] `useIdleProgress(duration)` advances on a 250 ms tick and wraps back to ~0 at `duration`
      instead of clamping
- [ ] Idle frame uses `DEFAULT_TRACK_DYNAMICS.bpm`, the default palette from
      `useAlbumPalette(undefined)`, `gainToIntensity(DEFAULT_TRACK_DYNAMICS.gain)`, and
      `isPlaying: true` so the scene animates
- [ ] `PlayerChrome` accepts `isDisabled`; when set, prev/play/next, the seek bar, the volume
      slider and the settings button are all `disabled`, and the title reads
      "Sign in with Spotify to start playing" with a `0:00` readout
- [ ] Fullscreen and cinema-mode controls stay enabled while disabled (they need no account)
- [ ] Space/`f` shortcuts do not trigger playback while disabled
- [ ] Enabled `PlayerChrome` renders and behaves exactly as before (existing tests untouched)

**Verification:**
- [ ] Tests pass: `npx vitest run src/client/PlayerChrome.test.tsx src/client/useIdleProgress.test.ts`
- [ ] New tests: disabled controls carry the `disabled` attribute; placeholder title renders;
      `onTogglePlay` is not called on click or Space while disabled
- [ ] Manual check: the scene visibly animates on the signed-out page

**Dependencies:** None (pairs with Task 8 for wiring)

**Files likely touched:**
- `src/client/useIdleProgress.ts`
- `src/client/useIdleProgress.test.ts`
- `src/client/PlayerChrome.tsx`
- `src/client/PlayerChrome.css`
- `src/client/PlayerChrome.test.tsx`

**Estimated scope:** Medium (5 files)

---

## Task 6: `Sidebar` component — signed-out and signed-in content

**Description:** The sidebar itself: a fixed left glass panel matching the player's aero
vocabulary, with a header and close button, and two content states. Signed out it shows the
"Sign in with Spotify" button (plus the popup-blocked fallback link). Signed in it shows the
existing `PlaylistPicker` and a "Sign off" button. Pure presentation — it takes callbacks and
renders; orchestration lands in Task 8.

**Acceptance criteria:**
- [ ] Props: `isOpen`, `onClose`, `isSignedIn`, `onSignIn`, `onSignOut`, `onSelectTrack`,
      `isPopupBlocked`, `isSigningIn`
- [ ] Signed out renders a "Sign in with Spotify" button wired to `onSignIn`; `isSigningIn`
      shows a pending state; `isPopupBlocked` additionally renders a link to `/login`
- [ ] Signed in renders `PlaylistPicker` with `onSelectTrack` forwarded, plus a "Sign off"
      button wired to `onSignOut`
- [ ] A close control (labelled for screen readers) calls `onClose`
- [ ] `isOpen === false` slides the panel off-canvas via transform (no layout jump) and leaves
      nothing of it clickable
- [ ] `PlaylistPicker` embedded in the sidebar drops its standalone card chrome (outer border /
      shadow / fixed width) and fills the panel, scrolling its own list
- [ ] Panel styling reuses the existing glass tokens and `#0a2a35` text; readable at 360 px wide

**Verification:**
- [ ] Tests pass: `npx vitest run src/client/Sidebar.test.tsx`
- [ ] New tests: signed-out shows sign-in and calls `onSignIn`; signed-in shows picker + sign-off
      and calls `onSignOut`; close button calls `onClose`; popup-blocked fallback link renders
- [ ] Manual check: panel legible over both a light and a dark backdrop image

**Dependencies:** Tasks 1 and 3 inform the props, but the component can be built and tested
against them in parallel

**Files likely touched:**
- `src/client/Sidebar.tsx`
- `src/client/Sidebar.css`
- `src/client/Sidebar.test.tsx`
- `src/client/PlaylistPicker.tsx`
- `src/client/PlaylistPicker.css`

**Estimated scope:** Medium (5 files)

---

## Task 7: `useSidebar` + extracted `useRevealOnMouseMove` + reveal handle

**Description:** Open/close state and the reopen affordance. The mouse-move reveal currently
living inside `useCinemaMode` is extracted to `useRevealOnMouseMove(active)` and reused, so the
closed sidebar gets the same fade-in-on-movement control the player already uses, with one
implementation and one set of timing rules.

**Acceptance criteria:**
- [ ] `useRevealOnMouseMove(active)` returns visibility: hidden when `active` flips true (no
      flash), shown on first mouse move, hidden 2000 ms after the last move, timer reset by
      further movement, and hidden immediately when `active` goes false
- [ ] `useCinemaMode` delegates to it and its existing test file passes unmodified
- [ ] `useSidebar()` starts open (`isOpen === true` on first render), exposes `open`, `close`,
      `toggle`
- [ ] While the sidebar is closed, a reveal control appears on mouse move and reopens the
      sidebar when clicked; it is absent while the sidebar is open
- [ ] The reveal control is labelled for screen readers and styled consistently with the
      existing cinema-mode reveal button

**Verification:**
- [ ] Tests pass: `npx vitest run src/client/useCinemaMode.test.ts src/client/useRevealOnMouseMove.test.ts src/client/useSidebar.test.ts`
- [ ] New tests: `useSidebar` starts open and toggles; extracted hook covers the timing rules
      with fake timers
- [ ] Manual check: closing the sidebar then moving the mouse reveals the control; stillness
      hides it after ~2 s

**Dependencies:** Task 6 (the panel it opens and closes)

**Files likely touched:**
- `src/client/useRevealOnMouseMove.ts`
- `src/client/useRevealOnMouseMove.test.ts`
- `src/client/useSidebar.ts`
- `src/client/useSidebar.test.ts`
- `src/client/useCinemaMode.ts`

**Estimated scope:** Medium (5 files)

---

## Task 8: Wire `/` — sidebar open by default, sign-in/sign-off, device gate removed

**Description:** The integration task. `/` stops redirecting, reads auth status in its loader,
always renders backdrop + visualizer + chrome + sidebar, and drives the whole flow: popup
sign-in refreshes status in place, sign-off tears the SDK down and reopens the sidebar on the
sign-in view, and the `!isActiveDevice` full-screen takeover is deleted in favour of picking a
track from the sidebar.

**Acceptance criteria:**
- [ ] `/`'s `beforeLoad` redirect to `/login` is gone; the loader returns `getAuthStatus()` so
      SSR renders the correct sidebar state with no signed-out flash
- [ ] A config failure (e.g. missing `SPOTIFY_CLIENT_ID`) still surfaces as an error, not as
      "signed out"
- [ ] Signed out: sidebar open on the sign-in view, idle visualizer running, chrome inert
- [ ] Completing the popup re-runs the status loader (`router.invalidate()`) and flips the
      sidebar to the picker without a full page load
- [ ] `usePlaybackSDK` receives `enabled: isSignedIn`
- [ ] The `!isActiveDevice` and `!state` full-screen messages are removed; the player stays on
      screen and the sidebar is the way to start playback
- [ ] Picking a track starts playback in this tab and the chrome goes live
- [ ] "Sign off" calls `signOut()`, invalidates status, disconnects the SDK, and reopens the
      sidebar on the sign-in view
- [ ] `error === 'authentication_error'` no longer navigates to `/login`; it invalidates status
      and opens the sidebar (the `account_error` Premium message is unchanged)
- [ ] `.player-chrome` is offset while the sidebar is open so the transport stays centered in
      the free space

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Typecheck + build: `npm run typecheck && npm run build`
- [ ] Manual check (real Spotify Premium account): cold load → sign in via popup → popup closes
      → pick a track → playback starts → close and reopen the sidebar → sign off

**Dependencies:** Tasks 1, 2, 3, 4, 5, 6, 7

**Files likely touched:**
- `src/routes/index.tsx`
- `src/client/PlayerChrome.css`

**Estimated scope:** Medium (2 files, high integration surface)

---

## Task 9: "Play here" — transfer playback to this device (optional)

**Description:** Removing the device gate leaves one small hole: if audio is already playing on
another Spotify device, the only way to capture it here is to pick a track. A `transferPlayback`
server fn (`PUT /me/player`) plus a sidebar button closes that, and makes the README's existing
"press Play here" claim true.

**Acceptance criteria:**
- [ ] `transferPlayback({ deviceId })` server fn calls `PUT /me/player` with `device_ids` and
      throws a descriptive error on a non-OK response
- [ ] `usePlaybackSDK` exposes a `playHere()` that uses the current device id and no-ops when
      the device is not ready
- [ ] The sidebar shows "Play here" only while signed in and not the active device
- [ ] Failures are logged and surfaced in the sidebar, never thrown into the render tree

**Verification:**
- [ ] Tests pass: `npx vitest run src/server/spotify-api.test.ts src/client/usePlaybackSDK.test.ts`
- [ ] Manual check: start playback in the Spotify desktop app, press "Play here", audio moves to
      the tab and the chrome goes live

**Dependencies:** Task 8

**Files likely touched:**
- `src/server/spotify-api.ts`
- `src/server/spotify-api.test.ts`
- `src/client/usePlaybackSDK.ts`
- `src/client/Sidebar.tsx`

**Estimated scope:** Small (4 files)

---

## Task 10: Refresh README for the new landing/auth flow

**Description:** The README describes a redirect-on-load login and claims "No library or
playlist browsing" under Known limitations. Both are now wrong.

**Acceptance criteria:**
- [ ] "Run it" describes the landing page: the player with the sidebar open, sign-in via popup
- [ ] The "No library or playlist browsing" limitation is corrected to what the sidebar offers
      (own playlists only, and why followed playlists are excluded in Dev Mode)
- [ ] Sign-off and sidebar reopen (mouse-move reveal) are documented in a sentence each
- [ ] Any popup-blocker caveat worth knowing is noted

**Verification:**
- [ ] Manual read-through against the running app
- [ ] No stale claim about redirecting to Spotify on first load

**Dependencies:** Task 8

**Files likely touched:**
- `README.md`

**Estimated scope:** XS (1 file)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Popup blocked, or `window.close()` refused by the browser | Med | `startSignIn` runs inside a click gesture (not blocked in practice); `isPopupBlocked` degrades to a plain `/login` link; the popup view keeps a visible "signed in, you can close this" message with a link back |
| `postMessage` never arrives (extension interference, cross-process quirk) | Med | `popup.closed` polling is an independent path to the same re-check; status is re-read from the server either way, so the message is an optimization, not the mechanism |
| Session cookie set in the popup isn't visible to the opener | High if hit | Same origin and same host (`127.0.0.1:3000`), `sameSite: 'lax'`, so the cookie is shared; verify early in Checkpoint 1 — this is the assumption most worth failing fast on |
| Removing the `!isActiveDevice` gate leaves users with no obvious way to start audio | Med | The sidebar starts open with the picker in view; Task 9's "Play here" covers the already-playing-elsewhere case |
| Extracting the reveal hook regresses cinema mode | Low | `useCinemaMode.test.ts` is behavioural and must pass unmodified as the guard |
| SDK teardown on sign-off leaves a stale Connect device | Low | `enabled: false` runs the existing effect cleanup (`disconnect()`); confirm the device disappears from another Spotify client's device list |
| Idle visualizer burns GPU on an unattended signed-out tab | Low | Idle frame ticks at 250 ms like live playback; accept for local dev, and note `document.hidden` throttling as a follow-up if it bites |

## Open Questions — answered

- **Keyboard shortcut for the sidebar.** Added, on `l` for "library" (Task 14). `s` was the
  other candidate but reads as shuffle / search / save in music apps, any of which this
  player could plausibly grow; `l` matches the panel's own label and the README's wording,
  and a single letter matches the existing Space and `f` shortcuts.
- **Background settings while signed out.** No: the settings button stays disabled until
  there is a session, since the background is stored per account.
- **Idle state wording.** No fake track name. The inert chrome reads "Sign in with Spotify
  to start playing".

## Known constraint: the app has exactly one origin

Spotify requires `redirect_uri` to match the dashboard entry character for character, so the
app only works on the origin `SPOTIFY_REDIRECT_URI` names (`http://127.0.0.1:3000`). Opening
it on `http://localhost:3000` used to half-work and then fail confusingly at sign-in: two
cookie jars, and a popup that could not talk to its opener. The root route now redirects any
other host to the canonical origin (Task 11), so this is enforced rather than documented.
