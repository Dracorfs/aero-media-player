import { useCallback, useEffect, useState } from 'react'

interface Fullscreen {
  isFullscreen: boolean
  toggleFullscreen: () => void
}

export function useFullscreen(): Fullscreen {
  const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement !== null)

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(document.fullscreenElement !== null)
    }
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
