import { createServerFn } from '@tanstack/react-start'
import { getSpotifySession, setSpotifySession, clearSpotifySession } from './session'
import { refreshAccessToken } from './spotify-auth'
import { NOT_AUTHENTICATED_MESSAGE } from '../shared/authError'

const EXPIRY_BUFFER_MS = 60_000

export function isExpiringSoon(expiresAt: number, now = Date.now()): boolean {
  return expiresAt - EXPIRY_BUFFER_MS <= now
}

/**
 * The single source of truth for "give me an access token I can actually use".
 * Refreshes (and re-persists) the session when the current token is expiring,
 * clearing the session if the refresh token itself has been revoked.
 */
async function getValidAccessToken(): Promise<string> {
  const session = await getSpotifySession()
  const { accessToken, refreshToken, expiresAt } = session.data

  if (!accessToken || !refreshToken || expiresAt === undefined) {
    throw new Error(NOT_AUTHENTICATED_MESSAGE)
  }

  if (isExpiringSoon(expiresAt)) {
    try {
      const refreshed = await refreshAccessToken(refreshToken)
      await setSpotifySession(refreshed)
      return refreshed.accessToken
    } catch (err) {
      await clearSpotifySession()
      throw err
    }
  }

  return accessToken
}

export const getPlaybackToken = createServerFn({ method: 'GET' }).handler(async () => getValidAccessToken())

const DEFAULT_BPM = 120

export async function fetchTempo(trackId: string, accessToken: string): Promise<number> {
  try {
    const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return DEFAULT_BPM

    const body = (await response.json()) as { tempo?: number }
    return typeof body.tempo === 'number' ? body.tempo : DEFAULT_BPM
  } catch {
    return DEFAULT_BPM
  }
}

export const getTempo = createServerFn({ method: 'GET' })
  .validator((data: { trackId: string }) => data)
  .handler(async ({ data }) => {
    let accessToken: string
    try {
      accessToken = await getValidAccessToken()
    } catch {
      // Tempo is best-effort decoration — never surface auth trouble here.
      return DEFAULT_BPM
    }
    return fetchTempo(data.trackId, accessToken)
  })

export const transferPlaybackHere = createServerFn({ method: 'POST' })
  .validator((data: { deviceId: string }) => data)
  .handler(async ({ data }) => {
    const accessToken = await getValidAccessToken()

    const response = await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_ids: [data.deviceId], play: true }),
    })

    if (!response.ok) {
      throw new Error(`Spotify transfer playback failed: ${response.status}`)
    }
  })
