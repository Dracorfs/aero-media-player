import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { PlayerChrome, SIGNED_OUT_TITLE } from './PlayerChrome'

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

describe('PlayerChrome when disabled', () => {
  it('invites sign-in instead of naming a track', () => {
    const { getByText, queryByText } = renderChrome({ isDisabled: true })

    expect(getByText(SIGNED_OUT_TITLE)).not.toBeNull()
    expect(queryByText('Aqua')).toBeNull()
  })

  it('reads 0:00 rather than a live position', () => {
    const { getByText } = renderChrome({ isDisabled: true, progressMs: 90_000 })

    expect(getByText('0:00')).not.toBeNull()
  })

  it('disables every control that needs an account', () => {
    // Signed out there is nothing playing, so the play button reads "Play".
    const { getByLabelText } = renderChrome({ isDisabled: true, isPlaying: false })

    expect(getByLabelText('Seek')).toBeDisabled()
    expect(getByLabelText('Volume')).toBeDisabled()
    expect(getByLabelText('Previous track')).toBeDisabled()
    expect(getByLabelText('Play')).toBeDisabled()
    expect(getByLabelText('Next track')).toBeDisabled()
    expect(getByLabelText('Configuration')).toBeDisabled()
  })

  it('keeps fullscreen and cinema mode usable', () => {
    const { getByLabelText } = renderChrome({ isDisabled: true, isPlaying: false })

    expect(getByLabelText('Enter fullscreen')).not.toBeDisabled()
    expect(getByLabelText('Hide player')).not.toBeDisabled()
  })

  it('does not fire playback callbacks when a disabled control is clicked', () => {
    const onTogglePlay = vi.fn()
    const onSkipNext = vi.fn()
    const onSkipPrevious = vi.fn()
    const onOpenSettings = vi.fn()
    const { getByLabelText } = renderChrome({
      isDisabled: true,
      isPlaying: false,
      onTogglePlay,
      onSkipNext,
      onSkipPrevious,
      onOpenSettings,
    })

    fireEvent.click(getByLabelText('Play'))
    fireEvent.click(getByLabelText('Next track'))
    fireEvent.click(getByLabelText('Previous track'))
    fireEvent.click(getByLabelText('Configuration'))

    expect(onTogglePlay).not.toHaveBeenCalled()
    expect(onSkipNext).not.toHaveBeenCalled()
    expect(onSkipPrevious).not.toHaveBeenCalled()
    expect(onOpenSettings).not.toHaveBeenCalled()
  })

  it('ignores the space shortcut', () => {
    const onTogglePlay = vi.fn()
    renderChrome({ isDisabled: true, onTogglePlay })

    fireEvent.keyDown(window, { code: 'Space' })

    expect(onTogglePlay).not.toHaveBeenCalled()
  })

  it('still opens the library on "l" — that is where signing in happens', () => {
    const onToggleLibrary = vi.fn()
    renderChrome({ isDisabled: true, isPlaying: false, onToggleLibrary })

    fireEvent.keyDown(window, { key: 'l' })

    expect(onToggleLibrary).toHaveBeenCalledTimes(1)
  })

  it('still toggles play from the space shortcut when enabled', () => {
    const onTogglePlay = vi.fn()
    renderChrome({ onTogglePlay })

    fireEvent.keyDown(window, { code: 'Space' })

    expect(onTogglePlay).toHaveBeenCalledTimes(1)
  })
})
