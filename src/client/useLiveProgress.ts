import { useEffect, useRef, useState } from 'react'

const TICK_MS = 250

/**
 * Spotify's SDK only reports `progressMs` on discrete player_state_changed
 * events (roughly once a second, sometimes sparser), so binding a seek bar
 * or time readout directly to it looks stale/jumpy between events. This
 * interpolates forward off a local clock between events and resyncs the
 * instant a fresh `progressMs` arrives.
 */
export function useLiveProgress(progressMs: number, isPlaying: boolean, durationMs: number): number {
  const [liveProgressMs, setLiveProgressMs] = useState(progressMs)
  const baseRef = useRef({ progressMs, timestamp: Date.now() })

  useEffect(() => {
    baseRef.current = { progressMs, timestamp: Date.now() }
    setLiveProgressMs(progressMs)
  }, [progressMs])

  useEffect(() => {
    if (!isPlaying) return

    const id = setInterval(() => {
      const elapsedMs = Date.now() - baseRef.current.timestamp
      setLiveProgressMs(Math.min(baseRef.current.progressMs + elapsedMs, durationMs))
    }, TICK_MS)

    return () => clearInterval(id)
  }, [isPlaying, durationMs])

  return liveProgressMs
}
