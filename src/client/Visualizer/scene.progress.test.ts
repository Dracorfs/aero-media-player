import { describe, it, expect } from 'vitest'
import { shouldResyncProgress, PROGRESS_RESYNC_THRESHOLD_MS } from './scene'

describe('shouldResyncProgress', () => {
  it('ignores normal event-to-event drift (SDK reports at ~1s granularity)', () => {
    expect(shouldResyncProgress(31_000, 30_100)).toBe(false)
  })

  it('resyncs on a forward seek', () => {
    expect(shouldResyncProgress(120_000, 30_000)).toBe(true)
  })

  it('resyncs on a backward seek / track change back to zero', () => {
    expect(shouldResyncProgress(0, 180_000)).toBe(true)
  })

  it('resyncs once drift exceeds the threshold (e.g. after a throttled tab)', () => {
    expect(shouldResyncProgress(10_000, 10_000 + PROGRESS_RESYNC_THRESHOLD_MS + 1)).toBe(true)
    expect(shouldResyncProgress(10_000, 10_000 + PROGRESS_RESYNC_THRESHOLD_MS)).toBe(false)
  })
})
