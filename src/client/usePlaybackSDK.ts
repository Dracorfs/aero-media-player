import { useEffect, useRef, useState } from 'react'
import { toPlaybackState, type PlaybackState } from './playbackState'
import { transferPlaybackHere } from '../server/spotify-api'

interface PlaybackSDK {
  state: PlaybackState | null
  isActiveDevice: boolean
  error: 'account_error' | 'initialization_error' | null
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
  const [error, setError] = useState<'account_error' | 'initialization_error' | null>(null)

  useEffect(() => {
    function initPlayer() {
      const player = new window.Spotify.Player({
        name: 'Aero Media Player',
        getOAuthToken: (callback) => {
          getAccessToken().then(callback)
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
  }, [getAccessToken])

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
        transferPlaybackHere({ data: { deviceId: deviceIdRef.current } })
      }
    },
  }
}
