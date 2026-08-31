import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildAuthorizeUrl } from '../server/spotify-auth'

export const Route = createFileRoute('/login')({
  loader: async () => {
    const url = await buildAuthorizeUrl()
    throw redirect({ href: url })
  },
})
