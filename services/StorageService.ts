import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Thin JSON persistence layer on top of AsyncStorage.
 * All keys are namespaced; values are JSON.
 */
const PREFIX = 'lector:'

export class StorageService {
	async get<T>(key: string): Promise<T | null> {
		try {
			const raw = await AsyncStorage.getItem(PREFIX + key)
			if (raw === null) return null
			return JSON.parse(raw) as T
		} catch (error) {
			console.error(`Failed to load key ${key}:`, error)
			return null
		}
	}

	async set<T>(key: string, value: T): Promise<void> {
		try {
			await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value))
		} catch (error) {
			console.error(`Failed to save key ${key}:`, error)
		}
	}

	async remove(key: string): Promise<void> {
		try {
			await AsyncStorage.removeItem(PREFIX + key)
		} catch (error) {
			console.error(`Failed to remove key ${key}:`, error)
		}
	}
}

export const storage = new StorageService()
