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

---

## Phase 6: Profile picture selector

Full design, rationale, risks and open questions for this feature:
`tasks/plan.md` → "Feature: Profile Picture Selector". Read that section's "Reference assets"
note before Task 18 — it describes all three attached reference images in detail and what
this app adopts vs. adapts from the real WLM dialog.

### [x] Task 15: Profile image session storage — XS
`src/server/session.ts`

- [x] `SpotifySession` gains `profileImage?: string` (a saved filename, mirroring `background`)
- [x] `getStoredProfileImage(): Promise<string | null>` reads it, `null` when absent
- [x] `setStoredProfileImage(filename: string): Promise<void>` and
      `clearStoredProfileImage(): Promise<void>` (sets the field to `undefined`) update the
      session
- [x] Verify: `npm run typecheck` (no dedicated test file — the existing `background` fields on
      this same type aren't unit-tested directly either; `profileImageStorage.test.ts` in
      Task 16 covers this through a mocked `./session`, matching `backgroundStorage.test.ts`)

**Dependencies:** None

**Estimated scope:** XS (1 file)

---

### [x] Task 16: Profile image file storage — S
`src/server/profileImageStorage.ts` (new), `src/server/profileImageStorage.test.ts` (new)

**Description:** Direct copy of `backgroundStorage.ts`'s shape, retargeted at profile
pictures: list uploaded files, save a new upload, and apply a selection (or clear it back to
default).

- [x] `listProfileImageFiles(): Promise<string[]>` reads `public/profile-images/`, filtered to
      the same allowed extensions as backgrounds (jpg/png/webp/gif); returns `[]` if the
      directory doesn't exist yet
- [x] `saveProfileImageFile(file: File): Promise<string>` validates MIME type and the same
      8 MB cap as backgrounds, writes under a `randomUUID()` filename, returns it
- [x] `applyProfileImage(filename: string): Promise<string>` sanitizes the filename (reusing
      `sanitizeImageFilename` from `../shared/background`), confirms it's in the directory
      listing, then calls `setStoredProfileImage`
- [x] `clearProfileImage(): Promise<void>` calls `clearStoredProfileImage`
- [x] `public/profile-images/` added to `.gitignore` (same line style as `public/backgrounds/`)
- [x] Tests (mocking `node:fs/promises` and `./session`, same technique as
      `backgroundStorage.test.ts`): listing filters extensions and tolerates a missing
      directory; save validates type/size and returns a generated filename; apply rejects an
      unknown filename and rejects a path-traversal attempt via `sanitizeImageFilename`; clear
      calls through to the session helper
- [x] Verify: `npx vitest run src/server/profileImageStorage.test.ts`, `npm run typecheck`

**Dependencies:** Task 15

**Estimated scope:** S (2 files)

---

### [x] Task 17: Profile image server functions — S
`src/server/profileImage.ts` (new)

**Description:** The `createServerFn` wrappers, mirroring `background.ts` 1:1.

- [x] `getProfileImageConfig()` — `GET`, returns `string | null` directly (tighter mirror of
      `getBackgroundConfig()`, which returns `getStoredBackground()`'s value as-is rather than
      wrapping it — deviates from this task's original `{ filename }` wording)
- [x] `setProfileImage` — `POST`, validates a non-empty string, requires an authenticated
      session (reuse the same `requireAuthenticatedSession` guard style as `background.ts`),
      calls `applyProfileImage`
- [x] `listProfileImages()` — `GET`, returns `listProfileImageFiles()`
- [x] `uploadProfileImage` — `POST`, validates the `FormData` has an `image` File, requires an
      authenticated session, calls `saveProfileImageFile`, returns `{ filename }`
- [x] `clearProfileImage` — `POST`, requires an authenticated session, calls the storage
      module's `clearProfileImage`
- [x] No dedicated test file, deviating from this task's original plan — `background.ts` (the
      file this mirrors) has no test file either in this codebase; its `createServerFn`
      wrapper layer (validator + auth guard + delegate) is thin enough that the storage-layer
      tests (Task 16) and Task 21's manual verification cover it, matching existing convention
- [x] Verify: `npm run typecheck`

**Dependencies:** Task 16

**Estimated scope:** S (1 file)

---

