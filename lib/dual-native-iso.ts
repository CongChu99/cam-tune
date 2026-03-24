/**
 * Dual Native ISO prompt hint builder.
 *
 * Generates a prompt injection string that tells the AI to prefer
 * native ISO values over intermediate ISOs for cameras with dual
 * (or multi) native ISO sensors.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DualNativeIsoResult {
  hint: string | null
  dualNativeIsoApplied: boolean
}

interface CameraForDualIso {
  dualNativeIso: boolean
  dualNativeIsoValues: string | null
}

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Builds a dual native ISO hint string for injection into the AI prompt.
 *
 * @param camera  Camera record with dualNativeIso flag and comma-separated values
 * @returns       Object with hint string (or null) and applied flag
 */
export function buildDualNativeIsoHint(camera: CameraForDualIso): DualNativeIsoResult {
  if (!camera.dualNativeIso || !camera.dualNativeIsoValues) {
    return { hint: null, dualNativeIsoApplied: false }
  }

  const values = camera.dualNativeIsoValues
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)

  if (values.length < 2) {
    return { hint: null, dualNativeIsoApplied: false }
  }

  const isoList = values.join(', ')
  const hint =
    `This camera has dual native ISO at ${isoList}. ` +
    `Prefer these native ISO values over intermediate ISOs for optimal noise performance.`

  return { hint, dualNativeIsoApplied: true }
}
