export interface PlaybackState {
  trackId: string
  name: string
  artists: string
  albumArtUrl: string | undefined
  progressMs: number
  durationMs: number
  isPlaying: boolean
}

export function toPlaybackState(sdkState: Spotify.PlaybackState): PlaybackState {
  const track = sdkState.track_window.current_track
  return {
    trackId: track.id ?? '',
    name: track.name,
    artists: track.artists.map((artist) => artist.name).join(', '),
    albumArtUrl: track.album.images[0]?.url,
    progressMs: sdkState.position,
    durationMs: sdkState.duration,
    isPlaying: !sdkState.paused,
  }
}
