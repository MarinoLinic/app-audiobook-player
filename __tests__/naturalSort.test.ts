import { deriveTitle, extractTrackNumber, getExtension, naturalCompare, naturalSortBy, stripExtension } from '../utils/naturalSort'

describe('naturalCompare', () => {
	it('orders numeric fragments by value, not lexically', () => {
		expect(naturalCompare('1 - Intro', '10 - Middle')).toBeLessThan(0)
		expect(naturalCompare('2 - Beginning', '10 - Middle')).toBeLessThan(0)
		expect(naturalCompare('10', '2')).toBeGreaterThan(0)
	})

	it('treats padded and unpadded numbers as equal value', () => {
		expect(naturalCompare('01 intro', '1 intro')).not.toBe(0) // deterministic tie-break
		expect(naturalCompare('1', '01')).toBeLessThan(0)
		expect(naturalCompare('002', '10')).toBeLessThan(0)
	})

	it('ignores case and punctuation noise in text fragments', () => {
		expect(naturalCompare('The_Dark-Tower', 'the dark tower')).toBe(0)
		expect(naturalCompare('Alpha', 'beta')).toBeLessThan(0)
	})

	it('sorts a realistic audiobook file list correctly', () => {
		const files = [
			'10 - The Fall.mp3',
			'1 - The Call.mp3',
			'2 - The Journey.mp3',
			'11 - Aftermath.mp3',
		]
		expect([...files].sort(naturalCompare)).toEqual([
			'1 - The Call.mp3',
			'2 - The Journey.mp3',
			'10 - The Fall.mp3',
			'11 - Aftermath.mp3',
		])
	})

	it('handles mixed zero padding in real-world lists', () => {
		const files = ['01.aac', '1.mp3', '0010.mp3', '2.mp3', '02.mp3', '10.mp3']
		const sorted = [...files].sort(naturalCompare)
		expect(sorted.map((f) => parseInt(f, 10))).toEqual([1, 1, 2, 2, 10, 10])
	})
})

describe('naturalSortBy', () => {
	it('sorts objects by a key', () => {
		const items = [{ n: 'file10' }, { n: 'file2' }, { n: 'file1' }]
		expect(naturalSortBy(items, (i) => i.n).map((i) => i.n)).toEqual(['file1', 'file2', 'file10'])
	})

	it('does not mutate the input array', () => {
		const items = ['b2', 'b10', 'b1']
		naturalSortBy(items, (i) => i)
		expect(items).toEqual(['b2', 'b10', 'b1'])
	})
})

describe('extractTrackNumber', () => {
	const cases: Array<[string, number]> = [
		['01 - The Shire.mp3', 1],
		['07_Title.m4b', 7],
		['3. Title.mp3', 3],
		['[03] Title.mp3', 3],
		['(2) Title.mp3', 2],
		['Chapter 3.mp3', 3],
		['Chapter 12 - The End.mp3', 12],
		['Ch. 9 Begins.mp3', 9],
		['ch05.mp3', 5],
		['Part 05.mp3', 5],
		['Book 2 Part 05.mp3', 5],
		['Disc 2 - A.mp3', 2],
		['CD01.mp3', 1],
		['Episode 12.mp3', 12],
		['ep 04.mp3', 4],
		['Track 08.mp3', 8],
		['Track02.mp3', 2],
		['3 of 12.mp3', 3],
		['3/12.mp3', 3],
		['My Story - 07.mp3', 7],
		['The Long Road 12.mp3', 12],
		['1.2 Title.mp3', 1],
		['010 title.mp3', 10],
		['00 - Prologue.mp3', 0],
	]
	it.each(cases)("parses '%s' as %i", (file, expected) => {
		expect(extractTrackNumber(file)).toBe(expected)
	})

	it('returns undefined for names without a plausible number', () => {
		expect(extractTrackNumber('Prologue.mp3')).toBeUndefined()
		expect(extractTrackNumber('The Dark Tower.mp3')).toBeUndefined()
	})

	it('does not treat leading year-like values as track numbers', () => {
		expect(extractTrackNumber('1999 Album Hits.mp3')).toBeUndefined()
		expect(extractTrackNumber('2024 Live in Berlin.mp3')).toBeUndefined()
	})

	it('does not treat a mid-word fragment as a keyword', () => {
		expect(extractTrackNumber('Steep Hill.m4b')).toBeUndefined()
	})
})

describe('deriveTitle', () => {
	it('strips leading numbers with separators', () => {
		expect(deriveTitle('01 - The Shire.mp3')).toBe('The Shire')
		expect(deriveTitle('07_Title.m4b')).toBe('Title')
		expect(deriveTitle('3. Title.mp3')).toBe('Title')
		expect(deriveTitle('[03] Title.mp3')).toBe('Title')
	})

	it('strips keyword prefixes', () => {
		expect(deriveTitle('Chapter 3 - Dark Roads.mp3')).toBe('Dark Roads')
		expect(deriveTitle('Part 05: Arrival.mp3')).toBe('Arrival')
	})

	it('strips trailing x of y', () => {
		expect(deriveTitle('My Story 3 of 12.mp3')).toBe('My Story')
	})

	it('cleans underscores and keeps titles without numbering intact', () => {
		expect(deriveTitle('the_dark_tower.mp3')).toBe('the dark tower')
		expect(deriveTitle('Prologue.mp3')).toBe('Prologue')
	})
})

describe('extension helpers', () => {
	it('strips and extracts extensions', () => {
		expect(stripExtension('a.b/c01.mp3')).toBe('a.b/c01')
		expect(getExtension('c01.MP3')).toBe('mp3')
		expect(getExtension('noext')).toBe('')
		expect(stripExtension('noext')).toBe('noext')
	})
})
