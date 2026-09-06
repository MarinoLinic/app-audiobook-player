import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CoverArt } from '../../components/CoverArt'
import { Logo } from '../../components/Logo'
import { OptionSheet } from '../../components/OptionSheet'
import { ProgressBar } from '../../components/ProgressBar'
import { BOOK_SORT_LABELS } from '../../constants/Defaults'
import { useLibrary } from '../../context/LibraryContext'
import { usePlayer } from '../../context/PlayerContext'
import { useTheme } from '../../context/ThemeContext'
import { Book } from '../../types'
import { bookProgressFraction, sortBooks } from '../../utils/bookSort'
import { formatLongDuration } from '../../utils/time'

export default function LibraryScreen() {
	const theme = useTheme()
	const router = useRouter()
	const { books, settings, importing, addFolderBook, addFilesBook, refreshBook, deleteBook, updateSettings } = useLibrary()
	const { book: playingBook, resumeBook } = usePlayer()
	const [sortSheetOpen, setSortSheetOpen] = useState(false)
	const [bookMenu, setBookMenu] = useState<Book | null>(null)

	const sorted = useMemo(() => sortBooks(books, settings.bookSortMode), [books, settings.bookSortMode])

	// Keep folder books in sync with the file system whenever the library tab gains focus
	const folderBookIds = useMemo(() => books.filter((b) => b.source === 'folder').map((b) => b.id).join(','), [books])
	useFocusEffect(
		useCallback(() => {
			for (const id of folderBookIds.split(',').filter(Boolean)) {
				refreshBook(id).catch(() => {})
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [folderBookIds]),
	)

	const handleAddFolder = async () => {
		const result = await addFolderBook()
		if (result) router.push(`/book/${result.book.id}`)
	}

	const remainingMs = (book: Book): number | undefined => {
		let remaining = 0
		let known = false
		for (const t of book.tracks) {
			const p = book.progress[t.id]
			if (p?.completed) continue
			const dur = p?.durationMs ?? t.durationMs
			if (dur) {
				known = true
				remaining += Math.max(0, dur - (p?.positionMs ?? 0))
			}
		}
		return known ? remaining : undefined
	}

	const confirmDelete = (book: Book) => {
		Alert.alert(
			`Remove "${book.name}"?`,
			book.source === 'imported'
				? 'The copied audio files will be deleted from app storage.'
				: 'Only the library entry is removed — your files stay on the device.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Remove', style: 'destructive', onPress: () => deleteBook(book.id) },
			],
		)
	}

	if (books.length === 0 && !importing) {
		return (
			<View style={[styles.container, { backgroundColor: theme.background }]}>
				<View style={styles.emptyState}>
					<Logo size={96} />
					<Text style={[styles.emptyTitle, { color: theme.text }]}>Your library is empty</Text>
					<Text style={[styles.emptyText, { color: theme.textSecondary }]}>
						Add a folder of audiobooks — each folder becomes a book, and Lector remembers exactly where you stopped.
					</Text>
					<AddButton themeLabel="Add folder" icon="folder-open-outline" onPress={handleAddFolder} primary />
					<AddButton themeLabel="Import audio files" icon="document-outline" onPress={addFilesBook} />
				</View>
			</View>
		)
	}

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<View style={styles.toolbar}>
				<Pressable style={styles.sortButton} onPress={() => setSortSheetOpen(true)}>
					<Text style={[styles.toolbarText, { color: theme.textSecondary }]}>{BOOK_SORT_LABELS[settings.bookSortMode]}</Text>
					<Ionicons name="swap-vertical" size={16} color={theme.textSecondary} />
				</Pressable>
				<View style={styles.toolbarActions}>
					<Pressable hitSlop={8} onPress={handleAddFolder} style={styles.actionButton}>
						<Ionicons name="folder-open-outline" size={22} color={theme.text} />
					</Pressable>
					<Pressable hitSlop={8} onPress={addFilesBook} style={styles.actionButton}>
						<Ionicons name="add-outline" size={26} color={theme.text} />
					</Pressable>
				</View>
			</View>

			{importing && (
				<View style={styles.importingRow}>
					<ActivityIndicator color={theme.accent} size="small" />
					<Text style={{ color: theme.textSecondary, marginLeft: 8 }}>Importing and reading metadata…</Text>
				</View>
			)}

			<ScrollView contentContainerStyle={styles.list}>
				{sorted.map((book) => {
					const progress = bookProgressFraction(book)
					const remaining = remainingMs(book)
					const isNowPlaying = playingBook?.id === book.id
					return (
						<Pressable
							key={book.id}
							style={({ pressed }) => [styles.bookRow, { backgroundColor: pressed ? theme.cardPressed : theme.card, borderColor: theme.border }]}
							onPress={() => router.push(`/book/${book.id}`)}
							onLongPress={() => setBookMenu(book)}
						>
							<CoverArt uri={book.coverUri} title={book.name} size={64} radius={8} />
							<View style={styles.bookInfo}>
								<Text numberOfLines={2} style={[styles.bookTitle, { color: theme.text }]}>
									{book.name}
									{isNowPlaying && <Text style={{ color: theme.accent }}>  ●</Text>}
								</Text>
								{book.author && (
									<Text numberOfLines={1} style={[styles.bookAuthor, { color: theme.textSecondary }]}>
										{book.author}
									</Text>
								)}
								<Text style={[styles.bookMeta, { color: theme.textTertiary }]}>
									{book.tracks.length} {book.tracks.length === 1 ? 'part' : 'parts'}
									{remaining !== undefined && progress < 1 ? `  ·  ${formatLongDuration(remaining)} left` : ''}
									{progress >= 1 ? '  ·  Finished' : ''}
								</Text>
								<ProgressBar fraction={progress} />
							</View>
							<Pressable
								hitSlop={10}
								style={[styles.playBadge, { backgroundColor: theme.accentSoft }]}
								onPress={() => {
									void resumeBook(book)
									router.push('/player')
								}}
							>
								<Ionicons name="play" size={20} color={theme.accent} />
							</Pressable>
						</Pressable>
					)
				})}
				<View style={{ height: 24 }} />
			</ScrollView>

			<OptionSheet
				visible={sortSheetOpen}
				title="Sort library by"
				onClose={() => setSortSheetOpen(false)}
				options={Object.entries(BOOK_SORT_LABELS).map(([mode, label]) => ({
					label,
					selected: settings.bookSortMode === mode,
					onPress: () => updateSettings({ bookSortMode: mode as typeof settings.bookSortMode }),
				}))}
			/>

			<OptionSheet
				visible={bookMenu !== null}
				title={bookMenu?.name}
				onClose={() => setBookMenu(null)}
				options={[
					{
						label: 'Play',
						icon: 'play',
						onPress: () => {
							if (bookMenu) {
								void resumeBook(bookMenu)
								router.push('/player')
							}
						},
					},
					...(bookMenu?.source === 'folder'
						? [
								{
									label: 'Rescan folder',
									icon: 'refresh' as const,
									onPress: () => bookMenu && refreshBook(bookMenu.id),
								},
							]
						: []),
					{
						label: 'Remove from library',
						icon: 'trash-outline',
						danger: true,
						onPress: () => bookMenu && confirmDelete(bookMenu),
					},
				]}
			/>
		</View>
	)
}

