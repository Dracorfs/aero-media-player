import { useEffect, useState } from 'react'
import { PlaylistPicker } from './PlaylistPicker'
import { useRevealOnMouseMove } from './useRevealOnMouseMove'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isSignedIn: boolean
  /** A sign-in tab is open and hasn't reported back yet. */
  isSigningIn: boolean
  /** The browser refused the sign-in tab, so offer a same-tab link instead. */
  isPopupBlocked: boolean
  onSignIn: () => void
  onSignOut: () => void
  onSelectTrack: (contextUri: string, trackUri: string) => void
  /**
   * Signed in, but something else is the active Spotify device — so there is
   * playback elsewhere that could be moved here.
   */
  canPlayHere: boolean
  onPlayHere: () => Promise<void>
}

/**
 * The player's account and library panel: sign-in before there is a session,
 * the playlist picker and sign-off after. Presentation only — opening,
 * closing and the sign-in flow itself are the caller's business.
 */
export function Sidebar({
  isOpen,
  onClose,
  isSignedIn,
  isSigningIn,
  isPopupBlocked,
  onSignIn,
  onSignOut,
  onSelectTrack,
  canPlayHere,
  onPlayHere,
}: SidebarProps) {
  const [playHereError, setPlayHereError] = useState<string | null>(null)

  useEffect(() => {
    // Playback landed here (or the account went quiet): the last failure is
    // no longer about anything the user can see.
    if (!canPlayHere) setPlayHereError(null)
  }, [canPlayHere])

  async function handlePlayHere() {
    setPlayHereError(null)
    try {
      await onPlayHere()
    } catch {
      // Kept local and rendered as a message — a rejected transfer must never
      // reach the render tree as a thrown error.
      setPlayHereError("Couldn't move playback here. Check that Spotify is playing somewhere, then try again.")
    }
  }
  return (
    <aside
      className={`sidebar${isOpen ? '' : ' sidebar--closed'}`}
      // Hidden from assistive tech and from pointers (see the CSS) while
      // closed: a panel that is merely translated off-canvas still takes
      // clicks and focus.
      aria-hidden={!isOpen}
      aria-label="Library"
    >
      <header className="sidebar__header">
        <h1 className="sidebar__brand">Aero Media Player</h1>
        <button type="button" className="sidebar__close" onClick={onClose} aria-label="Close sidebar">
          ×
        </button>
      </header>

      {isSignedIn ? (
        <>
          {canPlayHere ? (
            <div className="sidebar__transfer">
              <button
                type="button"
                className="sidebar__button sidebar__button--quiet"
                onClick={handlePlayHere}
              >
                Play here
              </button>
              {playHereError ? <p className="sidebar__error">{playHereError}</p> : null}
            </div>
          ) : null}
          <div className="sidebar__body">
            <PlaylistPicker onSelectTrack={onSelectTrack} variant="embedded" />
          </div>
          <footer className="sidebar__footer">
            <button type="button" className="sidebar__button sidebar__button--quiet" onClick={onSignOut}>
              Sign off
            </button>
          </footer>
        </>
      ) : (
        <div className="sidebar__body sidebar__body--signin">
          <p className="sidebar__lede">
            Connect your Spotify Premium account to play your own playlists through the visualizer.
          </p>
          <button
            type="button"
            className="sidebar__button"
            onClick={onSignIn}
            disabled={isSigningIn}
          >
            {isSigningIn ? 'Waiting for Spotify...' : 'Sign in with Spotify'}
          </button>
          {isPopupBlocked ? (
            <p className="sidebar__hint">
              Your browser blocked the sign-in window. <a href="/login">Sign in in this tab</a> instead.
            </p>
          ) : null}
        </div>
      )}
    </aside>
  )
}

interface SidebarRevealProps {
  isSidebarOpen: boolean
  onOpen: () => void
}

/**
 * The way back to a closed sidebar. It uses the same reveal-on-movement
 * behaviour as cinema mode's "Show player" control, so closing the panel
 * leaves nothing sitting permanently over the visualizer.
 */
export function SidebarReveal({ isSidebarOpen, onOpen }: SidebarRevealProps) {
  const isVisible = useRevealOnMouseMove(!isSidebarOpen)

  if (isSidebarOpen || !isVisible) return null

  return (
    <button type="button" className="sidebar-reveal" onClick={onOpen} aria-label="Show library">
      ☰
    </button>
  )
}
