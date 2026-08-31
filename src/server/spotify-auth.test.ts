import { describe, it, expect, vi, afterEach } from 'vitest'
import { exchangeCodeForTokens, refreshAccessToken } from './spotify-auth'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('exchangeCodeForTokens', () => {
  it('returns tokens on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
      }),
    )

    const tokens = await exchangeCodeForTokens('some-code', 'some-verifier')

    expect(tokens.accessToken).toBe('at')
    expect(tokens.refreshToken).toBe('rt')
    expect(tokens.expiresAt).toBeGreaterThan(Date.now())
  })

  it('throws when Spotify responds with a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }))

    await expect(exchangeCodeForTokens('bad-code', 'verifier')).rejects.toThrow('400')
  })
})

describe('refreshAccessToken', () => {
  it('reuses the old refresh token when Spotify does not return a new one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-at', expires_in: 3600 }),
      }),
    )

    const tokens = await refreshAccessToken('old-rt')

    expect(tokens.accessToken).toBe('new-at')
    expect(tokens.refreshToken).toBe('old-rt')
  })
})
