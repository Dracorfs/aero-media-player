import { createServerFn } from '@tanstack/react-start'
import { setCookie } from '@tanstack/react-start/server'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { requireEnv } from './env'
import { REFRESH_FAILED_MESSAGE } from '../shared/authError'

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
export const PKCE_COOKIE = 'spotify_pkce_verifier'
export const AUTH_FLOW_COOKIE = 'spotify_auth_flow'
export const AUTH_STATE_MISMATCH_MESSAGE = 'Spotify login state mismatch'

const AUTH_COOKIE_MAX_AGE_S = 60 * 10

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
].join(' ')

export interface SpotifyTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/**
 * Which flow started a login: `popup` was opened by the player in a second
 * tab (it reports back to its opener and closes itself), `redirect` owns the
 * whole tab and hands it back to the player when it finishes.
 */
export type AuthFlowMode = 'redirect' | 'popup'

export interface AuthFlow {
  state: string
  mode: AuthFlowMode
}

/** Anything that isn't an explicit `popup` request is the full-tab flow. */
export function toAuthFlowMode(value: unknown): AuthFlowMode {
  return value === 'popup' ? 'popup' : 'redirect'
}

export function serializeAuthFlow(flow: AuthFlow): string {
  return JSON.stringify(flow)
}

/**
 * Reads back the flow this server issued. Returns null (rather than throwing)
 * for anything unusable — a missing cookie, a truncated value, someone else's
 * JSON — so the caller can treat every one of those the same way: refuse the
 * callback.
 */
export function parseAuthFlow(raw: string | undefined): AuthFlow | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as { state?: unknown; mode?: unknown }
    if (typeof parsed.state !== 'string' || parsed.state.length === 0) return null
    return { state: parsed.state, mode: toAuthFlowMode(parsed.mode) }
  } catch {
    return null
  }
}

/**
 * Checks the `state` Spotify echoed back against the one issued when the flow
 * started, and reports which flow it was. This is the CSRF guard on the
 * callback: without it, anyone could hand this app an authorization code.
 */
export function resolveAuthFlow(flow: AuthFlow | null, receivedState: string | undefined): AuthFlowMode {
  if (!flow || !receivedState || receivedState !== flow.state) {
    throw new Error(AUTH_STATE_MISMATCH_MESSAGE)
  }
  return flow.mode
}

/**
 * Pure URL assembly, kept separate from the server function so it can be
 * tested without a request context (the cookies need one, this doesn't).
 */
export function buildAuthorizeUrlFor({ challenge, state }: { challenge: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: requireEnv('SPOTIFY_CLIENT_ID'),
    response_type: 'code',
    redirect_uri: requireEnv('SPOTIFY_REDIRECT_URI'),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SCOPES,
  })

  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`
}

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: AUTH_COOKIE_MAX_AGE_S,
    path: '/',
  }
}

export const buildAuthorizeUrl = createServerFn({ method: 'GET' })
  .validator((data: { mode?: string } | undefined) => ({ mode: toAuthFlowMode(data?.mode) }))
  .handler(async ({ data }) => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    // Same CSPRNG and base64url encoding as the PKCE verifier: all `state`
    // has to be is unguessable and URL-safe.
    const state = generateCodeVerifier()

    setCookie(PKCE_COOKIE, verifier, authCookieOptions())
    // Spotify can't be trusted to carry the flow mode back for us, and the
    // redirect URI is fixed (it must match the dashboard character for
    // character), so the mode rides along with the state this server issued.
    setCookie(AUTH_FLOW_COOKIE, serializeAuthFlow({ state, mode: data.mode }), authCookieOptions())

    return buildAuthorizeUrlFor({ challenge, state })
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
