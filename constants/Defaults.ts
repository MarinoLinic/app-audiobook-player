import { Settings } from '../types'

export const APP_NAME = 'Lector'

export const DEFAULT_SETTINGS: Settings = {
	theme: 'system',
	bookSortMode: 'recent',
	defaultSortMode: 'natural',
	playbackRate: 1,
	skipIntervalSec: 30,
	volumeBoostPercent: 100,
	// A track counts as finished at 97% or within the last 10 s.
	finishedThreshold: 0.97,
}

export const SKIP_OPTIONS = [10, 15, 30, 45, 60]

export const SLEEP_TIMER_OPTIONS = [
	{ label: 'Off', minutes: 0 },
	{ label: '5 min', minutes: 5 },
	{ label: '10 min', minutes: 10 },
	{ label: '15 min', minutes: 15 },
	{ label: '20 min', minutes: 20 },
	{ label: '30 min', minutes: 30 },
	{ label: '45 min', minutes: 45 },
	{ label: '1 hour', minutes: 60 },
	{ label: 'End of track', minutes: -1 },
]

export const BOOK_SORT_LABELS: Record<string, string> = {
	recent: 'Recently played',
	title: 'Title (A–Z)',
	added: 'Recently added',
	progress: 'In progress',
}

export const TRACK_SORT_LABELS: Record<string, string> = {
	natural: 'File name (numbered)',
	track: 'Track number (metadata)',
	title: 'Title',
}
