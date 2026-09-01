import { createServerFn } from '@tanstack/react-start'
import { setCookie } from '@tanstack/react-start/server'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { requireEnv } from './env'
import { REFRESH_FAILED_MESSAGE } from '../shared/authError'

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
export const PKCE_COOKIE = 'spotify_pkce_verifier'

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ')

export interface SpotifyTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export const buildAuthorizeUrl = createServerFn({ method: 'GET' }).handler(async () => {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)

  setCookie(PKCE_COOKIE, verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: requireEnv('SPOTIFY_CLIENT_ID'),
    response_type: 'code',
    redirect_uri: requireEnv('SPOTIFY_REDIRECT_URI'),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  })

  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`
})

export async function exchangeCodeForTokens(code: string, verifier: string): Promise<SpotifyTokens> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: requireEnv('SPOTIFY_REDIRECT_URI'),
      client_id: requireEnv('SPOTIFY_CLIENT_ID'),
      code_verifier: verifier,
    }),
  })

  if (!response.ok) {
    throw new Error(`Spotify token exchange failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: requireEnv('SPOTIFY_CLIENT_ID'),
    }),
  })

  if (!response.ok) {
    throw new Error(`${REFRESH_FAILED_MESSAGE}: ${response.status}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}
