import { useState } from 'react'
import { useFullscreen } from './useFullscreen'
import { useCinemaMode } from './useCinemaMode'
import './PlayerChrome.css'

interface PlayerChromeProps {
  trackName: string
  artists: string
  isPlaying: boolean
  progressMs: number
  durationMs: number
  onTogglePlay: () => void
  onSkipNext: () => void
  onSkipPrevious: () => void
  onSeek: (positionMs: number) => void
  onVolumeChange: (volume: number) => void
  onOpenSettings: () => void
}

export function PlayerChrome({
  trackName,
  artists,
  isPlaying,
  progressMs,
  durationMs,
  onTogglePlay,
  onSkipNext,
  onSkipPrevious,
  onSeek,
  onVolumeChange,
  onOpenSettings,
}: PlayerChromeProps) {
  // While the user drags, the slider is driven by local state so it doesn't
  // fight the coarse, event-driven `progressMs` prop (which would make the
  // thumb freeze or jump backwards mid-drag). The seek is issued once, on
  // release, instead of on every drag step.
  const [draggedMs, setDraggedMs] = useState<number | null>(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const { isCinemaMode, isRevealVisible, toggleCinemaMode } = useCinemaMode()

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
    <div className="player-chrome">
      <div className="player-chrome__track">
        <div className="player-chrome__title">{trackName}</div>
        <div className="player-chrome__artists">{artists}</div>
      </div>
      <div className="player-chrome__controls">
        <button onClick={onSkipPrevious} aria-label="Previous track">
          ⏮
        </button>
        <button onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={onSkipNext} aria-label="Next track">
          ⏭
        </button>
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? '⤡' : '⤢'}
        </button>
        <button onClick={toggleCinemaMode} aria-label="Hide player">
          ◐
        </button>
        <button onClick={onOpenSettings} aria-label="Configuration">
          ⚙
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={durationMs}
        value={draggedMs ?? progressMs}
        onChange={(e) => setDraggedMs(Number(e.target.value))}
        onPointerUp={commitSeek}
        onMouseUp={commitSeek}
        onTouchEnd={commitSeek}
        onKeyUp={commitSeek}
        onBlur={commitSeek}
        aria-label="Seek"
        className="player-chrome__seek"
      />
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        defaultValue={0.5}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        className="player-chrome__volume"
      />
    </div>
  )
}
