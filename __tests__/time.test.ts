import { formatDuration, formatLongDuration, fraction } from '../utils/time'

describe('formatDuration', () => {
	it('formats seconds, minutes and hours', () => {
		expect(formatDuration(0)).toBe('0:00')
		expect(formatDuration(45_000)).toBe('0:45')
		expect(formatDuration(600_000)).toBe('10:00')
		expect(formatDuration(3_600_000)).toBe('1:00:00')
		expect(formatDuration(3_661_000)).toBe('1:01:01')
		expect(formatDuration(86_400_000)).toBe('24:00:00')
	})

	it('returns a placeholder for unknown durations', () => {
		expect(formatDuration(undefined)).toBe('--:--')
		expect(formatDuration(null)).toBe('--:--')
		expect(formatDuration(NaN)).toBe('--:--')
		expect(formatDuration(-5)).toBe('--:--')
	})
})

describe('formatLongDuration', () => {
	it('describes durations in human words', () => {
		expect(formatLongDuration(30_000)).toBe('under 1 min')
		expect(formatLongDuration(600_000)).toBe('10 min')
		expect(formatLongDuration(3_600_000)).toBe('1 hr')
		expect(formatLongDuration(5_400_000)).toBe('1 hr 30 min')
	})
})

describe('fraction', () => {
	it('computes and clamps progress', () => {
		expect(fraction(50, 100)).toBe(0.5)
		expect(fraction(150, 100)).toBe(1)
		expect(fraction(-10, 100)).toBe(0)
		expect(fraction(0, 0)).toBe(0)
		expect(fraction(undefined, 100)).toBe(0)
		expect(fraction(10, undefined)).toBe(0)
	})
})
