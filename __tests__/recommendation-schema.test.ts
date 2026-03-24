/**
 * Tests for RecommendationResultSchema + isStructuredOutputSupported + buildResponseFormat.
 */
import {
  isStructuredOutputSupported,
  getRecommendationSchema,
  buildResponseFormat,
} from '../lib/recommendation-schema'

// ─── isStructuredOutputSupported ─────────────────────────────────────────────

describe('isStructuredOutputSupported', () => {
  // Supported models
  it('returns true for gpt-4o-2024-08-06', () => {
    expect(isStructuredOutputSupported('gpt-4o-2024-08-06')).toBe(true)
  })

  it('returns true for gpt-4o-2024-11-20', () => {
    expect(isStructuredOutputSupported('gpt-4o-2024-11-20')).toBe(true)
  })

  it('returns true for gpt-4o-mini', () => {
    expect(isStructuredOutputSupported('gpt-4o-mini')).toBe(true)
  })

  it('returns true for gpt-4o-mini-2024-07-18', () => {
    expect(isStructuredOutputSupported('gpt-4o-mini-2024-07-18')).toBe(true)
  })

  it('returns true for gpt-4.1', () => {
    expect(isStructuredOutputSupported('gpt-4.1')).toBe(true)
  })

  it('returns true for gpt-4.1-mini', () => {
    expect(isStructuredOutputSupported('gpt-4.1-mini')).toBe(true)
  })

  it('returns true for o1', () => {
    expect(isStructuredOutputSupported('o1')).toBe(true)
  })

  it('returns true for o1-2024-12-17', () => {
    expect(isStructuredOutputSupported('o1-2024-12-17')).toBe(true)
  })

  it('returns true for o3', () => {
    expect(isStructuredOutputSupported('o3')).toBe(true)
  })

  it('returns true for o3-mini', () => {
    expect(isStructuredOutputSupported('o3-mini')).toBe(true)
  })

  // Unsupported models
  it('returns false for gpt-3.5-turbo', () => {
    expect(isStructuredOutputSupported('gpt-3.5-turbo')).toBe(false)
  })

  it('returns false for gpt-3.5-turbo-0125', () => {
    expect(isStructuredOutputSupported('gpt-3.5-turbo-0125')).toBe(false)
  })

  it('returns false for gpt-4-0613', () => {
    expect(isStructuredOutputSupported('gpt-4-0613')).toBe(false)
  })

  it('returns false for gpt-4-0314', () => {
    expect(isStructuredOutputSupported('gpt-4-0314')).toBe(false)
  })

  it('returns false for gpt-4-turbo-preview', () => {
    expect(isStructuredOutputSupported('gpt-4-turbo-preview')).toBe(false)
  })

  // Pre-structured-output gpt-4o date
  it('returns false for gpt-4o-2024-05-13 (before structured output cutoff)', () => {
    expect(isStructuredOutputSupported('gpt-4o-2024-05-13')).toBe(false)
  })

  // Unknown models — safe default
  it('returns false for unknown model ID', () => {
    expect(isStructuredOutputSupported('some-custom-model')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isStructuredOutputSupported('')).toBe(false)
  })
})

// ─── getRecommendationSchema ─────────────────────────────────────────────────

describe('getRecommendationSchema', () => {
  it('returns a valid JSON schema object', () => {
    const schema = getRecommendationSchema()
    expect(schema).toBeDefined()
    expect(schema.type).toBe('object')
  })

  it('has sceneAnalysis property', () => {
    const schema = getRecommendationSchema()
    expect(schema.properties).toHaveProperty('sceneAnalysis')
  })

  it('has suggestions array property', () => {
    const schema = getRecommendationSchema()
    expect(schema.properties).toHaveProperty('suggestions')
    const suggestions = schema.properties!.suggestions as Record<string, unknown>
    expect(suggestions.type).toBe('array')
  })

  it('suggestion items have required fields', () => {
    const schema = getRecommendationSchema()
    const suggestions = schema.properties!.suggestions as Record<string, unknown>
    const items = suggestions.items as Record<string, unknown>
    const props = items.properties as Record<string, unknown>

    expect(props).toHaveProperty('iso')
    expect(props).toHaveProperty('aperture')
    expect(props).toHaveProperty('shutter')
    expect(props).toHaveProperty('whiteBalance')
    expect(props).toHaveProperty('meteringMode')
    expect(props).toHaveProperty('confidence')
    expect(props).toHaveProperty('primaryDriver')
  })
})

// ─── buildResponseFormat ─────────────────────────────────────────────────────

describe('buildResponseFormat', () => {
  it('returns json_schema format for supported model', () => {
    const format = buildResponseFormat('gpt-4o-2024-08-06')
    expect(format).not.toBeNull()
    expect(format!.type).toBe('json_schema')
    expect(format!.json_schema).toBeDefined()
    expect(format!.json_schema.name).toBe('recommendation_result')
  })

  it('returns null for unsupported model', () => {
    const format = buildResponseFormat('gpt-3.5-turbo')
    expect(format).toBeNull()
  })

  it('returns null for unknown model (safe default)', () => {
    const format = buildResponseFormat('custom-model-xyz')
    expect(format).toBeNull()
  })
})
