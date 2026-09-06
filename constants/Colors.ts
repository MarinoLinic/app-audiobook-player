import { ThemePreference } from '../types'

/** Audible-inspired palette: warm slate + signature orange accent. */
export interface Theme {
	dark: boolean
	background: string
	backgroundAlt: string
	card: string
	cardPressed: string
	text: string
	textSecondary: string
	textTertiary: string
	border: string
	accent: string
	accentSoft: string
	onAccent: string
	overlay: string
	progressTrack: string
	danger: string
	miniPlayer: string
	tabBar: string
	shadow: string
}

const ACCENT = '#f8991c'

export const lightTheme: Theme = {
	dark: false,
	background: '#faf9f7',
	backgroundAlt: '#f1efec',
	card: '#ffffff',
	cardPressed: '#f3f0ec',
	text: '#1c1a17',
	textSecondary: '#6b6359',
	textTertiary: '#9a9086',
	border: '#e8e3dc',
	accent: ACCENT,
	accentSoft: '#fde8cd',
	onAccent: '#1c1a17',
	overlay: 'rgba(28,26,23,0.5)',
	progressTrack: '#e8e3dc',
	danger: '#d64545',
	miniPlayer: '#ffffff',
	tabBar: '#ffffff',
	shadow: '#000',
}

export const darkTheme: Theme = {
	dark: true,
	background: '#0b0b10',
	backgroundAlt: '#13131a',
	card: '#1a1a24',
	cardPressed: '#23232f',
	text: '#f5f3ef',
	textSecondary: '#a9a49b',
	textTertiary: '#6f6b63',
	border: '#262633',
	accent: ACCENT,
	accentSoft: '#3a2b12',
	onAccent: '#17120a',
	overlay: 'rgba(0,0,0,0.6)',
	progressTrack: '#262633',
	danger: '#e06565',
	miniPlayer: '#1a1a24',
	tabBar: '#101018',
	shadow: '#000',
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): Theme {
	const dark = preference === 'system' ? systemDark : preference === 'dark'
	return dark ? darkTheme : lightTheme
}
