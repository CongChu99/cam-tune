/**
 * Flash sync speed validator.
 *
 * Checks whether a recommended shutter speed exceeds the camera's
 * maximum flash sync speed when flash is in use.
 */

import { parseShutterSpeed } from './ibis-check'

// ─── Types ───────────────────────────────────────────────────────────────────

export type FlashAvailability = 'none' | 'speedlight' | 'studio_strobe' | 'hss_capable'

export interface FlashSyncResult {
  flashSyncWarning: string | null
}

interface CameraForFlashSync {
  maxFlashSyncSpeed: number | null
}

interface SuggestionForFlashSync {
  shutter: string
}

// ─── Default ──────────────────────────────────────────────────────────────────

/** Default flash sync speed fallback: 1/200s */
const DEFAULT_FLASH_SYNC_SPEED = 200

// ─── Validator ───────────────────────────────────────────────────────────────

/**
 * Checks if a suggestion's shutter speed exceeds the camera's flash sync speed.
 *
 * @param suggestion       Suggestion with shutter speed string
 * @param camera           Camera with maxFlashSyncSpeed (in 1/x format, e.g. 250 means 1/250s)
 * @param flashAvailability Flash type being used
 * @returns                Object with flashSyncWarning (string if violated, null if safe)
 */
export function enforceFlashSync(
  suggestion: SuggestionForFlashSync,
  camera: CameraForFlashSync,
  flashAvailability: FlashAvailability
): FlashSyncResult {
  // No check needed for no flash or HSS-capable flash
  if (flashAvailability === 'none' || flashAvailability === 'hss_capable') {
    return { flashSyncWarning: null }
  }

  const syncSpeed = camera.maxFlashSyncSpeed ?? DEFAULT_FLASH_SYNC_SPEED
  const syncShutterSec = 1 / syncSpeed
  const shutterSec = parseShutterSpeed(suggestion.shutter)

  if (shutterSec <= 0) {
    return { flashSyncWarning: null }
  }

  // Shutter is faster (shorter duration) than sync speed → violation
  // e.g., 1/500 (0.002s) < 1/250 (0.004s) → violates sync
  if (shutterSec < syncShutterSec) {
    return {
      flashSyncWarning:
        `Shutter speed ${suggestion.shutter} exceeds flash sync speed of 1/${syncSpeed}s. ` +
        `Use 1/${syncSpeed}s or slower, or switch to HSS mode.`,
    }
  }

  return { flashSyncWarning: null }
}
