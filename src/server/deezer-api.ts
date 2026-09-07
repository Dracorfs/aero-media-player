export interface DeezerTrackDynamics {
  bpm: number
  gain: number
}

// Deezer's API returns HTTP 200 even for lookup failures, embedding an
// `error` object in the body instead — response.ok alone isn't reliable.
export async function fetchDeezerDynamics(isrc: string): Promise<DeezerTrackDynamics | null> {
  try {
    const response = await fetch(`https://api.deezer.com/track/isrc:${isrc}`)
    if (!response.ok) return null

    const body = (await response.json()) as { bpm?: number; gain?: number; error?: unknown }
    if (body.error) return null
    // Deezer reports bpm: 0 for tracks it hasn't beat-analyzed — not real.
    if (typeof body.bpm !== 'number' || body.bpm <= 0) return null
    if (typeof body.gain !== 'number') return null

    return { bpm: body.bpm, gain: body.gain }
  } catch {
    return null
  }
}
