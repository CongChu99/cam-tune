/**
 * Tests for XMP shooting intent fields with omit-on-null logic.
 */
import { generateXmp } from '../lib/xmp-generator'
import type { XmpSessionData } from '../lib/xmp-generator'

describe('generateXmp intent fields with omit-on-null', () => {
  const baseData: XmpSessionData = {
    sessionId: 'session-1',
    modifyDate: new Date('2026-01-01T12:00:00Z'),
  }

  it('includes OutputMedium when provided', () => {
    const data: XmpSessionData = {
      ...baseData,
      extras: { OutputMedium: 'web_1080p' },
    }
    const xmp = generateXmp(data)
    expect(xmp).toContain('camtune:OutputMedium')
    expect(xmp).toContain('web_1080p')
  })

  it('includes SubjectMotion when provided', () => {
    const data: XmpSessionData = {
      ...baseData,
      extras: { SubjectMotion: 'fast' },
    }
    const xmp = generateXmp(data)
    expect(xmp).toContain('camtune:SubjectMotion')
    expect(xmp).toContain('fast')
  })

  it('includes FlashMode when provided', () => {
    const data: XmpSessionData = {
      ...baseData,
      extras: { FlashMode: 'speedlight' },
    }
    const xmp = generateXmp(data)
    expect(xmp).toContain('camtune:FlashMode')
  })

  it('includes ShadowPriority when provided', () => {
    const data: XmpSessionData = {
      ...baseData,
      extras: { ShadowPriority: 'true' },
    }
    const xmp = generateXmp(data)
    expect(xmp).toContain('camtune:ShadowPriority')
  })

  it('omits fields not in extras (omit-on-null)', () => {
    const xmp = generateXmp(baseData)
    expect(xmp).not.toContain('OutputMedium')
    expect(xmp).not.toContain('SubjectMotion')
    expect(xmp).not.toContain('FlashMode')
    expect(xmp).not.toContain('ShadowPriority')
  })

  it('includes multiple intent fields when all provided', () => {
    const data: XmpSessionData = {
      ...baseData,
      extras: {
        OutputMedium: 'print_a2_plus',
        SubjectMotion: 'slow',
        FlashMode: 'hss_capable',
        ShadowPriority: 'false',
      },
    }
    const xmp = generateXmp(data)
    expect(xmp).toContain('camtune:OutputMedium')
    expect(xmp).toContain('camtune:SubjectMotion')
    expect(xmp).toContain('camtune:FlashMode')
    expect(xmp).toContain('camtune:ShadowPriority')
  })
})
