import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isExpiringSoon,
  hasUsableCredentials,
  fetchTrackIsrc,
  fetchTrackDynamics,
  DEFAULT_TRACK_DYNAMICS,
  fetchPlaylists,
  fetchPlaylistTracks,
  postPlayInContext,
  putTransferPlayback,
} from './spotify-api'
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

describe('hasUsableCredentials', () => {
  const complete = { accessToken: 'token', refreshToken: 'refresh', expiresAt: 1_000_000 }

  it('is true for a session holding token, refresh token and expiry', () => {
    expect(hasUsableCredentials(complete)).toBe(true)
  })

  it('is false for an empty session', () => {
    expect(hasUsableCredentials({})).toBe(false)
  })

  it('is false without a refresh token, since the session cannot be renewed', () => {
    expect(hasUsableCredentials({ ...complete, refreshToken: undefined })).toBe(false)
  })

  it('is false without an expiry, since refresh timing is unknowable', () => {
    expect(hasUsableCredentials({ ...complete, expiresAt: undefined })).toBe(false)
  })

  it('is false for an empty access token rather than truthy-by-presence', () => {
    expect(hasUsableCredentials({ ...complete, accessToken: '' })).toBe(false)
  })

  it('ignores unrelated session fields such as the stored background', () => {
    expect(hasUsableCredentials({ background: { type: 'color', value: '#000000' } })).toBe(false)
    expect(hasUsableCredentials({ ...complete, background: { type: 'color', value: '#000000' } })).toBe(true)
  })
})

describe('fetchTrackIsrc', () => {
  it('returns the ISRC from a successful track lookup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external_ids: { isrc: 'USMC16356894' } }) }),
    )

    expect(await fetchTrackIsrc('track-1', 'token')).toBe('USMC16356894')
  })

  it('returns null when the track has no ISRC', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external_ids: {} }) }))

    expect(await fetchTrackIsrc('track-1', 'token')).toBeNull()
  })

  it('returns null on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))

    expect(await fetchTrackIsrc('track-1', 'token')).toBeNull()
  })

  it('returns null when the fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    expect(await fetchTrackIsrc('track-1', 'token')).toBeNull()
  })
})

describe('fetchTrackDynamics', () => {
  it('returns Deezer bpm/gain when the Spotify track has an ISRC Deezer recognizes', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ external_ids: { isrc: 'USMC16356894' } }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ bpm: 153.7, gain: -12 }) }),
    )

    expect(await fetchTrackDynamics('track-1', 'token')).toEqual({ bpm: 153.7, gain: -12 })
  })

  it('falls back to defaults, without calling Deezer, when the Spotify track has no ISRC', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external_ids: {} }) })
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchTrackDynamics('track-1', 'token')).toEqual(DEFAULT_TRACK_DYNAMICS)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to defaults when the Spotify track lookup responds with a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))

    expect(await fetchTrackDynamics('track-1', 'token')).toEqual(DEFAULT_TRACK_DYNAMICS)
  })

  it('falls back to defaults when Deezer has no usable bpm/gain for the ISRC', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ external_ids: { isrc: 'USMC16356894' } }) })
        .mockResolvedValueOnce({ ok: false, status: 404 }),
    )

    expect(await fetchTrackDynamics('track-1', 'token')).toEqual(DEFAULT_TRACK_DYNAMICS)
  })
})

