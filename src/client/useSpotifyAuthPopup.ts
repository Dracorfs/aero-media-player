import { useCallback, useEffect, useRef, useState } from 'react'
import { isAuthCompleteMessage } from '../shared/authFlow'

const POPUP_URL = '/login?mode=popup'
const POPUP_NAME = 'aero-spotify-signin'
// No `noopener` here on purpose: the popup needs `window.opener` to report
// back, and that feature would sever it.
const POPUP_FEATURES = 'width=520,height=720'
const CLOSED_POLL_MS = 500

interface SpotifyAuthPopup {
  /** Opens the Spotify consent tab. Must be called from a user gesture. */
  startSignIn: () => void
  /** A sign-in tab is open and hasn't reported back yet. */
  isPending: boolean
  /** The browser refused to open the tab — offer a same-tab link instead. */
  isPopupBlocked: boolean
}

/**
 * Runs Spotify sign-in in a second tab and tells the caller when to re-check
 * auth status.
 *
 * Two independent paths settle a sign-in, because neither is reliable alone:
 * the popup posts a message once the session cookie is set (fast, but lost if
 * an extension or a blocked `window.close()` gets in the way), and this polls
 * `popup.closed` (slower, but catches a tab the user simply dismissed). The
 * callback fires at most once per attempt either way, and since the caller
 * re-reads status from the server, a cancelled sign-in just reports "still
 * signed out" rather than hanging.
 */
export function useSpotifyAuthPopup(onComplete: () => void): SpotifyAuthPopup {
  const [isPending, setIsPending] = useState(false)
  const [isPopupBlocked, setIsPopupBlocked] = useState(false)
  const popupRef = useRef<Window | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inFlightRef = useRef(false)

  // Callers pass a fresh closure on every render; hold the latest in a ref so
  // the listener below can stay mounted for the component's lifetime.
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const stopPolling = useCallback(() => {
    if (pollRef.current === null) return
    clearInterval(pollRef.current)
    pollRef.current = null
  }, [])

  const settle = useCallback(() => {
    if (!inFlightRef.current) return
    inFlightRef.current = false
    stopPolling()
    popupRef.current = null
    setIsPending(false)
    onCompleteRef.current()
  }, [stopPolling])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Origin first: the shape check alone would accept a message posted by
      // any other window.
      if (event.origin !== window.location.origin) return
      if (!isAuthCompleteMessage(event.data)) return
      settle()
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [settle])

  useEffect(() => stopPolling, [stopPolling])

  const startSignIn = useCallback(() => {
    const popup = window.open(POPUP_URL, POPUP_NAME, POPUP_FEATURES)

    if (!popup) {
      inFlightRef.current = false
      stopPolling()
      popupRef.current = null
      setIsPending(false)
      setIsPopupBlocked(true)
      return
    }

    setIsPopupBlocked(false)
    inFlightRef.current = true
    popupRef.current = popup
    setIsPending(true)

    stopPolling()
    pollRef.current = setInterval(() => {
      if (popupRef.current?.closed) settle()
    }, CLOSED_POLL_MS)
  }, [settle, stopPolling])

  return { startSignIn, isPending, isPopupBlocked }
}
