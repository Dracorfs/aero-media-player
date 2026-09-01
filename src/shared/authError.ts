/**
 * Shared (client + server safe) helpers for recognising "the user needs to log
 * in again" failures. Deliberately free of any server-only imports so route
 * components can use it without pulling session code into the client bundle.
 */

export const NOT_AUTHENTICATED_MESSAGE = 'Not authenticated'
export const REFRESH_FAILED_MESSAGE = 'Spotify token refresh failed'

/**
 * True only for the errors that mean "send the user back through login".
 * Anything else (config/startup errors, network failures) must surface rather
 * than be swallowed into a silent redirect.
 *
 * Duck-typed on `message` because server function errors cross a serialization
 * boundary and can reach the client as plain objects rather than `Error`s.
 */
export function isNotAuthenticatedError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const message = (err as { message?: unknown }).message
  if (typeof message !== 'string') return false
  return message.includes(NOT_AUTHENTICATED_MESSAGE) || message.includes(REFRESH_FAILED_MESSAGE)
}