describe('fetchPlaylists', () => {
  // Spotify's Nov 2024 API policy blocks GET /playlists/{id}/tracks in
  // Development Mode for any playlist the current user doesn't own, so the
  // picker must never even offer a followed-not-owned playlist as a choice.
  function stubMeAndPlaylists(
    meId: string,
    items: { id: string; name: string; uri: string; images: { url: string }[]; owner: { id: string } }[],
  ) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ id: meId }) }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items }),
      }),
    )
  }

  it('maps owned playlist items to id, name, uri, and imageUrl', async () => {
    stubMeAndPlaylists('me1', [
      {
        id: 'p1',
        name: 'Chill',
        uri: 'spotify:playlist:p1',
        images: [{ url: 'https://img/p1.jpg' }],
        owner: { id: 'me1' },
      },
    ])

    expect(await fetchPlaylists('token')).toEqual([
      { id: 'p1', name: 'Chill', uri: 'spotify:playlist:p1', imageUrl: 'https://img/p1.jpg' },
    ])
  })

  it('excludes playlists the current user follows but does not own', async () => {
    stubMeAndPlaylists('me1', [
      { id: 'p1', name: 'Mine', uri: 'spotify:playlist:p1', images: [], owner: { id: 'me1' } },
      { id: 'p2', name: 'Followed', uri: 'spotify:playlist:p2', images: [], owner: { id: 'someone-else' } },
    ])

    expect((await fetchPlaylists('token')).map((p) => p.id)).toEqual(['p1'])
  })

  it('leaves imageUrl undefined when a playlist has no images', async () => {
    stubMeAndPlaylists('me1', [
      { id: 'p1', name: 'Chill', uri: 'spotify:playlist:p1', images: [], owner: { id: 'me1' } },
    ])

    expect((await fetchPlaylists('token'))[0].imageUrl).toBeUndefined()
  })

  it('throws when the playlists request responds with a non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'me1' }) })
        .mockResolvedValueOnce({ ok: false, status: 403 }),
    )

    await expect(fetchPlaylists('token')).rejects.toThrow('403')
  })

  it('throws when the current-user request responds with a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))

    await expect(fetchPlaylists('token')).rejects.toThrow('401')
  })
})

describe('fetchPlaylistTracks', () => {
  // GET /playlists/{id}/items (Spotify's Feb 2026 replacement for the
  // deprecated /tracks endpoint) nests the played thing under `item`, not
  // `track` — and it can be an episode (`type: "episode"`), which has no
  // `artists` array.
  it('maps track entries to uri, name, and comma-joined artist names', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              item: {
                type: 'track',
                uri: 'spotify:track:t1',
                name: 'Song A',
                artists: [{ name: 'Artist A' }, { name: 'Artist B' }],
              },
            },
          ],
        }),
      }),
    )

    expect(await fetchPlaylistTracks('p1', 'token')).toEqual([
      { uri: 'spotify:track:t1', name: 'Song A', artists: 'Artist A, Artist B' },
    ])
  })

  it('skips entries with a null item (e.g. a removed track)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            { item: null },
            {
              item: { type: 'track', uri: 'spotify:track:t1', name: 'Song A', artists: [{ name: 'Artist A' }] },
            },
          ],
        }),
      }),
    )

    expect(await fetchPlaylistTracks('p1', 'token')).toHaveLength(1)
  })

  it('skips podcast episodes, which have no artists array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            { item: { type: 'episode', uri: 'spotify:episode:e1', name: 'Episode A' } },
            {
              item: { type: 'track', uri: 'spotify:track:t1', name: 'Song A', artists: [{ name: 'Artist A' }] },
            },
          ],
        }),
      }),
    )

    expect(await fetchPlaylistTracks('p1', 'token')).toEqual([
      { uri: 'spotify:track:t1', name: 'Song A', artists: 'Artist A' },
    ])
  })

  it('throws when Spotify responds with a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    await expect(fetchPlaylistTracks('p1', 'token')).rejects.toThrow('404')
  })
})

describe('postPlayInContext', () => {
  it('PUTs to the play endpoint with the device id, context uri, and track offset', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await postPlayInContext(
      { deviceId: 'device-1', contextUri: 'spotify:playlist:p1', trackUri: 'spotify:track:t1' },
      'token',
    )

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.spotify.com/v1/me/player/play?device_id=device-1')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({
      context_uri: 'spotify:playlist:p1',
      offset: { uri: 'spotify:track:t1' },
    })
  })

  it('throws when Spotify responds with a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    await expect(
      postPlayInContext({ deviceId: 'device-1', contextUri: 'ctx', trackUri: 'trk' }, 'token'),
    ).rejects.toThrow('404')
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

describe('putTransferPlayback', () => {
  it('PUTs the device id to the player endpoint and asks it to start playing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await putTransferPlayback('device-1', 'token')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.spotify.com/v1/me/player')
    expect(options.method).toBe('PUT')
    expect(options.headers.Authorization).toBe('Bearer token')
    expect(JSON.parse(options.body)).toEqual({ device_ids: ['device-1'], play: true })
  })

  it('throws when Spotify responds with a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    await expect(putTransferPlayback('device-1', 'token')).rejects.toThrow('404')
  })
})