### [x] Checkpoint E: Foundation
- [x] `npm test` and `npm run typecheck` pass
- [x] `npm run build` still succeeds
- [x] No client code touched yet — this checkpoint is server-only

---

### [x] Task 18: Default icon asset and Aero frame CSS — S
`public/default-avatar.png` (new), `src/client/ProfileAvatar.css` (new)

**Description:** Read "Reference assets" in `tasks/plan.md` first — the three images are
attached and described there in detail, not approximated.

- [x] The default icon file (this session's upload `d1d7e18a-image.png` — the teal glossy
      bust silhouette) is transferred into the project as `public/default-avatar.png` via the
      device bridge (`device_stage_files`/`device_commit_files`, or `SendUserFile` +
      `device_commit_files` if working from the cloud container) and served at
      `/default-avatar.png`. It lives directly under `public/`, not in the gitignored
      `public/profile-images/` upload namespace — it's a shipped app asset, not a user upload
- [x] A reusable "Aero frame" CSS class in `ProfileAvatar.css`, matching the plan's
      description of the frame reference image: rounded-square corners (~15-18% of side),
      a bevelled border with a bright white/pale-blue highlight along the top-left and a
      darker blue-gray shadow along the bottom-right, plus a soft outer ambient shadow. This
      is the one class both the sidebar avatar button and the modal's current-picture preview
      use — **not** applied to the picker's small gallery grid tiles (see Task 20)

**Dependencies:** None (can run in parallel with Tasks 15-17)

**Estimated scope:** S (2 files)

---

### [x] Task 19: `ProfileAvatar` component — S
`src/client/ProfileAvatar.tsx` (new), `src/client/ProfileAvatar.test.tsx` (new)

**Description:** The framed avatar display, used both standalone (the sidebar's clickable
avatar) and inside the picker (each gallery tile, plus the picker's own "currently selected"
preview) — one component, one visual source of truth for the frame.

- [x] Props: `filename: string | null`, optional `size` (e.g. `'sm' | 'lg'` for the sidebar
      button vs. a picker tile), optional `onClick`
- [x] Renders `<img src={`/profile-images/${filename}`}>` framed in the Aero treatment from
      Task 18 when `filename` is set
- [x] Renders the default icon, same frame, when `filename` is `null`
- [x] Renders as a `<button>` (not a bare `<img>`/`<div>`) when `onClick` is provided, so it's
      keyboard- and screen-reader-accessible as an interactive control
- [x] Tests: shows the `<img>` with the right `src` when given a filename; shows the default
      icon markup when `null`; renders a button and fires `onClick` when clicked; renders as a
      non-interactive element when `onClick` is omitted
- [x] Verify: `npx vitest run src/client/ProfileAvatar.test.tsx`, `npm run typecheck`

**Dependencies:** Task 18

**Estimated scope:** S (2 files)

---

### [x] Task 20: `ProfileImageModal` component — M
`src/client/ProfileImageModal.tsx` (new), `src/client/ProfileImageModal.css` (new),
`src/client/ProfileImageModal.test.tsx` (new)

**Description:** Direct adaptation of `ConfigurationModal`'s chrome (backdrop, Aero titlebar,
close button), laid out like the real WLM "Select a picture" dialog now on file in
`tasks/plan.md`: a plain small-thumbnail gallery on one side, one large framed "current
picture" preview with a Remove button on the other. No OK/Close step — matches this app's
existing immediate-apply convention instead of WLM's.

- [x] Same modal chrome as `ConfigurationModal`: backdrop click-to-close, Aero-glass titlebar,
      close button in the controls tray (reuse/mirror the CSS, not the background modal's
      color-tab markup — this modal has no tabs)
- [x] Props: `isOpen`, `onClose`, `selectedFilename: string | null`,
      `onSelectionChange: (filename: string | null) => void`
