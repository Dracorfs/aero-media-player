interface ColorBucket {
  r: number
  g: number
  b: number
  n: number
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

  return sorted
    .slice(0, count)
    .map((bucket) => toHex(bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n))
}

function toHex(r: number, g: number, b: number): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}
