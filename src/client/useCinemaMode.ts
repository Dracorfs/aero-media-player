import { useCallback, useEffect, useRef, useState } from 'react'

const REVEAL_HIDE_DELAY_MS = 2000

interface CinemaMode {
  isCinemaMode: boolean
  isRevealVisible: boolean
  toggleCinemaMode: () => void
}

export function useCinemaMode(): CinemaMode {
  const [isCinemaMode, setIsCinemaMode] = useState(false)
  const [isRevealVisible, setIsRevealVisible] = useState(false)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isCinemaMode) {
      setIsRevealVisible(false)
      return
    }

    function handleMouseMove() {
      setIsRevealVisible(true)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(() => setIsRevealVisible(false), REVEAL_HIDE_DELAY_MS)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [isCinemaMode])

  const toggleCinemaMode = useCallback(() => setIsCinemaMode((prev) => !prev), [])

  return { isCinemaMode, isRevealVisible, toggleCinemaMode }
}
