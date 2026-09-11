/**
 * Shared (client + server safe) contract for the popup sign-in handoff.
 *
 * The popup tab sets the session cookie, posts this message to its opener and
 * closes itself; the opener re-checks auth status when it arrives. Kept free
 * of server-only imports so both sides can use it.
 */

export const AUTH_COMPLETE_MESSAGE = 'aero-auth-complete'

export interface AuthCompleteMessage {
  type: typeof AUTH_COMPLETE_MESSAGE
}

/**
 * Recognises the handoff message. Callers must still check `event.origin`
 * themselves — a shape check alone would happily accept a message posted by
 * any other window.
 */
export function isAuthCompleteMessage(data: unknown): data is AuthCompleteMessage {
  if (typeof data !== 'object' || data === null) return false
  return (data as { type?: unknown }).type === AUTH_COMPLETE_MESSAGE
}
