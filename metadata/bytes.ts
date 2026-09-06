/** Low-level byte helpers shared by the metadata parsers. */

export function readUint16BE(b: Uint8Array, o: number): number {
	return (b[o] << 8) | b[o + 1]
}

export function readUint16LE(b: Uint8Array, o: number): number {
	return b[o] | (b[o + 1] << 8)
}

export function readUint24BE(b: Uint8Array, o: number): number {
	return (b[o] << 16) | (b[o + 1] << 8) | b[o + 2]
}

export function readUint32BE(b: Uint8Array, o: number): number {
	return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
}

export function readUint32LE(b: Uint8Array, o: number): number {
	return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
}

/** ID3 synchsafe integers: 7 usable bits per byte. */
export function readSynchsafe32(b: Uint8Array, o: number): number {
	return ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f)
}

export function ascii(b: Uint8Array, o: number, length: number): string {
	let out = ''
	for (let i = 0; i < length; i++) out += String.fromCharCode(b[o + i])
	return out
}

export function decodeLatin1(b: Uint8Array): string {
	let out = ''
	for (let i = 0; i < b.length; i++) out += String.fromCharCode(b[i])
	return out
}

export function decodeUtf8(b: Uint8Array): string {
	let out = ''
	let i = 0
	const cont = (offset: number) => i + offset < b.length && (b[i + offset] & 0xc0) === 0x80
	while (i < b.length) {
		const c = b[i]
		if (c < 0x80) {
			out += String.fromCharCode(c)
			i += 1
		} else if (c < 0xe0 && cont(1)) {
			out += String.fromCharCode(((c & 0x1f) << 6) | (b[i + 1] & 0x3f))
			i += 2
		} else if (c < 0xf0 && cont(1) && cont(2)) {
			out += String.fromCharCode(((c & 0x0f) << 12) | ((b[i + 1] & 0x3f) << 6) | (b[i + 2] & 0x3f))
			i += 3
		} else if (cont(1) && cont(2) && cont(3)) {
			const cp = ((c & 0x07) << 18) | ((b[i + 1] & 0x3f) << 12) | ((b[i + 2] & 0x3f) << 6) | (b[i + 3] & 0x3f)
			if (cp >= 0x10000 && cp <= 0x10ffff) {
				out += String.fromCharCode(0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff))
			} else {
				out += ''
			}
			i += 4
		} else {
			// Truncated or invalid sequence — emit replacement char and move on
			out += ''
			i += 1
		}
	}
	// Strip BOM when present
	if (out.charCodeAt(0) === 0xfeff) out = out.slice(1)
	return out
}

export function decodeUtf16(b: Uint8Array): string {
	let start = 0
	let littleEndian = false
	if (b.length >= 2) {
		if (b[0] === 0xff && b[1] === 0xfe) {
			littleEndian = true
			start = 2
		} else if (b[0] === 0xfe && b[1] === 0xff) {
			start = 2
		}
	}
	let out = ''
	for (let i = start; i + 1 < b.length; i += 2) {
		const unit = littleEndian ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]
		out += String.fromCharCode(unit)
	}
	return out
}

/** ID3 text encoding byte → decoded string. */
export function decodeId3Text(b: Uint8Array, encoding: number): string {
	switch (encoding) {
		case 0:
			return decodeLatin1(b).replace(/\0+$/, '')
		case 1:
			return decodeUtf16(b).replace(/\0+$/, '')
		case 2: {
			// UTF-16BE without BOM
			let out = ''
			for (let i = 0; i + 1 < b.length; i += 2) out += String.fromCharCode((b[i] << 8) | b[i + 1])
			return out.replace(/\0+$/, '')
		}
		default:
			return decodeUtf8(b).replace(/\0+$/, '')
	}
}

/** Finds a null terminator (respecting 2-byte units for utf16) starting at offset. */
export function nullTerminator(b: Uint8Array, offset: number, twoBytes: boolean): number {
	if (!twoBytes) {
		for (let i = offset; i < b.length; i++) if (b[i] === 0) return i
		return b.length
	}
	for (let i = offset; i + 1 < b.length; i += 2) {
		if (b[i] === 0 && b[i + 1] === 0) return i
	}
	return b.length
}

/** Removes 0x00 stuffing bytes that follow 0xFF (ID3 unsynchronisation scheme). */
export function deUnsynchronise(b: Uint8Array): Uint8Array {
	const out: number[] = []
	for (let i = 0; i < b.length; i++) {
		out.push(b[i])
		if (b[i] === 0xff && b[i + 1] === 0x00) i++
	}
	return Uint8Array.from(out)
}
