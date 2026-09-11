import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRevealOnMouseMove } from './useRevealOnMouseMove'

function move() {
  window.dispatchEvent(new MouseEvent('mousemove'))
}

describe('useRevealOnMouseMove', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays hidden while inactive, whatever the mouse does', () => {
    const { result } = renderHook(() => useRevealOnMouseMove(false))

    act(() => move())

    expect(result.current).toBe(false)
  })

  it('starts hidden on activation, so dismissing something does not flash the control', () => {
    const { result } = renderHook(() => useRevealOnMouseMove(true))
    expect(result.current).toBe(false)
  })

  it('appears on the first mouse move', () => {
    const { result } = renderHook(() => useRevealOnMouseMove(true))

    act(() => move())

    expect(result.current).toBe(true)
  })

  it('hides again after 2000ms of stillness', () => {
    const { result } = renderHook(() => useRevealOnMouseMove(true))

    act(() => move())
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current).toBe(false)
  })

  it('does not hide early', () => {
    const { result } = renderHook(() => useRevealOnMouseMove(true))

    act(() => move())
    act(() => {
      vi.advanceTimersByTime(1999)
    })

    expect(result.current).toBe(true)
  })

  it('restarts the countdown on further movement', () => {
    const { result } = renderHook(() => useRevealOnMouseMove(true))

    act(() => move())
    act(() => {
      vi.advanceTimersByTime(1500)
      move()
      vi.advanceTimersByTime(1500)
    })

    expect(result.current).toBe(true)
  })

  it('hides immediately when it goes inactive', () => {
    const { result, rerender } = renderHook(({ active }) => useRevealOnMouseMove(active), {
      initialProps: { active: true },
    })

    act(() => move())
    expect(result.current).toBe(true)

    rerender({ active: false })

    expect(result.current).toBe(false)
  })

  it('stops listening and cancels its pending hide once unmounted', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const clear = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = renderHook(() => useRevealOnMouseMove(true))

    act(() => move())
    unmount()

    expect(removeListener).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(clear).toHaveBeenCalled()

    // A move after unmount must not resurrect anything.
    expect(() => act(() => move())).not.toThrow()

    removeListener.mockRestore()
    clear.mockRestore()
  })
})
