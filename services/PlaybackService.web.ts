import type { AudioStatus } from 'expo-audio'
import { percentToPlayerVolume } from '../utils/volume'
import { readAudio } from './WebMediaStore'

type StatusListener = (status: AudioStatus) => void

/** Browser media events avoid SDK 53's web event-name incompatibility. */
export class PlaybackService {
	private player: HTMLAudioElement | null = null
	private objectUrl: string | null = null
	private generation = 0
	private detach: (() => void) | null = null
	private cancelLoad: (() => void) | null = null

	async configure(): Promise<void> {}

	async load(uri: string, onStatus: StatusListener): Promise<void> {
		this.release()
		const generation = this.generation
		const blob = await readAudio(uri)
		if (generation !== this.generation) return
		this.objectUrl = URL.createObjectURL(blob)
		const audio = new Audio()
		this.player = audio
		audio.preload = 'auto'
		const report = () => onStatus({
			id: generation, currentTime: audio.currentTime || 0,
			duration: Number.isFinite(audio.duration) ? audio.duration : 0,
			playing: !audio.paused && !audio.ended, isLoaded: audio.readyState >= 1,
			didJustFinish: audio.ended, playbackState: audio.error ? 'error' : 'ready',
			timeControlStatus: audio.paused ? 'paused' : 'playing', reasonForWaitingToPlay: '',
			mute: audio.muted, loop: audio.loop, isBuffering: !audio.paused && audio.readyState < 3,
			playbackRate: audio.playbackRate, shouldCorrectPitch: audio.preservesPitch,
		})
		const events = ['loadedmetadata', 'loadeddata', 'timeupdate', 'play', 'pause', 'seeked', 'ended', 'ratechange']
		for (const event of events) audio.addEventListener(event, report)
		this.detach = () => { for (const event of events) audio.removeEventListener(event, report) }
		await new Promise<void>((resolve, reject) => {
			const finish = (error?: Error) => {
				clearTimeout(timeout)
				audio.removeEventListener('loadedmetadata', loaded)
				audio.removeEventListener('error', failed)
				this.cancelLoad = null
				error ? reject(error) : resolve()
			}
			const loaded = () => finish()
			const failed = () => finish(new Error('This browser could not decode the audio file. Try a supported MP3, AAC or WAV file.'))
			const timeout = setTimeout(() => finish(new Error('Audio loading timed out. Try importing the original file again.')), 15000)
			this.cancelLoad = () => finish(new Error('Audio loading was replaced.'))
			audio.addEventListener('loadedmetadata', loaded)
			audio.addEventListener('error', failed)
			audio.src = this.objectUrl!
			audio.load()
		})
	}

	release(): void {
		this.generation++
		this.cancelLoad?.()
		this.detach?.()
		this.detach = null
		if (this.player) {
			this.player.pause()
			this.player.removeAttribute('src')
			this.player.load()
		}
		this.player = null
		if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
		this.objectUrl = null
	}

	play(): void { void this.player?.play().catch((error) => console.warn('Press Play to allow browser audio playback.', error)) }
	pause(): void { this.player?.pause() }
	async seekTo(positionMs: number): Promise<void> {
		if (this.player) this.player.currentTime = Math.max(0, Math.min(positionMs / 1000, this.player.duration || 0))
	}
	setRate(rate: number): void { if (this.player) { this.player.playbackRate = rate; this.player.preservesPitch = true } }
	setVolumeFromPercent(percent: number): void { if (this.player) this.player.volume = percentToPlayerVolume(percent) }
}

export const playbackService = new PlaybackService()
