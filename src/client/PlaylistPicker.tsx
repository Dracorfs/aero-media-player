import { useEffect, useState } from 'react'
import { getPlaylists, getPlaylistTracks, type Playlist, type PlaylistTrack } from '../server/spotify-api'
import './PlaylistPicker.css'

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
    return (
      <div className="playlist-picker">
        <p className="playlist-picker__status">Couldn't load your playlists. Try logging in again.</p>
      </div>
    )
  }

  if (selected) {
    return (
      <div className="playlist-picker">
        <div className="playlist-picker__header">
          <button className="playlist-picker__back" onClick={() => setSelected(null)} aria-label="Back">
            ‹
          </button>
          <h2 className="playlist-picker__title">{selected.name}</h2>
        </div>
        {tracks === null ? (
          <p className="playlist-picker__status">Loading tracks...</p>
        ) : (
          <ul className="playlist-picker__list">
            {tracks.map((track) => (
              <li key={track.uri}>
                <button
                  className="playlist-picker__item"
                  onClick={() => onSelectTrack(selected.uri, track.uri)}
                >
                  {track.name} <span className="playlist-picker__track-artists">— {track.artists}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (playlists === null) {
    return (
      <div className="playlist-picker">
        <p className="playlist-picker__status">Loading your playlists...</p>
      </div>
    )
  }

  return (
    <div className="playlist-picker">
      <ul className="playlist-picker__list">
        {playlists.map((playlist) => (
          <li key={playlist.id}>
            <button className="playlist-picker__item" onClick={() => setSelected(playlist)}>
              {playlist.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
