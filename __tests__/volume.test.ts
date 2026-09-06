import { clampRate, clampVolumePercent, formatRate, percentToGainMB, percentToPlayerVolume } from '../utils/volume'

describe('rate clamping', () => {
	it('clamps to the allowed 0.5–3.0 window', () => {
		expect(clampRate(0.1)).toBe(0.5)
		expect(clampRate(5)).toBe(3)
		expect(clampRate(2)).toBe(2)
		expect(clampRate(NaN)).toBe(1)
	})
})

describe('volume mapping', () => {
	it('clamps to 0–200%', () => {
		expect(clampVolumePercent(-10)).toBe(0)
		expect(clampVolumePercent(250)).toBe(200)
		expect(clampVolumePercent(NaN)).toBe(100)
	})

	it('maps to the 0–1 player volume below 100%', () => {
		expect(percentToPlayerVolume(50)).toBe(0.5)
		expect(percentToPlayerVolume(100)).toBe(1)
		expect(percentToPlayerVolume(150)).toBe(1)
		expect(percentToPlayerVolume(0)).toBe(0)
	})

	it('computes loudness gain in millibels for >100%', () => {
		expect(percentToGainMB(100)).toBe(0)
		expect(percentToGainMB(50)).toBe(0)
		expect(percentToGainMB(150)).toBe(500)
		expect(percentToGainMB(200)).toBe(1000)
	})
})

describe('formatRate', () => {
	it('formats rates cleanly', () => {
		expect(formatRate(1)).toBe('1×')
		expect(formatRate(1.5)).toBe('1.5×')
		expect(formatRate(1.05)).toBe('1.05×')
	})
})
