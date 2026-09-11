import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { requireEnv } from './env'

/**
 * The single origin this app can actually work on: whatever
 * `SPOTIFY_REDIRECT_URI` points at.
 *
 * Spotify requires that redirect URI to match the dashboard entry character
 * for character, so every login lands back on that exact host. Reaching the
 * app on any other host — `http://localhost:3000` instead of
 * `http://127.0.0.1:3000`, which browsers treat as a different origin — splits
 * the app in two: the session cookie the callback writes belongs to one host
 * while the tab you are looking at is on the other, and a popup sign-in can't
 * even talk to its opener across that boundary. The symptom is a popup that
 * turns into a second, signed-in copy of the app while the original tab waits
 * forever.
 */
export function canonicalOrigin(): string {
  return new URL(requireEnv('SPOTIFY_REDIRECT_URI')).origin
}

/**
 * The same path and query on the canonical origin, or null when the request is
 * already there. Pure so the host comparison is unit-testable.
 */
export function canonicalRedirectFor(currentUrl: string, expectedOrigin: string): string | null {
  const url = new URL(currentUrl)
  if (url.origin === expectedOrigin) return null
  return `${expectedOrigin}${url.pathname}${url.search}`
}

export const getCanonicalRedirect = createServerFn({ method: 'GET' }).handler(async () =>
  canonicalRedirectFor(getRequestUrl().href, canonicalOrigin()),
)
