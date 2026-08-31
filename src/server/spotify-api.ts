import { createServerFn } from '@tanstack/react-start'
import { getSpotifySession, setSpotifySession, clearSpotifySession } from './session'
import { refreshAccessToken } from './spotify-auth'

const EXPIRY_BUFFER_MS = 60_000

export function isExpiringSoon(expiresAt: number, now = Date.now()): boolean {
  return expiresAt - EXPIRY_BUFFER_MS <= now
}

export const getPlaybackToken = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSpotifySession()
  const { accessToken, refreshToken, expiresAt } = session.data

  if (!accessToken || !refreshToken || expiresAt === undefined) {
    throw new Error('Not authenticated')
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
})

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
  .inputValidator((data: { trackId: string }) => data)
  .handler(async ({ data }) => {
    const session = await getSpotifySession()
    if (!session.data.accessToken) return DEFAULT_BPM
    return fetchTempo(data.trackId, session.data.accessToken)
  })

export const transferPlaybackHere = createServerFn({ method: 'POST' })
  .inputValidator((data: { deviceId: string }) => data)
  .handler(async ({ data }) => {
    const session = await getSpotifySession()
    if (!session.data.accessToken) return

    await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session.data.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_ids: [data.deviceId], play: true }),
    })
  })
