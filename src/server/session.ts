import { useSession, updateSession, clearSession } from '@tanstack/react-start/server'
import type { SpotifyTokens } from './spotify-auth'
import { assertServerEnv, requireEnv } from './env'

export type BackgroundConfig = { type: 'color'; value: string } | { type: 'image'; value: string }

export type SpotifySession = SpotifyTokens & {
  background?: BackgroundConfig
  /** Filename of the selected profile picture, under `public/profile-images/`. Absent means
   * the default icon. */
  profileImage?: string
}

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

export async function getStoredBackground(): Promise<BackgroundConfig | null> {
  const session = await getSpotifySession()
  return session.data.background ?? null
}

export async function setStoredBackground(background: BackgroundConfig): Promise<void> {
  await updateSession(sessionConfig(), { background })
}

export async function getStoredProfileImage(): Promise<string | null> {
  const session = await getSpotifySession()
  return session.data.profileImage ?? null
}

export async function setStoredProfileImage(profileImage: string): Promise<void> {
  await updateSession(sessionConfig(), { profileImage })
}

export async function clearStoredProfileImage(): Promise<void> {
  await updateSession(sessionConfig(), { profileImage: undefined })
}

export async function clearSpotifySession(): Promise<void> {
  await clearSession(sessionConfig())
}
