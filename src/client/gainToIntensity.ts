// Deezer's `gain` is how much a track must be attenuated to reach Deezer's
// loudness target: more negative = the original master is louder.
// Empirically this clusters roughly in [-15, 0] dB. Mapped to [0.3, 1.0] so
// quiet masters still pulse visibly (never fully flatten) while loud
// masters read as clearly more energetic.
const MIN_GAIN_DB = -15
const MAX_GAIN_DB = 0
const MIN_INTENSITY = 0.3
const MAX_INTENSITY = 1.0

export function gainToIntensity(gainDb: number): number {
  const clamped = Math.min(MAX_GAIN_DB, Math.max(MIN_GAIN_DB, gainDb))
  const normalized = (clamped - MAX_GAIN_DB) / (MIN_GAIN_DB - MAX_GAIN_DB)
  return MIN_INTENSITY + normalized * (MAX_INTENSITY - MIN_INTENSITY)
}
