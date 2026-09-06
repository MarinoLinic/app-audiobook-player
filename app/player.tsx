import { Ionicons } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CoverArt } from '../components/CoverArt'
import { OptionSheet } from '../components/OptionSheet'
import { SLEEP_TIMER_OPTIONS } from '../constants/Defaults'
import { useLibrary } from '../context/LibraryContext'
import { usePlayer } from '../context/PlayerContext'
import { useTheme } from '../context/ThemeContext'
import { formatDuration } from '../utils/time'
import { formatRate, MAX_VOLUME_PERCENT, RATE_PRESETS, RATE_STEP } from '../utils/volume'

export default function PlayerScreen() {
	const theme = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const { settings } = useLibrary()
	const {
		book,
		track,
		trackIndex,
		trackCount,
		positionMs,
		durationMs,
		isPlaying,
		rate,
		volumePercent,
		sleepTimer,
		sleepRemainingMs,
		togglePlayPause,
		seekTo,
		skipBy,
		nextTrack,
		previousTrack,
		setRate,
		setVolumePercent,
		setSleepTimerMinutes,
		playbackError,
	} = usePlayer()

	const [speedSheet, setSpeedSheet] = useState(false)
	const [sleepSheet, setSleepSheet] = useState(false)
	const [seekingMs, setSeekingMs] = useState<number | null>(null)

	if (!book || !track) {
		return (
			<View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
				<Text style={{ color: theme.textSecondary }}>Nothing is playing.</Text>
				<Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
					<Text style={{ color: theme.accent, fontSize: 16 }}>Go back</Text>
				</Pressable>
			</View>
		)
	}

	const shownPosition = seekingMs ?? positionMs
	// Remaining time counts down faster at higher speeds
	const remainingMs = durationMs > 0 ? (durationMs - shownPosition) / rate : undefined

	const sleepLabel =
		sleepTimer.kind === 'minutes'
			? formatDuration(sleepRemainingMs ?? 0)
			: sleepTimer.kind === 'endOfTrack'
				? 'EOT'
				: null

	return (
		<View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
			<View style={styles.topBar}>
				<Pressable hitSlop={12} onPress={() => router.back()}>
					<Ionicons name="chevron-down" size={30} color={theme.text} />
				</Pressable>
				<Text numberOfLines={1} style={[styles.bookName, { color: theme.textSecondary }]}>
					{book.name}
				</Text>
				<View style={{ width: 30 }} />
			</View>

			{playbackError && (
				<View style={[styles.errorBanner, { backgroundColor: theme.danger }]}>
					<Ionicons name="alert-circle" size={16} color="#fff" />
					<Text style={styles.errorText}>{playbackError}</Text>
				</View>
			)}

			<View style={styles.coverWrap}>
				<CoverArt uri={book.coverUri} title={book.name} size={Math.min(320, 300)} radius={16} />
			</View>

			<View style={styles.titleWrap}>
				<Text numberOfLines={2} style={[styles.trackTitle, { color: theme.text }]}>
					{track.title}
				</Text>
				<Text style={[styles.trackMeta, { color: theme.textTertiary }]}>
					Part {trackIndex + 1} of {trackCount}
				</Text>
			</View>

			<View style={styles.seekWrap}>
				<Slider
					style={styles.slider}
					minimumValue={0}
					maximumValue={Math.max(durationMs, 1)}
					value={shownPosition}
					minimumTrackTintColor={theme.accent}
					maximumTrackTintColor={theme.progressTrack}
					thumbTintColor={theme.accent}
					onSlidingStart={() => setSeekingMs(positionMs)}
					onValueChange={(v) => setSeekingMs(v)}
					onSlidingComplete={async (v) => {
						setSeekingMs(null)
						await seekTo(v)
					}}
				/>
				<View style={styles.timeRow}>
					<Text style={[styles.timeText, { color: theme.textSecondary }]}>{formatDuration(shownPosition)}</Text>
					<Text style={[styles.timeText, { color: theme.textSecondary }]}>
						{remainingMs !== undefined ? `-${formatDuration(remainingMs)}` : '--:--'}
					</Text>
				</View>
			</View>

			<View style={styles.controls}>
				<Pressable hitSlop={10} onPress={previousTrack} disabled={trackIndex === 0 && positionMs < 5000}>
					<Ionicons
						name="play-skip-back"
						size={30}
						color={trackIndex === 0 && positionMs < 5000 ? theme.textTertiary : theme.text}
					/>
				</Pressable>
				<Pressable hitSlop={10} onPress={() => skipBy(-settings.skipIntervalSec)}>
					<View style={styles.skipWrap}>
						<Ionicons name="arrow-undo" size={30} color={theme.text} />
						<Text style={[styles.skipLabel, { color: theme.text }]}>{settings.skipIntervalSec}</Text>
					</View>
				</Pressable>
				<Pressable style={[styles.playButton, { backgroundColor: theme.accent }]} onPress={togglePlayPause}>
					<Ionicons name={isPlaying ? 'pause' : 'play'} size={44} color={theme.onAccent} style={!isPlaying ? styles.playIconOffset : undefined} />
				</Pressable>
				<Pressable hitSlop={10} onPress={() => skipBy(settings.skipIntervalSec)}>
					<View style={styles.skipWrap}>
						<Ionicons name="arrow-redo" size={30} color={theme.text} />
						<Text style={[styles.skipLabel, { color: theme.text }]}>{settings.skipIntervalSec}</Text>
					</View>
				</Pressable>
				<Pressable hitSlop={10} onPress={nextTrack} disabled={trackIndex >= trackCount - 1}>
					<Ionicons name="play-skip-forward" size={30} color={trackIndex >= trackCount - 1 ? theme.textTertiary : theme.text} />
				</Pressable>
			</View>

			<View style={styles.bottomRow}>
				<Pressable onPress={() => setSpeedSheet(true)} style={[styles.pill, { backgroundColor: theme.card }]}>
					<Text style={[styles.pillText, { color: theme.text }]}>{formatRate(rate)}</Text>
					<Text style={[styles.pillSub, { color: theme.textTertiary }]}>Speed</Text>
				</Pressable>
				<Pressable onPress={() => setSleepSheet(true)} style={[styles.pill, { backgroundColor: theme.card }]}>
					<Ionicons name="moon-outline" size={17} color={sleepLabel ? theme.accent : theme.text} />
					<Text style={[styles.pillSub, { color: sleepLabel ? theme.accent : theme.textTertiary }]}>
						{sleepLabel ?? 'Sleep'}
					</Text>
				</Pressable>
				<View style={[styles.volumePill, { backgroundColor: theme.card }]}>
					<Ionicons name="volume-low-outline" size={18} color={theme.textSecondary} />
					<Slider
						style={styles.volumeSlider}
						minimumValue={0}
						maximumValue={MAX_VOLUME_PERCENT}
						value={volumePercent}
						minimumTrackTintColor={volumePercent > 100 ? theme.danger : theme.accent}
						maximumTrackTintColor={theme.progressTrack}
						thumbTintColor={volumePercent > 100 ? theme.danger : theme.textSecondary}
						onValueChange={(v) => setVolumePercent(v)}
						onSlidingComplete={(v) => setVolumePercent(v, true)}
					/>
					<Text style={[styles.volumeLabel, { color: volumePercent > 100 ? theme.danger : theme.textSecondary }]}>
						{Math.round(volumePercent)}%
					</Text>
				</View>
			</View>

			<OptionSheet
				visible={speedSheet}
				title="Playback speed"
				onClose={() => setSpeedSheet(false)}
				options={[
					{
						label: `Faster  ( ${formatRate(rate + RATE_STEP)} )`,
						icon: 'add-circle-outline',
						hint: 'Keep pressing to fine-tune',
						onPress: () => setRate(rate + RATE_STEP),
					},
					{
						label: `Slower  ( ${formatRate(rate - RATE_STEP)} )`,
						icon: 'remove-circle-outline',
						onPress: () => setRate(rate - RATE_STEP),
					},
					...RATE_PRESETS.map((preset) => ({
						label: formatRate(preset),
						icon: preset === 1 ? ('play' as const) : ('speedometer-outline' as const),
						selected: Math.abs(rate - preset) < 0.001,
						onPress: () => setRate(preset),
					})),
				]}
			/>

			<OptionSheet
				visible={sleepSheet}
				title="Sleep timer"
				onClose={() => setSleepSheet(false)}
				options={SLEEP_TIMER_OPTIONS.map((option) => ({
					label: option.label,
					icon: option.minutes === 0 ? 'moon-outline' : option.minutes === -1 ? 'musical-notes-outline' : 'time-outline',
					selected:
						(option.minutes === 0 && sleepTimer.kind === 'off') ||
						(option.minutes === -1 && sleepTimer.kind === 'endOfTrack'),
					onPress: () => setSleepTimerMinutes(option.minutes),
				}))}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	center: { alignItems: 'center', justifyContent: 'center' },
	errorBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginHorizontal: 16,
		marginTop: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10,
	},
	errorText: { color: '#fff', fontSize: 13, flex: 1 },
	topBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
	},
	bookName: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'center' },
	coverWrap: { alignItems: 'center', marginTop: 18 },
	titleWrap: { alignItems: 'center', paddingHorizontal: 32, marginTop: 20 },
	trackTitle: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
	trackMeta: { fontSize: 13, marginTop: 5 },
	seekWrap: { paddingHorizontal: 24, marginTop: 14 },
	slider: { width: '100%', height: 36 },
	timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
	timeText: { fontSize: 12, fontVariant: ['tabular-nums'] },
	controls: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 24,
		marginTop: 10,
	},
	skipWrap: { alignItems: 'center' },
	skipLabel: { fontSize: 11, fontWeight: '700', marginTop: -2 },
	playButton: {
		width: 84,
		height: 84,
		borderRadius: 42,
		alignItems: 'center',
		justifyContent: 'center',
	},
	playIconOffset: { marginLeft: 5 },
	bottomRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingHorizontal: 16,
		marginTop: 22,
	},
	pill: {
		borderRadius: 22,
		paddingVertical: 9,
		paddingHorizontal: 14,
		alignItems: 'center',
		minWidth: 64,
	},
	pillText: { fontSize: 15, fontWeight: '700' },
	pillSub: { fontSize: 10, fontWeight: '600', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.4 },
	volumePill: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 22,
		paddingHorizontal: 10,
		paddingVertical: 4,
		gap: 6,
	},
	volumeSlider: { flex: 1, height: 30 },
	volumeLabel: { fontSize: 11, fontWeight: '700', width: 38, textAlign: 'right', fontVariant: ['tabular-nums'] },
})
