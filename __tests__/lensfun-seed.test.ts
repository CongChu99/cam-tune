/**
 * Tests for Lensfun seed script helpers (popularity weighting, record mapping).
 */
import {
  getPopularityWeight,
  mapLensfunRecordToUpsertData,
  POPULARITY_WEIGHTS,
} from '../scripts/lensfun-seed'
import type { LensfunRecord } from '../scripts/lensfun-parse'

// ─── getPopularityWeight ─────────────────────────────────────────────────────

describe('getPopularityWeight', () => {
  it('Canon gets weight 10', () => {
    expect(getPopularityWeight('Canon')).toBe(10)
  })

  it('Nikon gets weight 9', () => {
    expect(getPopularityWeight('Nikon')).toBe(9)
  })

  it('Sony gets weight 8', () => {
    expect(getPopularityWeight('Sony')).toBe(8)
  })

  it('Fujifilm gets weight 7', () => {
    expect(getPopularityWeight('Fujifilm')).toBe(7)
  })

  it('Sigma gets weight 6', () => {
    expect(getPopularityWeight('Sigma')).toBe(6)
  })

  it('Tamron gets weight 5', () => {
    expect(getPopularityWeight('Tamron')).toBe(5)
  })

  it('case-insensitive matching', () => {
    expect(getPopularityWeight('CANON')).toBe(10)
    expect(getPopularityWeight('nikon')).toBe(9)
  })

  it('unknown manufacturer gets weight 0', () => {
    expect(getPopularityWeight('UnknownBrand')).toBe(0)
  })
})

// ─── POPULARITY_WEIGHTS ──────────────────────────────────────────────────────

describe('POPULARITY_WEIGHTS', () => {
  it('is a non-empty map', () => {
    expect(Object.keys(POPULARITY_WEIGHTS).length).toBeGreaterThan(0)
  })
})

// ─── mapLensfunRecordToUpsertData ────────────────────────────────────────────

describe('mapLensfunRecordToUpsertData', () => {
  const record: LensfunRecord = {
    lensfunId: 'sony::sony-fe-85mm-f-1-4-gm',
    manufacturer: 'Sony',
    model: 'Sony FE 85mm f/1.4 GM',
    focalLengthMinMm: 85,
    focalLengthMaxMm: 85,
    maxAperture: 1.4,
    lensType: 'PRIME',
  }

  it('maps all required fields', () => {
    const data = mapLensfunRecordToUpsertData(record)
    expect(data.lensfunId).toBe('sony::sony-fe-85mm-f-1-4-gm')
    expect(data.manufacturer).toBe('Sony')
    expect(data.model).toBe('Sony FE 85mm f/1.4 GM')
    expect(data.focalLengthMinMm).toBe(85)
    expect(data.focalLengthMaxMm).toBe(85)
    expect(data.maxAperture).toBe(1.4)
    expect(data.lensType).toBe('PRIME')
  })

  it('includes popularity weight', () => {
    const data = mapLensfunRecordToUpsertData(record)
    expect(data.popularityWeight).toBe(8) // Sony = 8
  })

  it('handles zoom lens type', () => {
    const zoom: LensfunRecord = {
      ...record,
      lensType: 'ZOOM',
      focalLengthMinMm: 24,
      focalLengthMaxMm: 70,
    }
    const data = mapLensfunRecordToUpsertData(zoom)
    expect(data.lensType).toBe('ZOOM')
    expect(data.focalLengthMinMm).toBe(24)
    expect(data.focalLengthMaxMm).toBe(70)
  })
})
