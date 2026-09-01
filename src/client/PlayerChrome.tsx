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
}: PlayerChromeProps) {
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
      </div>
      <input
        type="range"
        min={0}
        max={durationMs}
        value={progressMs}
        onChange={(e) => onSeek(Number(e.target.value))}
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
