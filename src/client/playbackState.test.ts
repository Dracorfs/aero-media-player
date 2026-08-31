import { describe, it, expect } from 'vitest'
import { toPlaybackState } from './playbackState'

function mockSdkState(overrides: Partial<{ paused: boolean; position: number; duration: number }> = {}) {
  return {
    paused: overrides.paused ?? false,
    position: overrides.position ?? 15000,
    duration: overrides.duration ?? 200000,
    track_window: {
      current_track: {
        id: 'track-123',
        name: 'Test Track',
        artists: [{ name: 'Artist One' }, { name: 'Artist Two' }],
        album: { images: [{ url: 'https://example.com/art.jpg' }] },
      },
    },
  } as unknown as Spotify.PlaybackState
}

describe('toPlaybackState', () => {
  it('maps track metadata and playback position', () => {
    const state = toPlaybackState(mockSdkState())

    expect(state).toEqual({
      trackId: 'track-123',
      name: 'Test Track',
      artists: 'Artist One, Artist Two',
      albumArtUrl: 'https://example.com/art.jpg',
      progressMs: 15000,
      durationMs: 200000,
      isPlaying: true,
    })
  })

  it('reports isPlaying false when the SDK reports paused', () => {
    const state = toPlaybackState(mockSdkState({ paused: true }))
    expect(state.isPlaying).toBe(false)
  })
})
