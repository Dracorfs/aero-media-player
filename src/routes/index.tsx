import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { getPlaybackToken, getTempo } from '../server/spotify-api'
import { isNotAuthenticatedError } from '../shared/authError'
import { usePlaybackSDK } from '../client/usePlaybackSDK'
import { useAlbumPalette } from '../client/useAlbumPalette'
import { Visualizer } from '../client/Visualizer/Visualizer'
import { PlayerChrome } from '../client/PlayerChrome'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      await getPlaybackToken()
    } catch (err) {
      // Only a genuine "you aren't logged in" failure becomes a redirect.
      // Config/startup errors (e.g. a missing SPOTIFY_CLIENT_ID) must surface
      // instead of being masked as a silent bounce to /login.
      if (isNotAuthenticatedError(err)) {
        throw redirect({ to: '/login' })
      }
      throw err
    }
  },
  component: Index,
})

function Index() {
  const { state, isActiveDevice, error, togglePlay, skipNext, skipPrevious, seek, setVolume, playHere } =
    usePlaybackSDK(() => getPlaybackToken())
  const palette = useAlbumPalette(state?.albumArtUrl)
  const [bpm, setBpm] = useState(120)
  const navigate = useNavigate()

  useEffect(() => {
    // The session's refresh token was revoked (or Spotify rejected the token):
    // there is no recovering client-side, send the user back through login.
    if (error === 'authentication_error') {
      navigate({ to: '/login' })
    }
  }, [error, navigate])

  useEffect(() => {
    if (!state?.trackId) return
    let cancelled = false
    getTempo({ data: { trackId: state.trackId } }).then((tempo) => {
      if (!cancelled) setBpm(tempo)
    })
    return () => {
      cancelled = true
    }
  }, [state?.trackId])

  if (error === 'account_error') {
    return <FullScreenMessage text="Spotify Premium is required to use this player." />
  }

  if (error === 'authentication_error') {
    return <FullScreenMessage text="Your Spotify session expired. Redirecting to login..." />
  }

  // Checked before `!state`: on a cold start both are falsy, and "Play here" is
  // the actionable screen (this tab has to become the active Spotify device
  // before any playback state can ever arrive).
  if (!isActiveDevice) {
    return (
      <FullScreenMessage text="Select Aero Media Player as your Spotify device, or press Play here.">
        <button onClick={playHere}>Play here</button>
      </FullScreenMessage>
    )
  }

  if (!state) {
    return <FullScreenMessage text="Waiting for playback..." />
  }

  return (
    <>
      <Visualizer
        frame={{
          progressMs: state.progressMs,
          durationMs: state.durationMs,
          bpm,
          palette,
          isPlaying: state.isPlaying,
        }}
      />
      <PlayerChrome
        trackName={state.name}
        artists={state.artists}
        isPlaying={state.isPlaying}
        progressMs={state.progressMs}
        durationMs={state.durationMs}
        onTogglePlay={togglePlay}
        onSkipNext={skipNext}
        onSkipPrevious={skipPrevious}
        onSeek={seek}
        onVolumeChange={setVolume}
      />
    </>
  )
}

function FullScreenMessage({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p>{text}</p>
        {children}
      </div>
    </div>
  )
}
