import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlaybackSDK } from './usePlaybackSDK'

class FakePlayer {
  listeners = new Map<string, (payload: unknown) => void>()
  connect = vi.fn()
  disconnect = vi.fn()
  togglePlay = vi.fn()

  addListener(event: string, callback: (payload: unknown) => void) {
    this.listeners.set(event, callback)
  }

  emit(event: string, payload: unknown) {
    this.listeners.get(event)?.(payload)
  }
}

describe('usePlaybackSDK', () => {
  let fakePlayer: FakePlayer

  beforeEach(() => {
    fakePlayer = new FakePlayer()
    // @ts-expect-error test stub, not the real SDK types
    window.Spotify = { Player: vi.fn(function () { return fakePlayer }) }
  })

  it('marks the device inactive when player_state_changed receives null', () => {
    const { result } = renderHook(() => usePlaybackSDK(async () => 'token'))

    act(() => {
      fakePlayer.emit('player_state_changed', null)
    })

    expect(result.current.isActiveDevice).toBe(false)
  })

  it('sets an account_error when the SDK reports one', () => {
    const { result } = renderHook(() => usePlaybackSDK(async () => 'token'))

    act(() => {
      fakePlayer.emit('account_error', { message: 'Premium required' })
    })

    expect(result.current.error).toBe('account_error')
  })

  it('does not re-create the SDK player when the caller passes a new getter identity', () => {
    // `index.tsx` calls `usePlaybackSDK(() => getPlaybackToken())`, i.e. a fresh
    // arrow function every render. If the mount effect is keyed on that getter,
    // every re-render disconnects the player and registers a brand new Spotify
    // Connect device — which breaks playback outright.
    const { rerender } = renderHook(({ getToken }) => usePlaybackSDK(getToken), {
      initialProps: { getToken: async () => 'token' },
    })

    rerender({ getToken: async () => 'token' })
    rerender({ getToken: async () => 'token' })

    expect(window.Spotify.Player).toHaveBeenCalledTimes(1)
    expect(fakePlayer.connect).toHaveBeenCalledTimes(1)
    expect(fakePlayer.disconnect).not.toHaveBeenCalled()
  })

  it('reads the latest token getter through the ref on every getOAuthToken call', async () => {
    const first = vi.fn(async () => 'first-token')
    const second = vi.fn(async () => 'second-token')
    const { rerender } = renderHook(({ getToken }) => usePlaybackSDK(getToken), {
      initialProps: { getToken: first },
    })

    rerender({ getToken: second })

    const options = (window.Spotify.Player as unknown as { mock: { calls: [Spotify.PlayerInit][] } }).mock
      .calls[0][0]
    const callback = vi.fn()
    options.getOAuthToken(callback)
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith('second-token'))
    expect(first).not.toHaveBeenCalled()
  })

  it('flags an authentication_error when the token getter rejects', async () => {
    const { result } = renderHook(() =>
      usePlaybackSDK(async () => {
        throw new Error('Not authenticated')
      }),
    )

    const options = (window.Spotify.Player as unknown as { mock: { calls: [Spotify.PlayerInit][] } }).mock
      .calls[0][0]
    await act(async () => {
      options.getOAuthToken(vi.fn())
    })

    await vi.waitFor(() => expect(result.current.error).toBe('authentication_error'))
  })

  it('does not flag authentication_error for a transient token-fetch failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() =>
      usePlaybackSDK(async () => {
        throw new Error('network error')
      }),
    )

    const options = (window.Spotify.Player as unknown as { mock: { calls: [Spotify.PlayerInit][] } }).mock
      .calls[0][0]
    await act(async () => {
      options.getOAuthToken(vi.fn())
    })

    expect(result.current.error).toBeNull()
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to fetch a playback access token',
      expect.any(Error),
    )

    consoleError.mockRestore()
  })

  it('flags an authentication_error when the SDK emits one', () => {
    const { result } = renderHook(() => usePlaybackSDK(async () => 'token'))

    act(() => {
      fakePlayer.emit('authentication_error', { message: 'Invalid token' })
    })

    expect(result.current.error).toBe('authentication_error')
  })

  it('togglePlay delegates to the underlying SDK player', () => {
    const { result } = renderHook(() => usePlaybackSDK(async () => 'token'))

    act(() => {
      result.current.togglePlay()
    })

    expect(fakePlayer.togglePlay).toHaveBeenCalled()
  })
})
