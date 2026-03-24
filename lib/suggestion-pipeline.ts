/**
 * Suggestion validation pipeline.
 *
 * Orchestrates all post-AI validators in order:
 * 1. Aperture clamp (lens maxAperture / variable aperture)
 * 2. Flash sync speed check
 * 3. Diffraction guard
 * 4. Dual native ISO hint
 *
 * Each validator runs independently and fails gracefully.
 */

import { coerceSuggestion } from './recommendation-engine'
import type { Suggestion, LensProfileForCoercion } from './recommendation-engine'
import { enforceFlashSync } from './enforce-flash-sync'
import type { FlashAvailability } from './enforce-flash-sync'
import { checkDiffraction } from './check-diffraction'
import type { OutputMedium } from './check-diffraction'
import { buildDualNativeIsoHint } from './dual-native-iso'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PipelineCamera {
  sensorSize: string
  maxFlashSyncSpeed: number | null
  dualNativeIso: boolean
  dualNativeIsoValues: string | null
  ibis: boolean
  ibisStops: number | null
}

export interface PipelineContext {
  lensProfile?: LensProfileForCoercion
  camera: PipelineCamera
  flashAvailability: FlashAvailability
  outputMedium: OutputMedium
}

export interface PipelineResult {
  suggestion: Suggestion
  flashSyncWarning: string | null
  diffractionWarning: string | null
  dualNativeIsoApplied: boolean
  dualNativeIsoHint: string | null
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

/**
 * Runs the full suggestion validation pipeline.
 *
 * @param raw       Raw suggestion object from AI response
 * @param index     Suggestion index (for error messages)
 * @param context   Pipeline context with lens, camera, flash, output medium
 * @returns         Validated suggestion with all warnings/flags
 */
export function runSuggestionPipeline(
  raw: Record<string, unknown>,
  index: number,
  context: PipelineContext
): PipelineResult {
  // 1. Coerce + aperture clamp
  const suggestion = coerceSuggestion(raw, index, context.lensProfile)

  // 2. Flash sync check
  let flashSyncWarning: string | null = null
  try {
    const flashResult = enforceFlashSync(
      { shutter: suggestion.shutter },
      { maxFlashSyncSpeed: context.camera.maxFlashSyncSpeed },
      context.flashAvailability
    )
    flashSyncWarning = flashResult.flashSyncWarning
  } catch {
    // Fail gracefully
  }

  // 3. Diffraction guard
  let diffractionWarning: string | null = null
  try {
    const diffractionResult = checkDiffraction(
      { aperture: suggestion.aperture },
      { sensorSize: context.camera.sensorSize },
      context.outputMedium
    )
    diffractionWarning = diffractionResult.diffractionWarning
  } catch {
    // Fail gracefully
  }

  // 4. Dual native ISO hint
  let dualNativeIsoApplied = false
  let dualNativeIsoHint: string | null = null
  try {
    const dualIsoResult = buildDualNativeIsoHint({
      dualNativeIso: context.camera.dualNativeIso,
      dualNativeIsoValues: context.camera.dualNativeIsoValues,
    })
    dualNativeIsoApplied = dualIsoResult.dualNativeIsoApplied
    dualNativeIsoHint = dualIsoResult.hint
  } catch {
    // Fail gracefully
  }

  return {
    suggestion,
    flashSyncWarning,
    diffractionWarning,
    dualNativeIsoApplied,
    dualNativeIsoHint,
  }
}
