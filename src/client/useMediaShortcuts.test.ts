import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useMediaShortcuts } from './useMediaShortcuts'

afterEach(cleanup)

function pressKey(init: KeyboardEventInit, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe('useMediaShortcuts', () => {
  it('toggles play on Space', () => {
    const onTogglePlay = vi.fn()
    const onToggleFullscreen = vi.fn()
    renderHook(() => useMediaShortcuts(onTogglePlay, onToggleFullscreen))

    pressKey({ code: 'Space' })

    expect(onTogglePlay).toHaveBeenCalledTimes(1)
    expect(onToggleFullscreen).not.toHaveBeenCalled()
  })

  it('toggles fullscreen on "f", case-insensitively', () => {
    const onTogglePlay = vi.fn()
    const onToggleFullscreen = vi.fn()
    renderHook(() => useMediaShortcuts(onTogglePlay, onToggleFullscreen))

    pressKey({ key: 'F' })

    expect(onToggleFullscreen).toHaveBeenCalledTimes(1)
    expect(onTogglePlay).not.toHaveBeenCalled()
  })

  it('prevents the default action (stops Space from scrolling the page)', () => {
    const onTogglePlay = vi.fn()
    renderHook(() => useMediaShortcuts(onTogglePlay, vi.fn()))

    const event = pressKey({ code: 'Space' })

    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores the shortcut while typing into a text field', () => {
    const onTogglePlay = vi.fn()
    const onToggleFullscreen = vi.fn()
    renderHook(() => useMediaShortcuts(onTogglePlay, onToggleFullscreen))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    pressKey({ code: 'Space' }, input)
    pressKey({ key: 'f' }, input)

    expect(onTogglePlay).not.toHaveBeenCalled()
    expect(onToggleFullscreen).not.toHaveBeenCalled()

    document.body.removeChild(input)
  })

  it('ignores the shortcut when a modifier key is held', () => {
    const onTogglePlay = vi.fn()
    renderHook(() => useMediaShortcuts(onTogglePlay, vi.fn()))

    pressKey({ code: 'Space', metaKey: true })

    expect(onTogglePlay).not.toHaveBeenCalled()
  })

  it('stops listening after unmount', () => {
    const onTogglePlay = vi.fn()
    const { unmount } = renderHook(() => useMediaShortcuts(onTogglePlay, vi.fn()))

    unmount()
    pressKey({ code: 'Space' })

    expect(onTogglePlay).not.toHaveBeenCalled()
  })
})

describe('useMediaShortcuts library toggle', () => {
  it('toggles the library on "l", case-insensitively', () => {
    const onToggleLibrary = vi.fn()
    renderHook(() => useMediaShortcuts(vi.fn(), vi.fn(), onToggleLibrary))

    pressKey({ key: 'l' })
    pressKey({ key: 'L' })

    expect(onToggleLibrary).toHaveBeenCalledTimes(2)
  })

  it('leaves the browser\'s own Cmd/Ctrl+L alone', () => {
    const onToggleLibrary = vi.fn()
    renderHook(() => useMediaShortcuts(vi.fn(), vi.fn(), onToggleLibrary))

    pressKey({ key: 'l', metaKey: true })
    pressKey({ key: 'l', ctrlKey: true })

    expect(onToggleLibrary).not.toHaveBeenCalled()
  })

  it('ignores "l" typed into a form field', () => {
    const onToggleLibrary = vi.fn()
    renderHook(() => useMediaShortcuts(vi.fn(), vi.fn(), onToggleLibrary))

    const input = document.createElement('input')
    document.body.appendChild(input)
    pressKey({ key: 'l' }, input)
    input.remove()

    expect(onToggleLibrary).not.toHaveBeenCalled()
  })

  it('is optional — "l" does nothing when no handler is given', () => {
    const onTogglePlay = vi.fn()
    renderHook(() => useMediaShortcuts(onTogglePlay, vi.fn()))

    expect(() => pressKey({ key: 'l' })).not.toThrow()
    expect(onTogglePlay).not.toHaveBeenCalled()
  })
})
