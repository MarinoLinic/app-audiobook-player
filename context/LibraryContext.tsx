import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SETTINGS } from '../constants/Defaults'
import { libraryService } from '../services/LibraryService'
import { storage } from '../services/StorageService'
import { Book, BookSource, Settings, Track, TrackSortMode } from '../types'
import { sortTracks } from '../utils/bookSort'
import { hashId } from '../utils/id'
import { guessNameFromFiles, mapWithConcurrency } from '../utils/naming'

const BOOKS_KEY = 'books'
const SETTINGS_KEY = 'settings'

interface AddBookResult {
	book: Book
	merged: boolean
}

interface LibraryContextType {
	books: Book[]
	settings: Settings
	loading: boolean
	importing: boolean
	updateSettings: (patch: Partial<Settings>) => Promise<void>
	addFolderBook: () => Promise<AddBookResult | null>
	addFilesBook: () => Promise<AddBookResult | null>
	refreshBook: (bookId: string) => Promise<void>
	deleteBook: (bookId: string) => Promise<void>
	removeTrack: (bookId: string, trackId: string) => Promise<void>
	renameBook: (bookId: string, name: string) => Promise<void>
	setTrackSortMode: (bookId: string, mode: TrackSortMode) => Promise<void>
	updateTrackProgress: (bookId: string, trackId: string, positionMs: number, durationMs?: number) => Promise<void>
	markTrackCompleted: (bookId: string, trackId: string) => Promise<void>
	setTrackCompleted: (bookId: string, trackId: string, completed: boolean) => Promise<void>
	bookById: (id: string) => Book | undefined
	refreshLibrary: () => Promise<void>
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined)

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [books, setBooks] = useState<Book[]>([])
	const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
	const [loading, setLoading] = useState(true)
	const [importing, setImporting] = useState(false)

	// Latest books snapshot for callbacks that may run before state flushes
	const booksRef = useRef<Book[]>([])
	useEffect(() => {
		booksRef.current = books
	}, [books])

	// Serialize storage writes to avoid clobbering on concurrent updates
	const writeQueue = useRef(Promise.resolve())
	const enqueue = useCallback((task: () => Promise<void>) => {
		writeQueue.current = writeQueue.current.then(task).catch(() => {})
	}, [])

	const persistBooks = useCallback(
		(next: Book[]) => {
			enqueue(async () => {
				await storage.set(BOOKS_KEY, next)
			})
		},
		[enqueue],
	)

	const load = useCallback(async () => {
		const [storedBooks, storedSettings] = await Promise.all([storage.get<Book[]>(BOOKS_KEY), storage.get<Settings>(SETTINGS_KEY)])
		setBooks(Array.isArray(storedBooks) ? storedBooks.filter((b) => b && Array.isArray(b.tracks)) : [])
		if (storedSettings && typeof storedSettings === 'object') setSettings({ ...DEFAULT_SETTINGS, ...storedSettings })
	}, [])

	useEffect(() => {
		load().finally(() => setLoading(false))
	}, [load])

	const updateSettings = useCallback(
		async (patch: Partial<Settings>) => {
			setSettings((prev) => {
				const next = { ...prev, ...patch }
				enqueue(async () => {
					await storage.set(SETTINGS_KEY, next)
				})
				return next
			})
		},
		[enqueue],
	)

	const mutateBook = useCallback(
		(bookId: string, mutate: (book: Book) => Book) => {
			setBooks((prev) => {
				const next = prev.map((b) => (b.id === bookId ? mutate(b) : b))
				persistBooks(next)
				return next
			})
		},
		[persistBooks],
	)

	// ------------------------------------------------------------------
	// Adding books
	// ------------------------------------------------------------------

	interface BuildBookExtras {
		source: BookSource
		folderUri?: string
		createdAt: number
		sortMode: TrackSortMode
		progress: Book['progress']
		currentTrackId?: string
		lastPlayedAt?: number
		coverUri: string | null
	}

	const buildBook = useCallback(async (id: string, name: string, tracks: Track[], extra: BuildBookExtras): Promise<Book> => {
		const sorted = sortTracks(tracks, extra.sortMode)
		let author: string | undefined
		let coverUri = extra.coverUri
		await mapWithConcurrency(sorted, 6, async (track) => {
			const picture = await libraryService.enrichTrack(track)
			if (!author && track.artist) author = track.artist
			if (!coverUri && picture.pictureBytes) {
				coverUri = await libraryService.saveCover(id, picture.pictureBytes, picture.pictureMime ?? 'image/jpeg')
			}
		})
		return {
			id,
			name: name.trim() || 'Untitled book',
			author,
			...extra,
			coverUri,
			tracks: sorted,
		}
	}, [])

	const addFolderBook = useCallback(async (): Promise<AddBookResult | null> => {
		const pick = await libraryService.pickFolder()
		if (!pick) return null

		setImporting(true)
		try {
			const id = hashId(pick.uri)
			const existing = booksRef.current.find((b) => b.folderUri === pick.uri)
			const tracks = await libraryService.collectTracks(pick.uri)
			const book = await buildBook(id, pick.name, tracks, {
				source: 'folder',
				folderUri: pick.uri,
				createdAt: existing?.createdAt ?? Date.now(),
				sortMode: existing?.sortMode ?? settings.defaultSortMode,
				progress: existing?.progress ?? {},
				currentTrackId: existing?.currentTrackId,
				lastPlayedAt: existing?.lastPlayedAt,
				coverUri: existing?.coverUri ?? null,
			})

			setBooks((prev) => {
				const next = existing ? prev.map((b) => (b.id === id ? book : b)) : [...prev, book]
				persistBooks(next)
				return next
			})
			return { book, merged: Boolean(existing) }
		} finally {
			setImporting(false)
		}
	}, [buildBook, persistBooks, settings.defaultSortMode])

	const addFilesBook = useCallback(async (): Promise<AddBookResult | null> => {
		const picked = await libraryService.pickFiles()
		if (!picked) return null

		setImporting(true)
		try {
			const name = guessNameFromFiles(picked.names)
			// Loose files from the same "album" merge into one book on repeat imports
			const mergeable = booksRef.current.find(
				(b) => b.source === 'imported' && b.name.trim().toLowerCase() === name.trim().toLowerCase(),
			)
			const existingNames = new Set((mergeable?.tracks ?? []).map((t) => t.fileName))
			const tracks = [...(mergeable?.tracks ?? []), ...picked.tracks.filter((t) => !existingNames.has(t.fileName))]
			const book = await buildBook(mergeable?.id ?? hashId(`${name}-${Date.now()}`), mergeable?.name ?? name, tracks, {
				source: 'imported',
				createdAt: mergeable?.createdAt ?? Date.now(),
				sortMode: mergeable?.sortMode ?? settings.defaultSortMode,
				progress: mergeable?.progress ?? {},
				currentTrackId: mergeable?.currentTrackId,
				lastPlayedAt: mergeable?.lastPlayedAt,
				coverUri: mergeable?.coverUri ?? null,
			})

			setBooks((prev) => {
				const next = mergeable ? prev.map((b) => (b.id === book.id ? book : b)) : [...prev, book]
				persistBooks(next)
				return next
			})
			return { book, merged: Boolean(mergeable) }
		} finally {
			setImporting(false)
		}
	}, [buildBook, persistBooks, settings.defaultSortMode])

	// ------------------------------------------------------------------
	// Book maintenance
	// ------------------------------------------------------------------

	const reconcileTracks = (book: Book, freshTracks: Track[]): Book => {
		const byId = new Map(book.tracks.map((t) => [t.id, t]))
		const freshIds = new Set(freshTracks.map((t) => t.id))
		const next = freshTracks.map((t) => {
			const existing = byId.get(t.id)
			return existing
				? {
						...t,
						durationMs: existing.durationMs ?? t.durationMs,
						metadataTrackNumber: existing.metadataTrackNumber ?? t.metadataTrackNumber,
						title: existing.title !== existing.fileName ? existing.title : t.title,
					}
				: t
		})
		const progress = { ...book.progress }
		for (const id of Object.keys(progress)) {
			if (!freshIds.has(id)) delete progress[id]
		}
		return { ...book, tracks: sortTracks(next, book.sortMode), progress }
	}

	const refreshBook = useCallback(
		async (bookId: string) => {
			const book = booksRef.current.find((b) => b.id === bookId)
			if (!book || book.source !== 'folder' || !book.folderUri) return
			const tracks = await libraryService.collectTracks(book.folderUri)
			mutateBook(bookId, (b) => reconcileTracks(b, tracks))
		},
		[mutateBook],
	)

	const deleteBook = useCallback(
		async (bookId: string) => {
			const book = booksRef.current.find((b) => b.id === bookId)
			if (book?.source === 'imported') {
				await libraryService.deleteImportedFiles(book)
			}
			setBooks((prev) => {
				const next = prev.filter((b) => b.id !== bookId)
				persistBooks(next)
				return next
			})
		},
		[persistBooks],
	)

	const removeTrack = useCallback(
		async (bookId: string, trackId: string) => {
			mutateBook(bookId, (b) => {
				const progress = { ...b.progress }
				delete progress[trackId]
				return {
					...b,
					tracks: b.tracks.filter((t) => t.id !== trackId),
					progress,
					currentTrackId: b.currentTrackId === trackId ? undefined : b.currentTrackId,
				}
			})
		},
		[mutateBook],
	)

	const renameBook = useCallback(
		async (bookId: string, name: string) => {
			mutateBook(bookId, (b) => ({ ...b, name: name.trim() || b.name }))
		},
		[mutateBook],
	)

	const setTrackSortMode = useCallback(
		async (bookId: string, mode: TrackSortMode) => {
			mutateBook(bookId, (b) => ({ ...b, sortMode: mode, tracks: sortTracks(b.tracks, mode) }))
		},
		[mutateBook],
	)

	// ------------------------------------------------------------------
	// Progress tracking
	// ------------------------------------------------------------------

	const updateTrackProgress = useCallback(
		async (bookId: string, trackId: string, positionMs: number, durationMs?: number) => {
			mutateBook(bookId, (b) => {
				const prev = b.progress[trackId]
				const effectiveDuration = durationMs ?? prev?.durationMs
				const done = isFinished(positionMs, effectiveDuration, settings.finishedThreshold)
				return {
					...b,
					currentTrackId: trackId,
					lastPlayedAt: Date.now(),
					progress: {
						...b.progress,
						[trackId]: {
							positionMs,
							durationMs: effectiveDuration,
							completed: done,
							updatedAt: Date.now(),
						},
					},
				}
			})
		},
		[mutateBook, settings.finishedThreshold],
	)

	const markTrackCompleted = useCallback(
		async (bookId: string, trackId: string) => {
			mutateBook(bookId, (b) => {
				const prev = b.progress[trackId]
				return {
					...b,
					progress: {
						...b.progress,
						[trackId]: {
							positionMs: prev?.positionMs ?? 0,
							durationMs: prev?.durationMs,
							completed: true,
							updatedAt: Date.now(),
						},
					},
				}
			})
		},
		[mutateBook],
	)

	const setTrackCompleted = useCallback(
		async (bookId: string, trackId: string, completed: boolean) => {
			mutateBook(bookId, (b) => {
				const prev = b.progress[trackId] ?? { positionMs: 0, updatedAt: 0 }
				return {
					...b,
					progress: {
						...b.progress,
						[trackId]: {
							positionMs: completed ? (prev.positionMs ?? 0) : 0,
							durationMs: prev.durationMs,
							completed,
							updatedAt: Date.now(),
						},
					},
				}
			})
		},
		[mutateBook],
	)

	const bookById = useCallback((id: string) => booksRef.current.find((b) => b.id === id), [])

	const refreshLibrary = useCallback(async () => {
		setLoading(true)
		await load()
		setLoading(false)
	}, [load])

	const value: LibraryContextType = useMemo(
		() => ({
			books,
			settings,
			loading,
			importing,
			updateSettings,
			addFolderBook,
			addFilesBook,
			refreshBook,
			deleteBook,
			removeTrack,
			renameBook,
			setTrackSortMode,
			updateTrackProgress,
			markTrackCompleted,
			setTrackCompleted,
			bookById,
			refreshLibrary,
		}),
		[
			books,
			settings,
			loading,
			importing,
			updateSettings,
			addFolderBook,
			addFilesBook,
			refreshBook,
			deleteBook,
			removeTrack,
			renameBook,
			setTrackSortMode,
			updateTrackProgress,
			markTrackCompleted,
			setTrackCompleted,
			bookById,
			refreshLibrary,
		],
	)

	return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export const useLibrary = () => {
	const context = useContext(LibraryContext)
	if (!context) throw new Error('useLibrary must be used within a LibraryProvider')
	return context
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFinished(positionMs: number, durationMs: number | undefined, threshold: number): boolean {
	if (!durationMs || durationMs <= 0) return false
	if (positionMs >= durationMs * threshold) return true
	// 'Within the last 10 s' rule — only meaningful for tracks longer than that
	return durationMs > 10_000 && positionMs >= durationMs - 10_000
}
