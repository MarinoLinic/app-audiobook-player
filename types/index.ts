export type BookSource = 'folder' | 'imported'

export interface Track {
	/** Stable id (hash of the source uri) */
	id: string
	/** content:// or file:// uri */
	uri: string
	/** Original file name with extension */
	fileName: string
	/** Display title (metadata title or cleaned file name) */
	title: string
	/** Extension, lower-cased, without dot: 'mp3', 'm4b', ... */
	format: string
	/** Track number from metadata (TRCK / trkn / TRACKNUMBER) */
	metadataTrackNumber?: number
	/** Track number parsed from the file name */
	fileTrackNumber?: number
	/** Duration in ms — only known once parsed or played */
	durationMs?: number
	/** Size in bytes when known */
	sizeBytes?: number
	/** Author from metadata */
	artist?: string
	/** Album from metadata */
	album?: string
}

export interface TrackProgress {
	positionMs: number
	durationMs?: number
	/** true once the track was played to (near) the end */
	completed: boolean
	updatedAt: number
}

export interface Book {
	id: string
	name: string
	source: BookSource
	/** Folder uri (SAF tree uri) for folder books */
	folderUri?: string
	tracks: Track[]
	/** Cached cover art file uri, or null when the book has none */
	coverUri: string | null
	/** Book-level author/album, taken from first track that has them */
	author?: string
	createdAt: number
	lastPlayedAt?: number
	/** Track the user most recently listened to */
	currentTrackId?: string
	/** Per-track play position */
	progress: Record<string, TrackProgress>
	/** How tracks are ordered in the UI */
	sortMode: TrackSortMode
}

export type TrackSortMode = 'natural' | 'track' | 'title'
export type BookSortMode = 'recent' | 'title' | 'added' | 'progress'

export type ThemePreference = 'system' | 'light' | 'dark'

export interface Settings {
	theme: ThemePreference
	bookSortMode: BookSortMode
	defaultSortMode: TrackSortMode
	/** Last-used playback rate */
	playbackRate: number
	/** Skip interval in seconds (button rewind/ffwd) */
	skipIntervalSec: number
	/** Loudness boost 100–200 (%) applied on top of player volume */
	volumeBoostPercent: number
	/** Resume threshold: treat track as finished when this % is reached */
	finishedThreshold: number
}

export interface ParsedMetadata {
	title?: string
	artist?: string
	album?: string
	trackNumber?: number
	totalTracks?: number
	/** Detected audio/stream duration where the format exposes it */
	durationMs?: number
	picture?: {
		mime: string
		data: Uint8Array
	}
}
