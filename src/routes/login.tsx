import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildAuthorizeUrl } from '../server/spotify-auth'

export const Route = createFileRoute('/login')({
  // `?mode=popup` is how the player's sidebar starts a sign-in in a second
  // tab. Anything else is the full-tab flow, which ends back on the player.
  // Returned as an *optional* key, not a key that may be undefined: that
  // keeps `search` optional for every existing `to: '/login'` link and
  // redirect elsewhere in the app.
  validateSearch: (search: Record<string, unknown>): { mode?: 'popup' } =>
    search.mode === 'popup' ? { mode: 'popup' } : {},
  loaderDeps: ({ search }) => ({ mode: search.mode }),
  loader: async ({ deps }) => {
    const url = await buildAuthorizeUrl({ data: { mode: deps.mode } })
    throw redirect({ href: url })
  },
})
