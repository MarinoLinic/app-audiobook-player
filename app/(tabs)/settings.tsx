import { Ionicons } from '@expo/vector-icons'
import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Logo } from '../../components/Logo'
import { OptionSheet } from '../../components/OptionSheet'
import { APP_NAME, BOOK_SORT_LABELS, SKIP_OPTIONS, TRACK_SORT_LABELS } from '../../constants/Defaults'
import { useLibrary } from '../../context/LibraryContext'
import { volumeBoostAvailable } from '../../modules/volume-boost/src'
import { useTheme } from '../../context/ThemeContext'
import { ThemePreference, TrackSortMode, BookSortMode } from '../../types'

const THEME_LABELS: Record<ThemePreference, string> = {
	system: 'System default',
	light: 'Light',
	dark: 'Dark',
}

function SettingRow({
	icon,
	label,
	value,
	onPress,
}: {
	icon: keyof typeof Ionicons.glyphMap
	label: string
	value: string
	onPress: () => void
}) {
	const theme = useTheme()
	return (
		<View style={[styles.row, { borderColor: theme.border }]}>
			<Ionicons name={icon} size={20} color={theme.textSecondary} style={styles.rowIcon} />
			<Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
			<Text style={[styles.rowValue, { color: theme.textSecondary }]} onPress={onPress}>
				{value}  ›
			</Text>
		</View>
	)
}

export default function SettingsScreen() {
	const theme = useTheme()
	const { settings, updateSettings } = useLibrary()
	const [sheet, setSheet] = useState<null | 'theme' | 'skip' | 'trackSort' | 'bookSort'>(null)

	return (
		<ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container}>
			<Text style={[styles.section, { color: theme.textTertiary }]}>Appearance</Text>
			<SettingRow icon="contrast-outline" label="Theme" value={THEME_LABELS[settings.theme]} onPress={() => setSheet('theme')} />

			<Text style={[styles.section, { color: theme.textTertiary }]}>Playback</Text>
			<SettingRow icon="timer-outline" label="Skip interval" value={`${settings.skipIntervalSec} s`} onPress={() => setSheet('skip')} />
			<SettingRow
				icon="list-outline"
				label="Default track order"
				value={TRACK_SORT_LABELS[settings.defaultSortMode]}
				onPress={() => setSheet('trackSort')}
			/>
			<SettingRow
				icon="albums-outline"
				label="Library sort order"
				value={BOOK_SORT_LABELS[settings.bookSortMode]}
				onPress={() => setSheet('bookSort')}
			/>

			<Text style={[styles.section, { color: theme.textTertiary }]}>Volume boost</Text>
			<View style={[styles.note, { backgroundColor: theme.card, borderColor: theme.border }]}>
				<Ionicons name="volume-high-outline" size={20} color={theme.accent} />
				<Text style={[styles.noteText, { color: theme.textSecondary }]}>
					The player volume slider goes up to 200%. Above 100% an amplifier (Android Loudness Enhancer) kicks in.
					{volumeBoostAvailable
						? ' Boost is active on this build.'
						: ' This build has no boost support (e.g. Expo Go or iOS) — the slider is capped at 100% in effect.'}
				</Text>
			</View>

			<Text style={[styles.section, { color: theme.textTertiary }]}>About</Text>
			<View style={[styles.about, { backgroundColor: theme.card, borderColor: theme.border }]}>
				<Logo size={56} />
				<Text style={[styles.aboutName, { color: theme.text }]}>{APP_NAME}</Text>
				<Text style={[styles.aboutText, { color: theme.textTertiary }]}>
					A local-first audiobook player. Your books never leave your device, and your position is always remembered.
				</Text>
				<Text style={[styles.aboutText, { color: theme.textTertiary }]}>Version 1.0.0</Text>
			</View>

			<OptionSheet
				visible={sheet === 'theme'}
				title="Theme"
				onClose={() => setSheet(null)}
				options={(Object.entries(THEME_LABELS) as [ThemePreference, string][]).map(([value, label]) => ({
					label,
					icon: value === 'dark' ? 'moon-outline' : value === 'light' ? 'sunny-outline' : 'contrast-outline',
					selected: settings.theme === value,
					onPress: () => updateSettings({ theme: value }),
				}))}
			/>
			<OptionSheet
				visible={sheet === 'skip'}
				title="Skip interval"
				onClose={() => setSheet(null)}
				options={SKIP_OPTIONS.map((sec) => ({
					label: `${sec} seconds`,
					selected: settings.skipIntervalSec === sec,
					onPress: () => updateSettings({ skipIntervalSec: sec }),
				}))}
			/>
			<OptionSheet
				visible={sheet === 'trackSort'}
				title="Default track order for new books"
				onClose={() => setSheet(null)}
				options={Object.entries(TRACK_SORT_LABELS).map(([mode, label]) => ({
					label,
					selected: settings.defaultSortMode === mode,
					onPress: () => updateSettings({ defaultSortMode: mode as TrackSortMode }),
				}))}
			/>
			<OptionSheet
				visible={sheet === 'bookSort'}
				title="Library sort order"
				onClose={() => setSheet(null)}
				options={Object.entries(BOOK_SORT_LABELS).map(([mode, label]) => ({
					label,
					selected: settings.bookSortMode === mode,
					onPress: () => updateSettings({ bookSortMode: mode as BookSortMode }),
				}))}
			/>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: { padding: 16, paddingBottom: 60 },
	section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, marginLeft: 4 },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rowIcon: { marginRight: 14 },
	rowLabel: { flex: 1, fontSize: 16 },
	rowValue: { fontSize: 15 },
	note: {
		flexDirection: 'row',
		gap: 10,
		padding: 14,
		borderRadius: 12,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'flex-start',
	},
	noteText: { flex: 1, fontSize: 13, lineHeight: 19 },
	about: {
		alignItems: 'center',
		padding: 24,
		borderRadius: 16,
		borderWidth: StyleSheet.hairlineWidth,
	},
	aboutName: { fontSize: 20, fontWeight: '700', marginTop: 12 },
	aboutText: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 8 },
})
