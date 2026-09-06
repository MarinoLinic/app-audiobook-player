import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { usePlayer } from '../context/PlayerContext'
import { useTheme } from '../context/ThemeContext'
import { fraction } from '../utils/time'
import { CoverArt } from './CoverArt'

/** Persistent mini player pinned above the tab bar / screen bottom. */
export function MiniPlayer() {
	const theme = useTheme()
	const router = useRouter()
	const { book, track, isPlaying, positionMs, durationMs, togglePlayPause, closePlayer } = usePlayer()

	if (!book || !track) return null

	return (
		<Pressable
			style={[styles.container, { backgroundColor: theme.miniPlayer, borderColor: theme.border }]}
			onPress={() => router.push('/player')}
		>
			<CoverArt uri={book.coverUri} title={book.name} size={44} radius={6} />
			<View style={styles.textWrap}>
				<Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
					{track.title}
				</Text>
				<Text numberOfLines={1} style={[styles.subtitle, { color: theme.textSecondary }]}>
					{book.name}
				</Text>
			</View>
			<Pressable
				hitSlop={12}
				onPress={(e) => {
					e.stopPropagation()
					togglePlayPause()
				}}
				style={[styles.playButton, { backgroundColor: theme.accent }]}
			>
				<Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={theme.onAccent} />
			</Pressable>
			<Pressable
				hitSlop={12}
				onPress={(e) => {
					e.stopPropagation()
					void closePlayer()
				}}
				style={styles.closeButton}
			>
				<Ionicons name="close" size={18} color={theme.textTertiary} />
			</Pressable>
			<View style={[styles.progress, { backgroundColor: theme.progressTrack }]}>
				<View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${fraction(positionMs, durationMs) * 100}%` }]} />
			</View>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
		marginHorizontal: 10,
		marginBottom: 8,
		elevation: 4,
		shadowOpacity: 0.15,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 2 },
	},
	textWrap: {
		flex: 1,
		marginHorizontal: 12,
	},
	title: {
		fontSize: 14,
		fontWeight: '600',
	},
	subtitle: {
		fontSize: 12,
		marginTop: 1,
	},
	playButton: {
		width: 38,
		height: 38,
		borderRadius: 19,
		alignItems: 'center',
		justifyContent: 'center',
	},
	closeButton: {
		marginLeft: 8,
		padding: 4,
	},
	progress: {
		position: 'absolute',
		left: 12,
		right: 12,
		bottom: 3,
		height: 2.5,
		borderRadius: 1.5,
		overflow: 'hidden',
	},
	progressFill: {
		height: '100%',
	},
})
