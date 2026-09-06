import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import React from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Logo } from '../components/Logo'
import { LibraryProvider, useLibrary } from '../context/LibraryContext'
import { PlayerProvider } from '../context/PlayerContext'
import { ThemeProvider, useTheme } from '../context/ThemeContext'

function ThemedStack() {
	const theme = useTheme()
	return (
		<View style={[styles.root, { backgroundColor: theme.background }]}>
			<StatusBar style={theme.dark ? 'light' : 'dark'} />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: theme.background },
					headerTintColor: theme.text,
					headerShadowVisible: false,
					headerTitleStyle: { fontWeight: '700' },
					contentStyle: { backgroundColor: theme.background },
				}}
			>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen
					name="book/[id]"
					options={{
						headerTitle: '',
						headerBackTitle: 'Library',
						headerTransparent: true,
					}}
				/>
				<Stack.Screen
					name="player"
					options={{
						headerShown: false,
						presentation: 'modal',
						animation: 'slide_from_bottom',
					}}
				/>
			</Stack>
		</View>
	)
}

function BootSplash() {
	return (
		<View style={styles.boot}>
			<Logo size={96} />
			<ActivityIndicator color="#f8991c" style={{ marginTop: 24 }} />
		</View>
	)
}

function Shell() {
	const { settings, loading } = useLibrary()
	if (loading) return <BootSplash />
	return (
		<ThemeProvider preference={settings.theme}>
			<PlayerProvider>
				<ThemedStack />
			</PlayerProvider>
		</ThemeProvider>
	)
}

export default function RootLayout() {
	return (
		<GestureHandlerRootView style={styles.root}>
			<LibraryProvider>
				<Shell />
			</LibraryProvider>
		</GestureHandlerRootView>
	)
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	boot: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#0b0b10',
	},
})
