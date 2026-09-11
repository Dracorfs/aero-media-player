import { describe, it, expect } from 'vitest'
import { canonicalRedirectFor } from './origin'

const CANONICAL = 'http://127.0.0.1:3000'

describe('canonicalRedirectFor', () => {
  it('leaves a request that is already on the canonical origin alone', () => {
    expect(canonicalRedirectFor('http://127.0.0.1:3000/', CANONICAL)).toBeNull()
    expect(canonicalRedirectFor('http://127.0.0.1:3000/callback?code=abc', CANONICAL)).toBeNull()
  })

  it('moves a different host to the canonical one', () => {
    expect(canonicalRedirectFor('http://localhost:3000/', CANONICAL)).toBe('http://127.0.0.1:3000/')
  })

  it('keeps the path and query, so an in-flight OAuth callback still completes', () => {
    expect(canonicalRedirectFor('http://localhost:3000/callback?code=abc&state=xyz', CANONICAL)).toBe(
      'http://127.0.0.1:3000/callback?code=abc&state=xyz',
    )
    expect(canonicalRedirectFor('http://localhost:3000/login?mode=popup', CANONICAL)).toBe(
      'http://127.0.0.1:3000/login?mode=popup',
    )
  })

  it('treats a different port as a different origin', () => {
    expect(canonicalRedirectFor('http://127.0.0.1:5173/', CANONICAL)).toBe('http://127.0.0.1:3000/')
  })

  it('treats a different scheme as a different origin', () => {
    expect(canonicalRedirectFor('https://127.0.0.1:3000/', CANONICAL)).toBe('http://127.0.0.1:3000/')
  })
})
