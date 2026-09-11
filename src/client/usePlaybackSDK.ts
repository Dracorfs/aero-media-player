import { useEffect, useRef, useState } from 'react'
import { toPlaybackState, type PlaybackState } from './playbackState'
import { playTrackInContext, transferPlayback } from '../server/spotify-api'
import { isNotAuthenticatedError } from '../shared/authError'

export type PlaybackSDKError = 'account_error' | 'initialization_error' | 'authentication_error'

export interface PlaybackSDKOptions {
  /**
   * Whether to run at all. `false` keeps the SDK completely dormant — no
   * script injection, no Connect device registered, no token fetches — which
   * is what the signed-out landing page needs, and what signing off tears
   * back down to.
   */
  enabled?: boolean
}

interface PlaybackSDK {
  state: PlaybackState | null
  isActiveDevice: boolean
  error: PlaybackSDKError | null
  togglePlay: () => void
  skipNext: () => void
  skipPrevious: () => void
  seek: (positionMs: number) => void
  setVolume: (volume: number) => void
  playTrack: (contextUri: string, trackUri: string) => void
  /**
   * Moves playback that is running on another Spotify device onto this tab.
   * Rejects (rather than failing silently) so the caller can say why nothing
   * happened.
   */
  playHere: () => Promise<void>
}

declare global {
  interface Window {
    Spotify: typeof Spotify
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

export function usePlaybackSDK(
  getAccessToken: () => Promise<string>,
  { enabled = true }: PlaybackSDKOptions = {},
): PlaybackSDK {
  const playerRef = useRef<Spotify.Player | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const [state, setState] = useState<PlaybackState | null>(null)
  const [isActiveDevice, setIsActiveDevice] = useState(false)
  const [error, setError] = useState<PlaybackSDKError | null>(null)

  // Callers routinely pass a fresh arrow function on every render. Hold the
  // latest getter in a ref so the effect below never has to depend on it and
  // so never tears down / re-creates the SDK player (which would re-register a
  // new Spotify Connect device on every re-render).
  const getAccessTokenRef = useRef(getAccessToken)
  getAccessTokenRef.current = getAccessToken

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    function initPlayer() {
      // The SDK script can finish loading after this effect has been torn
      // down (a quick sign-in/sign-off). Without this guard that late
      // callback registers a Connect device nothing is left holding.
      if (cancelled) return

      const player = new window.Spotify.Player({
        name: 'Aero Media Player',
        getOAuthToken: (callback) => {
          getAccessTokenRef
            .current()
            .then(callback)
            .catch((err: unknown) => {
              // Only a genuine "log in again" failure should evict the user.
              // A transient network blip should not — the SDK calls
              // getOAuthToken again on its own later, so just log and let it
              // retry rather than bouncing a playing session to /login.
              if (isNotAuthenticatedError(err)) {
                setError('authentication_error')
              } else {
                console.error('Failed to fetch a playback access token', err)
              }
            })
        },
        volume: 0.5,
      })

      player.addListener('ready', ({ device_id }) => {
        deviceIdRef.current = device_id
      })

      player.addListener('not_ready', () => {
        deviceIdRef.current = null
      })

      player.addListener('player_state_changed', (sdkState) => {
        if (!sdkState) {
          setIsActiveDevice(false)
          return
        }
        setIsActiveDevice(true)
        setState(toPlaybackState(sdkState))
      })

      player.addListener('account_error', () => setError('account_error'))
      player.addListener('initialization_error', () => setError('initialization_error'))
      player.addListener('authentication_error', () => setError('authentication_error'))

      player.connect()
      playerRef.current = player
    }

    if (window.Spotify) {
      initPlayer()
    } else {
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      document.body.appendChild(script)
      window.onSpotifyWebPlaybackSDKReady = initPlayer
    }

    return () => {
      cancelled = true
      playerRef.current?.disconnect()
      playerRef.current = null
      deviceIdRef.current = null
    }
    // Keyed only on `enabled`: the token getter is read through a ref, so a
    // new function identity from the caller never re-creates the SDK player.
  }, [enabled])

  useEffect(() => {
    if (enabled) return
    // Signing off (or never having signed in) must not leave the chrome
    // showing the last session's track.
    setState(null)
    setIsActiveDevice(false)
    setError(null)
  }, [enabled])

  return {
    state,
    isActiveDevice,
    error,
    togglePlay: () => playerRef.current?.togglePlay(),
    skipNext: () => playerRef.current?.nextTrack(),
    skipPrevious: () => playerRef.current?.previousTrack(),
    seek: (positionMs) => playerRef.current?.seek(positionMs),
    setVolume: (volume) => playerRef.current?.setVolume(volume),
    playHere: async () => {
      if (!deviceIdRef.current) {
        throw new Error('This tab is not ready as a Spotify device yet')
      }
      await transferPlayback({ data: { deviceId: deviceIdRef.current } })
    },
    playTrack: (contextUri, trackUri) => {
      if (deviceIdRef.current) {
        playTrackInContext({
          data: { deviceId: deviceIdRef.current, contextUri, trackUri },
        }).catch((err: unknown) => {
          console.error('Failed to start playback for the selected track', err)
        })
      }
    },
  }
}
