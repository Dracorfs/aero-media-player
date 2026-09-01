/**
 * Server-side environment configuration.
 *
 * `.env` is loaded into `process.env` from `vite.config.ts` (via Vite's own
 * `loadEnv`) — Vite itself only ever populates `import.meta.env` with
 * `VITE_`-prefixed variables, which is not what the server code reads.
 */

export const REQUIRED_ENV_VARS = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_REDIRECT_URI', 'SESSION_SECRET'] as const

export type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number]

export class MissingEnvVarError extends Error {
  readonly name = 'MissingEnvVarError'
  readonly variable: string

  constructor(variable: string) {
    super(
      `Missing required env var: ${variable}. Copy .env.example to .env and fill it in (see README.md).`,
    )
    this.variable = variable
  }
}

export function isMissingEnvVarError(err: unknown): boolean {
  if (err instanceof MissingEnvVarError) return true
  // Server function errors cross a serialization boundary, so the class
  // identity can be lost by the time the client sees it — fall back to the
  // error name / message shape.
  if (typeof err !== 'object' || err === null) return false
  const candidate = err as { name?: unknown; message?: unknown }
  if (candidate.name === 'MissingEnvVarError') return true
  return typeof candidate.message === 'string' && candidate.message.startsWith('Missing required env var:')
}

/** Reads an env var, throwing a clear, named error when it is missing. */
export function requireEnv(name: RequiredEnvVar | (string & {})): string {
  const value = process.env[name]
  if (!value) throw new MissingEnvVarError(name)
  return value
}

/** Fail-fast check for every env var the server needs to function at all. */
export function assertServerEnv(): void {
  for (const name of REQUIRED_ENV_VARS) requireEnv(name)
}
