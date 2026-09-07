import { describe, it, expect } from 'vitest'
import { extractPalette } from './extractPalette'

function solidColorPixels(r: number, g: number, b: number, count: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(count * 4)
  for (let i = 0; i < count; i++) {
    pixels[i * 4] = r
    pixels[i * 4 + 1] = g
    pixels[i * 4 + 2] = b
    pixels[i * 4 + 3] = 255
  }
  return pixels
}

describe('extractPalette', () => {
  it('returns the single color for a solid-color image', () => {
    const pixels = solidColorPixels(200, 40, 40, 16)
    const palette = extractPalette(pixels, 4)

    expect(palette).toHaveLength(1)
    expect(palette[0]).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('ignores fully transparent pixels', () => {
    const opaque = solidColorPixels(10, 200, 10, 8)
    const transparent = new Uint8ClampedArray(8 * 4)
    const pixels = new Uint8ClampedArray([...opaque, ...transparent])

    const palette = extractPalette(pixels, 4)

    expect(palette).toEqual(['#0ac80a'])
  })

  it('lifts a near-black dominant color toward white instead of returning it as-is', () => {
    const pixels = solidColorPixels(10, 10, 10, 8)
    const palette = extractPalette(pixels, 1)

    expect(palette).toEqual(['#c8c8c8'])
  })

  it('leaves already-bright colors unchanged', () => {
    const pixels = solidColorPixels(230, 230, 230, 8)
    const palette = extractPalette(pixels, 1)

    expect(palette).toEqual(['#e6e6e6'])
  })

  it('leaves vivid saturated colors unchanged even though a dark hue is not "blackish"', () => {
    const pixels = solidColorPixels(20, 20, 220, 8)
    const palette = extractPalette(pixels, 1)

    expect(palette).toEqual(['#1414dc'])
  })

  it('preserves hue direction while lightening a dark, low-value color', () => {
    const pixels = solidColorPixels(80, 10, 10, 8)
    const palette = extractPalette(pixels, 1)

    expect(palette).toEqual(['#c8b2b2'])
  })

  it('returns at most `count` colors, most frequent first', () => {
    const red = solidColorPixels(220, 20, 20, 10)
    const blue = solidColorPixels(20, 20, 220, 3)
    const pixels = new Uint8ClampedArray([...red, ...blue])

    const palette = extractPalette(pixels, 1)

    expect(palette).toHaveLength(1)
    expect(palette[0]).toBe('#dc1414')
  })
})
