import { base64ToBytes, bytesToBase64 } from '../utils/base64'

describe('base64', () => {
	it('round-trips arbitrary bytes', () => {
		for (const length of [0, 1, 2, 3, 7, 64, 255]) {
			const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + 11) % 256)
			expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes])
		}
	})

	it('matches the standard alphabet on known vectors', () => {
		expect(bytesToBase64(new Uint8Array([104, 101, 108, 108, 111]))).toBe('aGVsbG8=')
		expect(bytesToBase64(new Uint8Array([0x66]))).toBe('Zg==')
		expect(bytesToBase64(new Uint8Array([]))).toBe('')
		expect([...base64ToBytes('aGVsbG8=')]).toEqual([104, 101, 108, 108, 111])
		expect([...base64ToBytes('Zg==')]).toEqual([0x66])
	})
})
