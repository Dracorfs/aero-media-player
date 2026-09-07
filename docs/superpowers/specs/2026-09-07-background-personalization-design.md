# Background Personalization — Design

## Summary

Add a "Configuration" entry point to the player that opens a settings modal.
The first (and for now, only) personalization option is **Background**: the
area behind the visualizer's bars/wave, which today is just whatever color
the page happens to show through the visualizer canvas's transparent
regions. Users can set it to one of seven fixed colors, or to an image —
either one already uploaded by anyone using this app instance, or a new one
they upload on the spot.

The choice is **per Spotify account** (stored in that account's existing
session) so each of the app's up to five allowlisted users sees their own
background. The **image pool is shared** — anyone's upload becomes available
to everyone's image picker, since there's no reason to store five copies of
the same photo.

Scope, matching the rest of this app: personal/small-group use, local dev
only, no deployment/hosting configuration needed or attempted.

## Constraints carried over from the base app design

- No raw audio access, no server-rendered content beyond what already
  exists — this feature is purely a visual personalization layer and does
  not touch playback, tempo, or palette logic at all.
- Session tokens/data live only in the sealed, httpOnly session cookie
  already established by `src/server/session.ts`. This feature reuses that
  exact mechanism for the per-account background choice — no new cookie,
  no new session store.
