import { describe, it, expect, vi, afterEach } from 'vitest'
import { isExpiringSoon, fetchTempo } from './spotify-api'
import { isNotAuthenticatedError } from '../shared/authError'
import { MissingEnvVarError } from './env'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isExpiringSoon', () => {
  it('is true once within the 60s buffer of expiry', () => {
    const now = 1_000_000
    expect(isExpiringSoon(now + 30_000, now)).toBe(true)
  })

  it('is false when well before expiry', () => {
    const now = 1_000_000
    expect(isExpiringSoon(now + 5 * 60_000, now)).toBe(false)
  })

  it('is true when already expired', () => {
    const now = 1_000_000
    expect(isExpiringSoon(now - 1000, now)).toBe(true)
  })
})

describe('fetchTempo', () => {
  it('returns the tempo from a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tempo: 128.4 }) }),
    )

    expect(await fetchTempo('track-1', 'token')).toBe(128.4)
  })

  it('falls back to 120 BPM on a non-ok response (e.g. deprecated-endpoint 403)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))

    expect(await fetchTempo('track-1', 'token')).toBe(120)
  })

  it('falls back to 120 BPM when the fetch itself throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    )

    expect(await fetchTempo('track-1', 'token')).toBe(120)
  })
})

describe('isNotAuthenticatedError', () => {
  it('is true for the missing-session error', () => {
    expect(isNotAuthenticatedError(new Error('Not authenticated'))).toBe(true)
  })

  it('is true for a failed refresh (revoked refresh token)', () => {
    expect(isNotAuthenticatedError(new Error('Spotify token refresh failed: 400'))).toBe(true)
  })

  it('is true for a plain serialized error object crossing the server-fn boundary', () => {
    expect(isNotAuthenticatedError({ message: 'Not authenticated' })).toBe(true)
  })

  it('is false for a config error, so it is not swallowed into a login redirect', () => {
    expect(isNotAuthenticatedError(new MissingEnvVarError('SPOTIFY_CLIENT_ID'))).toBe(false)
  })

  it('is false for non-error values', () => {
    expect(isNotAuthenticatedError(undefined)).toBe(false)
    expect(isNotAuthenticatedError('Not authenticated')).toBe(false)
  })
})
