import React, { useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'

interface RenameDialogProps {
	visible: boolean
	currentName: string
	onClose: () => void
	onSubmit: (name: string) => void
}

/** Simple rename modal — Alert.prompt is iOS-only, so this works everywhere. */
export function RenameDialog({ visible, currentName, onClose, onSubmit }: RenameDialogProps) {
	const theme = useTheme()
	// Mounted conditionally by callers — initial value is reset on each open
	const [name, setName] = useState(currentName)

	const submit = () => {
		onSubmit(name)
		onClose()
	}

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
				<View style={[styles.dialog, { backgroundColor: theme.card }]}>
					<Text style={[styles.title, { color: theme.text }]}>Rename book</Text>
					<TextInput
						style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundAlt }]}
						value={name}
						onChangeText={setName}
						autoFocus
						selectTextOnFocus
						placeholder="Book name"
						placeholderTextColor={theme.textTertiary}
						onSubmitEditing={submit}
						returnKeyType="done"
					/>
					<View style={styles.buttons}>
						<Pressable onPress={onClose} hitSlop={8} style={styles.button}>
							<Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancel</Text>
						</Pressable>
						<Pressable onPress={submit} hitSlop={8} style={styles.button}>
							<Text style={[styles.buttonText, { color: theme.accent, fontWeight: '700' }]}>Save</Text>
						</Pressable>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	)
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 32,
	},
	dialog: {
		width: '100%',
		borderRadius: 16,
		padding: 20,
	},
	title: {
		fontSize: 17,
		fontWeight: '700',
		marginBottom: 14,
	},
	input: {
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 16,
	},
	buttons: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 20,
		marginTop: 18,
	},
	button: {
		paddingVertical: 6,
		paddingHorizontal: 4,
	},
	buttonText: {
		fontSize: 15,
		fontWeight: '600',
	},
})
