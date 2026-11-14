import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { setVolumeBoostMB } from '../modules/volume-boost/src'
import { playbackService } from '../services/PlaybackService'
import { Book, Track } from '../types'
import { resumeTarget, sortTracks } from '../utils/bookSort'
import { clampRate, clampVolumePercent, percentToGainMB } from '../utils/volume'
import { useLibrary } from './LibraryContext'

const PROGRESS_SAVE_MS = 5000

export type SleepTimerMode = { kind: 'off' } | { kind: 'minutes'; endsAt: number } | { kind: 'endOfTrack' }

interface PlayerContextType {
	book: Book | null
	track: Track | null
	trackIndex: number
	trackCount: number
	positionMs: number
	durationMs: number
	isPlaying: boolean
	isLoaded: boolean
	rate: number
	volumePercent: number
	sleepTimer: SleepTimerMode
	sleepRemainingMs: number | null
	playBook: (book: Book, trackId?: string, positionMs?: number) => Promise<void>
	resumeBook: (book: Book) => Promise<void>
	closePlayer: () => Promise<void>
	togglePlayPause: () => void
	seekTo: (positionMs: number) => Promise<void>
	skipBy: (deltaSec: number) => Promise<void>
	nextTrack: () => Promise<void>
	previousTrack: () => Promise<void>
	playTrackAtIndex: (index: number) => Promise<void>
	setRate: (rate: number) => void
	setVolumePercent: (percent: number, persist?: boolean) => void
	setSleepTimerMinutes: (minutes: number) => void
	/** Set when the player failed to load/play a file; cleared on next successful load */
	playbackError: string | null
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined)

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const { settings, updateSettings, updateTrackProgress, markTrackCompleted, bookById } = useLibrary()

	const [bookId, setBookId] = useState<string | null>(null)
	const [tracks, setTracks] = useState<Track[]>([])
	const [trackIndex, setTrackIndex] = useState(0)
	const [positionMs, setPositionMs] = useState(0)
	const [durationMs, setDurationMs] = useState(0)
	const [isPlaying, setIsPlaying] = useState(false)
	const [isLoaded, setIsLoaded] = useState(false)
	const [rate, setRateState] = useState(1)
	const [volumePercent, setVolumePercentState] = useState(100)
	const [sleepTimer, setSleepTimer] = useState<SleepTimerMode>({ kind: 'off' })
	const [sleepRemainingMs, setSleepRemainingMs] = useState<number | null>(null)
	const [playbackError, setPlaybackError] = useState<string | null>(null)

	// Monotonic position that survives status tick latency
	const positionRef = useRef(0)
	const durationRef = useRef(0)
	const playingRef = useRef(false)
	const bookIdRef = useRef<string | null>(null)
	const trackIndexRef = useRef(0)
	const tracksRef = useRef<Track[]>([])
	const lastSavedRef = useRef(0)
	const sleepRef = useRef<SleepTimerMode>({ kind: 'off' })
	const finishedTrackRef = useRef<string | null>(null)
	const pendingSeekMs = useRef<number | null>(null)
	const pendingSeekIssued = useRef(false)
	const loadGeneration = useRef(0)
	const rateRef = useRef(rate)
	const volumePercentRef = useRef(volumePercent)

	useEffect(() => {
		rateRef.current = rate
	}, [rate])
	useEffect(() => {
		volumePercentRef.current = volumePercent
	}, [volumePercent])

	useEffect(() => {
		positionRef.current = positionMs
	}, [positionMs])
	useEffect(() => {
		durationRef.current = durationMs
	}, [durationMs])
	useEffect(() => {
		sleepRef.current = sleepTimer
	}, [sleepTimer])

	const book = bookId ? (bookById(bookId) ?? null) : null
	const track = tracks[trackIndex] ?? null

	// ------------------------------------------------------------------
	// Progress persistence
	// ------------------------------------------------------------------

	const saveProgress = useCallback(
		(force = false) => {
			const id = bookIdRef.current
			const current = tracksRef.current[trackIndexRef.current]
			if (!id || !current) return
			const now = Date.now()
			if (!force && now - lastSavedRef.current < PROGRESS_SAVE_MS) return
			lastSavedRef.current = now
			updateTrackProgress(id, current.id, positionRef.current, durationRef.current || current.durationMs)
		},
		[updateTrackProgress],
	)

	// Periodic auto-save while playing, plus save on backgrounding
	useEffect(() => {
		const interval = setInterval(() => {
			if (playingRef.current) saveProgress()
		}, PROGRESS_SAVE_MS)
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'background' || state === 'inactive') saveProgress(true)
		})
		return () => {
			clearInterval(interval)
			sub.remove()
		}
	}, [saveProgress])

	// ------------------------------------------------------------------
	// Status events from the audio engine
	// ------------------------------------------------------------------

	const onStatus = useCallback(
		(status: { currentTime: number; duration: number; playing: boolean; isLoaded: boolean; didJustFinish: boolean }) => {
			const pos = status.currentTime * 1000

			// A seek was requested but not yet applied (e.g. resume position set
			// before the player finished loading). Issue it once loaded; keep the
			// stale position hidden until playback reports the target position.
			// Playing/loaded state must always flow through, even mid-seek.
			if (pendingSeekMs.current !== null) {
				if (Math.abs(pos - pendingSeekMs.current) <= 1500) {
					pendingSeekMs.current = null
					pendingSeekIssued.current = false
				} else if (status.isLoaded && !pendingSeekIssued.current) {
					pendingSeekIssued.current = true
					void playbackService.seekTo(pendingSeekMs.current)
				}
			}

			if (pendingSeekMs.current === null) {
				setPositionMs(pos)
				positionRef.current = pos
			}
			const dur = status.duration * 1000
			if (dur > 0) {
				setDurationMs(dur)
				durationRef.current = dur
			}
			setIsPlaying(status.playing)
			playingRef.current = status.playing
			setIsLoaded(status.isLoaded)

			if (status.didJustFinish) {
				handleTrackFinished()
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	)

	const handleTrackFinished = useCallback(() => {
		const id = bookIdRef.current
		const current = tracksRef.current[trackIndexRef.current]
		if (!id || !current) return
		if (finishedTrackRef.current === current.id) return // guard against duplicate events
		finishedTrackRef.current = current.id

		// Leaving a couple of seconds as 'unplayed' so reopening resumes sensibly
		const endMs = Math.max(0, durationRef.current - 5000)
		updateTrackProgress(id, current.id, Math.min(positionRef.current || endMs, durationRef.current || endMs), durationRef.current)
		markTrackCompleted(id, current.id)

		if (sleepRef.current.kind === 'endOfTrack') {
			setSleepTimer({ kind: 'off' })
			setSleepRemainingMs(null)
			return // stay paused at the end, don't advance
		}

		const nextIndex = trackIndexRef.current + 1
		if (nextIndex < tracksRef.current.length) {
			loadTrack(nextIndex, 0, true)
		} else {
			setIsPlaying(false)
			playingRef.current = false
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [markTrackCompleted, updateTrackProgress])

	// ------------------------------------------------------------------
	// Loading tracks
	// ------------------------------------------------------------------

	const loadTrack = useCallback(
		async (index: number, startAtMs: number, autoplay: boolean) => {
			const target = tracksRef.current[index]
			const id = bookIdRef.current
			if (!target || !id) return
			const generation = ++loadGeneration.current

			try {
				await playbackService.load(target.uri, onStatus)
				if (generation !== loadGeneration.current) return
				playbackService.setRate(rateRef.current)
				playbackService.setVolumeFromPercent(volumePercentRef.current)
				setPlaybackError(null)
			} catch (error) {
				if (generation !== loadGeneration.current) return
				setPlaybackError(`Couldn't play "${target.title}".`)
				console.error(`Failed to load ${target.uri}:`, error)
				return
			}

			setTrackIndex(index)
			trackIndexRef.current = index
			setPositionMs(startAtMs)
			positionRef.current = startAtMs
			setDurationMs(target.durationMs ?? 0)
			durationRef.current = target.durationMs ?? 0
			finishedTrackRef.current = null

			// The seek is issued from onStatus once the player reports loaded —
			// seeking before load is silently dropped on some platforms.
			if (startAtMs > 500) {
				pendingSeekMs.current = startAtMs
				pendingSeekIssued.current = false
			} else {
				pendingSeekMs.current = null
			}
			if (autoplay) playbackService.play()

			// Touch progress so the book pops to 'recent' and remembers its track
			updateTrackProgress(id, target.id, startAtMs, target.durationMs)
		},
		[onStatus, updateTrackProgress],
	)

	// ------------------------------------------------------------------
	// Public API
	// ------------------------------------------------------------------

	const playBook = useCallback(
		async (targetBook: Book, trackId?: string, atPositionMs?: number) => {
			await playbackService.configure()
			// Persist progress of whatever was playing before switching books
			saveProgress(true)
			const ordered = sortTracks(targetBook.tracks, targetBook.sortMode)
			if (ordered.length === 0) return

			let index = 0
			let position = 0
			if (trackId) {
				const found = ordered.findIndex((t) => t.id === trackId)
				if (found >= 0) {
					index = found
					// Completed tracks start over when picked explicitly
					const saved = targetBook.progress[trackId]
					position = atPositionMs ?? (saved?.completed ? 0 : saved?.positionMs ?? 0)
				}
			} else {
				const resume = resumeTarget(targetBook)
				if (resume) {
					index = ordered.findIndex((t) => t.id === resume.track.id)
					position = atPositionMs !== undefined ? atPositionMs : resume.positionMs
				}
			}

			bookIdRef.current = targetBook.id
			setBookId(targetBook.id)
			tracksRef.current = ordered
			setTracks(ordered)
			setSleepTimer({ kind: 'off' })
			setSleepRemainingMs(null)

			await loadTrack(index, Math.max(0, position), true)
		},
		[loadTrack],
	)

	const resumeBook = useCallback((targetBook: Book) => playBook(targetBook), [playBook])

	const closePlayer = useCallback(async () => {
		loadGeneration.current++
		saveProgress(true)
		playbackService.release()
		bookIdRef.current = null
		setBookId(null)
		setTracks([])
		tracksRef.current = []
		setTrackIndex(0)
		setPositionMs(0)
		setDurationMs(0)
		setIsPlaying(false)
		playingRef.current = false
		setIsLoaded(false)
		setSleepTimer({ kind: 'off' })
		setSleepRemainingMs(null)
	}, [saveProgress])

	const togglePlayPause = useCallback(() => {
		if (playingRef.current) {
			playbackService.pause()
			saveProgress(true)
		} else {
			playbackService.play()
		}
	}, [saveProgress])

	const seekTo = useCallback(
		async (positionMs: number) => {
			const clamped = Math.max(0, Math.min(positionMs, durationRef.current || Number.MAX_SAFE_INTEGER))
			pendingSeekMs.current = clamped
			positionRef.current = clamped
			setPositionMs(clamped)
			// Seek is issued here on the (loaded) player; onStatus confirms and clears
			pendingSeekIssued.current = true
			await playbackService.seekTo(clamped)
			saveProgress(true)
		},
		[saveProgress],
	)

	const skipBy = useCallback(
		async (deltaSec: number) => {
			await seekTo(positionRef.current + deltaSec * 1000)
		},
		[seekTo],
	)

	const nextTrack = useCallback(async () => {
		const next = trackIndexRef.current + 1
		if (next < tracksRef.current.length) {
			saveProgress(true)
			await loadTrack(next, 0, playingRef.current)
		}
	}, [loadTrack, saveProgress])

	const previousTrack = useCallback(async () => {
		// Audible behaviour: > 5 s in → restart current track, else go to previous
		if (positionRef.current > 5000) {
			await seekTo(0)
			return
		}
		const prev = trackIndexRef.current - 1
		if (prev >= 0) {
			saveProgress(true)
			await loadTrack(prev, 0, playingRef.current)
		}
	}, [loadTrack, saveProgress, seekTo])

	const playTrackAtIndex = useCallback(
		async (index: number) => {
			saveProgress(true)
			const t = tracksRef.current[index]
			const id = bookIdRef.current
			const saved = id && t ? bookById(id)?.progress[t.id] : undefined
			const resumeMs = saved && !saved.completed ? saved.positionMs : 0
			await loadTrack(index, resumeMs, true)
		},
		[bookById, loadTrack, saveProgress],
	)

	const setRate = useCallback(
		(next: number) => {
			const clamped = clampRate(next)
			playbackService.setRate(clamped)
			setRateState(clamped)
			updateSettings({ playbackRate: clamped })
		},
		[updateSettings],
	)

	const setVolumePercent = useCallback(
		(percent: number, persist = false) => {
			const clamped = clampVolumePercent(percent)
			playbackService.setVolumeFromPercent(clamped)
			// Above 100% the LoudnessEnhancer takes over (dev/prod builds only)
			setVolumeBoostMB(percentToGainMB(clamped))
			setVolumePercentState(clamped)
			// Only persist on slider release — not every drag tick
			if (persist) updateSettings({ volumeBoostPercent: clamped })
		},
		[updateSettings],
	)

	const setSleepTimerMinutes = useCallback((minutes: number) => {
		if (minutes <= 0) {
			setSleepTimer(minutes === -1 ? { kind: 'endOfTrack' } : { kind: 'off' })
			setSleepRemainingMs(null)
			return
		}
		setSleepTimer({ kind: 'minutes', endsAt: Date.now() + minutes * 60_000 })
		setSleepRemainingMs(minutes * 60_000)
	}, [])

	// Sleep timer ticks once per second
	useEffect(() => {
		if (sleepTimer.kind !== 'minutes') return
		const interval = setInterval(() => {
			const remaining = sleepTimer.endsAt - Date.now()
			if (remaining <= 0) {
				clearInterval(interval)
				setSleepTimer({ kind: 'off' })
				setSleepRemainingMs(null)
				playbackService.pause()
				saveProgress(true)
			} else {
				setSleepRemainingMs(remaining)
			}
		}, 1000)
		return () => clearInterval(interval)
	}, [sleepTimer, saveProgress])

	// Rehydrate rate/volume from settings on start
	useEffect(() => {
		setRateState(clampRate(settings.playbackRate))
		setVolumePercentState(clampVolumePercent(settings.volumeBoostPercent))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Release the engine on unmount
	useEffect(() => {
		return () => playbackService.release()
	}, [])

	const value: PlayerContextType = useMemo(
		() => ({
			book,
			track,
			trackIndex,
			trackCount: tracks.length,
			positionMs,
			durationMs,
			isPlaying,
			isLoaded,
			rate,
			volumePercent,
			sleepTimer,
			sleepRemainingMs,
			playBook,
			resumeBook,
			closePlayer,
			togglePlayPause,
			seekTo,
			skipBy,
			nextTrack,
			previousTrack,
			playTrackAtIndex,
			setRate,
			setVolumePercent,
			setSleepTimerMinutes,
			playbackError,
		}),
		[
			book,
			track,
			trackIndex,
			tracks.length,
			positionMs,
			durationMs,
			isPlaying,
			isLoaded,
			rate,
			volumePercent,
			sleepTimer,
			sleepRemainingMs,
			playBook,
			resumeBook,
			closePlayer,
			togglePlayPause,
			seekTo,
			skipBy,
			nextTrack,
			previousTrack,
			playTrackAtIndex,
			setRate,
			setVolumePercent,
			setSleepTimerMinutes,
			playbackError,
		],
	)

	return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export const usePlayer = () => {
	const context = useContext(PlayerContext)
	if (!context) throw new Error('usePlayer must be used within a PlayerProvider')
	return context
}
