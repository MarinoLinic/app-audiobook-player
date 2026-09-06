import { ascii, decodeLatin1, decodeUtf8, readUint24BE, readUint32BE, readUint32LE } from './bytes'
import { ParsedMetadata } from '../types'

/**
 * Parses FLAC metadata blocks ('fLaC' magic + block stream).
 * Reads STREAMINFO (for duration), VORBIS_COMMENT and PICTURE blocks.
 */
export function parseFlac(b: Uint8Array): ParsedMetadata | undefined {
	if (b.length < 4 || ascii(b, 0, 4) !== 'fLaC') return undefined

	const meta: ParsedMetadata = {}
	let o = 4
	let isLast = false

	while (!isLast && o + 4 <= b.length) {
		isLast = (b[o] & 0x80) !== 0
		const type = b[o] & 0x7f
		const length = readUint24BE(b, o + 1)
		const body = b.subarray(o + 4, Math.min(o + 4 + length, b.length))
		switch (type) {
			case 0:
				parseStreamInfo(body, meta)
				break
			case 4:
				parseVorbisComment(body, meta)
				break
			case 6: {
				const picture = parsePicture(body)
				if (picture) meta.picture = picture
				break
			}
		}
		o += 4 + length
	}

	return meta
}

function parseStreamInfo(body: Uint8Array, meta: ParsedMetadata): void {
	if (body.length < 18) return
	// Bytes 10..17: sampleRate(20) channels(3) bps(5) totalSamples(36)
	const hi = readUint32BE(body, 10)
	const lo = readUint32BE(body, 14)
	const sampleRate = hi >>> 12
	const totalSamples = (hi & 0x0f) * 0x100000000 + lo
	if (sampleRate > 0 && totalSamples > 0) {
		meta.durationMs = Math.round((totalSamples / sampleRate) * 1000)
	}
}

function parseVorbisComment(body: Uint8Array, meta: ParsedMetadata): void {
	let o = 0
	if (body.length < 8) return
	const vendorLength = readUint32LE(body, o)
	o += 4 + vendorLength
	if (o + 4 > body.length) return
	const count = readUint32LE(body, o)
	o += 4

	for (let i = 0; i < count; i++) {
		if (o + 4 > body.length) return
		const length = readUint32LE(body, o)
		o += 4
		if (o + length > body.length) return
		const comment = decodeUtf8(body.subarray(o, o + length))
		o += length

		const eq = comment.indexOf('=')
		if (eq <= 0) continue
		const key = comment.slice(0, eq).toUpperCase()
		const value = comment.slice(eq + 1).trim()
		if (!value) continue
		switch (key) {
			case 'TITLE':
				meta.title = value
				break
			case 'ARTIST':
				meta.artist = value
				break
			case 'ALBUM':
				meta.album = value
				break
			case 'TRACKNUMBER': {
				const n = parseInt(value, 10)
				if (!isNaN(n)) meta.trackNumber = n
				break
			}
			case 'TOTALTRACKS':
			case 'TRACKTOTAL': {
				const n = parseInt(value, 10)
				if (!isNaN(n)) meta.totalTracks = n
				break
			}
		}
	}
}

function parsePicture(body: Uint8Array): ParsedMetadata['picture'] | undefined {
	let o = 4 // skip picture type
	if (body.length < o + 4) return undefined
	const mimeLength = readUint32BE(body, o)
	o += 4
	if (body.length < o + mimeLength) return undefined
	const mime = decodeLatin1(body.subarray(o, o + mimeLength)) || 'image/jpeg'
	o += mimeLength
	if (body.length < o + 4) return undefined
	const descLength = readUint32BE(body, o)
	o += 4 + descLength
	// width, height, depth, colors → 16 bytes
	o += 16
	if (body.length < o + 4) return undefined
	const dataLength = readUint32BE(body, o)
	o += 4
	if (body.length < o + dataLength || dataLength <= 0) return undefined
	return { mime, data: body.slice(o, o + dataLength) }
}
