import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLiveProgress } from './useLiveProgress'

describe('useLiveProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at the given progress', () => {
    const { result } = renderHook(() => useLiveProgress(10_000, true, 200_000))
    expect(result.current).toBe(10_000)
  })

  it('ticks forward on its own while playing, between events', () => {
    const { result } = renderHook(() => useLiveProgress(10_000, true, 200_000))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(11_000)
  })

  it('does not tick forward while paused', () => {
    const { result } = renderHook(() => useLiveProgress(10_000, false, 200_000))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current).toBe(10_000)
  })

  it('resyncs to a fresh progressMs the instant one arrives, discarding local drift', () => {
    const { result, rerender } = renderHook(({ progressMs, isPlaying }) => useLiveProgress(progressMs, isPlaying, 200_000), {
      initialProps: { progressMs: 10_000, isPlaying: true },
    })
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current).toBe(13_000)

    rerender({ progressMs: 50_000, isPlaying: true })
    expect(result.current).toBe(50_000)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(51_000)
  })

  it('never ticks past durationMs', () => {
    const { result } = renderHook(() => useLiveProgress(199_800, true, 200_000))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(200_000)
  })
})
