import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { getPlaybackToken, getTempo } from '../server/spotify-api'
import { usePlaybackSDK } from '../client/usePlaybackSDK'
import { useAlbumPalette } from '../client/useAlbumPalette'
import { Visualizer } from '../client/Visualizer/Visualizer'
import { PlayerChrome } from '../client/PlayerChrome'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      await getPlaybackToken()
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: Index,
})

function Index() {
  const { state, isActiveDevice, error, togglePlay, skipNext, skipPrevious, seek, setVolume, playHere } =
    usePlaybackSDK(() => getPlaybackToken())
  const palette = useAlbumPalette(state?.albumArtUrl)
  const [bpm, setBpm] = useState(120)

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

  if (!state) {
    return <FullScreenMessage text="Waiting for playback..." />
  }

  if (!isActiveDevice) {
    return (
      <FullScreenMessage text="Aero Media Player isn't the active Spotify device.">
        <button onClick={playHere}>Play here</button>
      </FullScreenMessage>
    )
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
