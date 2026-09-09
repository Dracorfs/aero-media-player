import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { getPlaybackToken, getTrackDynamics, DEFAULT_TRACK_DYNAMICS, type TrackDynamics } from '../server/spotify-api'
import { isNotAuthenticatedError } from '../shared/authError'
import { usePlaybackSDK } from '../client/usePlaybackSDK'
import { useAlbumPalette } from '../client/useAlbumPalette'
import { gainToIntensity } from '../client/gainToIntensity'
import { getBackgroundConfig, type BackgroundConfig } from '../server/background'
import { VisualizerBackdrop } from '../client/VisualizerBackdrop'
import { ConfigurationModal } from '../client/ConfigurationModal'
import { Visualizer } from '../client/Visualizer/Visualizer'
import { PlayerChrome } from '../client/PlayerChrome'
import { PlaylistPicker } from '../client/PlaylistPicker'
import './FullScreenMessage.css'

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
  const { state, isActiveDevice, error, togglePlay, skipNext, skipPrevious, seek, setVolume, playTrack } =
    usePlaybackSDK(() => getPlaybackToken())
  const palette = useAlbumPalette(state?.albumArtUrl)
  const [dynamics, setDynamics] = useState<TrackDynamics>(DEFAULT_TRACK_DYNAMICS)
  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // The session's refresh token was revoked (or Spotify rejected the token):
    // there is no recovering client-side, send the user back through login.
    if (error === 'authentication_error') {
      navigate({ to: '/login' })
    }
  }, [error, navigate])

  useEffect(() => {
    let cancelled = false
    getBackgroundConfig()
      .then((config) => {
        if (!cancelled) setBackgroundConfig(config)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state?.trackId) return
    let cancelled = false
    getTrackDynamics({ data: { trackId: state.trackId } }).then((next) => {
      if (!cancelled) setDynamics(next)
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

  // Checked before `!state`: on a cold start both are falsy, and picking a
  // track is the actionable screen (this tab has to become the active
  // Spotify device before any playback state can ever arrive).
  if (!isActiveDevice) {
    return (
      <FullScreenMessage text="Select Aero Media Player as your Spotify device, or pick a track to play here.">
        <PlaylistPicker onSelectTrack={playTrack} />
      </FullScreenMessage>
    )
  }

  if (!state) {
    return <FullScreenMessage text="Waiting for playback..." />
  }

  return (
    <>
      <VisualizerBackdrop config={backgroundConfig} />
      <Visualizer
        frame={{
          progressMs: state.progressMs,
          durationMs: state.durationMs,
          bpm: dynamics.bpm,
          palette,
          isPlaying: state.isPlaying,
          volumeIntensity: gainToIntensity(dynamics.gain),
        }}
      />
      <PlayerChrome
        trackName={state.name}
        isPlaying={state.isPlaying}
        progressMs={state.progressMs}
        durationMs={state.durationMs}
        onTogglePlay={togglePlay}
        onSkipNext={skipNext}
        onSkipPrevious={skipPrevious}
        onSeek={seek}
        onVolumeChange={setVolume}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <ConfigurationModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        backgroundConfig={backgroundConfig}
        onBackgroundConfigChange={setBackgroundConfig}
      />
    </>
  )
}

function FullScreenMessage({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="full-screen-message">
      <div className="full-screen-message__content">
        <p className="full-screen-message__text">{text}</p>
        {children}
      </div>
    </div>
  )
}
