import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'

interface ProgressBarProps {
	/** 0..1 */
	fraction: number
	height?: number
}

export function ProgressBar({ fraction, height = 4 }: ProgressBarProps) {
	const theme = useTheme()
	const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100)
	return (
		<View style={[styles.track, { height, backgroundColor: theme.progressTrack, borderRadius: height / 2 }]}>
			{pct > 0 && <View style={[styles.fill, { backgroundColor: theme.accent, borderRadius: height / 2, width: `${pct}%` }]} />}
		</View>
	)
}

const styles = StyleSheet.create({
	track: {
		overflow: 'hidden',
	},
	fill: {
		height: '100%',
	},
})
