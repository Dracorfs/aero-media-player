import { useState } from 'react'
import { useFullscreen } from './useFullscreen'
import { useCinemaMode } from './useCinemaMode'
import { useLiveProgress } from './useLiveProgress'
import { useMediaShortcuts } from './useMediaShortcuts'
import './PlayerChrome.css'

export const SIGNED_OUT_TITLE = 'Sign in with Spotify to start playing'

// Module-level so the identity is stable: `useMediaShortcuts` re-registers its
// listener whenever its callbacks change.
const noop = () => {}

interface PlayerChromeProps {
  trackName: string
  isPlaying: boolean
  progressMs: number
  durationMs: number
  onTogglePlay: () => void
  onSkipNext: () => void
  onSkipPrevious: () => void
  onSeek: (positionMs: number) => void
  onVolumeChange: (volume: number) => void
  onOpenSettings: () => void
  /**
   * Renders the bar as scenery: every playback control is inert and the
   * readout invites sign-in instead of naming a track. Fullscreen and cinema
   * mode stay live — neither needs an account.
   */
  isDisabled?: boolean
  /**
   * The sidebar is holding the left edge of the screen, so the bar slides
   * over to stay centered in the space that is actually free.
   */
  isShifted?: boolean
}

export function PlayerChrome({
  trackName,
  isPlaying,
  progressMs,
  durationMs,
  onTogglePlay,
  onSkipNext,
  onSkipPrevious,
  onSeek,
  onVolumeChange,
  onOpenSettings,
  isDisabled = false,
  isShifted = false,
}: PlayerChromeProps) {
  // While the user drags, the slider is driven by local state so it doesn't
  // fight the coarse, event-driven `progressMs` prop (which would make the
  // thumb freeze or jump backwards mid-drag). The seek is issued once, on
  // release, instead of on every drag step.
  const [draggedMs, setDraggedMs] = useState<number | null>(null)
  const [volume, setVolume] = useState(0.5)
  const liveProgressMs = useLiveProgress(progressMs, isPlaying, durationMs)
  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const { isCinemaMode, isRevealVisible, toggleCinemaMode } = useCinemaMode()
  useMediaShortcuts(isDisabled ? noop : onTogglePlay, toggleFullscreen)

  const seekProgressMs = isDisabled ? 0 : (draggedMs ?? liveProgressMs)
  const seekFillPct = durationMs > 0 ? (seekProgressMs / durationMs) * 100 : 0

  function commitSeek() {
    if (draggedMs === null) return
    onSeek(draggedMs)
    setDraggedMs(null)
  }

  if (isCinemaMode) {
    if (!isRevealVisible) return null
    return (
      <button
        type="button"
        onClick={toggleCinemaMode}
        aria-label="Show player"
        className="player-chrome__reveal"
      >
        ◑
      </button>
    )
  }

  return (
    <div
      className={`player-chrome${isDisabled ? ' player-chrome--disabled' : ''}${
        isShifted ? ' player-chrome--shifted' : ''
      }`}
    >
      <input
        type="range"
        min={0}
        max={durationMs}
        value={seekProgressMs}
        onChange={(e) => setDraggedMs(Number(e.target.value))}
        onPointerUp={commitSeek}
        onMouseUp={commitSeek}
        onTouchEnd={commitSeek}
        onKeyUp={commitSeek}
        onBlur={commitSeek}
        aria-label="Seek"
        disabled={isDisabled}
        className="player-chrome__seek"
        style={{ '--seek-fill': `${seekFillPct}%` } as React.CSSProperties}
      />
      <div className="player-chrome__row">
        <div className="player-chrome__readout">
          <span className="player-chrome__title">{isDisabled ? SIGNED_OUT_TITLE : trackName}</span>
        </div>
        <div className="player-chrome__transport">
          <span className="player-chrome__time">{formatTime(seekProgressMs)}</span>
          <div className="player-chrome__controls">
            <button
              className="player-chrome__icon-btn player-chrome__icon-btn--prev"
              onClick={onSkipPrevious}
              disabled={isDisabled}
              aria-label="Previous track"
            >
              ⏮
            </button>
            <button
              className="player-chrome__play-btn"
              onClick={onTogglePlay}
              disabled={isDisabled}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              className="player-chrome__icon-btn player-chrome__icon-btn--next"
              onClick={onSkipNext}
              disabled={isDisabled}
              aria-label="Next track"
            >
              ⏭
            </button>
          </div>
          <div className="player-chrome__volume-group">
            <svg
              className="player-chrome__volume-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M4 9v6h4l5 5V4L8 9H4z" />
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03z" />
              <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => {
                const next = Number(e.target.value)
                setVolume(next)
                onVolumeChange(next)
              }}
              aria-label="Volume"
              disabled={isDisabled}
              className="player-chrome__volume"
              style={{ '--volume-fill': `${volume * 100}%` } as React.CSSProperties}
            />
          </div>
        </div>
        <div className="player-chrome__extras">
          <button
            className="player-chrome__icon-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⤡' : '⤢'}
          </button>
          <button className="player-chrome__icon-btn" onClick={toggleCinemaMode} aria-label="Hide player">
            ◐
          </button>
          <button
            className="player-chrome__icon-btn"
            onClick={onOpenSettings}
            disabled={isDisabled}
            aria-label="Configuration"
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  )
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
