import { describe, it, expect } from 'vitest'
import { ALLOWED_BACKGROUND_COLORS, isAllowedColor, sanitizeImageFilename } from './background'

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
