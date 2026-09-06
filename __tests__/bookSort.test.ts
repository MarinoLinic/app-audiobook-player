import { bookProgressFraction, isBookFinished, resumeTarget, sortBooks, sortTracks } from '../utils/bookSort'
import { Book, Track } from '../types'

function makeTrack(overrides: Partial<Track>): Track {
	return {
		id: overrides.fileName ?? 'x',
		uri: 'content://a/' + (overrides.fileName ?? 'x'),
		fileName: overrides.fileName ?? 'x.mp3',
		title: overrides.fileName ?? 'x',
		format: 'mp3',
		...overrides,
	}
}

function makeBook(tracks: Track[], overrides: Partial<Book> = {}): Book {
	return {
		id: 'b1',
		name: 'Test Book',
		source: 'folder',
		coverUri: null,
		tracks,
		createdAt: 0,
		progress: {},
		sortMode: 'natural',
		...overrides,
	}
}

describe('sortTracks', () => {
	it('natural mode orders numbered files correctly', () => {
		const tracks = ['10.mp3', '2.mp3', '1.mp3'].map((f) => makeTrack({ fileName: f }))
		expect(sortTracks(tracks, 'natural').map((t) => t.fileName)).toEqual(['1.mp3', '2.mp3', '10.mp3'])
	})

	it('track mode prefers metadata track numbers', () => {
		const tracks = [
			makeTrack({ fileName: 'b.mp3', metadataTrackNumber: 2 }),
			makeTrack({ fileName: 'a.mp3', metadataTrackNumber: 1 }),
			makeTrack({ fileName: 'c.mp3', metadataTrackNumber: 10 }),
		]
		expect(sortTracks(tracks, 'track').map((t) => t.metadataTrackNumber)).toEqual([1, 2, 10])
	})

	it('track mode falls back to file track numbers and natural order', () => {
		const tracks = [
			makeTrack({ fileName: 'zebra.mp3' }),
			makeTrack({ fileName: 'b.mp3', fileTrackNumber: 2 }),
			makeTrack({ fileName: 'a.mp3', fileTrackNumber: 1 }),
		]
		// Numbered tracks first, unnumbered last by natural file order
		expect(sortTracks(tracks, 'track').map((t) => t.fileName)).toEqual(['a.mp3', 'b.mp3', 'zebra.mp3'])
	})

	it('title mode sorts by display title naturally', () => {
		const tracks = [
			makeTrack({ fileName: '1.mp3', title: 'Zulu' }),
			makeTrack({ fileName: '2.mp3', title: 'Alpha' }),
		]
		expect(sortTracks(tracks, 'title').map((t) => t.title)).toEqual(['Alpha', 'Zulu'])
	})
})

describe('bookProgressFraction', () => {
	it('counts completed tracks whole, partial by fraction', () => {
		const tracks = [makeTrack({ fileName: '1.mp3' }), makeTrack({ fileName: '2.mp3' }), makeTrack({ fileName: '3.mp3' })]
		const book = makeBook(tracks, {
			progress: {
				'1.mp3': { positionMs: 100, durationMs: 100, completed: true, updatedAt: 0 },
				'2.mp3': { positionMs: 50, durationMs: 100, completed: false, updatedAt: 0 },
			},
		})
		expect(bookProgressFraction(book)).toBeCloseTo((1 + 0.5) / 3)
	})

	it('is 0 for empty books and 1 for fully finished ones', () => {
		expect(bookProgressFraction(makeBook([]))).toBe(0)
		const t = makeTrack({ fileName: '1.mp3' })
		const book = makeBook([t], {
			progress: { '1.mp3': { positionMs: 1, durationMs: 1, completed: true, updatedAt: 0 } },
		})
		expect(bookProgressFraction(book)).toBe(1)
		expect(isBookFinished(book)).toBe(true)
	})
})

describe('resumeTarget', () => {
	const tracks = [makeTrack({ fileName: '1.mp3' }), makeTrack({ fileName: '2.mp3' }), makeTrack({ fileName: '3.mp3' })]

	it('resumes the current track at its saved position', () => {
		const book = makeBook(tracks, {
			currentTrackId: '2.mp3',
			progress: {
				'1.mp3': { positionMs: 1, durationMs: 1, completed: true, updatedAt: 0 },
				'2.mp3': { positionMs: 5000, durationMs: 60000, completed: false, updatedAt: 0 },
			},
		})
		const target = resumeTarget(book)!
		expect(target.track.id).toBe('2.mp3')
		expect(target.positionMs).toBe(5000)
	})

	it('advances to the first incomplete track when the saved one is done', () => {
		const book = makeBook(tracks, {
			currentTrackId: '1.mp3',
			progress: {
				'1.mp3': { positionMs: 1, durationMs: 1, completed: true, updatedAt: 0 },
			},
		})
		expect(resumeTarget(book)!.track.id).toBe('2.mp3')
	})

	it('restarts from the top when the book is finished', () => {
		const book = makeBook(tracks, {
			progress: Object.fromEntries(tracks.map((t) => [t.id, { positionMs: 1, durationMs: 1, completed: true, updatedAt: 0 }])),
		})
		const target = resumeTarget(book)!
		expect(target.track.id).toBe('1.mp3')
		expect(target.positionMs).toBe(0)
	})

	it('returns null for a book with no tracks', () => {
		expect(resumeTarget(makeBook([]))).toBeNull()
	})
})

describe('sortBooks', () => {
	const book = (name: string, extra: Partial<Book>) => makeBook([], { name, ...extra })

	it('sorts by recency, title, and added date', () => {
		const books = [
			book('10 Tales', { lastPlayedAt: 5, createdAt: 1 }),
			book('2 Tales', { lastPlayedAt: 9, createdAt: 2 }),
			book('1 Tale', { lastPlayedAt: 0, createdAt: 3 }),
		]
		expect(sortBooks(books, 'recent').map((b) => b.name)).toEqual(['2 Tales', '10 Tales', '1 Tale'])
		expect(sortBooks(books, 'title').map((b) => b.name)).toEqual(['1 Tale', '2 Tales', '10 Tales'])
		expect(sortBooks(books, 'added').map((b) => b.name)).toEqual(['1 Tale', '2 Tales', '10 Tales'])
	})
})
