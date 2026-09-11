import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  exchangeCodeForTokens,
  refreshAccessToken,
  buildAuthorizeUrlFor,
  serializeAuthFlow,
  parseAuthFlow,
  resolveAuthFlow,
  toAuthFlowMode,
  AUTH_STATE_MISMATCH_MESSAGE,
} from './spotify-auth'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildAuthorizeUrlFor', () => {
  function paramsFor(overrides: Partial<{ challenge: string; state: string }> = {}) {
    const url = new URL(buildAuthorizeUrlFor({ challenge: 'the-challenge', state: 'the-state', ...overrides }))
    return url.searchParams
  }

  it('points at Spotify\'s authorize endpoint', () => {
    expect(buildAuthorizeUrlFor({ challenge: 'c', state: 's' })).toContain(
      'https://accounts.spotify.com/authorize?',
    )
  })

  it('carries the state token so the callback can verify it', () => {
    expect(paramsFor().get('state')).toBe('the-state')
  })

  it('carries the PKCE challenge and its S256 method', () => {
    const params = paramsFor()
    expect(params.get('code_challenge')).toBe('the-challenge')
    expect(params.get('code_challenge_method')).toBe('S256')
  })

  it('uses the configured client id and redirect uri', () => {
    const params = paramsFor()
    expect(params.get('client_id')).toBe(process.env.SPOTIFY_CLIENT_ID)
    expect(params.get('redirect_uri')).toBe(process.env.SPOTIFY_REDIRECT_URI)
  })

  it('requests the scopes playback and playlist reading need', () => {
    const scopes = paramsFor().get('scope')?.split(' ') ?? []
    expect(scopes).toContain('streaming')
    expect(scopes).toContain('user-modify-playback-state')
    expect(scopes).toContain('playlist-read-private')
  })
})

describe('toAuthFlowMode', () => {
  it('recognises an explicit popup request', () => {
    expect(toAuthFlowMode('popup')).toBe('popup')
  })

  it('treats anything else as the full-tab flow', () => {
    expect(toAuthFlowMode('redirect')).toBe('redirect')
    expect(toAuthFlowMode(undefined)).toBe('redirect')
    expect(toAuthFlowMode('POPUP')).toBe('redirect')
    expect(toAuthFlowMode({ mode: 'popup' })).toBe('redirect')
  })
})

describe('parseAuthFlow', () => {
  it('round-trips a serialized flow', () => {
    const flow = { state: 'abc123', mode: 'popup' as const }
    expect(parseAuthFlow(serializeAuthFlow(flow))).toEqual(flow)
  })

  it('returns null when the cookie is absent', () => {
    expect(parseAuthFlow(undefined)).toBeNull()
    expect(parseAuthFlow('')).toBeNull()
  })

  it('returns null for a value that is not JSON', () => {
    expect(parseAuthFlow('not-json')).toBeNull()
  })

  it('returns null when the state is missing or empty', () => {
    expect(parseAuthFlow(JSON.stringify({ mode: 'popup' }))).toBeNull()
    expect(parseAuthFlow(JSON.stringify({ state: '', mode: 'popup' }))).toBeNull()
  })

  it('falls back to the full-tab flow for an unrecognised mode', () => {
    expect(parseAuthFlow(JSON.stringify({ state: 'abc', mode: 'sideways' }))).toEqual({
      state: 'abc',
      mode: 'redirect',
    })
  })
})

describe('resolveAuthFlow', () => {
  const flow = { state: 'issued-state', mode: 'popup' as const }

  it('returns the flow mode when the echoed state matches', () => {
    expect(resolveAuthFlow(flow, 'issued-state')).toBe('popup')
    expect(resolveAuthFlow({ state: 's', mode: 'redirect' }, 's')).toBe('redirect')
  })

  it('rejects a state that does not match the issued one', () => {
    expect(() => resolveAuthFlow(flow, 'someone-elses-state')).toThrow(AUTH_STATE_MISMATCH_MESSAGE)
  })

  it('rejects a callback that echoed no state at all', () => {
    expect(() => resolveAuthFlow(flow, undefined)).toThrow(AUTH_STATE_MISMATCH_MESSAGE)
    expect(() => resolveAuthFlow(flow, '')).toThrow(AUTH_STATE_MISMATCH_MESSAGE)
  })

  it('rejects a callback with no readable flow cookie', () => {
    expect(() => resolveAuthFlow(null, 'issued-state')).toThrow(AUTH_STATE_MISMATCH_MESSAGE)
  })
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
