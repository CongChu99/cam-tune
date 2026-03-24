/**
 * Tests for the full coerceSuggestion pipeline with all validators wired.
 */
import { runSuggestionPipeline } from '../lib/suggestion-pipeline'
import type { PipelineContext, PipelineResult } from '../lib/suggestion-pipeline'

describe('runSuggestionPipeline', () => {
  const baseSuggestion = {
    iso: 400,
    aperture: 1.4,
    shutter: '1/500',
    whiteBalance: 'Auto',
    meteringMode: 'Matrix',
    confidence: 90,
    primaryDriver: 'ambient light',
  }

  const baseContext: PipelineContext = {
    lensProfile: { maxAperture: 4 },
    camera: {
      sensorSize: 'FULL_FRAME',
      maxFlashSyncSpeed: 250,
      dualNativeIso: false,
      dualNativeIsoValues: null,
      ibis: true,
      ibisStops: 5.5,
    },
    flashAvailability: 'speedlight',
    outputMedium: 'web_1080p',
  }

  it('applies aperture clamp from pipeline', () => {
    const result = runSuggestionPipeline(baseSuggestion, 0, baseContext)
    expect(result.suggestion.aperture).toBe(4) // clamped to lens max
    expect(result.suggestion.apertureClampApplied).toBe(true)
  })

  it('applies flash sync warning', () => {
    const result = runSuggestionPipeline(baseSuggestion, 0, baseContext)
    expect(result.flashSyncWarning).toBeDefined()
    expect(result.flashSyncWarning).toContain('1/250')
  })

  it('no diffraction warning for web output', () => {
    const result = runSuggestionPipeline(baseSuggestion, 0, baseContext)
    expect(result.diffractionWarning).toBeNull()
  })

  it('diffraction warning for print_a2_plus with small aperture', () => {
    const ctx: PipelineContext = {
      ...baseContext,
      outputMedium: 'print_a2_plus',
    }
    const suggestion = { ...baseSuggestion, aperture: 22 }
    const result = runSuggestionPipeline(suggestion, 0, ctx)
    expect(result.diffractionWarning).toBeDefined()
  })

  it('includes dualNativeIsoApplied when camera has dual ISO', () => {
    const ctx: PipelineContext = {
      ...baseContext,
      camera: {
        ...baseContext.camera,
        dualNativeIso: true,
        dualNativeIsoValues: '640,12800',
      },
    }
    const result = runSuggestionPipeline(baseSuggestion, 0, ctx)
    expect(result.dualNativeIsoApplied).toBe(true)
    expect(result.dualNativeIsoHint).toBeDefined()
  })

  it('no flash sync warning when no flash', () => {
    const ctx: PipelineContext = {
      ...baseContext,
      flashAvailability: 'none',
    }
    const result = runSuggestionPipeline(baseSuggestion, 0, ctx)
    expect(result.flashSyncWarning).toBeNull()
  })

  it('works without any optional context', () => {
    const minimalContext: PipelineContext = {
      camera: {
        sensorSize: 'FULL_FRAME',
        maxFlashSyncSpeed: null,
        dualNativeIso: false,
        dualNativeIsoValues: null,
        ibis: false,
        ibisStops: null,
      },
      flashAvailability: 'none',
      outputMedium: 'web_1080p',
    }
    const result = runSuggestionPipeline(baseSuggestion, 0, minimalContext)
    expect(result.suggestion).toBeDefined()
    expect(result.suggestion.apertureClampApplied).toBe(false)
  })
})
