import { useCallback, useEffect, useState } from 'react'

interface Fullscreen {
  isFullscreen: boolean
  toggleFullscreen: () => void
}

export function useFullscreen(): Fullscreen {
  // Starts false and is corrected on mount rather than read during render:
  // the player is server-rendered now (the landing page is the player, signed
  // in or not) and `document` doesn't exist there — nor could the server know
  // the answer. `Boolean(...)` rather than `!== null` because a browser
  // without the Fullscreen API reports `undefined`, which means "not
  // fullscreen", not "fullscreen".
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    handleChange()
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }, [])

  return { isFullscreen, toggleFullscreen }
}
