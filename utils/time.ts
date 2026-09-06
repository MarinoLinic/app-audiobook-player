/** Formats milliseconds as h:mm:ss or m:ss. Returns '--:--' for unknown/invalid input. */
export function formatDuration(ms: number | undefined | null): string {
	if (ms === undefined || ms === null || !isFinite(ms) || ms < 0) return '--:--'
	const totalSeconds = Math.floor(ms / 1000)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
	const ss = String(seconds).padStart(2, '0')
	return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/** '1 hr 23 min' / '23 min' / '45 sec' — for totals and remaining-time labels. */
export function formatLongDuration(ms: number | undefined | null): string {
	if (ms === undefined || ms === null || !isFinite(ms) || ms < 0) return '--'
	const totalMinutes = Math.floor(ms / 60000)
	if (totalMinutes < 1) return 'under 1 min'
	const hours = Math.floor(totalMinutes / 60)
	const minutes = totalMinutes % 60
	if (hours === 0) return `${minutes} min`
	if (minutes === 0) return `${hours} hr`
	return `${hours} hr ${minutes} min`
}

/** 0..1 progress for a position/duration pair. */
export function fraction(positionMs: number | undefined, durationMs: number | undefined): number {
	if (!positionMs || !durationMs || durationMs <= 0) return 0
	return Math.min(1, Math.max(0, positionMs / durationMs))
}
