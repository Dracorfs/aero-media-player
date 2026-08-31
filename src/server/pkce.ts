import { webcrypto } from 'node:crypto'

const VERIFIER_BYTE_LENGTH = 64

export function generateCodeVerifier(): string {
  const bytes = webcrypto.getRandomValues(new Uint8Array(VERIFIER_BYTE_LENGTH))
  return base64UrlEncode(bytes)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await webcrypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
