import * as fsp from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { sanitizeImageFilename } from '../shared/background'
import { getStoredProfileImage, setStoredProfileImage, clearStoredProfileImage } from './session'

const PROFILE_IMAGES_DIR = join(process.cwd(), 'public', 'profile-images')
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'png', 'webp', 'gif']

export async function listProfileImageFiles(): Promise<string[]> {
  try {
    const files = await fsp.readdir(PROFILE_IMAGES_DIR)
    return files.filter((file) => ALLOWED_IMAGE_EXTENSIONS.some((ext) => file.endsWith(`.${ext}`)))
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

export async function saveProfileImageFile(file: File): Promise<string> {
  const extension = MIME_EXTENSIONS[file.type]
  if (!extension) throw new Error(`Unsupported image type: ${file.type}`)
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`Image too large: ${file.size} bytes`)

  await fsp.mkdir(PROFILE_IMAGES_DIR, { recursive: true })
  const filename = `${randomUUID()}.${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await fsp.writeFile(join(PROFILE_IMAGES_DIR, filename), buffer)
  return filename
}

/**
 * Selects an already-uploaded file as the profile picture. Unlike
 * `applyBackground`, there is no "color" branch — a profile picture is
 * always an image, so this only ever validates a filename against the
 * upload pool.
 */
export async function applyProfileImage(filename: string): Promise<string> {
  const safeName = sanitizeImageFilename(filename)
  if (!safeName) throw new Error('Invalid image filename')

  const files = await listProfileImageFiles()
  if (!files.includes(safeName)) throw new Error('Image not found')

  await setStoredProfileImage(safeName)
  return safeName
}

/** Resets the selection to the default icon ("Remove" in the picker). */
export async function clearProfileImage(): Promise<void> {
  await clearStoredProfileImage()
}

export { getStoredProfileImage }
