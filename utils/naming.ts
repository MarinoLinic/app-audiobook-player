/**
 * Guesses a book name from loose imported file names: the longest common
 * meaningful prefix with numbering noise stripped.
 */
export function guessNameFromFiles(names: string[]): string {
	const bases = names.map((n) =>
		n
			.replace(/\.[^.]+$/, '')
			.replace(/[\s\-_]*\d+\s*$/, '')
			.trim(),
	)
	if (bases.length === 1) return bases[0] || 'Imported audio'
	const common = longestCommonPrefix(bases)
	const cleaned = common.replace(/[\s\-_,.:()[\]+#]+$/, '').trim()
	return cleaned || 'Imported audio'
}

function longestCommonPrefix(strings: string[]): string {
	if (strings.length === 0) return ''
	let prefix = strings[0]
	for (const s of strings.slice(1)) {
		while (!s.startsWith(prefix) && prefix.length > 0) {
			prefix = prefix.slice(0, -1)
		}
		if (!prefix) return ''
	}
	return prefix
}

/** Runs async tasks over items with bounded concurrency, preserving order. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length)
	let cursor = 0
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (cursor < items.length) {
			const index = cursor++
			results[index] = await task(items[index])
		}
	})
	await Promise.all(workers)
	return results
}
