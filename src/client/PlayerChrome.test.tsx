import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { PlayerChrome } from './PlayerChrome'

// Vitest runs without globals, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

function renderChrome(overrides: Partial<Parameters<typeof PlayerChrome>[0]> = {}) {
  const onSeek = vi.fn()
  const props = {
    trackName: 'Aqua',
    artists: 'Aero',
    isPlaying: true,
    progressMs: 10_000,
    durationMs: 200_000,
    onTogglePlay: vi.fn(),
    onSkipNext: vi.fn(),
    onSkipPrevious: vi.fn(),
    onSeek,
    onVolumeChange: vi.fn(),
    ...overrides,
  }
  const utils = render(<PlayerChrome {...props} />)
  return { ...utils, onSeek, seek: utils.getByLabelText('Seek') as HTMLInputElement }
}

describe('PlayerChrome seek slider', () => {
  it('does not seek while dragging, and seeks once on release', () => {
    const { seek, onSeek } = renderChrome()

    fireEvent.change(seek, { target: { value: '50000' } })
    fireEvent.change(seek, { target: { value: '90000' } })
    fireEvent.change(seek, { target: { value: '120000' } })
    expect(onSeek).not.toHaveBeenCalled()

    fireEvent.pointerUp(seek)
    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenCalledWith(120_000)
  })

  it('shows the dragged position, not the stale progressMs prop, mid-drag', () => {
    const { seek, rerender } = renderChrome()

    fireEvent.change(seek, { target: { value: '150000' } })
    // A player_state_changed event lands mid-drag with an older position.
    rerender(
      <PlayerChrome
        trackName="Aqua"
        artists="Aero"
        isPlaying
        progressMs={12_000}
        durationMs={200_000}
        onTogglePlay={vi.fn()}
        onSkipNext={vi.fn()}
        onSkipPrevious={vi.fn()}
        onSeek={vi.fn()}
        onVolumeChange={vi.fn()}
      />,
    )

    expect(seek.value).toBe('150000')
  })

  it('follows progressMs again once the drag is committed', () => {
    const { seek, onSeek } = renderChrome()

    fireEvent.change(seek, { target: { value: '150000' } })
    fireEvent.touchEnd(seek)

    expect(onSeek).toHaveBeenCalledWith(150_000)
    expect(seek.value).toBe('10000')
  })
})
