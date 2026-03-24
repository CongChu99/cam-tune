/**
 * Tests for coerceSuggestion variable aperture zoom lens handling.
 */
import { coerceSuggestion } from '../lib/recommendation-engine'
import type { LensProfileForCoercion } from '../lib/recommendation-engine'

describe('coerceSuggestion variable aperture zoom', () => {
  const baseSuggestion = {
    iso: 400,
    aperture: 2.8,
    shutter: '1/500',
    whiteBalance: 'Auto',
    meteringMode: 'Matrix',
    confidence: 90,
    primaryDriver: 'ambient light',
  }

  it('clamps to maxApertureTele when at tele end of variable aperture zoom', () => {
    const lens: LensProfileForCoercion = {
      maxAperture: 3.5,
      isVariableAperture: true,
      maxApertureTele: 5.6,
      focalLengthMaxMm: 200,
      currentFocalLengthMm: 200, // at tele end
    }
    const result = coerceSuggestion(baseSuggestion, 0, lens)
    expect(result.aperture).toBe(5.6)
    expect(result.apertureClampApplied).toBe(true)
    expect(result.apertureClampNote).toContain('200mm')
    expect(result.apertureClampNote).toContain('f/5.6')
  })

  it('clamps to maxApertureTele when beyond 70% threshold', () => {
    const lens: LensProfileForCoercion = {
      maxAperture: 3.5,
      isVariableAperture: true,
      maxApertureTele: 5.6,
      focalLengthMaxMm: 200,
      currentFocalLengthMm: 150, // 75% of 200 → tele range
    }
    const result = coerceSuggestion(baseSuggestion, 0, lens)
    expect(result.aperture).toBe(5.6)
    expect(result.apertureClampApplied).toBe(true)
  })

  it('clamps to maxAperture (wide end) when below 70% threshold', () => {
    const lens: LensProfileForCoercion = {
      maxAperture: 3.5,
      isVariableAperture: true,
      maxApertureTele: 5.6,
      focalLengthMaxMm: 200,
      currentFocalLengthMm: 50, // 25% of 200 → wide range
    }
    const result = coerceSuggestion(baseSuggestion, 0, lens)
    expect(result.aperture).toBe(3.5)
    expect(result.apertureClampApplied).toBe(true)
  })

  it('does not clamp when aperture is within tele-end limit', () => {
    const lens: LensProfileForCoercion = {
      maxAperture: 3.5,
      isVariableAperture: true,
      maxApertureTele: 5.6,
      focalLengthMaxMm: 200,
      currentFocalLengthMm: 200,
    }
    const suggestion = { ...baseSuggestion, aperture: 8 }
    const result = coerceSuggestion(suggestion, 0, lens)
    expect(result.aperture).toBe(8)
    expect(result.apertureClampApplied).toBe(false)
  })

  it('falls back to maxAperture when not variable aperture', () => {
    const lens: LensProfileForCoercion = {
      maxAperture: 4,
    }
    const result = coerceSuggestion(baseSuggestion, 0, lens)
    expect(result.aperture).toBe(4)
    expect(result.apertureClampApplied).toBe(true)
  })
})
