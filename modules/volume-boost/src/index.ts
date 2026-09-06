import { requireOptionalNativeModule } from 'expo-modules-core'

interface VolumeBoostNativeModule {
	setBoostMB(millibels: number): void
}

const native: VolumeBoostNativeModule | null =
	// Only exists in development/production builds with the compiled module —
	// never inside Expo Go.
	typeof requireOptionalNativeModule === 'function' ? requireOptionalNativeModule<VolumeBoostNativeModule>('VolumeBoost') : null

/** True when the native LoudnessEnhancer module is available (dev/prod builds only). */
export const volumeBoostAvailable = native !== null

/**
 * Applies a loudness boost in millibels (0 = off, 1000 = +10 dB).
 * Returns false when the native module is unavailable.
 */
export function setVolumeBoostMB(millibels: number): boolean {
	if (!native) return false
	try {
		native.setBoostMB(Math.max(0, Math.round(millibels)))
		return true
	} catch {
		return false
	}
}
