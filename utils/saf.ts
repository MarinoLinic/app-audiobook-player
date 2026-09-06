/**
 * Helpers for Android SAF (Storage Access Framework) uris.
 * Tree uri:  content://.../tree/primary%3AAudiobooks%2FMy%20Book
 * Doc uri:   content://.../tree/<tree>/document/primary%3AAudiobooks%2FMy%20Book%2F01.mp3
 */

/** Decodes a SAF tree/document path segment ('primary:Audiobooks/My Book'). */
export function decodeSAFPath(uri: string): string {
	// Document uris embed the whole tree uri, so the LAST segment wins
	const matches = [...uri.matchAll(/\/(?:tree|document)\/([^/?]+)/g)]
	const last = matches[matches.length - 1]
	if (!last) return uri
	try {
		return decodeURIComponent(last[1])
	} catch {
		return last[1]
	}
}

/** Folder/display name from a tree or document uri. */
export function nameFromUri(uri: string): string {
	const path = decodeSAFPath(uri)
	const segments = path.split('/').filter((s) => s.length > 0)
	const last = segments[segments.length - 1]
	if (!last) return 'Book'
	// strip volume prefix like 'primary:'
	return last.includes(':') ? last.split(':').pop()! : last
}

/** File name (last path segment) from any uri. */
export function fileNameFromUri(uri: string): string {
	return nameFromUri(uri)
}
