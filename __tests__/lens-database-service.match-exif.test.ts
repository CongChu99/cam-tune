/**
 * TDD RED tests for matchExif() — Levenshtein fuzzy match + unmatched logging.
 *
 * Phase 1: These tests are written BEFORE the implementation exists.
 * All tests are expected to FAIL until matchExif is implemented.
 */

import { matchExif } from '../lib/lens-database-service'
import prisma from '../lib/prisma'

vi.mock('../lib/prisma', () => ({
  default: {
    lensfunLens: {
      findMany: vi.fn(),
    },
    lensExifUnmatched: {
      create: vi.fn(),
    },
  },
}))

// Typed mock helpers
const mockFindMany = prisma.lensfunLens.findMany as ReturnType<typeof vi.fn>
const mockCreate = prisma.lensExifUnmatched.create as ReturnType<typeof vi.fn>

// A minimal LensfunLens shape used in tests
const makeLens = (manufacturer: string, model: string, id = 'id-1') => ({
  id,
  lensfunId: `${manufacturer}-${model}`,
  manufacturer,
  model,
  focalLengthMinMm: 50,
  focalLengthMaxMm: 50,
  maxAperture: 1.4,
  lensType: 'NORMAL',
  popularityWeight: 1,
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── a. Empty / blank input ───────────────────────────────────────────────────

describe('matchExif — empty/blank input', () => {
  it('returns null immediately for empty string', async () => {
    const result = await matchExif('', 'user-1')
    expect(result).toBeNull()
  })

  it('returns null immediately for whitespace-only string', async () => {
    const result = await matchExif('   ', 'user-1')
    expect(result).toBeNull()
  })

  it('does NOT call DB when input is empty', async () => {
    await matchExif('', 'user-1')
    expect(mockFindMany).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('does NOT call DB when input is whitespace-only', async () => {
    await matchExif('   ', 'user-1')
    expect(mockFindMany).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

// ─── b. Returns best match when confidence >= 0.7 ────────────────────────────

describe('matchExif — confident match', () => {
  it('returns { lens, confidence } when best confidence >= 0.7', async () => {
    const lens = makeLens('Canon', 'EF 50mm f/1.4 USM')
    mockFindMany.mockResolvedValueOnce([lens])

    const result = await matchExif('Canon EF 50mm f/1.4 USM', 'user-1')

    expect(result).not.toBeNull()
    expect(result!.lens).toEqual(lens)
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('does NOT log to lensExifUnmatched when a match is found', async () => {
    const lens = makeLens('Sony', 'FE 85mm F1.4 GM')
    mockFindMany.mockResolvedValueOnce([lens])

    await matchExif('Sony FE 85mm F1.4 GM', 'user-1')

    expect(mockCreate).not.toHaveBeenCalled()
  })
})

// ─── c. Below threshold: log and return null ─────────────────────────────────

describe('matchExif — below confidence threshold', () => {
  it('returns null when best confidence < 0.7', async () => {
    // A lens completely unrelated to the input
    const lens = makeLens('Nikon', 'AF-S 500mm f/5.6E PF ED VR')
    mockFindMany.mockResolvedValueOnce([lens])

    const result = await matchExif('Canon EF 50mm f/1.4', 'user-1')

    expect(result).toBeNull()
  })

  it('logs to lensExifUnmatched with rawLensModelString and userId', async () => {
    const lens = makeLens('Nikon', 'AF-S 500mm f/5.6E PF ED VR')
    mockFindMany.mockResolvedValueOnce([lens])

    await matchExif('Canon EF 50mm f/1.4', 'user-42')

    expect(mockCreate).toHaveBeenCalledOnce()
    const createArg = mockCreate.mock.calls[0][0]
    expect(createArg.data.rawLensModelString).toBe('Canon EF 50mm f/1.4')
    expect(createArg.data.userId).toBe('user-42')
  })
})

// ─── d. Picks the highest-confidence lens ────────────────────────────────────

describe('matchExif — picks best among multiple candidates', () => {
  it('returns the lens with highest confidence when multiple candidates exist', async () => {
    const lowMatch = makeLens('Nikon', 'AF-S 70-200mm f/2.8E FL VR', 'id-low')
    const highMatch = makeLens('Canon', 'EF 50mm f/1.4 USM', 'id-high')
    const midMatch = makeLens('Canon', 'EF 50mm f/1.8 STM', 'id-mid')

    mockFindMany.mockResolvedValueOnce([lowMatch, highMatch, midMatch])

    const result = await matchExif('Canon EF 50mm f/1.4 USM', 'user-1')

    expect(result).not.toBeNull()
    expect(result!.lens.id).toBe('id-high')
  })

  it('returns highest confidence value, not an averaged or arbitrary one', async () => {
    const poor = makeLens('Sigma', '150-600mm f/5-6.3 DG OS HSM', 'id-poor')
    const good = makeLens('Canon', 'EF 50mm f/1.4 USM', 'id-good')

    mockFindMany.mockResolvedValueOnce([poor, good])

    const result = await matchExif('Canon EF 50mm f/1.4 USM', 'user-1')

    expect(result!.confidence).toBeGreaterThanOrEqual(0.9)
  })
})

// ─── e. Exact match returns confidence = 1.0 (or very close) ─────────────────

describe('matchExif — exact match', () => {
  it('returns confidence of 1.0 for an exact string match', async () => {
    const lens = makeLens('Sony', 'FE 24-70mm F2.8 GM')
    mockFindMany.mockResolvedValueOnce([lens])

    const result = await matchExif('Sony FE 24-70mm F2.8 GM', 'user-1')

    expect(result).not.toBeNull()
    expect(result!.confidence).toBeCloseTo(1.0, 5)
  })

  it('returns confidence >= 0.95 for case-variant exact match', async () => {
    const lens = makeLens('Sony', 'FE 85mm F1.4 GM')
    mockFindMany.mockResolvedValueOnce([lens])

    const result = await matchExif('SONY FE 85MM F1.4 GM', 'user-1')

    expect(result).not.toBeNull()
    expect(result!.confidence).toBeGreaterThanOrEqual(0.95)
  })
})

// ─── f. userId is passed correctly to the unmatched log ──────────────────────

describe('matchExif — userId in unmatched log', () => {
  it('passes the exact userId provided to lensExifUnmatched.create', async () => {
    const lens = makeLens('Zeiss', 'Otus 1.4/55')
    mockFindMany.mockResolvedValueOnce([lens])

    const userId = 'clx9abc123def456'
    await matchExif('Canon EF 50mm f/1.4', userId)

    expect(mockCreate).toHaveBeenCalledOnce()
    const createArg = mockCreate.mock.calls[0][0]
    expect(createArg.data.userId).toBe(userId)
  })

  it('does NOT include userId in the return value (only lens + confidence)', async () => {
    const lens = makeLens('Canon', 'EF 50mm f/1.4 USM')
    mockFindMany.mockResolvedValueOnce([lens])

    const result = await matchExif('Canon EF 50mm f/1.4 USM', 'user-1')

    expect(result).not.toBeNull()
    expect(Object.keys(result!)).toEqual(expect.arrayContaining(['lens', 'confidence']))
    expect(result).not.toHaveProperty('userId')
  })
})
