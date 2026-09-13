import { PlaylistPicker } from './PlaylistPicker'
import { ProfileAvatar } from './ProfileAvatar'
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
  /** `null` shows the default icon — see `ProfileAvatar`. Only relevant once signed in. */
  profileImageFilename: string | null
  onOpenProfilePicker: () => void
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
  profileImageFilename,
  onOpenProfilePicker,
}: SidebarProps) {
  return (
    <aside
      className={`sidebar${isOpen ? '' : ' sidebar--closed'}`}
      // Hidden from assistive tech and from pointers (see the CSS) while
      // closed: a panel that is merely translated off-canvas still takes
      // clicks and focus.
      aria-hidden={!isOpen}
      aria-label="Library"
    >
      <header className="sidebar__titlebar">
        <h1 className="sidebar__brand">Aero Media Player</h1>
        <div className="sidebar__titlebar-controls">
          <button type="button" className="sidebar__close" onClick={onClose} aria-label="Close sidebar">
            ×
          </button>
        </div>
      </header>

      {isSignedIn ? (
        <>
          <div className="sidebar__profile">
            <ProfileAvatar filename={profileImageFilename} size="sm" onClick={onOpenProfilePicker} />
          </div>
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
