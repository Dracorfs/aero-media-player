import { useSession, updateSession, clearSession } from '@tanstack/react-start/server'
import type { SpotifyTokens } from './spotify-auth'
import { assertServerEnv, requireEnv } from './env'

export type SpotifySession = SpotifyTokens

/**
 * Built lazily (not at module load) so the env check runs on the server at
 * first use and throws a named `MissingEnvVarError` instead of silently
 * sealing the session cookie with `undefined`.
 */
function sessionConfig() {
  assertServerEnv()
  return {
    password: requireEnv('SESSION_SECRET'),
    name: 'aero_media_player_session',
    maxAge: 60 * 60 * 24 * 30,
  }
}

export async function getSpotifySession() {
  return useSession<Partial<SpotifySession>>(sessionConfig())
}

export async function setSpotifySession(tokens: SpotifyTokens): Promise<void> {
  await updateSession(sessionConfig(), tokens)
}

export async function clearSpotifySession(): Promise<void> {
  await clearSession(sessionConfig())
}
