import { describe, it, expect } from 'vitest'
import { AUTH_COMPLETE_MESSAGE, isAuthCompleteMessage } from './authFlow'

describe('isAuthCompleteMessage', () => {
  it('recognises the handoff message', () => {
    expect(isAuthCompleteMessage({ type: AUTH_COMPLETE_MESSAGE })).toBe(true)
  })

  it('ignores other message shapes', () => {
    expect(isAuthCompleteMessage({ type: 'something-else' })).toBe(false)
    expect(isAuthCompleteMessage({})).toBe(false)
    expect(isAuthCompleteMessage(AUTH_COMPLETE_MESSAGE)).toBe(false)
    expect(isAuthCompleteMessage(null)).toBe(false)
    expect(isAuthCompleteMessage(undefined)).toBe(false)
  })
})
