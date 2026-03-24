/**
 * Tests for checkDiffraction() — diffraction threshold validator.
 */
import { checkDiffraction } from '../lib/check-diffraction'
import type { OutputMedium } from '../lib/check-diffraction'

describe('checkDiffraction', () => {
  it('warns for APS-C at f/16 with print_a2_plus', () => {
    const result = checkDiffraction({ aperture: 16 }, { sensorSize: 'APS_C' }, 'print_a2_plus')
    expect(result.diffractionWarning).toBeDefined()
    expect(result.diffractionWarning).toContain('f/16')
    expect(result.diffractionWarning).toContain('APS_C')
  })

  it('does not warn for APS-C at f/8 with print_a2_plus', () => {
    const result = checkDiffraction({ aperture: 8 }, { sensorSize: 'APS_C' }, 'print_a2_plus')
    expect(result.diffractionWarning).toBeNull()
  })

  it('warns for FF at f/22 with commercial', () => {
    const result = checkDiffraction({ aperture: 22 }, { sensorSize: 'FULL_FRAME' }, 'commercial')
    expect(result.diffractionWarning).toBeDefined()
    expect(result.diffractionWarning).toContain('f/22')
  })

  it('does not warn for FF at f/11 with print_a2_plus', () => {
    const result = checkDiffraction({ aperture: 11 }, { sensorSize: 'FULL_FRAME' }, 'print_a2_plus')
    expect(result.diffractionWarning).toBeNull()
  })

  it('warns for MFT at f/11 with print_a2_plus', () => {
    const result = checkDiffraction({ aperture: 11 }, { sensorSize: 'MFT' }, 'print_a2_plus')
    expect(result.diffractionWarning).toBeDefined()
  })

  it('does not warn for MFT at f/5.6 with print_a2_plus', () => {
    const result = checkDiffraction({ aperture: 5.6 }, { sensorSize: 'MFT' }, 'print_a2_plus')
    expect(result.diffractionWarning).toBeNull()
  })

  it('does not warn for web output regardless of aperture', () => {
    const result = checkDiffraction({ aperture: 22 }, { sensorSize: 'APS_C' }, 'web_1080p')
    expect(result.diffractionWarning).toBeNull()
  })

  it('does not warn for social_media output', () => {
    const result = checkDiffraction({ aperture: 22 }, { sensorSize: 'APS_C' }, 'social_media')
    expect(result.diffractionWarning).toBeNull()
  })

  it('does not warn for print_standard output', () => {
    const result = checkDiffraction({ aperture: 22 }, { sensorSize: 'APS_C' }, 'print_standard')
    expect(result.diffractionWarning).toBeNull()
  })

  it('warns for medium format at f/32 with commercial', () => {
    const result = checkDiffraction({ aperture: 32 }, { sensorSize: 'MEDIUM_FORMAT' }, 'commercial')
    expect(result.diffractionWarning).toBeDefined()
  })

  it('does not warn for medium format at f/16 with commercial', () => {
    const result = checkDiffraction({ aperture: 16 }, { sensorSize: 'MEDIUM_FORMAT' }, 'commercial')
    expect(result.diffractionWarning).toBeNull()
  })
})
