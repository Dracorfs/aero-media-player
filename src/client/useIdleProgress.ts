import { useEffect, useState } from 'react'

const TICK_MS = 250

/**
 * A playback position that loops forever, so the signed-out landing page has
 * something for the visualizer to animate from before any real track exists.
 *
 * `useLiveProgress` can't stand in for this: it clamps at `durationMs`, which
 * would freeze the scene after a single pass.
 */
export function useIdleProgress(durationMs: number): number {
  const [progressMs, setProgressMs] = useState(0)

  useEffect(() => {
    if (durationMs <= 0) {
      setProgressMs(0)
      return
    }

    const startedAt = Date.now()
    const id = setInterval(() => {
      setProgressMs((Date.now() - startedAt) % durationMs)
    }, TICK_MS)

    return () => clearInterval(id)
  }, [durationMs])

  return progressMs
}