function AddButton({ themeLabel, icon, onPress, primary }: { themeLabel: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; primary?: boolean }) {
	const theme = useTheme()
	return (
		<Pressable
			style={({ pressed }) => [
				styles.addButton,
				primary
					? { backgroundColor: theme.accent }
					: { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 },
				pressed && { opacity: 0.85 },
			]}
			onPress={onPress}
		>
			<Ionicons name={icon} size={20} color={primary ? theme.onAccent : theme.accent} />
			<Text style={[styles.addButtonText, { color: primary ? theme.onAccent : theme.text }]}>{themeLabel}</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	toolbar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	sortButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	toolbarText: { fontSize: 14, fontWeight: '600' },
	toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
	actionButton: { padding: 4 },
	importingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingBottom: 8,
	},
	list: { paddingHorizontal: 16, gap: 10 },
	bookRow: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
		gap: 12,
	},
	bookInfo: { flex: 1, gap: 5 },
	bookTitle: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
	bookAuthor: { fontSize: 13 },
	bookMeta: { fontSize: 12, marginBottom: 3 },
	playBadge: {
		width: 42,
		height: 42,
		borderRadius: 21,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptyState: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 40,
	},
	emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 28 },
	emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginTop: 10, marginBottom: 30 },
	addButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingHorizontal: 22,
		paddingVertical: 13,
		borderRadius: 26,
		marginTop: 12,
	},
	addButtonText: { fontSize: 16, fontWeight: '600' },
})
