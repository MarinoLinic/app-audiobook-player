import { ascii, deUnsynchronise, decodeLatin1, nullTerminator, readSynchsafe32, readUint24BE, readUint32BE } from './bytes'
import { ParsedMetadata } from '../types'
import { decodeId3Text } from './bytes'

/** Parses ID3v2.2 / v2.3 / v2.4 tags. Returns undefined when no ID3v2 tag is present. */
export function parseId3v2(b: Uint8Array): ParsedMetadata | undefined {
	if (b.length < 10 || ascii(b, 0, 3) !== 'ID3') return undefined

	const major = b[3]
	const flags = b[5]
	const tagSize = readSynchsafe32(b, 6)
	const tagEnd = Math.min(10 + tagSize, b.length)

	if (major < 2 || major > 4) return undefined

	let body = b.subarray(10, tagEnd)
	if (flags & 0x80) body = deUnsynchronise(body)

	// Skip extended header
	let offset = 0
	if (flags & 0x40) {
		const extSize = major === 4 ? readSynchsafe32(body, 0) : readUint32BE(body, 0)
		offset = major === 4 ? extSize : 4 + extSize
		if (offset >= body.length) offset = 0
	}

	const meta: ParsedMetadata = {}
	const isV22 = major === 2
	const headerSize = isV22 ? 6 : 10

	while (offset + headerSize <= body.length) {
		const id = ascii(body, offset, isV22 ? 3 : 4)
		if (!/^[A-Z0-9]+$/.test(id)) break

		const frameSize = isV22
			? readUint24BE(body, offset + 3)
			: major === 4
				? readSynchsafe32(body, offset + 4)
				: readUint32BE(body, offset + 4)
		const contentStart = offset + headerSize
		if (frameSize <= 0 || contentStart + frameSize > body.length) break
		const frame = body.subarray(contentStart, contentStart + frameSize)

		switch (id) {
			case 'TIT2':
			case 'TT2':
				meta.title = textFrame(frame) || meta.title
				break
			case 'TPE1':
			case 'TP1':
				meta.artist = textFrame(frame) || meta.artist
				break
			case 'TALB':
			case 'TAL':
				meta.album = textFrame(frame) || meta.album
				break
			case 'TRCK':
			case 'TRK': {
				const text = textFrame(frame)
				const m = text.match(/^\s*(\d{1,5})(?:\s*\/\s*(\d{1,5}))?/)
				if (m) {
					meta.trackNumber = parseInt(m[1], 10)
					if (m[2]) meta.totalTracks = parseInt(m[2], 10)
				}
				break
			}
			case 'APIC':
			case 'PIC': {
				const picture = isV22 ? parsePic(frame) : parseApic(frame)
				if (picture) meta.picture = picture
				break
			}
		}

		offset = contentStart + frameSize
	}

	return meta
}

function textFrame(frame: Uint8Array): string {
	if (frame.length === 0) return ''
	return decodeId3Text(frame.subarray(1), frame[0]).trim()
}

function parseApic(frame: Uint8Array): ParsedMetadata['picture'] | undefined {
	if (frame.length === 0) return undefined
	const encoding = frame[0]
	let o = 1
	const mimeEnd = nullTerminator(frame, o, false)
	const mime = decodeLatin1(frame.subarray(o, mimeEnd)) || 'image/jpeg'
	o = mimeEnd + 1
	if (o >= frame.length) return undefined
	o++ // picture type byte
	const twoBytes = encoding === 1 || encoding === 2
	const descEnd = nullTerminator(frame, o, twoBytes)
	o = descEnd + (twoBytes ? 2 : 1)
	if (o >= frame.length) return undefined
	return { mime: mime.startsWith('image') ? mime : `image/${mime.toLowerCase()}`, data: frame.slice(o) }
}

function parsePic(frame: Uint8Array): ParsedMetadata['picture'] | undefined {
	if (frame.length < 5) return undefined
	const encoding = frame[0]
	const format = ascii(frame, 1, 3).toLowerCase()
	const mime = format === 'png' ? 'image/png' : 'image/jpeg'
	let o = 5 // 1 encoding + 3 format + 1 picture type
	const twoBytes = encoding === 1 || encoding === 2
	const descEnd = nullTerminator(frame, o, twoBytes)
	o = descEnd + (twoBytes ? 2 : 1)
	if (o >= frame.length) return undefined
	return { mime, data: frame.slice(o) }
}

/** Parses an ID3v1 tag (last 128 bytes). Returns undefined when absent. */
export function parseId3v1(b: Uint8Array): ParsedMetadata | undefined {
	if (b.length < 128) return undefined
	const base = b.length - 128
	if (ascii(b, base, 3) !== 'TAG') return undefined

	const field = (start: number, length: number) => decodeLatin1(b.subarray(base + start, base + start + length)).replace(/\0.*$/, '').trim()
	const meta: ParsedMetadata = {}
	const title = field(3, 30)
	const artist = field(33, 30)
	const album = field(63, 30)
	if (title) meta.title = title
	if (artist) meta.artist = artist
	if (album) meta.album = album
	// ID3v1.1: byte 125 is 0 and byte 126 holds the track number
	if (b[base + 125] === 0 && b[base + 126] !== 0) meta.trackNumber = b[base + 126]
	return meta
}
