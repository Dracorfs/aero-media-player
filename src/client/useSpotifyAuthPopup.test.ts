import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpotifyAuthPopup } from './useSpotifyAuthPopup'
import { AUTH_COMPLETE_MESSAGE } from '../shared/authFlow'

function fakePopup() {
  return { closed: false, close: vi.fn() } as unknown as Window & { closed: boolean }
}

function postComplete(origin = window.location.origin, data: unknown = { type: AUTH_COMPLETE_MESSAGE }) {
  window.dispatchEvent(new MessageEvent('message', { data, origin }))
}

describe('useSpotifyAuthPopup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('opens the popup sign-in route on a user gesture', () => {
    const open = vi.fn().mockReturnValue(fakePopup())
    vi.stubGlobal('open', open)

    const { result } = renderHook(() => useSpotifyAuthPopup(vi.fn()))
    act(() => result.current.startSignIn())

    expect(open).toHaveBeenCalledTimes(1)
    expect(open.mock.calls[0][0]).toBe('/login?mode=popup')
    // `noopener` would sever window.opener and break the handoff.
    expect(String(open.mock.calls[0][2])).not.toContain('noopener')
    expect(result.current.isPending).toBe(true)
  })

  it('completes when the popup posts the handoff message', () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(fakePopup()))
    const onComplete = vi.fn()

    const { result } = renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => result.current.startSignIn())
    act(() => postComplete())

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(result.current.isPending).toBe(false)
  })

  it('ignores a handoff message from another origin', () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(fakePopup()))
    const onComplete = vi.fn()

    const { result } = renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => result.current.startSignIn())
    act(() => postComplete('https://evil.example'))

    expect(onComplete).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(true)
  })

  it('ignores a same-origin message of an unrelated shape', () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(fakePopup()))
    const onComplete = vi.fn()

    const { result } = renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => result.current.startSignIn())
    act(() => postComplete(window.location.origin, { type: 'not-ours' }))

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('completes when the popup is closed without a message', () => {
    const popup = fakePopup()
    vi.stubGlobal('open', vi.fn().mockReturnValue(popup))
    const onComplete = vi.fn()

    const { result } = renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => result.current.startSignIn())

    popup.closed = true
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(result.current.isPending).toBe(false)
  })

  it('stays pending while the popup is still open', () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(fakePopup()))
    const onComplete = vi.fn()

    const { result } = renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => result.current.startSignIn())
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(onComplete).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(true)
  })

  it('completes only once when the message and the close both land', () => {
    const popup = fakePopup()
    vi.stubGlobal('open', vi.fn().mockReturnValue(popup))
    const onComplete = vi.fn()

    const { result } = renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => result.current.startSignIn())
    act(() => postComplete())

    popup.closed = true
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('ignores a stray handoff message when no sign-in is in flight', () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(fakePopup()))
    const onComplete = vi.fn()

    renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => postComplete())

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('re-checks status when the user comes back to the tab mid-sign-in', () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(fakePopup()))
    const onComplete = vi.fn()

    const { result } = renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => result.current.startSignIn())
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
    // Still in flight: a handoff that shows up later must still settle it.
    expect(result.current.isPending).toBe(true)
  })

  it('ignores focus when no sign-in is in flight', () => {
    const onComplete = vi.fn()

    renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('still settles from the message after a focus re-check', () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(fakePopup()))
    const onComplete = vi.fn()

    const { result } = renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => result.current.startSignIn())
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    act(() => postComplete())

    expect(onComplete).toHaveBeenCalledTimes(2)
    expect(result.current.isPending).toBe(false)
  })

  it('reports a blocked popup instead of hanging', () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(null))
    const onComplete = vi.fn()

    const { result } = renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => result.current.startSignIn())

    expect(result.current.isPopupBlocked).toBe(true)
    expect(result.current.isPending).toBe(false)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('stops polling when the component unmounts mid-sign-in', () => {
    const popup = fakePopup()
    vi.stubGlobal('open', vi.fn().mockReturnValue(popup))
    const onComplete = vi.fn()

    const { result, unmount } = renderHook(() => useSpotifyAuthPopup(onComplete))
    act(() => result.current.startSignIn())
    unmount()

    popup.closed = true
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(onComplete).not.toHaveBeenCalled()
  })
})
