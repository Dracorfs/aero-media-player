import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, deleteCookie } from '@tanstack/react-start/server'
import {
  exchangeCodeForTokens,
  parseAuthFlow,
  resolveAuthFlow,
  AUTH_FLOW_COOKIE,
  PKCE_COOKIE,
  type AuthFlowMode,
} from '../server/spotify-auth'
import { setSpotifySession } from '../server/session'
import { isMissingEnvVarError } from '../server/env'
import { AUTH_COMPLETE_MESSAGE } from '../shared/authFlow'

const completeLogin = createServerFn({ method: 'GET' })
  .validator((data: { code?: string; error?: string; state?: string }) => data)
  .handler(async ({ data }): Promise<{ mode: AuthFlowMode }> => {
    if (data.error || !data.code) {
      throw new Error(data.error ?? 'Missing authorization code')
    }

    const verifier = getCookie(PKCE_COOKIE)
    const flow = parseAuthFlow(getCookie(AUTH_FLOW_COOKIE))
    // Both cookies are single-use: clear them as soon as they've been read, so
    // a replayed or failed callback can't reuse either one.
    deleteCookie(PKCE_COOKIE)
    deleteCookie(AUTH_FLOW_COOKIE)

    if (!verifier) {
      throw new Error('Missing PKCE verifier cookie')
    }

    // Throws on a state mismatch before the code is ever exchanged.
    const mode = resolveAuthFlow(flow, data.state)

    try {
      const tokens = await exchangeCodeForTokens(data.code, verifier)
      await setSpotifySession(tokens)
    } catch (err) {
      // A missing/misconfigured env var is a setup problem, not a failed
      // Spotify exchange — don't mask it behind the generic login-failed
      // message, or a developer chasing this down gets no signal at all.
      if (isMissingEnvVarError(err)) throw err
      throw new Error('Spotify login failed')
    }

    return { mode }
  })

export const Route = createFileRoute('/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
    state: typeof search.state === 'string' ? search.state : undefined,
  }),
  loaderDeps: ({ search }) => ({ code: search.code, error: search.error, state: search.state }),
  loader: async ({ deps }) => {
    const { mode } = await completeLogin({ data: deps })
    // The full-tab flow owns this tab, so hand it straight back to the player.
    // Only the popup flow has anything to render here.
    if (mode !== 'popup') {
      throw redirect({ to: '/' })
    }
    return { mode }
  },
  component: PopupComplete,
  errorComponent: ({ error }) =>
    isMissingEnvVarError(error) ? (
      <div>
        <p>{error instanceof Error ? error.message : 'Server is missing required configuration.'}</p>
      </div>
    ) : (
      <div>
        <p>Login failed, please try again.</p>
        <Link to="/login">Back to login</Link>
      </div>
    ),
})

function PopupComplete() {
  useEffect(() => {
    // The session cookie is set by now, so tell the player tab to re-check
    // auth status, then get out of the way. If the browser refuses to close a
    // tab it didn't script-open, the message below is what the user is left
    // with — hence the link back.
    window.opener?.postMessage({ type: AUTH_COMPLETE_MESSAGE }, window.location.origin)
    window.close()
  }, [])

  return (
    <div>
      <p>You're signed in — closing this window...</p>
      <Link to="/">Back to the player</Link>
    </div>
  )
}
