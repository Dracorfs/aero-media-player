import * as fsp from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { isAllowedColor, sanitizeImageFilename, type BackgroundConfig } from '../shared/background'
import { getStoredBackground, setStoredBackground } from './session'

const BACKGROUNDS_DIR = join(process.cwd(), 'public', 'backgrounds')
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'png', 'webp', 'gif']

export async function listBackgroundImageFiles(): Promise<string[]> {
  try {
    const files = await fsp.readdir(BACKGROUNDS_DIR)
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

export async function saveBackgroundImageFile(file: File): Promise<string> {
  const extension = MIME_EXTENSIONS[file.type]
  if (!extension) throw new Error(`Unsupported image type: ${file.type}`)
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`Image too large: ${file.size} bytes`)

  await fsp.mkdir(BACKGROUNDS_DIR, { recursive: true })
  const filename = `${randomUUID()}.${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await fsp.writeFile(join(BACKGROUNDS_DIR, filename), buffer)
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

export { getStoredBackground }
