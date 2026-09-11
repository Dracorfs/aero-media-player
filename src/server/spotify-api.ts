import { createServerFn } from '@tanstack/react-start'
import { getSpotifySession, setSpotifySession, clearSpotifySession, type SpotifySession } from './session'
import { refreshAccessToken } from './spotify-auth'
import { NOT_AUTHENTICATED_MESSAGE } from '../shared/authError'
import { fetchDeezerDynamics } from './deezer-api'

const EXPIRY_BUFFER_MS = 60_000

export function isExpiringSoon(expiresAt: number, now = Date.now()): boolean {
  return expiresAt - EXPIRY_BUFFER_MS <= now
}

/**
 * The single source of truth for "give me an access token I can actually use".
 * Refreshes (and re-persists) the session when the current token is expiring,
 * clearing the session if the refresh token itself has been revoked.
 */
async function getValidAccessToken(): Promise<string> {
  const session = await getSpotifySession()
  const { accessToken, refreshToken, expiresAt } = session.data

  if (!accessToken || !refreshToken || expiresAt === undefined) {
    throw new Error(NOT_AUTHENTICATED_MESSAGE)
  }

  if (isExpiringSoon(expiresAt)) {
    try {
      const refreshed = await refreshAccessToken(refreshToken)
      await setSpotifySession(refreshed)
      return refreshed.accessToken
    } catch (err) {
      await clearSpotifySession()
      throw err
    }
  }

  return accessToken
}

export const getPlaybackToken = createServerFn({ method: 'GET' }).handler(async () => getValidAccessToken())

export interface AuthStatus {
  isSignedIn: boolean
}

/**
 * True only when the session holds credentials this app can actually use: an
 * access token, the refresh token needed to renew it, and the expiry that
 * decides when to. Pure (no session/request access) so it stays unit-testable.
 */
export function hasUsableCredentials(data: Partial<SpotifySession>): boolean {
  return Boolean(data.accessToken && data.refreshToken && data.expiresAt !== undefined)
}

/**
 * Reports whether this browser has a Spotify session *without* throwing when
 * it doesn't — the landing page is the player either way, and it decides what
 * the sidebar shows. A missing/misconfigured env var still throws: that's a
 * setup problem, and reporting it as "signed out" would just loop the user
 * through a login that can never succeed.
 */
export const getAuthStatus = createServerFn({ method: 'GET' }).handler(async (): Promise<AuthStatus> => {
  const session = await getSpotifySession()
  return { isSignedIn: hasUsableCredentials(session.data) }
})

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  await clearSpotifySession()
})

export interface TrackDynamics {
  bpm: number
  gain: number
}

const DEFAULT_BPM = 120
// Midpoint of the modeled Deezer gain range [-15, 0] dB (see gainToIntensity)
// so a failed lookup lands the derived bar intensity in the middle of its
// range rather than at either visual extreme.
const DEFAULT_GAIN_DB = -7.5
export const DEFAULT_TRACK_DYNAMICS: TrackDynamics = { bpm: DEFAULT_BPM, gain: DEFAULT_GAIN_DB }

export async function fetchTrackIsrc(trackId: string, accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null

    const body = (await response.json()) as { external_ids?: { isrc?: string } }
    return body.external_ids?.isrc ?? null
  } catch {
    return null
  }
}

export async function fetchTrackDynamics(trackId: string, accessToken: string): Promise<TrackDynamics> {
  const isrc = await fetchTrackIsrc(trackId, accessToken)
  if (!isrc) return DEFAULT_TRACK_DYNAMICS

  const dynamics = await fetchDeezerDynamics(isrc)
  return dynamics ?? DEFAULT_TRACK_DYNAMICS
}

export const getTrackDynamics = createServerFn({ method: 'GET' })
  .validator((data: { trackId: string }) => data)
  .handler(async ({ data }) => {
    let accessToken: string
    try {
      accessToken = await getValidAccessToken()
    } catch {
      // Dynamics are best-effort decoration — never surface auth trouble here.
      return DEFAULT_TRACK_DYNAMICS
    }
    return fetchTrackDynamics(data.trackId, accessToken)
  })

