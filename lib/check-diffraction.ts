/**
 * Diffraction threshold checker.
 *
 * Warns when aperture exceeds diffraction-limiting threshold for the
 * sensor size, but only for high-resolution output mediums.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type OutputMedium =
  | 'web_1080p'
  | 'social_media'
  | 'print_standard'
  | 'print_a2_plus'
  | 'commercial'

export interface DiffractionResult {
  diffractionWarning: string | null
}

interface SuggestionForDiffraction {
  aperture: number
}

interface CameraForDiffraction {
  sensorSize: string
}

// ─── Threshold table ─────────────────────────────────────────────────────────

/**
 * Maximum aperture (f-number) before diffraction softening becomes
 * visible at high-resolution outputs, keyed by sensor size.
 */
const DIFFRACTION_THRESHOLDS: Record<string, number> = {
  MFT: 8,
  ONE_INCH: 5.6,
  APS_C: 11,
  FULL_FRAME: 16,
  MEDIUM_FORMAT: 22,
}

/** Output mediums that are sensitive to diffraction softening */
const DIFFRACTION_SENSITIVE_MEDIUMS: Set<OutputMedium> = new Set([
  'print_a2_plus',
  'commercial',
])

// ─── Checker ─────────────────────────────────────────────────────────────────

/**
 * Checks if the aperture exceeds the diffraction threshold for the sensor size
 * when outputting to a high-resolution medium.
 *
 * @param suggestion    Suggestion with aperture value
 * @param camera        Camera with sensorSize field
 * @param outputMedium  Target output medium
 * @returns             Object with diffractionWarning (string if exceeded, null if safe)
 */
export function checkDiffraction(
  suggestion: SuggestionForDiffraction,
  camera: CameraForDiffraction,
  outputMedium: OutputMedium
): DiffractionResult {
  // Only check for high-resolution outputs
  if (!DIFFRACTION_SENSITIVE_MEDIUMS.has(outputMedium)) {
    return { diffractionWarning: null }
  }

  const threshold = DIFFRACTION_THRESHOLDS[camera.sensorSize]
  if (threshold === undefined) {
    // Unknown sensor size — no warning
    return { diffractionWarning: null }
  }

  if (suggestion.aperture > threshold) {
    return {
      diffractionWarning:
        `f/${suggestion.aperture} may produce diffraction softness for ${outputMedium} ` +
        `on your ${camera.sensorSize} sensor. Consider f/${threshold} or wider.`,
    }
  }

  return { diffractionWarning: null }
}
