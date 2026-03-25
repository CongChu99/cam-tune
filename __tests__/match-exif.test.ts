/**
 * Tests for matchExif helpers — Levenshtein fuzzy matching and string normalization.
 */
import {
  normalizeForComparison,
  computeConfidence,
  CONFIDENCE_THRESHOLD,
} from '../lib/lens-database-service'

// ─── normalizeForComparison ──────────────────────────────────────────────────

describe('normalizeForComparison', () => {
  it('lowercases', () => {
    expect(normalizeForComparison('Canon EF 50mm')).toBe('canon ef 50mm')
  })

  it('removes punctuation except /', () => {
    expect(normalizeForComparison('f/1.4L IS USM')).toBe('f/14l is usm')
  })

  it('collapses whitespace', () => {
    expect(normalizeForComparison('Canon  EF   85mm')).toBe('canon ef 85mm')
  })

  it('handles empty string', () => {
    expect(normalizeForComparison('')).toBe('')
  })

  it('preserves slash for aperture notation', () => {
    expect(normalizeForComparison('f/2.8')).toBe('f/28')
  })
})

// ─── computeConfidence ───────────────────────────────────────────────────────

describe('computeConfidence', () => {
  it('returns 1.0 for identical strings', () => {
    expect(computeConfidence('Canon EF 50mm f/1.4 USM', 'Canon EF 50mm f/1.4 USM')).toBe(1)
  })

  it('returns high confidence for minor differences', () => {
    const conf = computeConfidence(
      'Canon EF 85mm f/1.4L IS USM',
      'Canon EF85mm f/1.4L IS USM'
    )
    expect(conf).toBeGreaterThan(0.85)
  })

  it('returns low confidence for very different strings', () => {
    const conf = computeConfidence(
      'Canon EF 50mm f/1.4 USM',
      'Nikon AF-S 70-200mm f/2.8E FL VR'
    )
    expect(conf).toBeLessThan(0.5)
  })

  it('returns 0 for empty strings', () => {
    expect(computeConfidence('', '')).toBe(0)
  })

  it('is case-insensitive', () => {
    const conf = computeConfidence(
      'SONY FE 85mm F1.4 GM',
      'Sony FE 85mm f1.4 GM'
    )
    expect(conf).toBe(1)
  })
})

// ─── CONFIDENCE_THRESHOLD ────────────────────────────────────────────────────

describe('CONFIDENCE_THRESHOLD', () => {
  it('is 0.7', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.7)
  })
})