export interface Playlist {
  id: string
  name: string
  uri: string
  imageUrl?: string
}

async function fetchCurrentUserId(accessToken: string): Promise<string> {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Spotify current-user request failed: ${response.status}`)
  }

  const body = (await response.json()) as { id: string }
  return body.id
}

export async function fetchPlaylists(accessToken: string): Promise<Playlist[]> {
  const currentUserId = await fetchCurrentUserId(accessToken)

  const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Spotify playlists request failed: ${response.status}`)
  }

  const body = (await response.json()) as {
    items: { id: string; name: string; uri: string; images: { url: string }[]; owner: { id: string } }[]
  }

  // Spotify's API policy blocks GET /playlists/{id}/items in Development
  // Mode for playlists the user follows but doesn't own, so a followed
  // playlist can't be offered here — picking one would always 403.
  return body.items
    .filter((item) => item.owner.id === currentUserId)
    .map((item) => ({
      id: item.id,
      name: item.name,
      uri: item.uri,
      imageUrl: item.images[0]?.url,
    }))
}

export const getPlaylists = createServerFn({ method: 'GET' }).handler(async () =>
  fetchPlaylists(await getValidAccessToken()),
)

export interface PlaylistTrack {
  uri: string
  name: string
  artists: string
}

interface PlaylistItemEntry {
  type: string
  uri: string
  name: string
  artists?: { name: string }[]
}

export async function fetchPlaylistTracks(playlistId: string, accessToken: string): Promise<PlaylistTrack[]> {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Spotify playlist tracks request failed: ${response.status}`)
  }

  const body = (await response.json()) as { items: { item: PlaylistItemEntry | null }[] }

  // GET /playlists/{id}/items (Feb 2026 replacement for the deprecated
  // /tracks endpoint) nests the played thing under `item`, which can be an
  // episode — episodes have no `artists` array, so they're skipped here.
  return body.items
    .filter((entry): entry is { item: PlaylistItemEntry & { artists: { name: string }[] } } =>
      entry.item !== null && entry.item.type === 'track',
    )
    .map((entry) => ({
      uri: entry.item.uri,
      name: entry.item.name,
      artists: entry.item.artists.map((artist) => artist.name).join(', '),
    }))
}

export const getPlaylistTracks = createServerFn({ method: 'GET' })
  .validator((data: { playlistId: string }) => data)
  .handler(async ({ data }) => fetchPlaylistTracks(data.playlistId, await getValidAccessToken()))

export interface PlayInContextRequest {
  deviceId: string
  contextUri: string
  trackUri: string
}

export async function postPlayInContext(request: PlayInContextRequest, accessToken: string): Promise<void> {
  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${request.deviceId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context_uri: request.contextUri, offset: { uri: request.trackUri } }),
    },
  )

  if (!response.ok) {
    throw new Error(`Spotify play request failed: ${response.status}`)
  }
}

export const playTrackInContext = createServerFn({ method: 'POST' })
  .validator((data: PlayInContextRequest) => data)
  .handler(async ({ data }) => postPlayInContext(data, await getValidAccessToken()))

/**
 * Moves whatever the account is already playing onto this tab's Connect
 * device. Picking a track starts playback here directly; this is the other
 * way in, for audio that is already running on a phone or the desktop app.
 */
export async function putTransferPlayback(deviceId: string, accessToken: string): Promise<void> {
  const response = await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    // `play: true` because the button says "Play here": a transfer that
    // lands paused would look like it did nothing.
    body: JSON.stringify({ device_ids: [deviceId], play: true }),
  })

  if (!response.ok) {
    throw new Error(`Spotify transfer request failed: ${response.status}`)
  }
}

export const transferPlayback = createServerFn({ method: 'POST' })
  .validator((data: { deviceId: string }) => data)
  .handler(async ({ data }) => putTransferPlayback(data.deviceId, await getValidAccessToken()))
