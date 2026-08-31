import { useEffect, useState } from 'react'
import { extractPalette } from './extractPalette'

const DEFAULT_PALETTE = ['#7fd8e8', '#c9d6df', '#3fa9c9', '#e8f4f8']
const SAMPLE_SIZE = 64

export function useAlbumPalette(albumArtUrl: string | undefined): string[] {
  const [palette, setPalette] = useState<string[]>(DEFAULT_PALETTE)

  useEffect(() => {
    if (!albumArtUrl) {
      setPalette(DEFAULT_PALETTE)
      return
    }

    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'

    image.onload = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SAMPLE_SIZE
        canvas.height = SAMPLE_SIZE
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('2d context unavailable')

        ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
        const extracted = extractPalette(data, 4)
        setPalette(extracted.length > 0 ? extracted : DEFAULT_PALETTE)
      } catch {
        setPalette(DEFAULT_PALETTE)
      }
    }
    image.onerror = () => {
      if (!cancelled) setPalette(DEFAULT_PALETTE)
    }
    image.src = albumArtUrl

    return () => {
      cancelled = true
    }
  }, [albumArtUrl])

  return palette
}
