export const ALLOWED_BACKGROUND_COLORS = [
  '#0032db',
  '#0689e4',
  '#7aeafe',
  '#9fe11d',
  '#ccff7c',
  '#000000',
  '#ffffff',
  '#fbb905',
  '#fc720f',
  '#d55e0f',
] as const

export type BackgroundConfig = { type: 'color'; value: string } | { type: 'image'; value: string }

export function isAllowedColor(color: string): boolean {
  return (ALLOWED_BACKGROUND_COLORS as readonly string[]).includes(color)
}

// This pattern anchors the entire string (^...$) and only allows
// [A-Za-z0-9_-] before the extension, so it already rejects "/" and ".."
// on its own — no separate node:path basename() check is needed.
const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/

export function sanitizeImageFilename(filename: string): string | null {
  if (!SAFE_FILENAME_PATTERN.test(filename)) return null
  return filename
}
