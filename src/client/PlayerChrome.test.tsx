import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { PlayerChrome } from './PlayerChrome'

// Vitest runs without globals, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

function renderChrome(overrides: Partial<Parameters<typeof PlayerChrome>[0]> = {}) {
  const onSeek = vi.fn()
  const props = {
    trackName: 'Aqua',
    isPlaying: true,
    progressMs: 10_000,
    durationMs: 200_000,
    onTogglePlay: vi.fn(),
    onSkipNext: vi.fn(),
    onSkipPrevious: vi.fn(),
    onSeek,
    onVolumeChange: vi.fn(),
    onOpenSettings: vi.fn(),
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
        isPlaying
        progressMs={12_000}
        durationMs={200_000}
        onTogglePlay={vi.fn()}
        onSkipNext={vi.fn()}
        onSkipPrevious={vi.fn()}
        onSeek={vi.fn()}
        onVolumeChange={vi.fn()}
        onOpenSettings={vi.fn()}
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

describe('PlayerChrome cinema mode', () => {
  it('shows the full panel and a "Hide player" button by default', () => {
    const { getByLabelText, queryByLabelText } = renderChrome()

    expect(getByLabelText('Hide player')).not.toBeNull()
    expect(queryByLabelText('Show player')).toBeNull()
  })

  it('hides the panel and shows neither button immediately on entering cinema mode', () => {
    const { getByLabelText, queryByLabelText, queryByText } = renderChrome()

    fireEvent.click(getByLabelText('Hide player'))

    expect(queryByText('Aqua')).toBeNull()
    expect(queryByLabelText('Hide player')).toBeNull()
    expect(queryByLabelText('Show player')).toBeNull()
  })

  it('reveals the "Show player" button on mouse move after entering cinema mode', () => {
    const { getByLabelText, queryByLabelText } = renderChrome()

    fireEvent.click(getByLabelText('Hide player'))
    fireEvent.mouseMove(window)

    expect(queryByLabelText('Show player')).not.toBeNull()
  })

  it('restores the full panel when "Show player" is clicked', () => {
    const { getByLabelText, queryByText } = renderChrome()

    fireEvent.click(getByLabelText('Hide player'))
    fireEvent.mouseMove(window)
    fireEvent.click(getByLabelText('Show player'))

    expect(queryByText('Aqua')).not.toBeNull()
    expect(getByLabelText('Hide player')).not.toBeNull()
  })
})

describe('PlayerChrome configuration', () => {
  it('calls onOpenSettings when the configuration button is clicked', () => {
    const onOpenSettings = vi.fn()
    const { getByLabelText } = renderChrome({ onOpenSettings })

    fireEvent.click(getByLabelText('Configuration'))

    expect(onOpenSettings).toHaveBeenCalled()
  })
})
