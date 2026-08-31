import '@testing-library/jest-dom/vitest'

process.env.SPOTIFY_CLIENT_ID ||= 'test-client-id'
process.env.SPOTIFY_REDIRECT_URI ||= 'http://127.0.0.1:3000/callback'
process.env.SESSION_SECRET ||= 'test-session-secret-at-least-32-chars-long'
