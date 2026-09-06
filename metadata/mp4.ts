import { ascii, decodeUtf8, readUint16BE, readUint32BE } from './bytes'
import { ParsedMetadata } from '../types'

/**
 * Parses MP4/M4A/M4B/iTunes metadata by walking the atom tree down to
 * moov.udta.meta.ilst. Works regardless of whether `moov` is at the start
 * or the end of the file (the whole buffer must be supplied).
 */
export function parseMp4(b: Uint8Array): ParsedMetadata | undefined {
	const ftyp = findAtom(b, 0, b.length, 'ftyp')
	if (!ftyp) return undefined

	const meta: ParsedMetadata = {}
	const moov = findAtom(b, 0, b.length, 'moov')
	if (!moov) return meta

	const udta = findAtom(b, moov.start, moov.end, 'udta')
	if (!udta) return meta

	// meta atom has a 4-byte fullbox header before its children
	const metaAtom = findAtom(b, udta.start, udta.end, 'meta')
	if (!metaAtom) return meta

	const ilst = findAtom(b, metaAtom.start + 4, metaAtom.end, 'ilst')
	if (!ilst) return meta

	// Iterate ilst items
	let o = ilst.start
	while (o + 8 <= ilst.end) {
		const size = readUint32BE(b, o)
		const type = ascii(b, o + 4, 4)
		if (size < 8 || o + size > ilst.end) break
		parseItem(b.subarray(o + 8, o + size), type, meta)
		o += size
	}
	return meta
}

function parseItem(item: Uint8Array, type: string, meta: ParsedMetadata): void {
	const data = findAtom(item, 0, item.length, 'data')
	if (!data) return
	// data atom: 4 bytes type indicator + 4 bytes locale, then payload
	const payload = item.subarray(data.start + 8, data.end)
	switch (type) {
		case '©nam': {
			const value = decodeUtf8(payload).trim()
			if (value) meta.title = value
			break
		}
		case '©ART': {
			const value = decodeUtf8(payload).trim()
			if (value) meta.artist = value
			break
		}
		case 'aART': {
			if (!meta.artist) {
				const value = decodeUtf8(payload).trim()
				if (value) meta.artist = value
			}
			break
		}
		case '©alb': {
			const value = decodeUtf8(payload).trim()
			if (value) meta.album = value
			break
		}
		case 'trkn': {
			if (payload.length >= 8) {
				// 2 reserved, 2 track, 2 total
				const track = readUint16BE(payload, 2)
				const total = readUint16BE(payload, 4)
				if (track > 0) meta.trackNumber = track
				if (total > 0) meta.totalTracks = total
			}
			break
		}
		case 'covr': {
			if (payload.length > 0) {
				// 4-byte type indicator precedes the payload; 13 = JPEG, 14 = PNG
				const kind = item[data.start + 3] === 14 ? 'image/png' : 'image/jpeg'
				meta.picture = { mime: kind, data: payload.slice() }
			}
			break
		}
	}
}

interface AtomRange {
	start: number
	end: number
}

/** Finds the first atom of the given 4cc within [start, end). Handles 64-bit sizes. */
function findAtom(b: Uint8Array, start: number, end: number, fourCC: string): AtomRange | undefined {
	let o = start
	while (o + 8 <= end) {
		let size = readUint32BE(b, o)
		const type = ascii(b, o + 4, 4)
		let headerSize = 8
		if (size === 1) {
			// 64-bit extended size
			if (o + 16 > end) return undefined
			const hi = readUint32BE(b, o + 8)
			const lo = readUint32BE(b, o + 12)
			size = hi * 0x100000000 + lo
			headerSize = 16
		} else if (size === 0) {
			size = end - o
		}
		if (size < headerSize || o + size > end) return undefined
		if (type === fourCC) return { start: o + headerSize, end: o + size }
		o += size
	}
	return undefined
}
