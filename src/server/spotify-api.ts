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
