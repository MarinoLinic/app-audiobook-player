import { guessNameFromFiles, mapWithConcurrency } from '../utils/naming'

describe('guessNameFromFiles', () => {
	it('uses the common prefix for numbered chapter files', () => {
		expect(guessNameFromFiles(['Dune 01.mp3', 'Dune 02.mp3', 'Dune 03.mp3'])).toBe('Dune')
		expect(guessNameFromFiles(['The Dark Tower - 1.m4b', 'The Dark Tower - 2.m4b'])).toBe('The Dark Tower')
	})

	it('uses the file itself for a single import', () => {
		expect(guessNameFromFiles(['Prologue.mp3'])).toBe('Prologue')
	})

	it('falls back when there is no common ground', () => {
		expect(guessNameFromFiles(['alpha.mp3', 'zebra.mp3'])).toBe('Imported audio')
		expect(guessNameFromFiles([])).toBe('Imported audio')
	})
})

describe('mapWithConcurrency', () => {
	it('processes all items and preserves order', async () => {
		const items = Array.from({ length: 25 }, (_, i) => i)
		const results = await mapWithConcurrency(items, 5, async (n) => n * 2)
		expect(results).toEqual(items.map((n) => n * 2))
	})

	it('never exceeds the concurrency limit', async () => {
		let active = 0
		let peak = 0
		const items = Array.from({ length: 30 }, (_, i) => i)
		await mapWithConcurrency(items, 4, async () => {
			active++
			peak = Math.max(peak, active)
			await new Promise((r) => setTimeout(r, 5))
			active--
		})
		expect(peak).toBeLessThanOrEqual(4)
	})

	it('handles empty input', async () => {
		expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([])
	})
})
