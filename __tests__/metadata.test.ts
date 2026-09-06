import { parseMetadata, isAudioFile } from '../metadata'
import { parseId3v1, parseId3v2 } from '../metadata/id3'
import { parseMp4 } from '../metadata/mp4'
import { parseFlac } from '../metadata/flac'

// ---------------------------------------------------------------------------
// Test helpers: build synthetic binary tags
// ---------------------------------------------------------------------------

function latin1(s: string): number[] {
	return [...s].map((c) => c.charCodeAt(0))
}

function utf16be(s: string): number[] {
	const out: number[] = []
	for (let i = 0; i < s.length; i++) {
		out.push((s.charCodeAt(i) >> 8) & 0xff, s.charCodeAt(i) & 0xff)
	}
	return out
}

function synchsafe(n: number): number[] {
	return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]
}

function u32be(n: number): number[] {
	return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function u16be(n: number): number[] {
	return [(n >> 8) & 0xff, n & 0xff]
}

function u32le(n: number): number[] {
	return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]
}

function u24be(n: number): number[] {
	return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** Build an ID3v2.3 text frame. */
function v23TextFrame(id: string, text: string, encoding: 0 | 1 | 3 = 0): number[] {
	let payload: number[]
	if (encoding === 0) payload = [0, ...latin1(text)]
	else if (encoding === 3) payload = [3, ...latin1(text)] // ascii-safe utf8
	else payload = [1, 0xfe, 0xff, ...utf16be(text)] // BOM + BE
	return [...latin1(id), ...u32be(payload.length), 0, 0, ...payload]
}

function id3v23Tag(frames: number[][]): Uint8Array {
	const body = frames.flat()
	return Uint8Array.from([...latin1('ID3'), 3, 0, 0, ...synchsafe(body.length), ...body, 0xff, 0xfb, 0x90, 0x00])
}

/** Build an MP4 atom. */
function atom(type: string, children: Uint8Array[]): Uint8Array {
	const content = children.reduce<number[]>((acc, c) => acc.concat([...c]), [])
	return Uint8Array.from([...u32be(8 + content.length), ...latin1(type), ...content])
}

function dataAtom(payload: number[], typeIndicator: number = 1): Uint8Array {
	return atom('data', [Uint8Array.from([...u32be(typeIndicator), 0, 0, 0, 0, ...payload])])
}

/** FLAC metadata block. */
function flacBlock(type: number, body: number[], isLast: boolean): number[] {
	return [(isLast ? 0x80 : 0) | type, ...u24be(body.length), ...body]
}

// ---------------------------------------------------------------------------
// ID3v2
// ---------------------------------------------------------------------------

describe('ID3v2 parser', () => {
	it('parses latin1 text frames and track numbers', () => {
		const tag = id3v23Tag([
			v23TextFrame('TIT2', 'The Tombs of Atuan'),
			v23TextFrame('TPE1', 'Ursula K. Le Guin'),
			v23TextFrame('TALB', 'Earthsea Cycle'),
			v23TextFrame('TRCK', '3/12'),
		])
		const meta = parseId3v2(tag)!
		expect(meta.title).toBe('The Tombs of Atuan')
		expect(meta.artist).toBe('Ursula K. Le Guin')
		expect(meta.album).toBe('Earthsea Cycle')
		expect(meta.trackNumber).toBe(3)
		expect(meta.totalTracks).toBe(12)
	})

	it('parses utf16 frames with BOM', () => {
		const tag = id3v23Tag([v23TextFrame('TIT2', 'Ümlauts Åre Fīne', 1)])
		expect(parseId3v2(tag)!.title).toBe('Ümlauts Åre Fīne')
	})

	it('parses track numbers without totals', () => {
		const tag = id3v23Tag([v23TextFrame('TRCK', '7')])
		const meta = parseId3v2(tag)!
		expect(meta.trackNumber).toBe(7)
		expect(meta.totalTracks).toBeUndefined()
	})

	it('extracts APIC cover art', () => {
		const jpeg = [0xff, 0xd8, 0xff, 0x01, 0x02, 0x03]
		const apic = [0, ...latin1('image/jpeg'), 0, 3, 0, ...jpeg] // enc, mime, nul, type, desc-nul, data
		const tag = id3v23Tag([[...latin1('APIC'), ...u32be(apic.length), 0, 0, ...apic]])
		const meta = parseId3v2(tag)!
		expect(meta.picture?.mime).toBe('image/jpeg')
		expect([...meta.picture!.data]).toEqual(jpeg)
	})

	it('returns undefined for non-ID3 data', () => {
		expect(parseId3v2(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeUndefined()
	})

	it('parses ID3v2.2 short frame headers', () => {
		const payload = [0, ...latin1('Old Title')]
		const frame = [...latin1('TT2'), ...u24be(payload.length), ...payload]
		const tag = Uint8Array.from([...latin1('ID3'), 2, 0, 0, ...synchsafe(frame.length), ...frame])
		expect(parseId3v2(tag)!.title).toBe('Old Title')
	})
})

describe('ID3v1 parser', () => {
	it('reads trailing TAG block incl. v1.1 track number', () => {
		const audio = new Array<number>(128).fill(0)
		const tag: number[] = [...latin1('TAG')]
		const pad = (s: string, n: number) => [...latin1(s), ...new Array(Math.max(0, n - s.length)).fill(0)]
		tag.push(...pad('Some Title', 30), ...pad('Some Artist', 30), ...pad('Some Album', 30))
		tag.push(...pad('2024', 4)) // year
		tag.push(...pad('comment', 28), 0, 9) // v1.1: zero then track 9
		tag.push(1) // genre
		const buf = Uint8Array.from([...audio, ...tag])
		const meta = parseId3v1(buf)!
		expect(meta).toMatchObject({ title: 'Some Title', artist: 'Some Artist', album: 'Some Album', trackNumber: 9 })
	})

	it('returns undefined when the TAG marker is missing', () => {
		expect(parseId3v1(new Uint8Array(200))).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// MP4
// ---------------------------------------------------------------------------

describe('MP4 parser', () => {
	function sampleMp4(moovFirst: boolean): Uint8Array {
		// trkn payload: 2 reserved, 2 track, 2 total, 2 trailing reserved
		const trknPayload = [0, 0, ...u16be(4), ...u16be(20), 0, 0]
		const ilst = atom('ilst', [
			atom('©nam', [dataAtom(latin1('The Voice from the Whirlwind'))]),
			atom('©ART', [dataAtom(latin1('The Author'))]),
			atom('©alb', [dataAtom(latin1('Great Book'))]),
			atom('trkn', [dataAtom(trknPayload)]),
			atom('covr', [dataAtom([0xff, 0xd8, 0xff, 0xaa], 13)]),
		])
		const meta = atom('meta', [Uint8Array.from([0, 0, 0, 0]), ilst])
		const moov = atom('moov', [atom('udta', [meta])])
		const ftyp = atom('ftyp', [Uint8Array.from(latin1('M4B '))])
		const mdat = atom('mdat', [new Uint8Array(32)])
		return Uint8Array.from([...ftyp, ...(moovFirst ? [...moov, ...mdat] : [...mdat, ...moov])])
	}

	it.each([true, false])('parses ilst metadata (moov first: %s)', (moovFirst) => {
		const meta = parseMp4(sampleMp4(moovFirst))!
		expect(meta.title).toBe('The Voice from the Whirlwind')
		expect(meta.artist).toBe('The Author')
		expect(meta.album).toBe('Great Book')
		expect(meta.trackNumber).toBe(4)
		expect(meta.totalTracks).toBe(20)
		expect(meta.picture?.mime).toBe('image/jpeg')
		expect(meta.picture?.data.length).toBe(4)
	})

	it('returns undefined without an ftyp atom', () => {
		expect(parseMp4(new Uint8Array(64))).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// FLAC
// ---------------------------------------------------------------------------

function buildSampleFlac(): Uint8Array {
	// STREAMINFO packed field: sampleRate(20) | channels-1(3) | bps-1(5) | totalSamples(36).
	// 44100 Hz, 2 channels, 16 bps, 88200 samples → exactly 2 s.
	const packed: number[] = [
		...u32be((44100 << 12) | ((2 - 1) << 9) | ((16 - 1) << 4)),
		...u32be(88200),
	]
	const streamInfo = flacBlock(0, [...new Array(10).fill(0), ...packed], false)
	const comments = (entries: string[]) => [
		...u32le(4), ...latin1('test'),
		...u32le(entries.length),
		...entries.flatMap((e) => [...u32le(e.length), ...latin1(e)]),
	]
	const vorbis = flacBlock(4, comments(['TITLE=Flac Title', 'ARTIST=Flac Artist', 'TRACKNUMBER=11', 'TOTALTRACKS=12']), true)
	return Uint8Array.from([...latin1('fLaC'), ...streamInfo, ...vorbis])
}

describe('FLAC parser', () => {
	it('parses stream info duration and vorbis comments', () => {
		const meta = parseFlac(buildSampleFlac())!
		expect(meta.durationMs).toBe(2000)
		expect(meta.title).toBe('Flac Title')
		expect(meta.artist).toBe('Flac Artist')
		expect(meta.trackNumber).toBe(11)
		expect(meta.totalTracks).toBe(12)
	})

	it('returns undefined without the fLaC magic', () => {
		expect(parseFlac(new Uint8Array(32))).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

describe('decodeUtf8 hardening', () => {
	it('survives truncated multi-byte sequences without throwing or reading OOB', () => {
		const { decodeUtf8 } = require('../metadata/bytes')
		expect(() => decodeUtf8(Uint8Array.from([0xc3]))).not.toThrow()
		expect(() => decodeUtf8(Uint8Array.from([0xe2, 0x82]))).not.toThrow()
		expect(() => decodeUtf8(Uint8Array.from([0xf0, 0x9f, 0x92]))).not.toThrow()
		expect(decodeUtf8(Uint8Array.from([0x48, 0xe2, 0x82, 0xac]))).toBe('H€') // valid 3-byte euro sign
	})
})

describe('parseMetadata dispatcher', () => {
	it('detects formats by magic bytes', () => {
		const id3 = id3v23Tag([v23TextFrame('TIT2', 'Hello')])
		expect(parseMetadata(id3, 'mp3').title).toBe('Hello')

		const flac = buildSampleFlac()
		expect(parseMetadata(flac, 'flac').title).toBe('Flac Title')

		const mp4 = atom('ftyp', [Uint8Array.from(latin1('M4B '))])
		expect(parseMetadata(mp4, 'm4b')).toEqual({})
	})

	it('returns empty objects for unparsed formats', () => {
		expect(parseMetadata(new Uint8Array([1, 2, 3, 4]), 'ogg')).toEqual({})
		expect(parseMetadata(new Uint8Array(0), 'mp3')).toEqual({})
	})
})

describe('isAudioFile', () => {
	it('accepts common audiobook formats', () => {
		expect(isAudioFile('chapter1.mp3')).toBe(true)
		expect(isAudioFile('book.M4B')).toBe(true)
		expect(isAudioFile('a.flac')).toBe(true)
		expect(isAudioFile('a.opus')).toBe(true)
		expect(isAudioFile('a.ogg')).toBe(true)
		expect(isAudioFile('a.wav')).toBe(true)
		expect(isAudioFile('a.wma')).toBe(true)
	})

	it('rejects non-audio files', () => {
		expect(isAudioFile('cover.jpg')).toBe(false)
		expect(isAudioFile('notes.txt')).toBe(false)
		expect(isAudioFile('.cue')).toBe(false)
	})
})
