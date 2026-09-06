import { useEffect, useState } from 'react'
import { getPlaylists, getPlaylistTracks, type Playlist, type PlaylistTrack } from '../server/spotify-api'

interface PlaylistPickerProps {
  onSelectTrack: (contextUri: string, trackUri: string) => void
}

export function PlaylistPicker({ onSelectTrack }: PlaylistPickerProps) {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<PlaylistTrack[] | null>(null)

  useEffect(() => {
    getPlaylists()
      .then(setPlaylists)
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    if (!selected) return
    setTracks(null)
    getPlaylistTracks({ data: { playlistId: selected.id } })
      .then(setTracks)
      .catch(() => setError(true))
  }, [selected])

  if (error) {
    return <p>Couldn't load your playlists. Try logging in again.</p>
  }

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)}>Back</button>
        <h2>{selected.name}</h2>
        {tracks === null ? (
          <p>Loading tracks...</p>
        ) : (
          <ul>
            {tracks.map((track) => (
              <li key={track.uri}>
                <button onClick={() => onSelectTrack(selected.uri, track.uri)}>
                  {track.name} — {track.artists}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (playlists === null) {
    return <p>Loading your playlists...</p>
  }

  return (
    <ul>
      {playlists.map((playlist) => (
        <li key={playlist.id}>
          <button onClick={() => setSelected(playlist)}>{playlist.name}</button>
        </li>
      ))}
    </ul>
  )
}
