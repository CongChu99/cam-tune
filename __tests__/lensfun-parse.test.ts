/**
 * Tests for Lensfun XML parse script helpers.
 */
import {
  parseLensXml,
  extractApertureFromModel,
  classifyLensType,
  type LensfunRecord,
} from '../scripts/lensfun-parse'

// ─── extractApertureFromModel ────────────────────────────────────────────────

describe('extractApertureFromModel', () => {
  it('extracts single aperture from prime lens name', () => {
    expect(extractApertureFromModel('Sony DT 35mm f/1.8 SAM')).toBe(1.8)
  })

  it('extracts wide aperture from zoom lens name', () => {
    expect(extractApertureFromModel('Sony AF DT 55-200mm f/4-5.6 SAM')).toBe(4)
  })

  it('extracts aperture with F prefix (uppercase)', () => {
    expect(extractApertureFromModel('Canon EF 50mm F1.4 USM')).toBe(1.4)
  })

  it('extracts aperture with f/ prefix', () => {
    expect(extractApertureFromModel('Nikon AF-S 85mm f/1.4G')).toBe(1.4)
  })

  it('returns null when no aperture found', () => {
    expect(extractApertureFromModel('Unknown Lens')).toBeNull()
  })

  it('extracts from variable aperture format f/3.5-5.6', () => {
    expect(extractApertureFromModel('Canon EF-S 18-55mm f/3.5-5.6 IS')).toBe(3.5)
  })
})

// ─── classifyLensType ────────────────────────────────────────────────────────

describe('classifyLensType', () => {
  it('returns PRIME when min === max', () => {
    expect(classifyLensType(50, 50)).toBe('PRIME')
  })

  it('returns ZOOM when min !== max', () => {
    expect(classifyLensType(18, 55)).toBe('ZOOM')
  })

  it('returns PRIME when only one value', () => {
    expect(classifyLensType(35, undefined)).toBe('PRIME')
  })
})

// ─── parseLensXml ────────────────────────────────────────────────────────────

describe('parseLensXml', () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<lensdatabase version="2">
  <lens>
    <maker>Sony</maker>
    <model>Sony DT 35mm f/1.8 SAM (SAL35F18)</model>
    <model lang="en">Sony DT 35mm f/1.8 SAM</model>
    <mount>Sony Alpha</mount>
    <cropfactor>1.523</cropfactor>
    <calibration>
      <distortion model="ptlens" focal="35" a="0" b="0.00284" c="-0.01946"/>
    </calibration>
  </lens>
  <lens>
    <maker>Sony</maker>
    <model>Sony AF DT 55-200mm f/4-5.6 SAM (SAL55200-2)</model>
    <model lang="en">Sony AF DT 55-200mm f/4-5.6 SAM</model>
    <mount>Sony Alpha</mount>
    <focal min="55" max="200"/>
    <type>rectilinear</type>
    <cropfactor>1.527</cropfactor>
  </lens>
  <lens>
    <maker>Sony</maker>
    <model>No aperture lens</model>
    <mount>Sony Alpha</mount>
  </lens>
</lensdatabase>`

  it('parses lens entries from XML', () => {
    const lenses = parseLensXml(sampleXml)
    expect(lenses.length).toBeGreaterThanOrEqual(2)
  })

  it('extracts manufacturer', () => {
    const lenses = parseLensXml(sampleXml)
    expect(lenses[0].manufacturer).toBe('Sony')
  })

  it('extracts model name', () => {
    const lenses = parseLensXml(sampleXml)
    expect(lenses[0].model).toContain('35mm')
  })

  it('extracts focal length from model name for primes', () => {
    const lenses = parseLensXml(sampleXml)
    const prime = lenses.find((l) => l.model.includes('35mm'))
    expect(prime).toBeDefined()
    // Prime with no <focal> tag — focal length extracted from model name
    expect(prime!.focalLengthMinMm).toBe(35)
    expect(prime!.focalLengthMaxMm).toBe(35)
  })

  it('extracts focal length from focal tag for zooms', () => {
    const lenses = parseLensXml(sampleXml)
    const zoom = lenses.find((l) => l.model.includes('55-200'))
    expect(zoom).toBeDefined()
    expect(zoom!.focalLengthMinMm).toBe(55)
    expect(zoom!.focalLengthMaxMm).toBe(200)
  })

  it('classifies lens type', () => {
    const lenses = parseLensXml(sampleXml)
    const prime = lenses.find((l) => l.model.includes('35mm'))
    const zoom = lenses.find((l) => l.model.includes('55-200'))
    expect(prime!.lensType).toBe('PRIME')
    expect(zoom!.lensType).toBe('ZOOM')
  })

  it('extracts maxAperture from model name', () => {
    const lenses = parseLensXml(sampleXml)
    const prime = lenses.find((l) => l.model.includes('35mm'))
    expect(prime!.maxAperture).toBe(1.8)
  })

  it('skips lenses with no extractable aperture', () => {
    const lenses = parseLensXml(sampleXml)
    const noAperture = lenses.find((l) => l.model === 'No aperture lens')
    expect(noAperture).toBeUndefined()
  })

  it('generates a lensfunId from maker + model', () => {
    const lenses = parseLensXml(sampleXml)
    expect(lenses[0].lensfunId).toBeTruthy()
    expect(typeof lenses[0].lensfunId).toBe('string')
  })
})
