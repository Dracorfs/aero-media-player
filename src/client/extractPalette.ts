interface ColorBucket {
  r: number
  g: number
  b: number
  n: number
}

// Keeps bars/UI accents from rendering as near-black against the dark scene
// background — album covers with large dark regions would otherwise produce
// a near-black dominant color. A color only reads as "blackish" when every
// channel is low, so this checks HSV value (the brightest channel), not
// perceived luminance — luminance weights blue/red far below green, which
// would otherwise wash out vivid, clearly-non-black hues like pure red/blue.
// The bars' material is metallic with no environment map, so even a
// "medium gray" (value ~120) reads as near-black on screen with no diffuse
// light to reflect — the floor has to be high enough to read as genuinely
// light, not just technically non-black.
const MIN_VALUE = 200

function liftTowardWhite(r: number, g: number, b: number): [number, number, number] {
  const value = Math.max(r, g, b)
  if (value >= MIN_VALUE) return [r, g, b]

  const t = (MIN_VALUE - value) / (255 - value)
  return [r + t * (255 - r), g + t * (255 - g), b + t * (255 - b)]
}

export function extractPalette(pixels: Uint8ClampedArray, count: number): string[] {
  const buckets = new Map<string, ColorBucket>()

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]
    if (alpha < 128) continue

    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`

    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
    bucket.r += r
    bucket.g += g
    bucket.b += b
    bucket.n += 1
    buckets.set(key, bucket)
  }

  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n)

  return sorted.slice(0, count).map((bucket) => {
    const [r, g, b] = liftTowardWhite(bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n)
    return toHex(r, g, b)
  })
}

function toHex(r: number, g: number, b: number): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}
