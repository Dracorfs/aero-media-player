import { useEffect, useRef, useState } from 'react'
import { toPlaybackState, type PlaybackState } from './playbackState'
import { transferPlaybackHere } from '../server/spotify-api'

export type PlaybackSDKError = 'account_error' | 'initialization_error' | 'authentication_error'

interface PlaybackSDK {
  state: PlaybackState | null
  isActiveDevice: boolean
  error: PlaybackSDKError | null
  togglePlay: () => void
  skipNext: () => void
  skipPrevious: () => void
  seek: (positionMs: number) => void
  setVolume: (volume: number) => void
  playHere: () => void
}

declare global {
  interface Window {
    Spotify: typeof Spotify
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

export function usePlaybackSDK(getAccessToken: () => Promise<string>): PlaybackSDK {
  const playerRef = useRef<Spotify.Player | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const [state, setState] = useState<PlaybackState | null>(null)
  const [isActiveDevice, setIsActiveDevice] = useState(false)
  const [error, setError] = useState<PlaybackSDKError | null>(null)

  // Callers routinely pass a fresh arrow function on every render. Hold the
  // latest getter in a ref so the mount effect below can stay keyed on `[]` and
  // never tear down / re-create the SDK player (which would re-register a new
  // Spotify Connect device on every re-render).
  const getAccessTokenRef = useRef(getAccessToken)
  getAccessTokenRef.current = getAccessToken

  useEffect(() => {
    function initPlayer() {
      const player = new window.Spotify.Player({
        name: 'Aero Media Player',
        getOAuthToken: (callback) => {
          getAccessTokenRef
            .current()
            .then(callback)
            .catch(() => setError('authentication_error'))
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
      playerRef.current?.disconnect()
    }
    // Mount-only on purpose: the token getter is read through a ref so a new
    // function identity from the caller never re-creates the SDK player.
  }, [])

  return {
    state,
    isActiveDevice,
    error,
    togglePlay: () => playerRef.current?.togglePlay(),
    skipNext: () => playerRef.current?.nextTrack(),
    skipPrevious: () => playerRef.current?.previousTrack(),
    seek: (positionMs) => playerRef.current?.seek(positionMs),
    setVolume: (volume) => playerRef.current?.setVolume(volume),
    playHere: () => {
      if (deviceIdRef.current) {
        // The server function now throws on a failed transfer; surface it in
        // the console rather than leaving an unhandled rejection.
        transferPlaybackHere({ data: { deviceId: deviceIdRef.current } }).catch((err: unknown) => {
          console.error('Failed to transfer playback to this device', err)
        })
      }
    },
  }
}
