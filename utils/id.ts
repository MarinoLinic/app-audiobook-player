/** djb2 string hash → short stable id. Used so track/book ids survive app restarts. */
export function hashId(input: string): string {
	let hash = 5381
	for (let i = 0; i < input.length; i++) {
		hash = (hash * 33) ^ input.charCodeAt(i)
	}
	return (hash >>> 0).toString(36)
}

let counter = 0

/** Random-ish unique id for books created at runtime (imported groups). */
export function uniqueId(prefix = ''): string {
	counter = (counter + 1) % 46656
	const random = Math.floor(Math.random() * 0xffffffff).toString(36)
	return `${prefix}${Date.now().toString(36)}${random}${counter.toString(36)}`
}
