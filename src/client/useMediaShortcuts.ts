import { useEffect } from 'react'

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable
}

/**
 * Global playback shortcuts: Space toggles play/pause, "f" toggles
 * fullscreen. Ignored while the user is typing into a form field, and
 * whenever a modifier key is held, so this doesn't fight the browser's own
 * shortcuts or normal text entry.
 */
export function useMediaShortcuts(onTogglePlay: () => void, onToggleFullscreen: () => void): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (isTypingTarget(e.target)) return

      if (e.code === 'Space') {
        e.preventDefault()
        onTogglePlay()
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        onToggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onTogglePlay, onToggleFullscreen])
}
