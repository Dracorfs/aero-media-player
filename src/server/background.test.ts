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

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    readdir: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  }
})

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
