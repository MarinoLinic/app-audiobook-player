import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'

export interface OptionItem {
	label: string
	hint?: string
	icon?: keyof typeof Ionicons.glyphMap
	selected?: boolean
	danger?: boolean
	onPress: () => void
}

interface OptionSheetProps {
	visible: boolean
	title?: string
	onClose: () => void
	options: OptionItem[]
}

/** Simple bottom-sheet style option list used for sort menus, speed, sleep timer. */
export function OptionSheet({ visible, title, onClose, options }: OptionSheetProps) {
	const theme = useTheme()
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose}>
				<Pressable style={[styles.sheet, { backgroundColor: theme.card }]} onPress={() => {}}>
					{title && <Text style={[styles.title, { color: theme.textSecondary }]}>{title}</Text>}
					{options.map((option) => (
						<Pressable
							key={option.label}
							style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.cardPressed }]}
							onPress={() => {
								option.onPress()
								onClose()
							}}
						>
							{option.icon && (
								<Ionicons
									name={option.icon}
									size={20}
									color={option.danger ? theme.danger : theme.textSecondary}
									style={styles.icon}
								/>
							)}
							<View style={styles.labelWrap}>
								<Text style={[styles.label, { color: option.danger ? theme.danger : theme.text }]}>{option.label}</Text>
								{option.hint && <Text style={[styles.hint, { color: theme.textTertiary }]}>{option.hint}</Text>}
							</View>
							{option.selected && <Ionicons name="checkmark" size={20} color={theme.accent} />}
						</Pressable>
					))}
				</Pressable>
			</Pressable>
		</Modal>
	)
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		justifyContent: 'flex-end',
	},
	sheet: {
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		paddingTop: 8,
		paddingBottom: 28,
	},
	title: {
		fontSize: 13,
		fontWeight: '600',
		letterSpacing: 0.5,
		textTransform: 'uppercase',
		paddingHorizontal: 20,
		paddingVertical: 12,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingVertical: 14,
		borderRadius: 10,
	},
	icon: {
		marginRight: 14,
	},
	labelWrap: {
		flex: 1,
	},
	label: {
		fontSize: 16,
		fontWeight: '500',
	},
	hint: {
		fontSize: 13,
		marginTop: 2,
	},
})
