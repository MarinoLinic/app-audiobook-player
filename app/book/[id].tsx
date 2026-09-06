import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CoverArt } from '../../components/CoverArt'
import { OptionSheet } from '../../components/OptionSheet'
import { ProgressBar } from '../../components/ProgressBar'
import { TRACK_SORT_LABELS } from '../../constants/Defaults'
import { useLibrary } from '../../context/LibraryContext'
import { usePlayer } from '../../context/PlayerContext'
import { useTheme } from '../../context/ThemeContext'
import { Track, TrackSortMode } from '../../types'
import { bookProgressFraction, sortTracks } from '../../utils/bookSort'
import { formatDuration } from '../../utils/time'

export default function BookScreen() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const theme = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const { books, setTrackSortMode, removeTrack } = useLibrary()
	const { book: playingBook, track: playingTrack, isPlaying, playBook, playTrackAtIndex } = usePlayer()
	const [sortSheetOpen, setSortSheetOpen] = useState(false)
	const [trackMenu, setTrackMenu] = useState<Track | null>(null)

	const book = books.find((b) => b.id === id)
	const sorted = useMemo(() => (book ? sortTracks(book.tracks, book.sortMode) : []), [book])

	if (!book) {
		return (
			<View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
				<Text style={{ color: theme.textSecondary }}>Book not found.</Text>
				<Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
					<Text style={{ color: theme.accent, fontSize: 16 }}>Back to library</Text>
				</Pressable>
			</View>
		)
	}

	const progress = bookProgressFraction(book)
	const isCurrentBook = playingBook?.id === book.id

	const resume = async () => {
		await playBook(book)
		router.push('/player')
	}

	const playFromTrack = async (track: Track) => {
		if (isCurrentBook) {
			const index = sorted.findIndex((t) => t.id === track.id)
			await playTrackAtIndex(index)
		} else {
			await playBook(book, track.id)
		}
		router.push('/player')
	}

	const confirmRemoveTrack = (t: Track) => {
		Alert.alert(`Remove "${t.title}"?`, 'It stays on the device — it is only dropped from this book.', [
			{ text: 'Cancel', style: 'cancel' },
			{ text: 'Remove', style: 'destructive', onPress: () => removeTrack(book.id, t.id) },
		])
	}

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<Stack.Screen options={{ headerTransparent: true, headerTitle: '' }} />
			<ScrollView contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: 120 }}>
				<View style={styles.header}>
					<CoverArt uri={book.coverUri} title={book.name} size={168} radius={14} />
					<Text style={[styles.title, { color: theme.text }]}>{book.name}</Text>
					{book.author && <Text style={[styles.author, { color: theme.textSecondary }]}>{book.author}</Text>}
					<Text style={[styles.meta, { color: theme.textTertiary }]}>
						{book.tracks.length} {book.tracks.length === 1 ? 'part' : 'parts'}
						{book.source === 'folder' ? '  ·  folder' : '  ·  imported'}
					</Text>

					<Pressable style={[styles.resumeButton, { backgroundColor: theme.accent }]} onPress={resume}>
						<Ionicons name="play" size={18} color={theme.onAccent} />
						<Text style={[styles.resumeText, { color: theme.onAccent }]}>
							{progress >= 1 ? 'Listen again' : progress > 0 ? 'Continue listening' : 'Start listening'}
						</Text>
					</Pressable>
					{progress > 0 && progress < 1 && (
						<View style={styles.progressWrap}>
							<ProgressBar fraction={progress} height={5} />
							<Text style={[styles.progressLabel, { color: theme.textTertiary }]}>{Math.round(progress * 100)}%</Text>
						</View>
					)}
				</View>

				<View style={styles.trackHeader}>
					<Text style={[styles.trackHeaderText, { color: theme.textSecondary }]}>Tracks</Text>
					<Pressable style={styles.sortRow} onPress={() => setSortSheetOpen(true)}>
						<Text style={[styles.sortText, { color: theme.accent }]}>{TRACK_SORT_LABELS[book.sortMode]}</Text>
						<Ionicons name="swap-vertical" size={14} color={theme.accent} />
					</Pressable>
				</View>

				{sorted.map((track, index) => {
					const trackProgress = book.progress[track.id]
					const isActive = isCurrentBook && playingTrack?.id === track.id
					const number = track.metadataTrackNumber ?? track.fileTrackNumber
					return (
						<Pressable
							key={track.id}
							style={({ pressed }) => [
								styles.trackRow,
								{ backgroundColor: pressed ? theme.cardPressed : 'transparent', borderBottomColor: theme.border },
								isActive && { backgroundColor: theme.accentSoft },
							]}
							onPress={() => playFromTrack(track)}
							onLongPress={() => setTrackMenu(track)}
						>
							<View style={styles.trackNumberWrap}>
								{isActive && isPlaying ? (
									<Ionicons name="volume-high" size={16} color={theme.accent} />
								) : trackProgress?.completed ? (
									<Ionicons name="checkmark-circle" size={16} color={theme.accent} />
								) : (
									<Text style={[styles.trackNumber, { color: theme.textTertiary }]}>{number ?? index + 1}</Text>
								)}
							</View>
							<View style={styles.trackInfo}>
								<Text numberOfLines={1} style={[styles.trackTitle, { color: theme.text }]}>
									{track.title}
								</Text>
								<Text style={[styles.trackMeta, { color: theme.textTertiary }]}>
									{formatDuration(trackProgress?.durationMs ?? track.durationMs)}
									{trackProgress && !trackProgress.completed && trackProgress.positionMs > 1000
										? `  ·  resume at ${formatDuration(trackProgress.positionMs)}`
										: ''}
								</Text>
								{trackProgress && !trackProgress.completed && trackProgress.durationMs ? (
									<ProgressBar fraction={trackProgress.positionMs / trackProgress.durationMs} height={3} />
								) : null}
							</View>
							<Ionicons name="play-circle-outline" size={26} color={isActive ? theme.accent : theme.textTertiary} />
						</Pressable>
					)
				})}
			</ScrollView>

			<OptionSheet
				visible={sortSheetOpen}
				title="Sort tracks by"
				onClose={() => setSortSheetOpen(false)}
				options={Object.entries(TRACK_SORT_LABELS).map(([mode, label]) => ({
					label,
					selected: book.sortMode === mode,
					onPress: () => setTrackSortMode(book.id, mode as TrackSortMode),
				}))}
			/>

			<OptionSheet
				visible={trackMenu !== null}
				title={trackMenu?.title}
				onClose={() => setTrackMenu(null)}
				options={[
					{
						label: 'Remove from book',
						icon: 'remove-circle-outline',
						danger: true,
						onPress: () => trackMenu && confirmRemoveTrack(trackMenu),
					},
				]}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	center: { alignItems: 'center', justifyContent: 'center' },
	header: { alignItems: 'center', paddingHorizontal: 32, paddingBottom: 24 },
	title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginTop: 18 },
	author: { fontSize: 15, marginTop: 6 },
	meta: { fontSize: 13, marginTop: 6 },
	resumeButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 22,
		paddingHorizontal: 26,
		paddingVertical: 13,
		borderRadius: 26,
	},
	resumeText: { fontSize: 16, fontWeight: '700' },
	progressWrap: { width: '100%', marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
	progressLabel: { fontSize: 12, width: 34, textAlign: 'right' },
	trackHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	trackHeaderText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
	sortRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
	sortText: { fontSize: 13, fontWeight: '600' },
	trackRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 12,
		gap: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	trackNumberWrap: { width: 26, alignItems: 'center' },
	trackNumber: { fontSize: 14, fontWeight: '600' },
	trackInfo: { flex: 1, gap: 4 },
	trackTitle: { fontSize: 15, fontWeight: '500' },
	trackMeta: { fontSize: 12 },
})
