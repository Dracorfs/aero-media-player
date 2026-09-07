import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCinemaMode } from './useCinemaMode'

describe('useCinemaMode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts outside cinema mode with the reveal control hidden', () => {
    const { result } = renderHook(() => useCinemaMode())
    expect(result.current.isCinemaMode).toBe(false)
    expect(result.current.isRevealVisible).toBe(false)
  })

  it('enters cinema mode with the reveal control hidden (no flash on entry)', () => {
    const { result } = renderHook(() => useCinemaMode())
    act(() => {
      result.current.toggleCinemaMode()
    })
    expect(result.current.isCinemaMode).toBe(true)
    expect(result.current.isRevealVisible).toBe(false)
  })

  it('reveals the control on the first mouse move after entering cinema mode', () => {
    const { result } = renderHook(() => useCinemaMode())
    act(() => {
      result.current.toggleCinemaMode()
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
    })
    expect(result.current.isRevealVisible).toBe(true)
  })

  it('hides the reveal control again after 2000ms of no further movement', () => {
    const { result } = renderHook(() => useCinemaMode())
    act(() => {
      result.current.toggleCinemaMode()
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.isRevealVisible).toBe(false)
  })

  it('does not hide before 2000ms have elapsed', () => {
    const { result } = renderHook(() => useCinemaMode())
    act(() => {
      result.current.toggleCinemaMode()
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
    })
    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(result.current.isRevealVisible).toBe(true)
  })

  it('resets the hide timer on repeated movement instead of hiding early', () => {
    const { result } = renderHook(() => useCinemaMode())
    act(() => {
      result.current.toggleCinemaMode()
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
    })
    act(() => {
      vi.advanceTimersByTime(1500)
      window.dispatchEvent(new MouseEvent('mousemove'))
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.isRevealVisible).toBe(true)
  })

  it('hides the reveal control immediately when exiting cinema mode', () => {
    const { result } = renderHook(() => useCinemaMode())
    act(() => {
      result.current.toggleCinemaMode()
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
    })
    act(() => {
      result.current.toggleCinemaMode()
    })
    expect(result.current.isCinemaMode).toBe(false)
    expect(result.current.isRevealVisible).toBe(false)
  })

  it('does not react to mouse moves while not in cinema mode', () => {
    const { result } = renderHook(() => useCinemaMode())
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
    })
    expect(result.current.isRevealVisible).toBe(false)
  })
})
