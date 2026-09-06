import { decodeSAFPath, fileNameFromUri, nameFromUri } from '../utils/saf'

describe('SAF uri helpers', () => {
	const tree = 'content://com.android.externalstorage.documents/tree/primary%3AAudiobooks%2FMy%20Book'
	const doc = 'content://com.android.externalstorage.documents/tree/primary%3AAudiobooks%2FMy%20Book/document/primary%3AAudiobooks%2FMy%20Book%2F01%20-%20Intro.mp3'

	it('decodes tree paths', () => {
		expect(decodeSAFPath(tree)).toBe('primary:Audiobooks/My Book')
	})

	it('extracts folder names from tree uris', () => {
		expect(nameFromUri(tree)).toBe('My Book')
	})

	it('extracts file names from document uris', () => {
		expect(fileNameFromUri(doc)).toBe('01 - Intro.mp3')
	})

	it('falls back gracefully on unusual uris', () => {
		expect(nameFromUri('file:///sdcard/Audiobooks/Dune/03.mp3')).toBe('03.mp3')
		expect(nameFromUri('')).toBe('Book')
	})
})
