/**
 * Tests for LensDatabaseService search helpers.
 */
import {
  sanitizeSearchQuery,
  buildSearchConditions,
  MAX_SEARCH_RESULTS,
} from '../lib/lens-database-service'

// ─── sanitizeSearchQuery ─────────────────────────────────────────────────────

describe('sanitizeSearchQuery', () => {
  it('trims whitespace', () => {
    expect(sanitizeSearchQuery('  canon  ')).toBe('canon')
  })

  it('removes special characters', () => {
    expect(sanitizeSearchQuery('canon%50mm')).toBe('canon50mm')
  })

  it('allows alphanumeric, spaces, hyphens, dots, slashes', () => {
    expect(sanitizeSearchQuery('Canon EF 50mm f/1.4')).toBe('Canon EF 50mm f/1.4')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeSearchQuery('')).toBe('')
  })

  it('collapses multiple spaces', () => {
    expect(sanitizeSearchQuery('Canon   EF   50mm')).toBe('Canon EF 50mm')
  })

  it('allows parentheses', () => {
    expect(sanitizeSearchQuery('Sony (SAL35F18)')).toBe('Sony (SAL35F18)')
  })
})

// ─── buildSearchConditions ───────────────────────────────────────────────────

describe('buildSearchConditions', () => {
  it('generates AND conditions for multi-word query', () => {
    const conditions = buildSearchConditions('canon 50mm')
    expect(conditions).toBeDefined()
    expect(conditions.AND).toBeDefined()
    expect(conditions.AND!.length).toBe(2)
    // Each AND entry has OR for manufacturer/model match
    expect(conditions.AND![0].OR).toBeDefined()
  })

  it('splits query into words for ILIKE matching', () => {
    const conditions = buildSearchConditions('sony 85mm')
    // Should contain conditions matching both words
    expect(JSON.stringify(conditions)).toContain('sony')
    expect(JSON.stringify(conditions)).toContain('85mm')
  })

  it('returns conditions for single word', () => {
    const conditions = buildSearchConditions('nikon')
    expect(conditions.OR).toBeDefined()
  })
})

// ─── MAX_SEARCH_RESULTS ─────────────────────────────────────────────────────

describe('MAX_SEARCH_RESULTS', () => {
  it('is 20', () => {
    expect(MAX_SEARCH_RESULTS).toBe(20)
  })
})
