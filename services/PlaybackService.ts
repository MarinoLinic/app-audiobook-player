import { AudioPlayer, AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import { percentToPlayerVolume } from '../utils/volume'

type StatusListener = (status: AudioStatus) => void

const UPDATE_INTERVAL_MS = 250

/**
 * Low-level audio engine wrapper. Owns the single AudioPlayer instance;
 * PlayerContext drives the book/track logic on top of this.
 */
export class PlaybackService {
	private player: AudioPlayer | null = null
	private subscription: { remove(): void } | null = null
	private configured = false

	/** One-time audio session setup: background playback + interruption handling. */
	async configure(): Promise<void> {
		if (this.configured) return
		this.configured = true
		try {
			await setAudioModeAsync({
				playsInSilentMode: true,
				shouldPlayInBackground: true,
				interruptionMode: 'doNotMix',
				interruptionModeAndroid: 'duckOthers',
				shouldRouteThroughEarpiece: false,
			})
		} catch (error) {
			console.debug('Audio mode configuration failed:', error)
		}
	}

	load(uri: string, onStatus: StatusListener): void {
		this.release()
		this.player = createAudioPlayer({ uri }, UPDATE_INTERVAL_MS)
		this.subscription = this.player.addListener('playbackStatusUpdate', onStatus)
	}

	release(): void {
		this.subscription?.remove()
		this.subscription = null
		if (this.player) {
			try {
				this.player.remove()
			} catch {
				// already released
			}
			this.player = null
		}
	}

	play(): void {
		this.player?.play()
	}

	pause(): void {
		this.player?.pause()
	}

	async seekTo(positionMs: number): Promise<void> {
		if (!this.player) return
		await this.player.seekTo(Math.max(0, positionMs / 1000))
	}

	/** rate with pitch correction so voices never chipmunk. */
	setRate(rate: number): void {
		this.player?.setPlaybackRate(rate, 'high')
	}

	/** 0..1 player volume (the ≤100% portion of the UI slider). */
	setVolumeFromPercent(percent: number): void {
		if (!this.player) return
		this.player.volume = percentToPlayerVolume(percent)
	}

	get isPlaying(): boolean {
		return this.player?.playing ?? false
	}

	get positionMs(): number {
		return (this.player?.currentTime ?? 0) * 1000
	}

	get durationMs(): number {
		return (this.player?.duration ?? 0) * 1000
	}
}

export const playbackService = new PlaybackService()
