/**
 * Natural (human) sorting utilities.
 *
 * The whole point: '1 - Intro', '2 - Beginnings', '10 - Middle' must sort
 * as 1, 2, 10 — never 1, 10, 2 — regardless of zero padding, separators,
 * or numbering style.
 */

interface Chunk {
	text: boolean
	value: string
}

const CHUNK_RE = /(\d+|\D+)/g

function chunkify(input: string): Chunk[] {
	const chunks: Chunk[] = []
	let match: RegExpExecArray | null
	CHUNK_RE.lastIndex = 0
	while ((match = CHUNK_RE.exec(input)) !== null) {
		const value = match[1]
		chunks.push({ text: /^\d+$/.test(value) === false, value })
	}
	return chunks
}

/**
 * Compares two strings naturally: numeric runs compare by value, everything
 * else compares alphabetically, ignoring case, punctuation and extra spaces.
 * Returns a negative number when a < b, 0 when equal, positive otherwise.
 */
export function naturalCompare(a: string, b: string): number {
	const chunksA = chunkify(a)
	const chunksB = chunkify(b)
	const length = Math.max(chunksA.length, chunksB.length)

	for (let i = 0; i < length; i++) {
		const chunkA = chunksA[i]
		const chunkB = chunksB[i]
		if (chunkA === undefined) return -1
		if (chunkB === undefined) return 1

		if (!chunkA.text && !chunkB.text) {
			// Both numeric: compare by numeric value so 2 < 10.
			const numA = parseInt(chunkA.value, 10)
			const numB = parseInt(chunkB.value, 10)
			if (numA !== numB) return numA - numB
			// Same value: fewer leading zeros first ('3' before '03'),
			// keeps ordering stable and deterministic.
			if (chunkA.value.length !== chunkB.value.length) return chunkA.value.length - chunkB.value.length
			continue
		}

		const textA = normalize(chunkA.value)
		const textB = normalize(chunkB.value)
		if (textA !== textB) return textA < textB ? -1 : 1
	}

	return 0
}

function normalize(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
}

/** Sorts a copy of the array by a string key, naturally. */
export function naturalSortBy<T>(items: T[], key: (item: T) => string): T[] {
	return [...items].sort((a, b) => naturalCompare(key(a), key(b)))
}

/**
 * Extracts a track/part/chapter number from a file name or title.
 *
 * Recognizes, among others:
 *   '01 - Title'            'Chapter 3'           'Book 2 Part 05'
 *   '[03] Title'            '3 of 12'             'Title (Disc 2)'
 *   'Title - 07'            'EP04'                't08 title'
 *   '1.2 Title' (chapter 1) 'The_Way_-_12'        '010 title'
 *
 * Returns undefined when no plausible number exists (e.g. bare titles,
 * or numbers that look like years/sizes are avoided by pattern choice).
 */
export function extractTrackNumber(fileName: string): number | undefined {
	const name = stripExtension(fileName).trim()

	// 1. Explicit keyword + number: 'Chapter 3', 'Part 05', 'Disc 2', 'Episode 12', 'Track02'.
	//    'part'/'chapter' style keywords win over 'book' so 'Book 2 Part 05' resolves to 5.
	const partMatch = name.match(
		/(?:^|[^a-z0-9])(?:chapter|ch|part|pt|disk|disc|cd|episode|ep|track|trk|section|sec)\s*\.?(?:\s+no\.?)?[\s\-_.]*(\d{1,4})\b/i,
	)
	if (partMatch) return parseInt(partMatch[1], 10)

	// 2. Series keywords: 'Book 1', 'Vol. 4'
	const bookMatch = name.match(/(?:^|[^a-z0-9])(?:book|volume|vol)\s*\.?[\s\-_.]*(\d{1,4})\b/i)
	if (bookMatch) return parseInt(bookMatch[1], 10)

	// 2. 'N of M' anywhere: '3 of 12', '3/12', '3-12_total' is intentionally not matched
	const ofMatch = name.match(/(?:^|[^0-9])(\d{1,4})\s*(?:of|\/)\s*\d{1,4}(?:\D|$)/i)
	if (ofMatch) return parseInt(ofMatch[1], 10)

	// 3. Leading number: '01 - Title', '07_Title', '[03] Title', '3. Title', '(2) Title'
	const leadingMatch = name.match(/^\s*[\[\(]?(\d{1,4})(?:[\]\)\.:\-_]|\s+-\s+|\s{2,}|\s)/)
	if (leadingMatch) {
		const value = parseInt(leadingMatch[1], 10)
		// Don't treat year-like leading values ('1999 Album Hits') as track numbers
		if (value >= 1900 && value <= 2099) return undefined
		return value
	}

	// 4. Trailing number: 'Title 07', 'Title - 07' ('Title Part 07' is caught by rule 1)
	const trailingMatch = name.match(/(?:^|\s|[\-_(\[])(\d{1,3})\s*[\]\)]?\s*$/)
	if (trailingMatch) return parseInt(trailingMatch[1], 10)

	return undefined
}

/** Removes a known audio extension from a file name. */
export function stripExtension(fileName: string): string {
	const match = fileName.match(/^(.*)\.([a-z0-9]{2,5})$/i)
	if (!match) return fileName
	return match[1]
}

/** Lower-cased extension without the dot, or '' when none. */
export function getExtension(fileName: string): string {
	const match = fileName.match(/\.([a-z0-9]{2,5})$/i)
	return match ? match[1].toLowerCase() : ''
}

/**
 * Produces a tidy display title from a file name: strips the extension and
 * the leading/trailing numbering noise ('01 - ', 'Chapter 3: ', '[03] ').
 */
export function deriveTitle(fileName: string): string {
	let name = stripExtension(fileName).trim()

	// Strip bracketed leading numbers: '[03] ', '(07) '
	name = name.replace(/^\s*[\[\(]\s*\d{1,4}\s*[\]\)]\s*[.\-_:]?\s*/, '')

	// Strip keyword + number prefixes: 'Chapter 3 - ', 'Part 05: ', 'Track 2. '
	name = name.replace(
		/^\s*(?:chapter|part|track|disc|disk|cd|volume|vol|book|episode|ep)\b\.?\s*(?:no\.?\s*)?\d{1,4}\s*[.\-_:]\s*/i,
		'',
	)

	// Strip plain leading numbers: '01 - ', '07_ ', '3. ', '01 Title'
	name = name.replace(/^\s*\d{1,4}\s*[.\-_:]+\s*/, '')
	name = name.replace(/^\s*\d{1,4}\s+(?=\S)/, '')

	// Strip trailing 'N of M'
	name = name.replace(/\s*\(?\d{1,4}\s*(?:of|\/)\s*\d{1,4}\)?\s*$/i, '')

	// Tidy separators people leave in file names
	name = name.replace(/[_|]+/g, ' ').replace(/\s{2,}/g, ' ').trim()

	return name || stripExtension(fileName).trim()
}
