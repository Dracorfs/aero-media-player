import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIdleProgress } from './useIdleProgress'

const DURATION_MS = 10_000

describe('useIdleProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at the beginning', () => {
    const { result } = renderHook(() => useIdleProgress(DURATION_MS))
    expect(result.current).toBe(0)
  })

  it('advances as time passes', () => {
    const { result } = renderHook(() => useIdleProgress(DURATION_MS))

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current).toBe(1000)
  })

  it('wraps back to the start instead of clamping at the duration', () => {
    const { result } = renderHook(() => useIdleProgress(DURATION_MS))

    act(() => {
      vi.advanceTimersByTime(DURATION_MS + 500)
    })

    expect(result.current).toBe(500)
  })

  it('keeps looping over several passes', () => {
    const { result } = renderHook(() => useIdleProgress(DURATION_MS))

    act(() => {
      vi.advanceTimersByTime(DURATION_MS * 3 + 2000)
    })

    expect(result.current).toBe(2000)
    expect(result.current).toBeLessThan(DURATION_MS)
  })

  it('stays at zero for a zero or negative duration rather than dividing by it', () => {
    const { result } = renderHook(() => useIdleProgress(0))

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current).toBe(0)
  })

  it('stops ticking once unmounted', () => {
    const { result, unmount } = renderHook(() => useIdleProgress(DURATION_MS))

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    const beforeUnmount = result.current
    unmount()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current).toBe(beforeUnmount)
    expect(vi.getTimerCount()).toBe(0)
  })
})
