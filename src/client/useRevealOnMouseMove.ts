import { useEffect, useRef, useState } from 'react'

const REVEAL_HIDE_DELAY_MS = 2000

/**
 * Visibility for the control that brings back UI which has taken itself off
 * screen — cinema mode's player, or a closed sidebar. It appears on mouse
 * movement and hides again after a beat of stillness, so the control is
 * reachable without permanently sitting on top of the visualizer.
 *
 * Starts hidden each time it becomes active, so dismissing something doesn't
 * immediately flash the control that undoes it.
 */
export function useRevealOnMouseMove(active: boolean): boolean {
  const [isVisible, setIsVisible] = useState(false)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) {
      setIsVisible(false)
      return
    }

    function handleMouseMove() {
      setIsVisible(true)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = setTimeout(() => setIsVisible(false), REVEAL_HIDE_DELAY_MS)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [active])

  return isVisible
}
