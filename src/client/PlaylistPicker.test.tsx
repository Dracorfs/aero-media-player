import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { PlaylistPicker } from './PlaylistPicker'
import { getPlaylists, getPlaylistTracks } from '../server/spotify-api'

vi.mock('../server/spotify-api', () => ({
  getPlaylists: vi.fn(),
  getPlaylistTracks: vi.fn(),
}))

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
})

const playlists = [
  { id: 'p1', name: 'Chill', uri: 'spotify:playlist:p1' },
  { id: 'p2', name: 'Focus', uri: 'spotify:playlist:p2' },
]

const tracks = [
  { uri: 'spotify:track:t1', name: 'Song A', artists: 'Artist A' },
  { uri: 'spotify:track:t2', name: 'Song B', artists: 'Artist B' },
]

describe('PlaylistPicker', () => {
  it('lists the playlist names once they load', async () => {
    vi.mocked(getPlaylists).mockResolvedValue(playlists)

    render(<PlaylistPicker onSelectTrack={vi.fn()} />)

    expect(await screen.findByText('Chill')).toBeInTheDocument()
    expect(screen.getByText('Focus')).toBeInTheDocument()
  })

  it('shows an error state when playlists fail to load', async () => {
    vi.mocked(getPlaylists).mockRejectedValue(new Error('403'))

    render(<PlaylistPicker onSelectTrack={vi.fn()} />)

    expect(await screen.findByText(/couldn't load/i)).toBeInTheDocument()
  })

  it('shows a playlist\'s tracks after clicking it', async () => {
    vi.mocked(getPlaylists).mockResolvedValue(playlists)
    vi.mocked(getPlaylistTracks).mockResolvedValue(tracks)

    render(<PlaylistPicker onSelectTrack={vi.fn()} />)
    fireEvent.click(await screen.findByText('Chill'))

    expect(getPlaylistTracks).toHaveBeenCalledWith({ data: { playlistId: 'p1' } })
    expect(await screen.findByText(/Song A/)).toBeInTheDocument()
    expect(screen.getByText(/Song B/)).toBeInTheDocument()
  })

  it('calls onSelectTrack with the playlist and track uris when a track is clicked', async () => {
    vi.mocked(getPlaylists).mockResolvedValue(playlists)
    vi.mocked(getPlaylistTracks).mockResolvedValue(tracks)
    const onSelectTrack = vi.fn()

    render(<PlaylistPicker onSelectTrack={onSelectTrack} />)
    fireEvent.click(await screen.findByText('Chill'))
    fireEvent.click(await screen.findByText(/Song A/))

    expect(onSelectTrack).toHaveBeenCalledWith('spotify:playlist:p1', 'spotify:track:t1')
  })

  it('returns to the playlist list from the track list via the back button', async () => {
    vi.mocked(getPlaylists).mockResolvedValue(playlists)
    vi.mocked(getPlaylistTracks).mockResolvedValue(tracks)

    render(<PlaylistPicker onSelectTrack={vi.fn()} />)
    fireEvent.click(await screen.findByText('Chill'))
    await screen.findByText(/Song A/)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    expect(await screen.findByText('Focus')).toBeInTheDocument()
  })
})
