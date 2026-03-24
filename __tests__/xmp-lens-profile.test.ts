/**
 * Tests for XMP lens profile field generation.
 */
import { generateXmp } from '../lib/xmp-generator'
import type { XmpSessionData } from '../lib/xmp-generator'

describe('generateXmp with LensProfile', () => {
  const baseData: XmpSessionData = {
    sessionId: 'session-1',
    iso: 400,
    aperture: 2.8,
    shutterSpeed: '1/500',
    modifyDate: new Date('2026-01-01T12:00:00Z'),
  }

  it('includes LensProfile field when provided in extras', () => {
    const data: XmpSessionData = {
      ...baseData,
      extras: {
        LensProfile: JSON.stringify({
          focalLengthMm: 85,
          maxAperture: 1.4,
          lensType: 'PRIME',
        }),
      },
    }
    const xmp = generateXmp(data)
    expect(xmp).toContain('camtune:LensProfile')
    expect(xmp).toContain('focalLengthMm')
    expect(xmp).toContain('85')
  })

  it('does not include LensProfile when not in extras', () => {
    const xmp = generateXmp(baseData)
    expect(xmp).not.toContain('LensProfile')
  })

  it('includes camtune namespace declaration', () => {
    const xmp = generateXmp(baseData)
    expect(xmp).toContain('xmlns:camtune="https://camtune.app/ns/1.0/"')
  })

  it('preserves existing fields when lens profile added', () => {
    const data: XmpSessionData = {
      ...baseData,
      extras: {
        LensProfile: '{"focalLengthMm":50}',
      },
    }
    const xmp = generateXmp(data)
    expect(xmp).toContain('camtune:ISO')
    expect(xmp).toContain('camtune:Aperture')
    expect(xmp).toContain('camtune:LensProfile')
  })
})
