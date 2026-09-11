import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import {
  getAuthStatus,
  getPlaybackToken,
  getTrackDynamics,
  signOut,
  DEFAULT_TRACK_DYNAMICS,
  type TrackDynamics,
} from '../server/spotify-api'
import { usePlaybackSDK } from '../client/usePlaybackSDK'
import { useAlbumPalette } from '../client/useAlbumPalette'
import { useIdleProgress } from '../client/useIdleProgress'
import { useSidebar } from '../client/useSidebar'
import { useSpotifyAuthPopup } from '../client/useSpotifyAuthPopup'
import { gainToIntensity } from '../client/gainToIntensity'
import { getBackgroundConfig, type BackgroundConfig } from '../server/background'
import { VisualizerBackdrop } from '../client/VisualizerBackdrop'
import { ConfigurationModal } from '../client/ConfigurationModal'
import { Visualizer } from '../client/Visualizer/Visualizer'
import { PlayerChrome } from '../client/PlayerChrome'
import { Sidebar, SidebarReveal } from '../client/Sidebar'
import './FullScreenMessage.css'

/**
 * Length of the imaginary track the idle scene animates against, so the
 * landing page is already moving before anyone signs in.
 */
const IDLE_DURATION_MS = 240_000

export const Route = createFileRoute('/')({
  // No auth redirect: this page *is* the player whether or not there's a
  // session — only the sidebar's contents change. Status is loaded (rather
  // than inferred client-side) so the server renders the right panel with no
  // signed-out flash, and a config failure such as a missing
  // SPOTIFY_CLIENT_ID still surfaces as an error instead of masquerading as
  // "signed out", which would loop the user through a login that can't work.
  loader: async () => getAuthStatus(),
  component: Index,
})

function Index() {
  const { isSignedIn } = Route.useLoaderData()
  const router = useRouter()
  const {
    isOpen: isSidebarOpen,
    open: openSidebar,
    close: closeSidebar,
    toggle: toggleSidebar,
  } = useSidebar()

  const {
    state,
    isActiveDevice,
    error,
    togglePlay,
    skipNext,
    skipPrevious,
    seek,
    setVolume,
    playTrack,
    playHere,
  } = usePlaybackSDK(() => getPlaybackToken(), { enabled: isSignedIn })

  const palette = useAlbumPalette(state?.albumArtUrl)
  const [dynamics, setDynamics] = useState<TrackDynamics>(DEFAULT_TRACK_DYNAMICS)
  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Re-reads the session from the server: the popup sets the cookie in its own
  // tab, so this side only finds out by asking again.
  const refreshAuthStatus = useCallback(() => {
    void router.invalidate()
  }, [router])

  const { startSignIn, isPending: isSigningIn, isPopupBlocked } = useSpotifyAuthPopup(refreshAuthStatus)

  // Nothing is playing until a track is picked, so the idle scene runs
  // whenever there's no playback state — signed out or simply not started.
  const isLive = state !== null
  const idleProgressMs = useIdleProgress(isLive ? 0 : IDLE_DURATION_MS)

  const handleSignOut = useCallback(async () => {
    await signOut()
    await router.invalidate()
    // Put the sign-in panel back in front of the user rather than leaving an
    // empty player behind.
    openSidebar()
  }, [router, openSidebar])

  useEffect(() => {
    if (error !== 'authentication_error') return
    // The refresh token was revoked or rejected; there's no recovering
    // client-side. The server has already cleared the session, so re-read
    // status (which tears the SDK down) and offer sign-in again.
    void router.invalidate()
    openSidebar()
  }, [error, router, openSidebar])

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

  const frame = isLive
    ? {
        progressMs: state.progressMs,
        durationMs: state.durationMs,
        bpm: dynamics.bpm,
        palette,
        isPlaying: state.isPlaying,
        volumeIntensity: gainToIntensity(dynamics.gain),
      }
    : {
        progressMs: idleProgressMs,
        durationMs: IDLE_DURATION_MS,
        bpm: DEFAULT_TRACK_DYNAMICS.bpm,
        palette,
        isPlaying: true,
        volumeIntensity: gainToIntensity(DEFAULT_TRACK_DYNAMICS.gain),
      }

  return (
    <>
      <VisualizerBackdrop config={backgroundConfig} />
      <Visualizer frame={frame} />
      <PlayerChrome
        trackName={state?.name ?? ''}
        isPlaying={state?.isPlaying ?? false}
        progressMs={state?.progressMs ?? 0}
        durationMs={state?.durationMs ?? 0}
        onTogglePlay={togglePlay}
        onSkipNext={skipNext}
        onSkipPrevious={skipPrevious}
        onSeek={seek}
        onVolumeChange={setVolume}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isDisabled={!isSignedIn}
        isShifted={isSidebarOpen}
        onToggleLibrary={toggleSidebar}
      />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        isSignedIn={isSignedIn}
        isSigningIn={isSigningIn}
        isPopupBlocked={isPopupBlocked}
        onSignIn={startSignIn}
        onSignOut={handleSignOut}
        onSelectTrack={playTrack}
        canPlayHere={isSignedIn && !isActiveDevice}
        onPlayHere={playHere}
      />
      <SidebarReveal isSidebarOpen={isSidebarOpen} onOpen={openSidebar} />
      <ConfigurationModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        backgroundConfig={backgroundConfig}
        onBackgroundConfigChange={setBackgroundConfig}
      />
    </>
  )
}

function FullScreenMessage({ text }: { text: string }) {
  return (
    <div className="full-screen-message">
      <div className="full-screen-message__content">
        <p className="full-screen-message__text">{text}</p>
      </div>
    </div>
  )
}
