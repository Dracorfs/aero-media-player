import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchDeezerDynamics } from './deezer-api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchDeezerDynamics', () => {
  it('returns bpm and gain from a successful ISRC lookup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bpm: 153.7, gain: -12 }) }),
    )

    expect(await fetchDeezerDynamics('USMC16356894')).toEqual({ bpm: 153.7, gain: -12 })
  })

  it('returns null when Deezer responds with a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    expect(await fetchDeezerDynamics('unknown-isrc')).toBeNull()
  })

  it('returns null when Deezer embeds an error object in a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: { type: 'DataException', code: 800 } }) }),
    )

    expect(await fetchDeezerDynamics('unknown-isrc')).toBeNull()
  })

  it('returns null when the track has not been analyzed for bpm', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bpm: 0, gain: -8 }) }))

    expect(await fetchDeezerDynamics('some-isrc')).toBeNull()
  })

  it('returns null when gain is missing from the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bpm: 120 }) }))

    expect(await fetchDeezerDynamics('some-isrc')).toBeNull()
  })

  it('returns null when the fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    expect(await fetchDeezerDynamics('some-isrc')).toBeNull()
  })
})
