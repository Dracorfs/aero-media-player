import { useSession, updateSession, clearSession } from '@tanstack/react-start/server'
import type { SpotifyTokens } from './spotify-auth'

export type SpotifySession = SpotifyTokens

const sessionConfig = {
  password: process.env.SESSION_SECRET!,
  name: 'aero_media_player_session',
  maxAge: 60 * 60 * 24 * 30,
}

export async function getSpotifySession() {
  return useSession<Partial<SpotifySession>>(sessionConfig)
}

export async function setSpotifySession(tokens: SpotifyTokens): Promise<void> {
  await updateSession(sessionConfig, tokens)
}

export async function clearSpotifySession(): Promise<void> {
  await clearSession(sessionConfig)
}
