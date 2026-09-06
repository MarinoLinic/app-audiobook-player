/**
 * Generates the app/adaptive/splash icons by drawing the Lector mark
 * pixel-by-pixel and encoding PNGs with zlib only (no native module).
 *
 *   node scripts/generate-icon.js
 *
 * The mark matches components/Logo.tsx: an open book whose pages rise as
 * audio bars under a headphone band.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const OUT_DIR = path.join(__dirname, '..', 'assets', 'images')

// ---------------------------------------------------------------------------
// PNG encoder
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
	const table = new Int32Array(256)
	for (let n = 0; n < 256; n++) {
		let c = n
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
		table[n] = c
	}
	return table
})()

function crc32(buf) {
	let c = ~0
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
	return ~c >>> 0
}

function pngChunk(type, data) {
	const len = Buffer.alloc(4)
	len.writeUInt32BE(data.length)
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
	const crc = Buffer.alloc(4)
	crc.writeUInt32BE(crc32(body))
	return Buffer.concat([len, body, crc])
}

function encodePNG(width, height, rgba) {
	const raw = Buffer.alloc((width * 4 + 1) * height)
	for (let y = 0; y < height; y++) {
		const rowStart = y * (width * 4 + 1)
		raw[rowStart] = 0 // filter: none
		rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
	}
	const ihdr = Buffer.alloc(13)
	ihdr.writeUInt32BE(width, 0)
	ihdr.writeUInt32BE(height, 4)
	ihdr[8] = 8 // bit depth
	ihdr[9] = 6 // RGBA
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		pngChunk('IHDR', ihdr),
		pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
		pngChunk('IEND', Buffer.alloc(0)),
	])
}

// ---------------------------------------------------------------------------
// Shape functions — all in normalized 0..1 coordinates, return true when inside
// ---------------------------------------------------------------------------

function inRoundedRect(x, y, x0, y0, x1, y1, rx) {
	// Only round the corners: inset regions are always inside
	if (x >= x0 + rx && x <= x1 - rx && y >= y0 && y <= y1) return true
	if (x >= x0 && x <= x1 && y >= y0 + rx && y <= y1 - rx) return true
	const cx = Math.max(x0 + rx, Math.min(x, x1 - rx))
	const cy = Math.max(y0 + rx, Math.min(y, y1 - rx))
	if (x < x0 || x > x1 || y < y0 || y > y1) return false
	return Math.hypot(x - cx, y - cy) <= rx
}

function distToQuadBezier(x, y, p0, p1, p2) {
	let min = Infinity
	for (let i = 0; i <= 240; i++) {
		const t = i / 240
		const mt = 1 - t
		const px = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0]
		const py = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]
		min = Math.min(min, Math.hypot(x - px, y - py))
	}
	return min
}

/** True when pixel (x,y) in 0..1 is part of the mark glyph. */
function inGlyph(nx, ny) {
	// Headphone band (circle-arc approximation of the SVG bezier)
	const bandR = Math.hypot(nx - 0.5, ny - 0.44)
	if (Math.abs(bandR - 0.22) <= 0.030 && ny <= 0.46) return true
	// Ear cups
	if (inRoundedRect(nx, ny, 0.22, 0.42, 0.34, 0.60, 0.05)) return true
	if (inRoundedRect(nx, ny, 0.66, 0.42, 0.78, 0.60, 0.05)) return true
	// Audio bars
	if (inRoundedRect(nx, ny, 0.38, 0.46, 0.44, 0.62, 0.028)) return true
	if (inRoundedRect(nx, ny, 0.47, 0.38, 0.53, 0.62, 0.028)) return true
	if (inRoundedRect(nx, ny, 0.56, 0.46, 0.62, 0.62, 0.028)) return true
	// Open book base
	if (distToQuadBezier(nx, ny, [0.28, 0.74], [0.5, 0.66], [0.72, 0.74]) <= 0.028) return true
	return false
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

const GLYPH_COLOR = [28, 26, 23] // #1c1a17
const GRADIENT_TOP = [255, 182, 77] // #ffb64d
const GRADIENT_BOTTOM = [240, 128, 0] // #f08000

/**
 * variant: 'tile' (rounded-square orange tile + dark glyph),
 *          'adaptive' (dark glyph centered on transparent, 72% scale),
 *          'splash' (tile scaled 64% on transparent, for the splash screen)
 */
function renderIcon(size, variant) {
	const rgba = Buffer.alloc(size * size * 4)
	const scale = variant === 'adaptive' ? 0.66 : variant === 'splash' ? 0.6 : 1
	const offset = (1 - scale) / 2

	for (let py = 0; py < size; py++) {
		for (let px = 0; px < size; px++) {
			const nx = (px + 0.5) / size
			const ny = (py + 0.5) / size
			const idx = (py * size + px) * 4

			// Background
			if (variant !== 'adaptive') {
				const gx = (nx - offset) / scale
				const gy = (ny - offset) / scale
				const onTile = scale >= 1 ? inRoundedRect(nx, ny, 0, 0, 1, 1, 0.235) : inRoundedRect(gx, gy, 0, 0, 1, 1, 0.235)
				if (onTile) {
					rgba[idx] = GRADIENT_TOP[0] + (GRADIENT_BOTTOM[0] - GRADIENT_TOP[0]) * gy
					rgba[idx + 1] = GRADIENT_TOP[1] + (GRADIENT_BOTTOM[1] - GRADIENT_TOP[1]) * gy
					rgba[idx + 2] = GRADIENT_TOP[2] + (GRADIENT_BOTTOM[2] - GRADIENT_TOP[2]) * gy
					rgba[idx + 3] = 255
				}
			}

			// Glyph (2x2 supersampling for smooth edges)
			let coverage = 0
			for (let sy = 0; sy < 2; sy++) {
				for (let sx = 0; sx < 2; sx++) {
					const sxn = (px + 0.25 + 0.5 * sx) / size
					const syn = (py + 0.25 + 0.5 * sy) / size
					if (inGlyph((sxn - offset) / scale, (syn - offset) / scale)) coverage += 0.25
				}
			}
			if (coverage > 0) {
				for (let c = 0; c < 3; c++) {
					rgba[idx + c] = Math.round(GLYPH_COLOR[c] * coverage + rgba[idx + c] * (1 - coverage))
				}
				rgba[idx + 3] = Math.max(rgba[idx + 3], Math.round(255 * coverage))
			}
		}
	}
	return rgba
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true })

const targets = [
	{ name: 'icon.png', size: 1024, variant: 'tile' },
	{ name: 'adaptive-icon.png', size: 1024, variant: 'adaptive' },
	{ name: 'splash-icon.png', size: 512, variant: 'splash' },
	{ name: 'favicon.png', size: 96, variant: 'tile' },
]

for (const target of targets) {
	const png = encodePNG(target.size, target.size, renderIcon(target.size, target.variant))
	const file = path.join(OUT_DIR, target.name)
	fs.writeFileSync(file, png)
	console.log(`wrote ${target.name} (${target.size}×${target.size}, ${(png.length / 1024).toFixed(1)} KiB)`)
}
