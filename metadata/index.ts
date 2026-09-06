import { parseFlac } from './flac'
import { parseId3v1, parseId3v2 } from './id3'
import { parseMp4 } from './mp4'
import { ParsedMetadata } from '../types'

export const SUPPORTED_AUDIO_EXTENSIONS = ['mp3', 'm4a', 'm4b', 'aac', 'flac', 'ogg', 'opus', 'wav', 'aiff', 'aif', 'wma'] as const

export function isAudioFile(fileName: string): boolean {
	const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
	return (SUPPORTED_AUDIO_EXTENSIONS as readonly string[]).includes(ext)
}

/**
 * Parses embedded metadata from file bytes, dispatching on the real content
 * (magic bytes) with the file extension as a hint. Returns an empty object
 * for formats we don't parse — callers then fall back to file names.
 */
export function parseMetadata(bytes: Uint8Array, extensionHint = ''): ParsedMetadata {
	if (bytes.length === 0) return {}

	// ID3v2 at the start of the file
	if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
		const id3 = parseId3v2(bytes)
		if (id3) return id3
	}
	if (extensionHint === 'flac' || ascii4(bytes, 0) === 'fLaC') {
		const flac = parseFlac(bytes)
		if (flac) return flac
	}
	if (['m4a', 'm4b', 'aac', 'mp4'].includes(extensionHint) || ascii4(bytes, 4) === 'ftyp') {
		return parseMp4(bytes) ?? {}
	}
	if (extensionHint === 'mp3') {
		// Plain MP3 without ID3v2 — try the trailing ID3v1 tag
		return parseId3v1(bytes) ?? {}
	}
	return {}
}

function ascii4(b: Uint8Array, o: number): string {
	if (b.length < o + 4) return ''
	return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3])
}
