import { createServerFn } from '@tanstack/react-start'
import { getStoredBackground, setStoredBackground, type BackgroundConfig } from './session'
import * as fsp from 'node:fs/promises'
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
    return await fsp.readdir(BACKGROUNDS_DIR)
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
