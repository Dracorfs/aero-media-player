import { describe, it, expect } from 'vitest'
import { generateCodeVerifier, generateCodeChallenge } from './pkce'

describe('generateCodeVerifier', () => {
  it('returns a URL-safe string of sufficient length', () => {
    const verifier = generateCodeVerifier()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('returns a different value each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier())
  })
})

describe('generateCodeChallenge', () => {
  it('is deterministic for the same verifier', async () => {
    const verifier = 'fixed-test-verifier-value-for-hashing'
    const challengeA = await generateCodeChallenge(verifier)
    const challengeB = await generateCodeChallenge(verifier)
    expect(challengeA).toBe(challengeB)
    expect(challengeA).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(challengeA).not.toContain('=')
  })

  it('differs for different verifiers', async () => {
    const challengeA = await generateCodeChallenge('verifier-one-value-xxxxxxxxxxxx')
    const challengeB = await generateCodeChallenge('verifier-two-value-yyyyyyyyyyyy')
    expect(challengeA).not.toBe(challengeB)
  })
})
