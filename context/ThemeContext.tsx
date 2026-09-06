import React, { createContext, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { resolveTheme, Theme } from '../constants/Colors'

interface ThemeContextValue {
	theme: Theme
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children, preference }: { children: React.ReactNode; preference: string }) {
	const systemScheme = useColorScheme()
	const theme = useMemo(
		() => resolveTheme(preference as 'system' | 'light' | 'dark', systemScheme === 'dark'),
		[preference, systemScheme],
	)
	return <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
	const context = useContext(ThemeContext)
	if (!context) throw new Error('useTheme must be used within a ThemeProvider')
	return context.theme
}
