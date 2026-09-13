import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdir, mkdir, writeFile } from 'node:fs/promises'
import {
  listProfileImageFiles,
  saveProfileImageFile,
  applyProfileImage,
  clearProfileImage,
} from './profileImageStorage'
import { setStoredProfileImage, clearStoredProfileImage } from './session'

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
  getStoredProfileImage: vi.fn(),
  setStoredProfileImage: vi.fn(),
  clearStoredProfileImage: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listProfileImageFiles', () => {
  it('returns the directory listing filtered to allowed image extensions', async () => {
    vi.mocked(readdir).mockResolvedValue(['a.jpg', 'b.png', '.DS_Store'] as never)
    expect(await listProfileImageFiles()).toEqual(['a.jpg', 'b.png'])
  })

  it('returns an empty list when the directory does not exist yet', async () => {
    vi.mocked(readdir).mockRejectedValue(new Error('ENOENT'))
    expect(await listProfileImageFiles()).toEqual([])
  })
})

describe('saveProfileImageFile', () => {
  it('writes the file under a generated name and returns it', async () => {
    const file = new File(['fake image bytes'], 'photo.png', { type: 'image/png' })
    const filename = await saveProfileImageFile(file)

    expect(filename).toMatch(/^[0-9a-f-]+\.png$/)
    expect(mkdir).toHaveBeenCalled()
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining(filename), expect.any(Buffer))
  })

  it('rejects an unsupported MIME type', async () => {
    const file = new File(['not an image'], 'notes.txt', { type: 'text/plain' })
    await expect(saveProfileImageFile(file)).rejects.toThrow('Unsupported image type')
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('rejects a file over the size limit', async () => {
    const bigContent = new Uint8Array(8 * 1024 * 1024 + 1)
    const file = new File([bigContent], 'huge.png', { type: 'image/png' })
    await expect(saveProfileImageFile(file)).rejects.toThrow('Image too large')
    expect(writeFile).not.toHaveBeenCalled()
  })
})

describe('applyProfileImage', () => {
  it('persists a valid selection from the shared pool and returns it', async () => {
    vi.mocked(readdir).mockResolvedValue(['avatar.jpg'] as never)
    const result = await applyProfileImage('avatar.jpg')
    expect(result).toEqual('avatar.jpg')
    expect(setStoredProfileImage).toHaveBeenCalledWith('avatar.jpg')
  })

  it('rejects a path-traversal filename without persisting', async () => {
    await expect(applyProfileImage('../../etc/passwd')).rejects.toThrow('Invalid image filename')
    expect(setStoredProfileImage).not.toHaveBeenCalled()
  })

  it('rejects a filename not present in the shared pool', async () => {
    vi.mocked(readdir).mockResolvedValue(['other.jpg'] as never)
    await expect(applyProfileImage('avatar.jpg')).rejects.toThrow('Image not found')
    expect(setStoredProfileImage).not.toHaveBeenCalled()
  })
})

describe('clearProfileImage', () => {
  it('resets the stored selection', async () => {
    await clearProfileImage()
    expect(clearStoredProfileImage).toHaveBeenCalledTimes(1)
  })
})
