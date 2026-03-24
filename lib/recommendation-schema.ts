/**
 * Recommendation Result JSON Schema for OpenAI structured output.
 *
 * Provides:
 *  - getRecommendationSchema  — returns the JSON Schema for AI response validation
 *  - isStructuredOutputSupported — checks if a model ID supports response_format: json_schema
 *  - buildResponseFormat      — returns the response_format parameter or null for fallback
 */

// ─── Model support detection ─────────────────────────────────────────────────

/** Structured output cutoff date for gpt-4o models (2024-08-06) */
const STRUCTURED_OUTPUT_CUTOFF = '2024-08-06'

/**
 * Returns true if the given model ID supports OpenAI structured output
 * (response_format: { type: 'json_schema' }).
 *
 * Supported: gpt-4o-2024-08-06+, gpt-4o-mini*, gpt-4.1*, o1*, o3*
 * Unsupported: gpt-3.5*, gpt-4-0XXX, gpt-4-turbo-preview, unknown models
 */
export function isStructuredOutputSupported(modelId: string): boolean {
  if (!modelId) return false

  const id = modelId.toLowerCase()

  // gpt-3.5 — never supported
  if (id.startsWith('gpt-3.5')) return false

  // gpt-4-MMDD (legacy) — not supported
  if (/^gpt-4-0\d{3}/.test(id)) return false

  // gpt-4-turbo-preview — pre-structured-output
  if (id === 'gpt-4-turbo-preview') return false

  // gpt-4o with date suffix — check date >= 2024-08-06
  const gpt4oDateMatch = id.match(/^gpt-4o-(\d{4}-\d{2}-\d{2})/)
  if (gpt4oDateMatch) {
    return gpt4oDateMatch[1] >= STRUCTURED_OUTPUT_CUTOFF
  }

  // gpt-4o-mini — supported
  if (id.startsWith('gpt-4o-mini')) return true

  // gpt-4.1 series — supported
  if (id.startsWith('gpt-4.1')) return true

  // o1 series — supported
  if (id.startsWith('o1')) return true

  // o3 series — supported
  if (id.startsWith('o3')) return true

  // Unknown model — safe default is false
  return false
}

// ─── JSON Schema definition ──────────────────────────────────────────────────

interface JSONSchemaProperty {
  type: string | string[]
  description?: string
  items?: JSONSchemaProperty
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  enum?: string[]
  minimum?: number
  maximum?: number
  additionalProperties?: boolean
}

export interface JSONSchema {
  type: string
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  additionalProperties?: boolean
}

const explanationSchema: JSONSchemaProperty = {
  type: 'object',
  properties: {
    iso: { type: 'string', description: 'Brief explanation for ISO choice' },
    aperture: { type: 'string', description: 'Brief explanation for aperture choice' },
    shutter: { type: 'string', description: 'Brief explanation for shutter speed choice' },
    whiteBalance: { type: 'string', description: 'Brief explanation for white balance choice' },
    meteringMode: { type: 'string', description: 'Brief explanation for metering mode choice' },
  },
  required: ['iso', 'aperture', 'shutter', 'whiteBalance', 'meteringMode'],
  additionalProperties: false,
}

const suggestionSchema: JSONSchemaProperty = {
  type: 'object',
  properties: {
    iso: { type: 'integer' as string, description: 'Recommended ISO value' },
    aperture: { type: 'number', description: 'Recommended aperture f-number (e.g. 2.8)' },
    shutter: { type: 'string', description: 'Recommended shutter speed (e.g. "1/500")' },
    whiteBalance: { type: 'string', description: 'Recommended white balance preset' },
    meteringMode: { type: 'string', description: 'Recommended metering mode' },
    confidence: { type: 'number', description: 'Confidence score 0-100', minimum: 0, maximum: 100 },
    primaryDriver: { type: 'string', description: 'Which signal most influenced this recommendation' },
    explanation: explanationSchema,
  },
  required: ['iso', 'aperture', 'shutter', 'whiteBalance', 'meteringMode', 'confidence', 'primaryDriver'],
  additionalProperties: false,
}

const sceneAnalysisSchema: JSONSchemaProperty = {
  type: 'object',
  properties: {
    sceneType: { type: 'string', description: 'Detected scene type' },
    estimatedEV: { type: 'number', description: 'Estimated exposure value' },
    subjectMotion: {
      type: 'string',
      description: 'Subject motion level',
      enum: ['static', 'slow', 'fast'],
    },
    depthIntent: {
      type: 'string',
      description: 'Depth of field intent',
      enum: ['shallow', 'deep', 'neutral'],
    },
  },
  required: ['sceneType', 'estimatedEV', 'subjectMotion', 'depthIntent'],
  additionalProperties: false,
}

/**
 * Returns the JSON Schema for the AI recommendation response.
 * Used with OpenAI's response_format: { type: 'json_schema' } on supported models.
 */
export function getRecommendationSchema(): JSONSchema {
  return {
    type: 'object',
    properties: {
      sceneAnalysis: sceneAnalysisSchema,
      suggestions: {
        type: 'array',
        description: 'Exactly 3 camera setting suggestions ordered by confidence descending',
        items: suggestionSchema,
      },
    },
    required: ['sceneAnalysis', 'suggestions'],
    additionalProperties: false,
  }
}

// ─── Response format builder ─────────────────────────────────────────────────

export interface ResponseFormat {
  type: 'json_schema'
  json_schema: {
    name: string
    strict: boolean
    schema: JSONSchema
  }
}

/**
 * Returns the response_format parameter for the OpenAI API call,
 * or null if the model does not support structured output.
 *
 * When null, the caller should fall back to extractFirstJSON() parsing.
 */
export function buildResponseFormat(modelId: string): ResponseFormat | null {
  if (!isStructuredOutputSupported(modelId)) return null

  return {
    type: 'json_schema',
    json_schema: {
      name: 'recommendation_result',
      strict: true,
      schema: getRecommendationSchema(),
    },
  }
}
