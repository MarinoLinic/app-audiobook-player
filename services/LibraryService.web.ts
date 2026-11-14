import { isAudioFile, parseMetadata } from '../metadata'
import { Book, Track } from '../types'
import { bytesToBase64 } from '../utils/base64'
import { deriveTitle, extractTrackNumber, getExtension } from '../utils/naturalSort'
import { hashId } from '../utils/id'
import { readAudio, removeAudio, storeAudio } from './WebMediaStore'

export interface FolderPick { uri: string; name: string }

export class LibraryService {
	async pickFolder(): Promise<FolderPick | null> {
		throw new Error('Folder scanning is available in the Android app. Use Import audio files on this PC.')
	}

	async collectTracks(_folderUri: string, _depth = 0): Promise<Track[]> {
		throw new Error('Browser libraries use imported audio files rather than device folders.')
	}

	async pickFiles(): Promise<{ tracks: Track[]; names: string[] } | null> {
		const files = await new Promise<File[] | null>((resolve) => {
			const input = document.createElement('input')
			input.type = 'file'
			input.multiple = true
			input.accept = 'audio/*,.mp3,.m4a,.m4b,.flac,.ogg,.opus,.wav,.aac'
			input.style.display = 'none'
			const finish = (selected: File[] | null) => { input.remove(); resolve(selected) }
			input.onchange = () => finish(Array.from(input.files || []))
			input.oncancel = () => finish(null)
			document.body.append(input)
			input.click()
		})
		if (!files?.length) return null
		const tracks: Track[] = []
		try {
			for (const file of files) {
				if (!isAudioFile(file.name)) continue
				const uri = await storeAudio(file)
				tracks.push({ ...this.buildTrack(uri, file.name), sizeBytes: file.size })
			}
		} catch (error) {
			// Roll back only this failed import, preserving every existing book.
			await Promise.all(tracks.map((track) => removeAudio(track.uri).catch(() => {})))
			throw error
		}
		return tracks.length ? { tracks, names: tracks.map((track) => track.fileName) } : null
	}

	async deleteImportedFiles(book: Book): Promise<void> {
		await Promise.all(book.tracks.map((track) => removeAudio(track.uri)))
	}

	buildTrack(uri: string, fileName: string): Track {
		return { id: hashId(uri), uri, fileName, title: deriveTitle(fileName), format: getExtension(fileName), fileTrackNumber: extractTrackNumber(fileName) }
	}

	async enrichTrack(track: Track): Promise<{ pictureBytes?: Uint8Array; pictureMime?: string }> {
		const file = await readAudio(track.uri)
		if (file.size > 80 * 1024 * 1024) return {}
		try {
			const metadata = parseMetadata(new Uint8Array(await file.arrayBuffer()), track.format === 'aac' ? 'm4a' : track.format)
			if (metadata.title) track.title = metadata.title
			if (metadata.artist) track.artist = metadata.artist
			if (metadata.album) track.album = metadata.album
			if (metadata.trackNumber !== undefined) track.metadataTrackNumber = metadata.trackNumber
			if (metadata.durationMs !== undefined) track.durationMs = metadata.durationMs
			if (metadata.picture) return { pictureBytes: metadata.picture.data, pictureMime: metadata.picture.mime }
		} catch (error) { console.debug(`Metadata parse skipped for ${track.fileName}:`, error) }
		return {}
	}

	async saveCover(_bookId: string, bytes: Uint8Array, mime: string): Promise<string> {
		return `data:${mime};base64,${bytesToBase64(bytes)}`
	}
}

export const libraryService = new LibraryService()
