import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, deleteCookie } from '@tanstack/react-start/server'
import { exchangeCodeForTokens, PKCE_COOKIE } from '../server/spotify-auth'
import { setSpotifySession } from '../server/session'

const completeLogin = createServerFn({ method: 'GET' })
  .inputValidator((data: { code?: string; error?: string }) => data)
  .handler(async ({ data }) => {
    if (data.error || !data.code) {
      throw new Error(data.error ?? 'Missing authorization code')
    }

    const verifier = getCookie(PKCE_COOKIE)
    if (!verifier) {
      throw new Error('Missing PKCE verifier cookie')
    }

    const tokens = await exchangeCodeForTokens(data.code, verifier)
    await setSpotifySession(tokens)
    deleteCookie(PKCE_COOKIE)
  })

export const Route = createFileRoute('/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  loaderDeps: ({ search }) => ({ code: search.code, error: search.error }),
  loader: async ({ deps }) => {
    await completeLogin({ data: deps })
    throw redirect({ to: '/' })
  },
})
