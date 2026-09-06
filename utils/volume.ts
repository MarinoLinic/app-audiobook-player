export const MIN_RATE = 0.5
export const MAX_RATE = 3.0
export const RATE_STEP = 0.05

/** Common preset speeds surfaced as chips in the UI. */
export const RATE_PRESETS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]

export const MIN_VOLUME_PERCENT = 0
/** VLC-style over-amplification ceiling. */
export const MAX_VOLUME_PERCENT = 200

export function clampRate(rate: number): number {
	if (!isFinite(rate)) return 1
	return Math.min(MAX_RATE, Math.max(MIN_RATE, rate))
}

export function clampVolumePercent(percent: number): number {
	if (!isFinite(percent)) return 100
	return Math.min(MAX_VOLUME_PERCENT, Math.max(MIN_VOLUME_PERCENT, percent))
}

/** Player volume is 0..1 — applies only to the ≤100% part of the slider. */
export function percentToPlayerVolume(percent: number): number {
	return Math.min(1, Math.max(0, clampVolumePercent(percent) / 100))
}

/**
 * Gain in millibels for Android's LoudnessEnhancer to amplify beyond 100%.
 * 100% → 0 mB (no boost), 200% → 1000 mB (+10 dB).
 */
export function percentToGainMB(percent: number): number {
	const p = clampVolumePercent(percent)
	if (p <= 100) return 0
	return Math.round((p - 100) * 10)
}

export function formatRate(rate: number): string {
	return `${Number(rate.toFixed(2))}×`
}
