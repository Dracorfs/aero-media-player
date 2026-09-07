import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFullscreen } from './useFullscreen'

describe('useFullscreen', () => {
  let fullscreenElement: Element | null

  beforeEach(() => {
    fullscreenElement = null
    // jsdom doesn't implement the Fullscreen API at all, so these properties
    // don't exist yet on `document` — define them rather than spying on them.
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    })
    document.exitFullscreen = vi.fn().mockImplementation(async () => {
      fullscreenElement = null
    })
    document.documentElement.requestFullscreen = vi.fn().mockImplementation(async () => {
      fullscreenElement = document.documentElement
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error test-only cleanup of the property defined above
    delete document.fullscreenElement
  })

  it('reports not fullscreen when document.fullscreenElement is null', () => {
    const { result } = renderHook(() => useFullscreen())
    expect(result.current.isFullscreen).toBe(false)
  })

  it('requests fullscreen on the document element when toggled while not fullscreen', () => {
    const { result } = renderHook(() => useFullscreen())

    act(() => {
      result.current.toggleFullscreen()
    })

    expect(document.documentElement.requestFullscreen).toHaveBeenCalled()
    expect(document.exitFullscreen).not.toHaveBeenCalled()
  })

  it('exits fullscreen when toggled while already fullscreen', () => {
    fullscreenElement = document.documentElement
    const { result } = renderHook(() => useFullscreen())

    act(() => {
      result.current.toggleFullscreen()
    })

    expect(document.exitFullscreen).toHaveBeenCalled()
    expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled()
  })

  it('updates isFullscreen when a fullscreenchange event fires', () => {
    const { result } = renderHook(() => useFullscreen())

    act(() => {
      fullscreenElement = document.documentElement
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(result.current.isFullscreen).toBe(true)
  })
})