- [x] On open, loads the gallery via `listProfileImages()` (mirrors
      `ConfigurationModal`'s `listBackgroundImages()` effect, including the "load once per
      open" guard and its error message)
- [x] Gallery grid: one **plain, lightly-bordered** square thumbnail per uploaded filename
      (deliberately not the full `ProfileAvatar` frame — matches the real dialog's plain small
      thumbnails), marked selected when it matches `selectedFilename`, plus an upload tile
      identical in spirit to `.configuration-modal__upload` ("Browse..." — a file `<input>`
      triggering `uploadProfileImage` then immediately selecting the new upload)
- [x] Preview panel: a large `ProfileAvatar` (the full Aero frame) showing `selectedFilename`
      or the default icon, with a "Remove" button beneath it
- [x] Clicking a gallery tile calls `setProfileImage({ data: { filename } })` then
      `onSelectionChange(filename)`; clicking "Remove" calls `clearProfileImage()` then
      `onSelectionChange(null)`; a failed call shows the same inline error text pattern as
      `ConfigurationModal`
- [x] Tests (mirroring `ConfigurationModal.test.tsx`'s structure, with the server fns mocked):
      loads and renders the gallery on open; the preview reflects `selectedFilename`; selecting
      a gallery tile calls `onSelectionChange`; clicking Remove clears it; upload flow calls
      `uploadProfileImage` then selects the result; a rejected select/upload/remove surfaces
      the error text instead of throwing; closed renders nothing
- [x] Verify: `npx vitest run src/client/ProfileImageModal.test.tsx`, `npm run typecheck`

**Dependencies:** Tasks 17, 19

**Estimated scope:** M (3 files)

---

### [x] Checkpoint F: Components
- [x] `npm test` and `npm run typecheck` pass
- [x] `npm run build` succeeds
- [x] `ProfileAvatar` and `ProfileImageModal` are fully covered by tests in isolation, with no
      wiring into `index.tsx` or `Sidebar.tsx` yet — nothing user-visible has changed

---

### [x] Task 21: Wire the picker into the app — M
`src/routes/index.tsx`, `src/client/Sidebar.tsx`, `src/client/Sidebar.css`,
`src/client/Sidebar.test.tsx`

**Description:** The integration slice — after this task a signed-in user can actually open
the picker from the sidebar and see their choice reflected.

- [x] `index.tsx` loads `getProfileImageConfig()` on mount (same `useEffect` shape as
      `backgroundConfig`) into a `profileImageFilename` state, and holds an
      `isProfileModalOpen` state (same shape as `isSettingsOpen`)
- [x] A new row in `Sidebar` — visible only when `isSignedIn`, positioned between the
      titlebar and the playlist picker — renders a `ProfileAvatar` (with `onClick`) sized for
      the sidebar; clicking it calls a new `onOpenProfilePicker` prop
- [x] `<ProfileImageModal>` is rendered from `index.tsx` alongside `<ConfigurationModal>`,
      wired to the same `profileImageFilename` state via `onSelectionChange`
- [x] Signed-out sidebar shows no avatar row at all (matches the existing convention that
      account-scoped settings are unavailable before sign-in, e.g. the disabled background
      button in `PlayerChrome`)
- [x] `Sidebar.test.tsx` additions: the avatar row is present and clickable when signed in;
      absent when signed out; clicking it invokes the new callback
- [x] Manual verification: ran `npm run dev` and `curl`ed a signed-out `GET /` — no SSR
      errors in the server log, "Sign in with Spotify" present, and (correctly) no
      `sidebar__profile` / "Change profile picture" markup while signed out. The signed-in
      render (avatar visible with the default icon, or a picked image) still needs a manual
      check by the user after a real sign-in — this session has no live Spotify session to
      exercise that path with
- [x] Verify: `npm test` (260 passing), `npm run typecheck`, `npm run build` all clean, plus
      the manual curl check above

**Dependencies:** Tasks 20 (modal), 17 (server fns already required by the modal)

**Estimated scope:** M (4 files)

---

### [x] Task 22: README update — XS
`README.md`

- [x] A short section (or addition to an existing feature list) describing the profile
      picture picker: where it lives (sidebar, signed-in only), that it mirrors the background
      picker's gallery-plus-upload mechanic, and the current default-icon/frame caveat if
      Task 18 shipped without the real reference assets

**Dependencies:** Task 21

**Estimated scope:** XS (1 file)

---

### [x] Checkpoint G: Complete
- [x] `npm test`, `npm run typecheck`, `npm run build` all clean
- [x] Every box above checked
- [x] Open questions in `tasks/plan.md` (Feature: Profile Picture Selector section) answered
      or consciously deferred
- [x] If the reference images were attached mid-build, Task 18's approximations have been
      revisited against them
