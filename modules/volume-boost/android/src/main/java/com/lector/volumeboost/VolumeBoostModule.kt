package com.lector.volumeboost

import android.media.audiofx.LoudnessEnhancer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Amplifies playback beyond 100% using Android's LoudnessEnhancer audio effect
 * attached to the global output mix (audio session 0).
 *
 * gainMB is in millibels: 1000 mB = +10 dB. 0 (or below) disables the effect.
 */
class VolumeBoostModule : Module() {
  private var enhancer: LoudnessEnhancer? = null

  override fun definition() = ModuleDefinition {
    Name("VolumeBoost")

    Function("setBoostMB") { gainMB: Int ->
      applyBoost(gainMB)
    }

    OnDestroy {
      enhancer?.release()
      enhancer = null
    }
  }

  private fun applyBoost(gainMB: Int) {
    if (gainMB <= 0) {
      enhancer?.enabled = false
      enhancer?.release()
      enhancer = null
      return
    }
    try {
      if (enhancer == null) {
        // Session 0 = the output mix, so it boosts whatever the app is playing
        enhancer = LoudnessEnhancer(0)
      }
      enhancer?.setTargetGain(gainMB)
      enhancer?.enabled = true
    } catch (e: Exception) {
      // LoudnessEnhancer is unsupported on some devices — fail silently
      enhancer = null
    }
  }
}
