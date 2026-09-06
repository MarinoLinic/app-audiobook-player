import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Logo } from '../../components/Logo'
import { MiniPlayer } from '../../components/MiniPlayer'
import { useTheme } from '../../context/ThemeContext'

export default function TabLayout() {
	const theme = useTheme()
	return (
		<View style={styles.root}>
			<Tabs
				screenOptions={{
					headerStyle: { backgroundColor: theme.background },
					headerTintColor: theme.text,
					headerShadowVisible: false,
					tabBarStyle: { backgroundColor: theme.tabBar, borderTopColor: theme.border },
					tabBarActiveTintColor: theme.accent,
					tabBarInactiveTintColor: theme.textTertiary,
					sceneStyle: { backgroundColor: theme.background },
				}}
			>
				<Tabs.Screen
					name="index"
					options={{
						title: 'Library',
						headerTitle: () => (
							<View style={styles.brand}>
								<Logo size={26} tiled={false} />
								<LogoLabel />
							</View>
						),
						tabBarIcon: ({ color, size }) => <Ionicons name="library" color={color} size={size} />,
					}}
				/>
				<Tabs.Screen
					name="settings"
					options={{
						title: 'Settings',
						headerTitle: 'Settings',
						tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
					}}
				/>
			</Tabs>
			<MiniPlayer />
		</View>
	)
}

function LogoLabel() {
	const theme = useTheme()
	return <Text style={[styles.brandText, { color: theme.text }]}>Lector</Text>
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	brand: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	brandText: {
		fontSize: 20,
		fontWeight: '700',
		marginLeft: 8,
		letterSpacing: 0.3,
	},
})
