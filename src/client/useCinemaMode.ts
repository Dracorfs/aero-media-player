import { useCallback, useState } from 'react'
import { useRevealOnMouseMove } from './useRevealOnMouseMove'

interface CinemaMode {
  isCinemaMode: boolean
  isRevealVisible: boolean
  toggleCinemaMode: () => void
}

/**
 * Cinema mode hides the whole player behind a reveal-on-movement control, so
 * the visualizer can be watched uninterrupted. The reveal timing is shared
 * with the sidebar's reopen control (see `useRevealOnMouseMove`).
 */
export function useCinemaMode(): CinemaMode {
  const [isCinemaMode, setIsCinemaMode] = useState(false)
  const isRevealVisible = useRevealOnMouseMove(isCinemaMode)

  const toggleCinemaMode = useCallback(() => setIsCinemaMode((prev) => !prev), [])

  return { isCinemaMode, isRevealVisible, toggleCinemaMode }
}
