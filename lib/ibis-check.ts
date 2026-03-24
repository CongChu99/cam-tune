/**
 * IBIS (In-Body Image Stabilization) shutter speed safety checks.
 *
 * Implements the reciprocal rule with IBIS compensation:
 *   safe minimum shutter = 1 / (focalLength * 0.5^ibisStops)
 *
 * For example, a 50mm lens with 5-stop IBIS:
 *   min = 1 / (50 * 0.5^5) = 1 / (50 * 0.03125) = 1 / 1.5625 ≈ 1/2s
 */

import type { CameraProfileRecord } from './camera-database'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Minimal lens profile shape accepted by ibis-check.
 * Avoids importing full Prisma types so callers can pass plain objects.
 */
export interface LensProfileParam {
  focalLengthMm: number
  focalLengthMinMm?: number
  focalLengthMaxMm?: number
  lensType?: 'PRIME' | 'ZOOM'
  currentFocalLengthMm?: number
}

export interface ShutterWarningExtendedResult {
  stabilizationWarning: string | null
  estimatedFocalLength: boolean
  usedFocalLengthMm: number
}

// ─── Shutter string parser ────────────────────────────────────────────────────

/**
 * Parses a shutter speed string into a decimal seconds value.
 *
 * Supports:
 *   "1/500"   → 0.002
 *   "1/60"    → 0.0167
 *   "1"       → 1
 *   "2"       → 2
 *   "0.5"     → 0.5
 */
export function parseShutterSpeed(shutter: string): number {
  const trimmed = shutter.trim()
  if (trimmed.includes('/')) {
    const [num, den] = trimmed.split('/').map(Number)
    if (!den || den === 0) return 0
    return num / den
  }
  return parseFloat(trimmed) || 0
}

// ─── Combined stabilization ──────────────────────────────────────────────────

/** Maximum combined stabilization stops (physics limit) */
const MAX_COMBINED_STOPS = 8

/**
 * Calculates combined stabilization stops from IBIS and OIS (lens IS),
 * capped at 8 stops (practical physics limit).
 *
 * @param ibisStops  Camera body IBIS stops (0 if no IBIS)
 * @param oisStops   Lens optical stabilization stops (0 if no OIS)
 * @returns          Combined stops, capped at MAX_COMBINED_STOPS
 */
export function getCombinedStabilizationStops(
  ibisStops: number,
  oisStops: number = 0
): number {
  const total = ibisStops + oisStops
  return Math.min(total, MAX_COMBINED_STOPS)
}

// ─── IBIS minimum shutter ─────────────────────────────────────────────────────

/**
 * Returns the minimum safe shutter speed (in seconds) for handheld shooting
 * using the reciprocal rule with IBIS compensation.
 *
 * Formula: 1 / (focalLengthMm * 0.5^ibisStops)
 *
 * @param focalLengthMm  Effective focal length in mm (35mm equivalent)
 * @param ibisStops      Number of IBIS stops (0 = no IBIS)
 * @returns              Minimum safe shutter speed in seconds
 */
export function getMinShutterSpeed(focalLengthMm: number, ibisStops: number): number {
  if (focalLengthMm <= 0) return 0
  const ibisGain = Math.pow(0.5, ibisStops)
  return 1 / (focalLengthMm * ibisGain)
}

// ─── Warning check ────────────────────────────────────────────────────────────

/**
 * Checks whether a given shutter speed is below the safe handheld threshold
 * for the camera's IBIS capability and focal length.
 *
 * @param shutterSpeed    Shutter speed string (e.g. "1/60", "1/500", "1")
 * @param cameraProfile   Camera profile with cameraDatabase IBIS data
 * @param focalLengthMm   Explicit focal length override; takes precedence over lensProfile
 * @param lensProfile     Optional lens profile; uses its focalLengthMm if focalLengthMm not explicitly provided
 * @returns               Warning string if below threshold, null if safe
 */
export function checkShutterWarning(
  shutterSpeed: string,
  cameraProfile: CameraProfileRecord,
  focalLengthMm?: number,
  lensProfile?: LensProfileParam
): string | null {
  // Priority: explicit focalLengthMm > lensProfile.focalLengthMm > default 50mm
  const focal = focalLengthMm ?? lensProfile?.focalLengthMm ?? 50
  const db = cameraProfile.cameraDatabase

  // Determine IBIS stops: prefer camera database value, allow profile override
  let ibisStops = 0
  if (db?.ibis && db.ibisStops !== null) {
    ibisStops = db.ibisStops
  }

  // Allow user's custom overrides to adjust IBIS stops
  const overrides = cameraProfile.customOverrides as Record<string, unknown> | null
  if (overrides && typeof overrides.ibisStops === 'number') {
    ibisStops = overrides.ibisStops
  }

  const shutterSec = parseShutterSpeed(shutterSpeed)
  if (shutterSec <= 0) return null

  const minShutter = getMinShutterSpeed(focal, ibisStops)

  if (shutterSec < minShutter) {
    const safeShutterFraction = Math.ceil(1 / minShutter)
    const hasIbis = ibisStops > 0
    const ibisNote = hasIbis
      ? ` (${ibisStops}-stop IBIS applied)`
      : ''

    return (
      `Shutter speed ${shutterSpeed} may cause motion blur at ${focal}mm` +
      `${ibisNote}. Consider 1/${safeShutterFraction}s or faster for handheld shots.`
    )
  }

  return null
}

// ─── Extended warning check ──────────────────────────────────────────────────

/**
 * Resolves the effective focal length from a lens profile, using zoom midpoint
 * fallback when the current focal length is unknown for zoom lenses.
 */
function resolveFocalLength(
  explicitFocalLengthMm: number | undefined,
  lensProfile?: LensProfileParam
): { focal: number; estimated: boolean } {
  // Explicit focal length always wins
  if (explicitFocalLengthMm !== undefined) {
    return { focal: explicitFocalLengthMm, estimated: false }
  }

  if (!lensProfile) {
    return { focal: 50, estimated: false }
  }

  // Zoom lens with current focal length set
  if (lensProfile.currentFocalLengthMm !== undefined) {
    return { focal: lensProfile.currentFocalLengthMm, estimated: false }
  }

  // Zoom lens without current focal length → use midpoint
  if (
    lensProfile.lensType === 'ZOOM' &&
    lensProfile.focalLengthMinMm !== undefined &&
    lensProfile.focalLengthMaxMm !== undefined
  ) {
    const midpoint = Math.round(
      (lensProfile.focalLengthMinMm + lensProfile.focalLengthMaxMm) / 2
    )
    return { focal: midpoint, estimated: true }
  }

  // Prime or fallback
  return { focal: lensProfile.focalLengthMm, estimated: false }
}

/**
 * Extended shutter warning check that returns structured result with
 * stabilizationWarning, estimatedFocalLength flag, and usedFocalLengthMm.
 *
 * @param shutterSpeed    Shutter speed string
 * @param cameraProfile   Camera profile with IBIS data
 * @param focalLengthMm   Explicit focal length override
 * @param lensProfile     Optional lens profile for focal length resolution
 */
export function checkShutterWarningExtended(
  shutterSpeed: string,
  cameraProfile: CameraProfileRecord,
  focalLengthMm?: number,
  lensProfile?: LensProfileParam
): ShutterWarningExtendedResult {
  const { focal, estimated } = resolveFocalLength(focalLengthMm, lensProfile)
  const warning = checkShutterWarning(shutterSpeed, cameraProfile, focal)

  return {
    stabilizationWarning: warning,
    estimatedFocalLength: estimated,
    usedFocalLengthMm: focal,
  }
}
