import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'

/**
 * Vite only exposes `VITE_`-prefixed variables, and only on `import.meta.env`.
 * Every server module here reads `process.env` (SPOTIFY_CLIENT_ID, ...), which
 * Vite never populates — so load `.env` ourselves with Vite's own `loadEnv`
 * (empty prefix = all variables) and copy it into `process.env` for the dev /
 * build process. Real environment variables always win.
 *
 * These values stay server-side: nothing is injected via `define`, so they are
 * never inlined into the client bundle.
 */
function loadDotEnvIntoProcessEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

export default defineConfig(({ mode }) => {
  loadDotEnvIntoProcessEnv(mode)

  return {
    // `strictPort` so a taken :3000 fails loudly instead of silently moving
    // to :3001 — the app would then be running on a port that doesn't match
    // SPOTIFY_REDIRECT_URI, so the OAuth callback lands on whatever old dev
    // server is still squatting :3000 instead of this one.
    server: { port: 3000, strictPort: true },
    plugins: [tsConfigPaths(), tanstackStart(), viteReact()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
    },
  }
})