- This app runs via `vite dev` only; there is no production build/deploy
  step in scope. Writing uploaded files to `public/backgrounds/` at runtime
  is sufficient because Vite's dev server serves `public/` straight from
  disk on every request — no custom file-serving route needed. (If this
  project ever adds a real deployment step, this exact mechanism would need
  revisiting — noted here so it isn't a silent gap.)

## Architecture

- **Selected background**: a new `background` field on the existing Spotify
  session object (`src/server/session.ts`). Confirmed this session's
  `updateSession()` does a shallow `Object.assign` merge server-side (via
  h3), so adding this field alongside the existing `accessToken` /
  `refreshToken` / `expiresAt` fields cannot disturb them.
- **Shared image pool**: files on disk under `public/backgrounds/`
  (created on first upload if missing). No manifest/database — the pool is
  just "whatever files are in that directory", listed via a directory read
  each time it's needed. Simplest option that satisfies "already uploaded
  image," and avoids a second source of truth to keep in sync.
- **Upload transport**: confirmed this app's installed
  `@tanstack/react-start` (1.168.49) natively supports a `FormData`/`File`
  payload on a POST `createServerFn` — the server handler receives a real
  `File` (`.arrayBuffer()`, `.type`, `.size`), not a JSON-serialized stub.
  No base64 workaround needed.
- **Rendering**: a new fixed, full-viewport backdrop element rendered as a
  DOM sibling immediately *before* the visualizer's `<canvas>` in the
  playing-state branch of `index.tsx`. The canvas already renders with
  `alpha: true`, so wherever the 3D scene doesn't draw anything, the canvas
  pixel is transparent and the backdrop shows through; the wave/"carpet"
  plane's own partial opacity (0.35) also tints over the backdrop. No
  changes to `scene.ts`'s Three.js setup are needed — this is a pure CSS/DOM
  layering trick, not a scene-graph change.

## Components

### `src/server/background.ts` (new)

```ts
export const ALLOWED_BACKGROUND_COLORS = [
  '#0032db', '#0689e4', '#7aeafe', '#9fe11d', '#ccff7c', '#000000', '#ffffff',
] as const

export type BackgroundConfig =
  | { type: 'color'; value: string }
  | { type: 'image'; value: string } // filename under public/backgrounds/, served at /backgrounds/<value>

export function isAllowedColor(color: string): boolean
export function sanitizeImageFilename(filename: string): string | null // rejects path traversal / unsafe characters; returns the safe basename or null

export async function listBackgroundImageFiles(): Promise<string[]> // reads public/backgrounds/, [] if the directory doesn't exist yet
export async function saveBackgroundImageFile(file: File): Promise<string> // validates MIME (image/jpeg|png|webp|gif) and size (<= 8MB), writes a uuid-named file, returns its filename; throws on invalid input

export const getBackgroundConfig = createServerFn({ method: 'GET' }).handler(...) // reads session.background, or null
export const setBackground = createServerFn({ method: 'POST' })
  .validator((data: BackgroundConfig) => data) // re-validates color/filename server-side regardless of client input
  .handler(...) // merges { background: data } into the session
export const listBackgroundImages = createServerFn({ method: 'GET' }).handler(...) // wraps listBackgroundImageFiles
export const uploadBackgroundImage = createServerFn({ method: 'POST' })
  .validator((data: FormData) => { /* pull the 'image' file out, throw if missing/not a File */ })
  .handler(...) // wraps saveBackgroundImageFile, returns { filename: string }
```

### `src/client/VisualizerBackdrop.tsx` (new) + no separate CSS file

Presentational only:

```tsx
interface VisualizerBackdropProps {
  config: BackgroundConfig | null
}

export function VisualizerBackdrop({ config }: VisualizerBackdropProps) {
  const style =
    config?.type === 'color'
      ? { backgroundColor: config.value }
      : config?.type === 'image'
        ? { backgroundImage: `url(/backgrounds/${config.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : undefined // no config yet: renders nothing special, today's appearance is unchanged

  return <div className="visualizer-backdrop" style={style} />
}
```

`.visualizer-backdrop` CSS (added to a shared stylesheet, likely
`PlayerChrome.css` renamed conceptually or a new tiny
`VisualizerBackdrop.css` — final call left to implementation, but it's just
`position: fixed; inset: 0;` with no `background` of its own, since that's
supplied inline per-config).

### `src/client/ConfigurationModal.tsx` + `.css` (new)

A centered glass-panel modal (same Frutiger Aero visual language as
`PlayerChrome`/`PlaylistPicker`) with a dimmed backdrop click-to-close and an
explicit × button. Contents: a "Background" heading, a Color/Image toggle,
and:

- **Color mode**: the 7 swatches from `ALLOWED_BACKGROUND_COLORS`, rendered
  as small circular buttons with that background color; the currently
  active one shows a highlighted ring. Clicking a swatch calls
  `setBackground({ type: 'color', value })` immediately and updates the
  highlighted state — no separate "save" step.
- **Image mode**: a thumbnail grid from `listBackgroundImages()` (each
  `<img>` pointing at `/backgrounds/<filename>`), the active one
  highlighted the same way, plus an "Upload new image" file input. Picking
  a file calls `uploadBackgroundImage` with a `FormData`, then
  `setBackground({ type: 'image', value: <returned filename> })` — the
  newly uploaded image becomes selected immediately and appears in the grid
  without a manual refresh (append it to local state rather than
  re-fetching the list).

Props: `{ isOpen, onClose, config, onConfigChange }` — the modal doesn't own
the config's source of truth; `index.tsx` does, matching how `PlayerChrome`
is a controlled component today.

### `PlayerChrome.tsx` (edit)

One new button after the cinema-mode button, following the exact existing
pattern (no per-button class, shared `.player-chrome__controls button`
styling):

```tsx
<button onClick={onOpenSettings} aria-label="Configuration">⚙</button>
```

New prop: `onOpenSettings: () => void`.

### `index.tsx` (edit)

- New state: `const [isSettingsOpen, setIsSettingsOpen] = useState(false)` and
  `const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig | null>(null)`.
- One-time fetch (not per-track — this is account-level, not track-level):
  a `useEffect` with `[]` deps calling `getBackgroundConfig()` once when the
  playing view mounts.
- Render `<VisualizerBackdrop config={backgroundConfig} />` immediately
  before `<Visualizer>` in the playing-state JSX branch.
- Render `<ConfigurationModal>` conditionally on `isSettingsOpen`, passing
  `backgroundConfig`/`setBackgroundConfig` down so a change in the modal is
  reflected behind the visualizer immediately.
- Pass `onOpenSettings={() => setIsSettingsOpen(true)}` into `<PlayerChrome>`.

### `.gitignore` (edit)

Add `public/backgrounds/` — uploaded user content, not source, shouldn't be
committed.

## Data flow

1. Player mounts (already-active device, a track playing) → `index.tsx`
   fetches `getBackgroundConfig()` once → stores it → passes it to
   `VisualizerBackdrop`, which renders the color/image (or nothing, if the
   account has never set one).
2. User clicks the new ⚙ button → `ConfigurationModal` opens, itself
   fetching `listBackgroundImages()` when the Image tab is first shown.
3. User picks a color → `setBackground` server fn validates + persists to
   session → `index.tsx`'s local state updates → backdrop re-renders
   immediately, no page reload.
4. User uploads an image → `uploadBackgroundImage` validates + saves to
   `public/backgrounds/<uuid>.<ext>` → returns the filename →
   `setBackground({type:'image', value: filename})` persists the selection
   → same immediate local update.

## Error handling

- Invalid/tampered color or filename sent to `setBackground` (bypassing the
  UI) → server-side validation (`isAllowedColor` / `sanitizeImageFilename`
  against the real directory listing) rejects it; the server fn throws, the
  modal shows a simple inline error state, nothing is persisted.
- Upload exceeding the 8MB limit or with a non-image MIME type → rejected
  before any disk write, same inline error treatment.
- `getBackgroundConfig` failing for any reason (e.g. a corrupt/expired
  session mid-request) → treated as "no background set" (`null`), never
  surfaced as a user-facing error — this is decorative, matching this app's
  existing convention for best-effort features like tempo/loudness.
- `public/backgrounds/` not existing yet → `listBackgroundImageFiles`
  returns `[]` rather than throwing; the directory is created lazily on
  first successful upload.

## Testing

- `src/server/background.test.ts`: `isAllowedColor` and
  `sanitizeImageFilename` as pure-function tests (valid/invalid colors;
  path-traversal attempts like `../../etc/passwd` or embedded slashes
  rejected, a plain `foo.png` accepted). `listBackgroundImageFiles` and
  `saveBackgroundImageFile` with `node:fs/promises` mocked (`vi.mock`),
  mirroring how this codebase already mocks `fetch` at the I/O boundary for
  every other server function test.
- `src/client/ConfigurationModal.test.tsx`: mirrors
  `PlaylistPicker.test.tsx`'s conventions — mock the `../server/background`
  module, render, assert swatch/thumbnail rendering, clicking a swatch
  calls `setBackground` with the right payload, uploading calls
  `uploadBackgroundImage` then `setBackground`.
- `VisualizerBackdrop`: a couple of simple tests asserting the right inline
  style for a color config, an image config, and no config.
- No automated test for the visual result behind the WebGL canvas itself —
  verified manually, same convention as the rest of the visualizer.

## Out of scope (this spec)

- Deleting/managing uploaded images (no removal UI or endpoint).
- Any personalization option beyond Background (the modal's structure
  doesn't preclude adding more sections later, but no framework for
  multiple sections is being built ahead of need).
- Image resizing/compression on upload.
- Per-image attribution (who uploaded what) or pagination of the image
  gallery.
- Any production/deployment story for serving `public/backgrounds/` outside
  `vite dev`.
