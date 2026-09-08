# Background Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Configuration" button to the player that opens a modal where each Spotify account can personalize the visualizer's background — a fixed color, an already-uploaded shared image, or a newly uploaded one.

**Architecture:** The selected background is a new field on the existing per-account session cookie (shallow-merged, doesn't disturb the existing token fields). Uploaded images are a shared pool of files on disk under `public/backgrounds/`, listed by directory read (no manifest/database). A new fixed backdrop `<div>` renders behind the visualizer's already-transparent canvas to show the color/image; no changes to the Three.js scene itself. Uploads use `createServerFn`'s native `FormData`/`File` support (confirmed present in the installed `@tanstack/react-start` version).

**Tech Stack:** TanStack Start server functions, React 19, Vitest + `@testing-library/react`, `node:fs/promises`.

**Spec:** `docs/superpowers/specs/2026-09-07-background-personalization-design.md`

## Global Constraints

- Allowed background colors (exact values): `#0032db`, `#0689e4`, `#7aeafe`, `#9fe11d`, `#ccff7c`, `#000000`, `#ffffff`.
- Allowed image MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Max upload size: 8MB (`8 * 1024 * 1024` bytes).
- Uploaded images are saved under `public/backgrounds/` and served at `/backgrounds/<filename>` — this relies on Vite's dev server serving `public/` from disk per request, and is only in scope for `vite dev` (no production/deployment story, matching this project's existing scope).
- The background *selection* is per Spotify account (stored in that account's existing session cookie via `src/server/session.ts`). The *image pool* is shared across all accounts.
- Server-side validation must re-check color/filename validity on every write, regardless of what the client sends.

---

## Task 1: Session support for storing a background config

**Files:**
- Modify: `src/server/session.ts`

**Interfaces:**
- Produces: `BackgroundConfig` type (`{ type: 'color'; value: string } | { type: 'image'; value: string }`), `getStoredBackground(): Promise<BackgroundConfig | null>`, `setStoredBackground(background: BackgroundConfig): Promise<void>` — consumed by Task 2's `src/server/background.ts`.

No new test file for this task — this file's existing three functions (`getSpotifySession`, `setSpotifySession`, `clearSpotifySession`) have no tests today either, since they're thin wrappers over a third-party session mechanism (`useSession`/`updateSession` from `@tanstack/react-start/server`) that requires a real server request context to exercise. This task follows that same established pattern.

- [ ] **Step 1: Add the `BackgroundConfig` type and extend `SpotifySession`**

Edit `src/server/session.ts`. Replace:

```ts
export type SpotifySession = SpotifyTokens
```

with:

```ts
export type BackgroundConfig = { type: 'color'; value: string } | { type: 'image'; value: string }

export type SpotifySession = SpotifyTokens & { background?: BackgroundConfig }
```

- [ ] **Step 2: Add the two accessor functions**

In the same file, add after `setSpotifySession`:

```ts
export async function getStoredBackground(): Promise<BackgroundConfig | null> {
  const session = await getSpotifySession()
  return session.data.background ?? null
}

export async function setStoredBackground(background: BackgroundConfig): Promise<void> {
  await updateSession(sessionConfig(), { background })
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (nothing else references `SpotifySession` in a way this breaks — it was already `Partial<SpotifySession>` everywhere it's read).

- [ ] **Step 4: Commit**

```bash
git add src/server/session.ts
git commit -m "feat: add per-account background config storage to the session"
```

---

## Task 2: Background validation and file-storage logic (TDD)

**Files:**
- Create: `src/server/background.ts`
- Test: `src/server/background.test.ts`

**Interfaces:**
- Consumes: `setStoredBackground`, `getStoredBackground`, `BackgroundConfig` from `src/server/session.ts` (Task 1).
- Produces: `ALLOWED_BACKGROUND_COLORS` (readonly array of 7 hex strings), `isAllowedColor(color: string): boolean`, `sanitizeImageFilename(filename: string): string | null`, `listBackgroundImageFiles(): Promise<string[]>`, `saveBackgroundImageFile(file: File): Promise<string>`, `applyBackground(data: BackgroundConfig): Promise<BackgroundConfig>` — `applyBackground` is consumed by Task 3's `setBackground` server function; the rest are consumed by Task 3's other server function wrappers.

- [ ] **Step 1: Write the failing tests**

Create `src/server/background.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdir, mkdir, writeFile } from 'node:fs/promises'
import {
  ALLOWED_BACKGROUND_COLORS,
  isAllowedColor,
  sanitizeImageFilename,
  listBackgroundImageFiles,
  saveBackgroundImageFile,
  applyBackground,
} from './background'
import { setStoredBackground } from './session'

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('./session', () => ({
  getStoredBackground: vi.fn(),
  setStoredBackground: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('isAllowedColor', () => {
  it('accepts every color in the allowed palette', () => {
    for (const color of ALLOWED_BACKGROUND_COLORS) {
      expect(isAllowedColor(color)).toBe(true)
    }
  })

  it('rejects a color outside the allowed palette', () => {
    expect(isAllowedColor('#123456')).toBe(false)
  })
})

describe('sanitizeImageFilename', () => {
  it('accepts a plain filename', () => {
    expect(sanitizeImageFilename('sunset.jpg')).toBe('sunset.jpg')
  })

  it('rejects a path traversal attempt', () => {
    expect(sanitizeImageFilename('../../etc/passwd')).toBeNull()
  })

  it('rejects a filename containing a slash', () => {
    expect(sanitizeImageFilename('a/b.png')).toBeNull()
  })

  it('rejects a filename with no extension', () => {
    expect(sanitizeImageFilename('sunset')).toBeNull()
  })
})

describe('listBackgroundImageFiles', () => {
  it('returns the directory listing', async () => {
    vi.mocked(readdir).mockResolvedValue(['a.jpg', 'b.png'] as never)
    expect(await listBackgroundImageFiles()).toEqual(['a.jpg', 'b.png'])
  })

  it('returns an empty list when the directory does not exist yet', async () => {
    vi.mocked(readdir).mockRejectedValue(new Error('ENOENT'))
    expect(await listBackgroundImageFiles()).toEqual([])
  })
})

describe('saveBackgroundImageFile', () => {
  it('writes the file under a generated name and returns it', async () => {
    const file = new File(['fake image bytes'], 'photo.png', { type: 'image/png' })
    const filename = await saveBackgroundImageFile(file)

    expect(filename).toMatch(/^[0-9a-f-]+\.png$/)
    expect(mkdir).toHaveBeenCalled()
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining(filename), expect.any(Buffer))
  })

  it('rejects an unsupported MIME type', async () => {
    const file = new File(['not an image'], 'notes.txt', { type: 'text/plain' })
    await expect(saveBackgroundImageFile(file)).rejects.toThrow('Unsupported image type')
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('rejects a file over the size limit', async () => {
    const bigContent = new Uint8Array(8 * 1024 * 1024 + 1)
    const file = new File([bigContent], 'huge.png', { type: 'image/png' })
    await expect(saveBackgroundImageFile(file)).rejects.toThrow('Image too large')
    expect(writeFile).not.toHaveBeenCalled()
  })
})

describe('applyBackground', () => {
  it('persists a valid color and returns it', async () => {
    const result = await applyBackground({ type: 'color', value: '#0032db' })
    expect(result).toEqual({ type: 'color', value: '#0032db' })
    expect(setStoredBackground).toHaveBeenCalledWith({ type: 'color', value: '#0032db' })
  })

  it('rejects a color outside the allowed palette without persisting', async () => {
    await expect(applyBackground({ type: 'color', value: '#123456' })).rejects.toThrow('Color not allowed')
    expect(setStoredBackground).not.toHaveBeenCalled()
  })

  it('persists a valid image that exists in the shared pool', async () => {
    vi.mocked(readdir).mockResolvedValue(['sunset.jpg'] as never)
    const result = await applyBackground({ type: 'image', value: 'sunset.jpg' })
    expect(result).toEqual({ type: 'image', value: 'sunset.jpg' })
    expect(setStoredBackground).toHaveBeenCalledWith({ type: 'image', value: 'sunset.jpg' })
  })

  it('rejects a path-traversal image filename without persisting', async () => {
    await expect(applyBackground({ type: 'image', value: '../../etc/passwd' })).rejects.toThrow(
      'Invalid image filename',
    )
    expect(setStoredBackground).not.toHaveBeenCalled()
  })

  it('rejects an image filename not present in the shared pool', async () => {
    vi.mocked(readdir).mockResolvedValue(['other.jpg'] as never)
    await expect(applyBackground({ type: 'image', value: 'sunset.jpg' })).rejects.toThrow('Image not found')
    expect(setStoredBackground).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/server/background.test.ts`
Expected: FAIL — `./background` module does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/server/background.ts`:

```ts
import { getStoredBackground, setStoredBackground, type BackgroundConfig } from './session'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'

export type { BackgroundConfig }

export const ALLOWED_BACKGROUND_COLORS = [
  '#0032db',
  '#0689e4',
  '#7aeafe',
  '#9fe11d',
  '#ccff7c',
  '#000000',
  '#ffffff',
] as const

export function isAllowedColor(color: string): boolean {
  return (ALLOWED_BACKGROUND_COLORS as readonly string[]).includes(color)
}

const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/

export function sanitizeImageFilename(filename: string): string | null {
  if (basename(filename) !== filename) return null
  if (!SAFE_FILENAME_PATTERN.test(filename)) return null
  return filename
}

const BACKGROUNDS_DIR = join(process.cwd(), 'public', 'backgrounds')

export async function listBackgroundImageFiles(): Promise<string[]> {
  try {
    return await readdir(BACKGROUNDS_DIR)
  } catch {
    return []
  }
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function saveBackgroundImageFile(file: File): Promise<string> {
  const extension = MIME_EXTENSIONS[file.type]
  if (!extension) throw new Error(`Unsupported image type: ${file.type}`)
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`Image too large: ${file.size} bytes`)

  await mkdir(BACKGROUNDS_DIR, { recursive: true })
  const filename = `${randomUUID()}.${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(join(BACKGROUNDS_DIR, filename), buffer)
  return filename
}

export async function applyBackground(data: BackgroundConfig): Promise<BackgroundConfig> {
  if (data.type === 'color') {
    if (!isAllowedColor(data.value)) throw new Error(`Color not allowed: ${data.value}`)
    await setStoredBackground(data)
    return data
  }

  const safeName = sanitizeImageFilename(data.value)
  if (!safeName) throw new Error('Invalid image filename')

  const files = await listBackgroundImageFiles()
  if (!files.includes(safeName)) throw new Error('Image not found')

  const validated: BackgroundConfig = { type: 'image', value: safeName }
  await setStoredBackground(validated)
  return validated
}

// getStoredBackground is re-exported indirectly via Task 3's getBackgroundConfig
// server function — imported here now so Task 3 doesn't need a new import line.
export { getStoredBackground }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/server/background.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/background.ts src/server/background.test.ts
git commit -m "feat: add background color/image validation and file storage"
```

---

## Task 3: Server function wrappers for background config

**Files:**
- Modify: `src/server/background.ts`

**Interfaces:**
- Consumes: `applyBackground`, `listBackgroundImageFiles`, `saveBackgroundImageFile`, `getStoredBackground` (Task 2, same file).
- Produces: `getBackgroundConfig` (`createServerFn`, GET, no input, returns `Promise<BackgroundConfig | null>`), `setBackground` (`createServerFn`, POST, input `BackgroundConfig`, returns `Promise<BackgroundConfig>`), `listBackgroundImages` (`createServerFn`, GET, no input, returns `Promise<string[]>`), `uploadBackgroundImage` (`createServerFn`, POST, input `FormData` with an `"image"` file field, returns `Promise<{ filename: string }>`) — all four consumed by Task 6/7's `ConfigurationModal` and Task 8's `index.tsx`.

No new tests in this task — per this codebase's established convention (see `getTempo`, `getPlaylists`, `getTrackDynamics` in `src/server/spotify-api.ts`), `createServerFn`-wrapped functions are never unit-tested directly since they require a real server request context; only the plain functions they call (already tested in Task 2) are.

- [ ] **Step 1: Add the `createServerFn` import and the four wrappers**

Edit `src/server/background.ts`. Add to the top of the file:

```ts
import { createServerFn } from '@tanstack/react-start'
```

Replace the final line (`export { getStoredBackground }`) with:

```ts
export const getBackgroundConfig = createServerFn({ method: 'GET' }).handler(async () => getStoredBackground())

export const setBackground = createServerFn({ method: 'POST' })
  .validator((data: BackgroundConfig) => data)
  .handler(async ({ data }) => applyBackground(data))

export const listBackgroundImages = createServerFn({ method: 'GET' }).handler(async () => listBackgroundImageFiles())

export const uploadBackgroundImage = createServerFn({ method: 'POST' })
  .validator((data: FormData) => {
    const file = data.get('image')
    if (!(file instanceof File)) throw new Error('Missing image file')
    return file
  })
  .handler(async ({ data }) => ({ filename: await saveBackgroundImageFile(data) }))
```

- [ ] **Step 2: Run the full test suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all tests still pass (Task 2's 16 plus the rest of the suite), no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/background.ts
git commit -m "feat: add background config server functions"
```

---

## Task 4: `VisualizerBackdrop` component (TDD)

**Files:**
- Create: `src/client/VisualizerBackdrop.tsx`
- Create: `src/client/VisualizerBackdrop.css`
- Test: `src/client/VisualizerBackdrop.test.tsx`

**Interfaces:**
- Consumes: `BackgroundConfig` type from `src/server/background.ts` (Task 2).
- Produces: `<VisualizerBackdrop config={BackgroundConfig | null} />` — consumed by Task 8's `index.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/client/VisualizerBackdrop.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { VisualizerBackdrop } from './VisualizerBackdrop'

afterEach(cleanup)

describe('VisualizerBackdrop', () => {
  it('renders a solid background color for a color config', () => {
    const { container } = render(<VisualizerBackdrop config={{ type: 'color', value: '#0032db' }} />)
    const backdrop = container.querySelector('.visualizer-backdrop') as HTMLElement

    expect(backdrop.style.backgroundColor).toBe('rgb(0, 50, 219)')
  })

  it('renders a cover background image for an image config', () => {
    const { container } = render(<VisualizerBackdrop config={{ type: 'image', value: 'abc123.jpg' }} />)
    const backdrop = container.querySelector('.visualizer-backdrop') as HTMLElement

    expect(backdrop.style.backgroundImage).toBe('url(/backgrounds/abc123.jpg)')
    expect(backdrop.style.backgroundSize).toBe('cover')
  })

  it('renders with no special background when there is no config yet', () => {
    const { container } = render(<VisualizerBackdrop config={null} />)
    const backdrop = container.querySelector('.visualizer-backdrop') as HTMLElement

    expect(backdrop.style.backgroundColor).toBe('')
    expect(backdrop.style.backgroundImage).toBe('')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/client/VisualizerBackdrop.test.tsx`
Expected: FAIL — `./VisualizerBackdrop` module does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/client/VisualizerBackdrop.css`:

```css
.visualizer-backdrop {
  position: fixed;
  inset: 0;
}
```

Create `src/client/VisualizerBackdrop.tsx`:

```tsx
import type { BackgroundConfig } from '../server/background'
import './VisualizerBackdrop.css'

interface VisualizerBackdropProps {
  config: BackgroundConfig | null
}

export function VisualizerBackdrop({ config }: VisualizerBackdropProps) {
  const style =
    config?.type === 'color'
      ? { backgroundColor: config.value }
      : config?.type === 'image'
        ? {
            backgroundImage: `url(/backgrounds/${config.value})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : {}

  return <div className="visualizer-backdrop" style={style} />
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/client/VisualizerBackdrop.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/client/VisualizerBackdrop.tsx src/client/VisualizerBackdrop.css src/client/VisualizerBackdrop.test.tsx
git commit -m "feat: add VisualizerBackdrop component"
```

---

## Task 5: "Configuration" button in `PlayerChrome`

**Files:**
- Modify: `src/client/PlayerChrome.tsx`
- Modify: `src/client/PlayerChrome.test.tsx`

**Interfaces:**
- Produces: new `onOpenSettings: () => void` prop on `PlayerChrome` — consumed by Task 8's `index.tsx`.

- [ ] **Step 1: Write the failing test**

Edit `src/client/PlayerChrome.test.tsx`. In the `renderChrome` helper, add `onOpenSettings: vi.fn(),` to the `props` object (after `onVolumeChange: vi.fn(),`):

```ts
function renderChrome(overrides: Partial<Parameters<typeof PlayerChrome>[0]> = {}) {
  const onSeek = vi.fn()
  const props = {
    trackName: 'Aqua',
    artists: 'Aero',
    isPlaying: true,
    progressMs: 10_000,
    durationMs: 200_000,
    onTogglePlay: vi.fn(),
    onSkipNext: vi.fn(),
    onSkipPrevious: vi.fn(),
    onSeek,
    onVolumeChange: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  }
  const utils = render(<PlayerChrome {...props} />)
  return { ...utils, onSeek, seek: utils.getByLabelText('Seek') as HTMLInputElement }
}
```

Also add `onOpenSettings={vi.fn()}` to the plain `<PlayerChrome ... />` JSX inside the `rerender(...)` call in the `'shows the dragged position...'` test (the one at line ~46-58), so that test keeps compiling against the now-required prop.

Then add a new describe block at the end of the file:

```tsx
describe('PlayerChrome configuration', () => {
  it('calls onOpenSettings when the configuration button is clicked', () => {
    const onOpenSettings = vi.fn()
    const { getByLabelText } = renderChrome({ onOpenSettings })

    fireEvent.click(getByLabelText('Configuration'))

    expect(onOpenSettings).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/client/PlayerChrome.test.tsx`
Expected: FAIL — `getByLabelText('Configuration')` finds no element (and/or a TypeScript error on the missing prop, if type-checked as part of the run).

- [ ] **Step 3: Add the prop and button**

Edit `src/client/PlayerChrome.tsx`. In `PlayerChromeProps`, add after `onVolumeChange: (volume: number) => void`:

```ts
  onOpenSettings: () => void
```

In the destructured parameters, add `onOpenSettings,` after `onVolumeChange,`.

In the `.player-chrome__controls` div, add after the cinema-mode button (after the `</button>` that closes the "Hide player" button, before the closing `</div>`):

```tsx
        <button onClick={onOpenSettings} aria-label="Configuration">
          ⚙
        </button>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/client/PlayerChrome.test.tsx`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/client/PlayerChrome.tsx src/client/PlayerChrome.test.tsx
git commit -m "feat: add configuration button to the player controls"
```

---

## Task 6: `ConfigurationModal` shell with color picking (TDD)

**Files:**
- Create: `src/client/ConfigurationModal.tsx`
- Create: `src/client/ConfigurationModal.css`
- Test: `src/client/ConfigurationModal.test.tsx`

**Interfaces:**
- Consumes: `ALLOWED_BACKGROUND_COLORS`, `setBackground`, `BackgroundConfig` from `src/server/background.ts` (Tasks 2-3).
- Produces: `<ConfigurationModal isOpen backgroundConfig onClose onBackgroundConfigChange />` — extended in Task 7, consumed by Task 8's `index.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/client/ConfigurationModal.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'
import { ConfigurationModal } from './ConfigurationModal'
import { setBackground } from '../server/background'

vi.mock('../server/background', () => ({
  ALLOWED_BACKGROUND_COLORS: ['#0032db', '#0689e4', '#7aeafe', '#9fe11d', '#ccff7c', '#000000', '#ffffff'],
  setBackground: vi.fn(),
}))

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
})

const ALLOWED_BACKGROUND_COLORS = ['#0032db', '#0689e4', '#7aeafe', '#9fe11d', '#ccff7c', '#000000', '#ffffff']

describe('ConfigurationModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfigurationModal isOpen={false} onClose={vi.fn()} backgroundConfig={null} onBackgroundConfigChange={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('shows all 7 color swatches by default', () => {
    render(<ConfigurationModal isOpen onClose={vi.fn()} backgroundConfig={null} onBackgroundConfigChange={vi.fn()} />)

    for (const color of ALLOWED_BACKGROUND_COLORS) {
      expect(screen.getByLabelText(`Set background color ${color}`)).not.toBeNull()
    }
  })

  it('selecting a color calls setBackground and notifies the parent', async () => {
    vi.mocked(setBackground).mockResolvedValue(undefined as never)
    const onBackgroundConfigChange = vi.fn()
    render(
      <ConfigurationModal
        isOpen
        onClose={vi.fn()}
        backgroundConfig={null}
        onBackgroundConfigChange={onBackgroundConfigChange}
      />,
    )

    fireEvent.click(screen.getByLabelText('Set background color #0032db'))

    await vi.waitFor(() =>
      expect(onBackgroundConfigChange).toHaveBeenCalledWith({ type: 'color', value: '#0032db' }),
    )
    expect(setBackground).toHaveBeenCalledWith({ data: { type: 'color', value: '#0032db' } })
  })

  it('shows an error message when selecting a color fails', async () => {
    vi.mocked(setBackground).mockRejectedValue(new Error('nope'))
    render(<ConfigurationModal isOpen onClose={vi.fn()} backgroundConfig={null} onBackgroundConfigChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Set background color #0032db'))

    expect(await screen.findByText(/couldn't set/i)).not.toBeNull()
  })

  it('clicking the backdrop closes the modal', () => {
    const onClose = vi.fn()
    const { container } = render(
      <ConfigurationModal isOpen onClose={onClose} backgroundConfig={null} onBackgroundConfigChange={vi.fn()} />,
    )

    fireEvent.click(container.querySelector('.configuration-modal__backdrop') as HTMLElement)

    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/client/ConfigurationModal.test.tsx`
Expected: FAIL — `./ConfigurationModal` module does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/client/ConfigurationModal.css`:

```css
.configuration-modal__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 42, 53, 0.35);
  display: grid;
  place-items: center;
  z-index: 10;
}

.configuration-modal {
  width: min(420px, 90vw);
  max-height: 80vh;
  overflow-y: auto;
  padding: 1.5rem;
  border-radius: 1.5rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(120, 200, 220, 0.2));
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 32px rgba(0, 60, 80, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: #0a2a35;
  font-family: system-ui, sans-serif;
}

.configuration-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.configuration-modal__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.configuration-modal__close {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 6px rgba(0, 60, 80, 0.2);
  color: #0a2a35;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.configuration-modal__error {
  margin: 0 0 1rem;
  color: #a02040;
  font-size: 0.9rem;
}

.configuration-modal__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.configuration-modal__swatch {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 6px rgba(0, 60, 80, 0.2);
  cursor: pointer;
}

.configuration-modal__swatch--selected {
  border-color: #0a2a35;
}
```

Create `src/client/ConfigurationModal.tsx`:

```tsx
import { useState } from 'react'
import { ALLOWED_BACKGROUND_COLORS, setBackground, type BackgroundConfig } from '../server/background'
import './ConfigurationModal.css'

interface ConfigurationModalProps {
  isOpen: boolean
  onClose: () => void
  backgroundConfig: BackgroundConfig | null
  onBackgroundConfigChange: (config: BackgroundConfig) => void
}

export function ConfigurationModal({
  isOpen,
  onClose,
  backgroundConfig,
  onBackgroundConfigChange,
}: ConfigurationModalProps) {
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function selectColor(color: string) {
    setError(null)
    try {
      await setBackground({ data: { type: 'color', value: color } })
      onBackgroundConfigChange({ type: 'color', value: color })
    } catch {
      setError("Couldn't set that background. Try again.")
    }
  }

  return (
    <div className="configuration-modal__backdrop" onClick={onClose}>
      <div className="configuration-modal" onClick={(e) => e.stopPropagation()}>
        <div className="configuration-modal__header">
          <h2 className="configuration-modal__title">Background</h2>
          <button className="configuration-modal__close" onClick={onClose} aria-label="Close configuration">
            ×
          </button>
        </div>

        {error && <p className="configuration-modal__error">{error}</p>}

        <div className="configuration-modal__swatches">
          {ALLOWED_BACKGROUND_COLORS.map((color) => (
            <button
              key={color}
              className={
                backgroundConfig?.type === 'color' && backgroundConfig.value === color
                  ? 'configuration-modal__swatch configuration-modal__swatch--selected'
                  : 'configuration-modal__swatch'
              }
              style={{ backgroundColor: color }}
              onClick={() => selectColor(color)}
              aria-label={`Set background color ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/client/ConfigurationModal.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/client/ConfigurationModal.tsx src/client/ConfigurationModal.css src/client/ConfigurationModal.test.tsx
git commit -m "feat: add ConfigurationModal with background color picking"
```

---

## Task 7: Image mode and upload in `ConfigurationModal` (TDD)

**Files:**
- Modify: `src/client/ConfigurationModal.tsx`
- Modify: `src/client/ConfigurationModal.css`
- Modify: `src/client/ConfigurationModal.test.tsx`

**Interfaces:**
- Consumes: `listBackgroundImages`, `uploadBackgroundImage` from `src/server/background.ts` (Task 3), in addition to Task 6's imports.
- Produces: no new props — extends the existing `ConfigurationModal` with an Image mode alongside Color mode.

- [ ] **Step 1: Write the failing tests**

Edit `src/client/ConfigurationModal.test.tsx`. Update the `vi.mock('../server/background', ...)` factory to add the two new functions:

```ts
vi.mock('../server/background', () => ({
  ALLOWED_BACKGROUND_COLORS: ['#0032db', '#0689e4', '#7aeafe', '#9fe11d', '#ccff7c', '#000000', '#ffffff'],
  setBackground: vi.fn(),
  listBackgroundImages: vi.fn(),
  uploadBackgroundImage: vi.fn(),
}))
```

Update the import line to also pull in the two new mocked functions:

```ts
import { setBackground, listBackgroundImages, uploadBackgroundImage } from '../server/background'
```

Add two new tests at the end of the `describe('ConfigurationModal', ...)` block:

```tsx
  it('loads and shows uploaded images when switching to the Image tab', async () => {
    vi.mocked(listBackgroundImages).mockResolvedValue(['sunset.jpg'])
    render(<ConfigurationModal isOpen onClose={vi.fn()} backgroundConfig={null} onBackgroundConfigChange={vi.fn()} />)

    fireEvent.click(screen.getByText('Image'))

    expect(await screen.findByLabelText('Set background image sunset.jpg')).not.toBeNull()
  })

  it('uploading an image saves it and selects it', async () => {
    vi.mocked(listBackgroundImages).mockResolvedValue([])
    vi.mocked(uploadBackgroundImage).mockResolvedValue({ filename: 'new.png' })
    vi.mocked(setBackground).mockResolvedValue(undefined as never)
    const onBackgroundConfigChange = vi.fn()
    render(
      <ConfigurationModal
        isOpen
        onClose={vi.fn()}
        backgroundConfig={null}
        onBackgroundConfigChange={onBackgroundConfigChange}
      />,
    )

    fireEvent.click(screen.getByText('Image'))
    await screen.findByLabelText('Upload new image')

    const file = new File(['x'], 'new.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Upload new image'), { target: { files: [file] } })

    await vi.waitFor(() =>
      expect(onBackgroundConfigChange).toHaveBeenCalledWith({ type: 'image', value: 'new.png' }),
    )
    expect(uploadBackgroundImage).toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/client/ConfigurationModal.test.tsx`
Expected: The two new tests FAIL (no "Image" tab exists yet); the five existing tests still pass.

- [ ] **Step 3: Add the tab switcher, image mode, and upload handling**

Edit `src/client/ConfigurationModal.css`. Add at the end:

```css
.configuration-modal__tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.configuration-modal__tab {
  flex: 1;
  padding: 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.4);
  color: #0a2a35;
  cursor: pointer;
}

.configuration-modal__tab--active {
  background: rgba(255, 255, 255, 0.85);
  font-weight: 600;
}

.configuration-modal__status {
  opacity: 0.7;
}

.configuration-modal__images {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.configuration-modal__thumb {
  width: 4.5rem;
  height: 4.5rem;
  padding: 0;
  border-radius: 0.75rem;
  border: 2px solid rgba(255, 255, 255, 0.8);
  overflow: hidden;
  cursor: pointer;
}

.configuration-modal__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.configuration-modal__thumb--selected {
  border-color: #0a2a35;
}

.configuration-modal__upload {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 0.75rem;
  border: 2px dashed rgba(10, 42, 53, 0.4);
  font-size: 0.7rem;
  text-align: center;
  cursor: pointer;
  padding: 0.25rem;
}

.configuration-modal__upload input {
  display: none;
}
```

Replace the full contents of `src/client/ConfigurationModal.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import {
  ALLOWED_BACKGROUND_COLORS,
  setBackground,
  listBackgroundImages,
  uploadBackgroundImage,
  type BackgroundConfig,
} from '../server/background'
import './ConfigurationModal.css'

interface ConfigurationModalProps {
  isOpen: boolean
  onClose: () => void
  backgroundConfig: BackgroundConfig | null
  onBackgroundConfigChange: (config: BackgroundConfig) => void
}

export function ConfigurationModal({
  isOpen,
  onClose,
  backgroundConfig,
  onBackgroundConfigChange,
}: ConfigurationModalProps) {
  const [mode, setMode] = useState<'color' | 'image'>('color')
  const [images, setImages] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || mode !== 'image' || images !== null) return
    listBackgroundImages().then(setImages)
  }, [isOpen, mode, images])

  if (!isOpen) return null

  async function selectColor(color: string) {
    setError(null)
    try {
      await setBackground({ data: { type: 'color', value: color } })
      onBackgroundConfigChange({ type: 'color', value: color })
    } catch {
      setError("Couldn't set that background. Try again.")
    }
  }

  async function selectImage(filename: string) {
    setError(null)
    try {
      await setBackground({ data: { type: 'image', value: filename } })
      onBackgroundConfigChange({ type: 'image', value: filename })
    } catch {
      setError("Couldn't set that background. Try again.")
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const { filename } = await uploadBackgroundImage({ data: formData })
      setImages((prev) => [...(prev ?? []), filename])
      await selectImage(filename)
    } catch {
      setError("Couldn't upload that image. Try again.")
    }
  }

  return (
    <div className="configuration-modal__backdrop" onClick={onClose}>
      <div className="configuration-modal" onClick={(e) => e.stopPropagation()}>
        <div className="configuration-modal__header">
          <h2 className="configuration-modal__title">Background</h2>
          <button className="configuration-modal__close" onClick={onClose} aria-label="Close configuration">
            ×
          </button>
        </div>

        <div className="configuration-modal__tabs">
          <button
            className={
              mode === 'color'
                ? 'configuration-modal__tab configuration-modal__tab--active'
                : 'configuration-modal__tab'
            }
            onClick={() => setMode('color')}
          >
            Color
          </button>
          <button
            className={
              mode === 'image'
                ? 'configuration-modal__tab configuration-modal__tab--active'
                : 'configuration-modal__tab'
            }
            onClick={() => setMode('image')}
          >
            Image
          </button>
        </div>

        {error && <p className="configuration-modal__error">{error}</p>}

        {mode === 'color' ? (
          <div className="configuration-modal__swatches">
            {ALLOWED_BACKGROUND_COLORS.map((color) => (
              <button
                key={color}
                className={
                  backgroundConfig?.type === 'color' && backgroundConfig.value === color
                    ? 'configuration-modal__swatch configuration-modal__swatch--selected'
                    : 'configuration-modal__swatch'
                }
                style={{ backgroundColor: color }}
                onClick={() => selectColor(color)}
                aria-label={`Set background color ${color}`}
              />
            ))}
          </div>
        ) : (
          <div className="configuration-modal__images">
            {images === null ? (
              <p className="configuration-modal__status">Loading images...</p>
            ) : (
              images.map((filename) => (
                <button
                  key={filename}
                  className={
                    backgroundConfig?.type === 'image' && backgroundConfig.value === filename
                      ? 'configuration-modal__thumb configuration-modal__thumb--selected'
                      : 'configuration-modal__thumb'
                  }
                  onClick={() => selectImage(filename)}
                  aria-label={`Set background image ${filename}`}
                >
                  <img src={`/backgrounds/${filename}`} alt="" />
                </button>
              ))
            )}
            <label className="configuration-modal__upload">
              Upload new image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  handleUpload(file)
                }}
                aria-label="Upload new image"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/client/ConfigurationModal.test.tsx`
Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/client/ConfigurationModal.tsx src/client/ConfigurationModal.css src/client/ConfigurationModal.test.tsx
git commit -m "feat: add image picking and upload to ConfigurationModal"
```

---

## Task 8: Wire it all into the Now Playing screen

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `getBackgroundConfig`, `type BackgroundConfig` from `src/server/background.ts` (Task 3); `VisualizerBackdrop` (Task 4); `onOpenSettings` prop on `PlayerChrome` (Task 5); `ConfigurationModal` (Tasks 6-7).

No new automated tests — this route has no existing test file (verified manually, same convention as the rest of `index.tsx`'s wiring).

- [ ] **Step 1: Ignore uploaded images**

Edit `.gitignore`. Add a new line at the end:

```
public/backgrounds/
```

- [ ] **Step 2: Add imports**

Edit `src/routes/index.tsx`. Add after the existing `import { gainToIntensity } from '../client/gainToIntensity'` line:

```ts
import { getBackgroundConfig, type BackgroundConfig } from '../server/background'
import { VisualizerBackdrop } from '../client/VisualizerBackdrop'
import { ConfigurationModal } from '../client/ConfigurationModal'
```

- [ ] **Step 3: Add state and the background-fetch effect**

In the `Index` function, after the line `const [dynamics, setDynamics] = useState<TrackDynamics>(DEFAULT_TRACK_DYNAMICS)`, add:

```ts
  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
```

After the existing `useEffect` that redirects on `authentication_error` (the one closing with `}, [error, navigate])`), add a new effect:

```ts
  useEffect(() => {
    let cancelled = false
    getBackgroundConfig().then((config) => {
      if (!cancelled) setBackgroundConfig(config)
    })
    return () => {
      cancelled = true
    }
  }, [])
```

- [ ] **Step 4: Render the backdrop, the configuration button, and the modal**

Replace the final `return` block of `Index` (the one rendering `<Visualizer>` and `<PlayerChrome>`):

```tsx
  return (
    <>
      <Visualizer
        frame={{
          progressMs: state.progressMs,
          durationMs: state.durationMs,
          bpm: dynamics.bpm,
          palette,
          isPlaying: state.isPlaying,
          volumeIntensity: gainToIntensity(dynamics.gain),
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
```

with:

```tsx
  return (
    <>
      <VisualizerBackdrop config={backgroundConfig} />
      <Visualizer
        frame={{
          progressMs: state.progressMs,
          durationMs: state.durationMs,
          bpm: dynamics.bpm,
          palette,
          isPlaying: state.isPlaying,
          volumeIntensity: gainToIntensity(dynamics.gain),
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
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <ConfigurationModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        backgroundConfig={backgroundConfig}
        onBackgroundConfigChange={setBackgroundConfig}
      />
    </>
  )
```

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all tests pass, no type errors.

- [ ] **Step 6: Manual end-to-end verification**

1. Start the dev server, log in if needed, use the playlist picker to start playback.
2. Confirm the ⚙ button appears as the 6th button in the transport row.
3. Click it — confirm the modal opens centered, showing 7 color swatches.
4. Click a color swatch — confirm the modal shows it highlighted, and the area behind the visualizer bars immediately changes to that color (no reload).
5. Click the "Image" tab — confirm it shows "Loading images..." briefly then an empty grid plus an "Upload new image" control (first run, no images yet).
6. Upload an image file — confirm it appears in the grid, is immediately selected (highlighted), and the visualizer's backdrop shows that image (cover-fit) behind the bars.
7. Reload the page and resume playback — confirm the previously selected background is restored automatically (proves the per-account session persistence works).
8. Close the modal via the × button and via clicking the dimmed backdrop — confirm both work.
9. Check `public/backgrounds/` on disk — confirm the uploaded file is actually there with a generated name.

- [ ] **Step 7: Commit**

```bash
git add src/routes/index.tsx .gitignore
git commit -m "feat: wire background personalization into the Now Playing screen"
```
