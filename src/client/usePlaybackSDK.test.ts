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

  it('togglePlay delegates to the underlying SDK player', () => {
    const { result } = renderHook(() => usePlaybackSDK(async () => 'token'))

    act(() => {
      result.current.togglePlay()
    })

    expect(fakePlayer.togglePlay).toHaveBeenCalled()
  })
})
