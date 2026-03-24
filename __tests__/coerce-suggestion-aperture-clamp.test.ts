/**
 * Tests for coerceSuggestion aperture clamping to lensProfile.maxAperture.
 */
import { coerceSuggestion } from '../lib/recommendation-engine'
import type { LensProfileForCoercion } from '../lib/recommendation-engine'

describe('coerceSuggestion aperture clamp', () => {
  const baseSuggestion = {
    iso: 400,
    aperture: 1.4,
    shutter: '1/500',
    whiteBalance: 'Auto',
    meteringMode: 'Matrix',
    confidence: 90,
    primaryDriver: 'ambient light',
  }

  it('clamps aperture when AI suggests wider than lens maxAperture', () => {
    const lens: LensProfileForCoercion = { maxAperture: 4 }
    const result = coerceSuggestion(baseSuggestion, 0, lens)
    expect(result.aperture).toBe(4)
    expect(result.apertureClampApplied).toBe(true)
    expect(result.apertureClampNote).toContain('f/1.4')
    expect(result.apertureClampNote).toContain('f/4')
  })

  it('does not clamp when AI suggests narrower than lens maxAperture', () => {
    const lens: LensProfileForCoercion = { maxAperture: 1.4 }
    const suggestion = { ...baseSuggestion, aperture: 2.8 }
    const result = coerceSuggestion(suggestion, 0, lens)
    expect(result.aperture).toBe(2.8)
    expect(result.apertureClampApplied).toBe(false)
    expect(result.apertureClampNote).toBeUndefined()
  })

  it('does not clamp when aperture equals maxAperture', () => {
    const lens: LensProfileForCoercion = { maxAperture: 1.4 }
    const result = coerceSuggestion(baseSuggestion, 0, lens)
    expect(result.aperture).toBe(1.4)
    expect(result.apertureClampApplied).toBe(false)
  })

  it('uses no clamp when no lens profile provided (backward compat)', () => {
    const result = coerceSuggestion(baseSuggestion, 0)
    expect(result.aperture).toBe(1.4)
    expect(result.apertureClampApplied).toBe(false)
  })

  it('clamp note format matches spec', () => {
    const lens: LensProfileForCoercion = { maxAperture: 5.6 }
    const suggestion = { ...baseSuggestion, aperture: 2.8 }
    const result = coerceSuggestion(suggestion, 0, lens)
    expect(result.apertureClampApplied).toBe(true)
    expect(result.apertureClampNote).toBe(
      'f/2.8 requested but your lens maximum is f/5.6'
    )
  })
})
