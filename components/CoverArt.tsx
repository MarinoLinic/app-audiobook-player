import { LinearGradient } from 'expo-linear-gradient'
import React, { useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { hashId } from '../utils/id'

interface CoverArtProps {
	uri: string | null
	title: string
	size: number
	radius?: number
}

// Warm, audiobook-ish gradient pairs keyed by title hash
const GRADIENTS: [string, string][] = [
	['#f8991c', '#c25e00'],
	['#3d5a80', '#1b2a3d'],
	['#6d4c7d', '#3b2547'],
	['#2f6f5e', '#153a30'],
	['#8a4b3a', '#51251b'],
	['#5a5f73', '#2b2e3b'],
]

/**
 * Book cover: embedded art when present, otherwise a deterministic
 * gradient tile with the book's initials — Audible-style placeholder.
 */
export function CoverArt({ uri, title, size, radius = 10 }: CoverArtProps) {
	const theme = useTheme()
	// Cached cover files can be purged by the OS — fall back to the gradient tile.
	// Storing the failing uri (not a boolean) resets automatically when uri changes.
	const [brokenUri, setBrokenUri] = useState<string | null>(null)
	const broken = uri !== null && uri === brokenUri

	if (uri && !broken) {
		return (
			<Image
				source={{ uri }}
				style={{ width: size, height: size, borderRadius: radius, backgroundColor: theme.backgroundAlt }}
				resizeMode="cover"
				onError={() => setBrokenUri(uri)}
			/>
		)
	}

	const gradient = GRADIENTS[parseInt(hashId(title), 36) % GRADIENTS.length]
	const initials = title
		.split(/\s+/)
		.filter((w) => w.length > 0)
		.slice(0, 2)
		.map((w) => w[0].toUpperCase())
		.join('')

	return (
		<LinearGradient
			colors={gradient}
			start={{ x: 0, y: 0 }}
			end={{ x: 0.6, y: 1 }}
			style={[styles.placeholder, { width: size, height: size, borderRadius: radius }]}
		>
			<View style={[styles.rule, { width: size * 0.34 }]} />
			<Text style={[styles.initials, { fontSize: size * 0.30 }]} numberOfLines={1}>
				{initials || ' '}
			</Text>
			<View style={[styles.rule, { width: size * 0.34 }]} />
		</LinearGradient>
	)
}

const styles = StyleSheet.create({
	placeholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	initials: {
		color: 'rgba(255,255,255,0.95)',
		fontWeight: '700',
		letterSpacing: 1,
		marginVertical: 6,
	},
	rule: {
		height: 1.5,
		backgroundColor: 'rgba(255,255,255,0.5)',
	},
})
