const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const LOOKUP = new Uint8Array(256)
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i

/** Decodes a base64 string to bytes without relying on atob (not guaranteed in Hermes). */
export function base64ToBytes(base64: string): Uint8Array {
	const clean = base64.replace(/[\r\n\s]/g, '')
	const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
	const length = ((clean.length * 3) >> 2) - padding
	const out = new Uint8Array(length)

	let byteIndex = 0
	for (let i = 0; i < clean.length; i += 4) {
		const a = LOOKUP[clean.charCodeAt(i)]
		const b = LOOKUP[clean.charCodeAt(i + 1)]
		const c = i + 2 < clean.length ? LOOKUP[clean.charCodeAt(i + 2)] : 0
		const d = i + 3 < clean.length ? LOOKUP[clean.charCodeAt(i + 3)] : 0
		const word = (a << 18) | (b << 12) | (c << 6) | d
		if (byteIndex < length) out[byteIndex++] = (word >> 16) & 0xff
		if (byteIndex < length) out[byteIndex++] = (word >> 8) & 0xff
		if (byteIndex < length) out[byteIndex++] = word & 0xff
	}
	return out
}

/** Encodes bytes to base64 without relying on btoa. */
export function bytesToBase64(bytes: Uint8Array): string {
	let out = ''
	for (let i = 0; i < bytes.length; i += 3) {
		const a = bytes[i]
		const b = i + 1 < bytes.length ? bytes[i + 1] : 0
		const c = i + 2 < bytes.length ? bytes[i + 2] : 0
		const word = (a << 16) | (b << 8) | c
		out += ALPHABET[(word >> 18) & 63] + ALPHABET[(word >> 12) & 63]
		out += i + 1 < bytes.length ? ALPHABET[(word >> 6) & 63] : '='
		out += i + 2 < bytes.length ? ALPHABET[word & 63] : '='
	}
	return out
}
