import { Book, BookSortMode, Track, TrackSortMode } from '../types'
import { naturalCompare, naturalSortBy } from './naturalSort'

/**
 * Sorts a book's tracks by the chosen mode.
 * - natural: file names in natural numeric order ('1', '2', '10'). The default —
 *   always correct for numbered rips and harmless for named ones.
 * - track:   metadata track number first, natural file name as tie-break/fallback.
 * - title:   display title (metadata title or cleaned file name), naturally.
 */
export function sortTracks(tracks: Track[], mode: TrackSortMode): Track[] {
	switch (mode) {
		case 'track': {
			return [...tracks].sort((a, b) => {
				const numA = a.metadataTrackNumber ?? a.fileTrackNumber
				const numB = b.metadataTrackNumber ?? b.fileTrackNumber
				if (numA !== undefined && numB !== undefined && numA !== numB) return numA - numB
				if (numA !== undefined && numB === undefined) return -1
				if (numA === undefined && numB !== undefined) return 1
				return naturalCompare(a.fileName, b.fileName)
			})
		}
		case 'title':
			return naturalSortBy(tracks, (t) => t.title)
		case 'natural':
		default:
			return naturalSortBy(tracks, (t) => t.fileName)
	}
}

export function sortBooks(books: Book[], mode: BookSortMode): Book[] {
	switch (mode) {
		case 'recent':
			return [...books].sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
		case 'added':
			return [...books].sort((a, b) => b.createdAt - a.createdAt)
		case 'progress':
			// In-progress (between 0 and 1) first, then untouched, then finished
			return [...books].sort((a, b) => progressBucket(a) - progressBucket(b) || naturalCompare(a.name, b.name))
		case 'title':
		default:
			return naturalSortBy(books, (b) => b.name)
	}
}

function progressBucket(book: Book): number {
	const p = bookProgressFraction(book)
	if (p >= 1) return 2
	if (p > 0) return 0
	return 1
}

/**
 * Fraction of the book that is finished, 0..1.
 * Completed tracks count whole; the in-progress track contributes its own fraction.
 */
export function bookProgressFraction(book: Book): number {
	if (book.tracks.length === 0) return 0
	let sum = 0
	for (const track of book.tracks) {
		const progress = book.progress[track.id]
		if (!progress) continue
		if (progress.completed) sum += 1
		else if (progress.durationMs && progress.positionMs > 0) {
			sum += Math.min(1, progress.positionMs / progress.durationMs)
		}
	}
	return Math.min(1, sum / book.tracks.length)
}

export function isBookFinished(book: Book): boolean {
	return book.tracks.length > 0 && book.tracks.every((t) => book.progress[t.id]?.completed)
}

/**
 * The track + position to resume a book at: the most recently played
 * incomplete track, else the first incomplete track in sorted order.
 */
export function resumeTarget(book: Book): { track: Track; positionMs: number } | null {
	const sorted = sortTracks(book.tracks, book.sortMode)

	if (book.currentTrackId) {
		const current = sorted.find((t) => t.id === book.currentTrackId)
		if (current && !book.progress[current.id]?.completed) {
			return { track: current, positionMs: book.progress[current.id]?.positionMs ?? 0 }
		}
	}

	const firstIncomplete = sorted.find((t) => !book.progress[t.id]?.completed)
	if (firstIncomplete) {
		return { track: firstIncomplete, positionMs: book.progress[firstIncomplete.id]?.positionMs ?? 0 }
	}

	// Fully finished book → restart from the beginning
	const first = sorted[0]
	return first ? { track: first, positionMs: 0 } : null
}
