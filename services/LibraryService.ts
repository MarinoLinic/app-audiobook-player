import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { isAudioFile, parseMetadata } from '../metadata'
import { Book, Track } from '../types'
import { base64ToBytes, bytesToBase64 } from '../utils/base64'
import { deriveTitle, extractTrackNumber, getExtension } from '../utils/naturalSort'
import { hashId } from '../utils/id'
import { fileNameFromUri, nameFromUri } from '../utils/saf'

/** Don't attempt to parse tags from files above this size — reads the whole file. */
const METADATA_SIZE_CAP_BYTES = 80 * 1024 * 1024

const IMPORTS_DIR = `${FileSystem.documentDirectory}imports/`
const COVERS_DIR = `${FileSystem.cacheDirectory}covers/`

const SAF = FileSystem.StorageAccessFramework

export interface FolderPick {
	uri: string
	name: string
}

export class LibraryService {
	/** Opens the system folder picker (persistent SAF permission). Null when cancelled. */
	async pickFolder(): Promise<FolderPick | null> {
		const result = await SAF.requestDirectoryPermissionsAsync()
		if (!result.granted) return null
		return { uri: result.directoryUri, name: nameFromUri(result.directoryUri) }
	}

	/** Recursively collects audio files under an SAF folder uri. */
	async collectTracks(folderUri: string, depth = 0): Promise<Track[]> {
		if (depth > 8) return []
		const entries = await SAF.readDirectoryAsync(folderUri)
		const tracks: Track[] = []

		for (const entryUri of entries) {
			const name = fileNameFromUri(entryUri)
			if (name.startsWith('.')) continue
			if (!isAudioFile(name)) {
				// Could be a subfolder — SAF uris for folders have no audio extension,
				// so recurse; a file without a supported extension is simply skipped.
				try {
					const nested = await this.collectTracks(entryUri, depth + 1)
					tracks.push(...nested)
				} catch {
					// not a directory — ignore
				}
				continue
			}
			tracks.push(this.buildTrack(entryUri, name))
		}
		return tracks
	}

	/** Picks loose audio files and copies them into app storage. Null when cancelled. */
	async pickFiles(): Promise<{ tracks: Track[]; names: string[] } | null> {
		const result = await DocumentPicker.getDocumentAsync({
			type: 'audio/*',
			multiple: true,
			copyToCacheDirectory: true,
		})
		if (result.canceled || result.assets.length === 0) return null

		await FileSystem.makeDirectoryAsync(IMPORTS_DIR, { intermediates: true }).catch(() => {})

		const tracks: Track[] = []
		for (const [index, asset] of result.assets.entries()) {
			const safeName = asset.name.replace(/[^\w .\-()[\]]/g, '_')
			const target = `${IMPORTS_DIR}${hashId(asset.name + Date.now() + index)}-${safeName}`
			try {
				await FileSystem.copyAsync({ from: asset.uri, to: target })
				const track = this.buildTrack(target, asset.name)
				track.sizeBytes = asset.size
				tracks.push(track)
			} catch (error) {
				console.error(`Failed to import ${asset.name}:`, error)
			}
		}
		return tracks.length > 0 ? { tracks, names: tracks.map((t) => t.fileName) } : null
	}

	/** Deletes files previously copied into app storage. */
	async deleteImportedFiles(book: Book): Promise<void> {
		for (const track of book.tracks) {
			if (track.uri.startsWith(IMPORTS_DIR)) {
				await FileSystem.deleteAsync(track.uri, { idempotent: true }).catch(() => {})
			}
		}
	}

	buildTrack(uri: string, fileName: string): Track {
		return {
			id: hashId(uri),
			uri,
			fileName,
			title: deriveTitle(fileName),
			format: getExtension(fileName),
			fileTrackNumber: extractTrackNumber(fileName),
		}
	}

	/**
	 * Reads embedded metadata for a track (skipped for very large files).
	 * Merges results into the track and returns the cover bytes when found.
	 */
	async enrichTrack(track: Track): Promise<{ pictureBytes?: Uint8Array; pictureMime?: string }> {
		const size = track.sizeBytes ?? (await this.readSize(track.uri))
		// Unknown size → don't risk reading a huge file into memory at all
		if (size === undefined || size > METADATA_SIZE_CAP_BYTES) return {}

		try {
			const base64 = await FileSystem.readAsStringAsync(track.uri, { encoding: 'base64' })
			const bytes = base64ToBytes(base64)
			const meta = parseMetadata(bytes, track.format === 'aac' ? 'm4a' : track.format)

			if (meta.title) track.title = meta.title
			if (meta.artist) track.artist = meta.artist
			if (meta.album) track.album = meta.album
			if (meta.trackNumber !== undefined) track.metadataTrackNumber = meta.trackNumber
			if (meta.durationMs !== undefined) track.durationMs = meta.durationMs

			if (meta.picture) return { pictureBytes: meta.picture.data, pictureMime: meta.picture.mime }
		} catch (error) {
			console.debug(`Metadata parse skipped for ${track.fileName}:`, error)
		}
		return {}
	}

	private async readSize(uri: string): Promise<number | undefined> {
		try {
			const info = await FileSystem.getInfoAsync(uri, { size: true })
			return info.exists ? info.size : undefined
		} catch {
			return undefined
		}
	}

	/** Caches cover art bytes to disk; returns the file uri. */
	async saveCover(bookId: string, bytes: Uint8Array, mime: string): Promise<string> {
		await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true }).catch(() => {})
		const extension = mime.includes('png') ? 'png' : 'jpg'
		const uri = `${COVERS_DIR}${bookId}.${extension}`
		await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), { encoding: 'base64' })
		return uri
	}
}

export const libraryService = new LibraryService()
