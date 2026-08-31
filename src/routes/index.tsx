import { createFileRoute, redirect } from '@tanstack/react-router'
import { getPlaybackToken } from '../server/spotify-api'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      await getPlaybackToken()
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <p>Aero Media Player scaffold is running.</p>,
})
