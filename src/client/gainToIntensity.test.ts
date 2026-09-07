import { describe, it, expect } from 'vitest'
import { gainToIntensity } from './gainToIntensity'

describe('gainToIntensity', () => {
  it('maps a heavily-normalized loud-master gain to the top of the intensity range', () => {
    expect(gainToIntensity(-15)).toBe(1)
  })

  it('maps a near-zero quiet-master gain to the bottom of the intensity range', () => {
    expect(gainToIntensity(0)).toBe(0.3)
  })

  it('clamps gains louder than the modeled range to the max intensity', () => {
    expect(gainToIntensity(-20)).toBe(1)
  })

  it('clamps positive gains to the min intensity', () => {
    expect(gainToIntensity(5)).toBe(0.3)
  })

  it('interpolates linearly between the min and max gain bounds', () => {
    expect(gainToIntensity(-12)).toBeCloseTo(0.86)
  })

  it('maps the default fallback gain to the midpoint of the intensity range', () => {
    expect(gainToIntensity(-7.5)).toBeCloseTo(0.65)
  })
})
