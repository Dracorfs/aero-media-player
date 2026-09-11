import { Outlet, createRootRoute, redirect, HeadContent, Scripts } from '@tanstack/react-router'
import { getCanonicalRedirect } from '../server/origin'

export const Route = createRootRoute({
  beforeLoad: async () => {
    // Only a real document request can arrive on the wrong host; client-side
    // navigation stays on whatever origin the app is already running on, and
    // checking there would cost a round trip per navigation.
    if (typeof window !== 'undefined') return

    // Spotify's redirect URI pins the app to one origin. Anyone who opens
    // another one (localhost instead of 127.0.0.1) gets moved there before a
    // session cookie or an OAuth flow can be stranded on the wrong host.
    const target = await getCanonicalRedirect()
    if (target) throw redirect({ href: target })
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Aero Media Player' },
    ],
    links: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
