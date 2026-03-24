/**
 * AI Recommendation Engine — server-side helpers for the /api/recommend endpoint.
 *
 * Provides:
 *  - buildSystemPrompt  — constructs the OpenAI system prompt with camera DNA + conditions
 *  - buildUserPrompt    — constructs the user message with scene analysis + shoot intent
 *  - parseAIResponse    — parses raw OpenAI text into typed RecommendationResult
 *  - checkShutterSpeed  — wraps ibis-check for use in the recommendation flow
 */

import type { CameraProfileRecord } from './camera-database'
import type { WeatherData, SunData } from './weather-service'
import { checkShutterWarning } from './ibis-check'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShootIntent =
  | 'portrait'
  | 'landscape'
  | 'street'
  | 'event'
  | 'astro'
  | 'macro'

export interface SuggestionExplanation {
  iso: string
  aperture: string
  shutter: string
  whiteBalance: string
  meteringMode: string
}

export interface Suggestion {
  iso: number
  aperture: number
  shutter: string
  whiteBalance: string
  meteringMode: string
  confidence: number
  primaryDriver: string
  explanation?: SuggestionExplanation
  apertureClampApplied: boolean
  apertureClampNote?: string
}

/**
 * Minimal lens profile shape used by coerceSuggestion for aperture clamping.
 */
export interface LensProfileForCoercion {
  maxAperture: number
}

export interface SceneAnalysis {
  sceneType: string
  estimatedEV: number
  subjectMotion: 'static' | 'slow' | 'fast'
  depthIntent: 'shallow' | 'deep' | 'neutral'
}

export interface RecommendationResult {
  suggestions: Suggestion[]
  sceneAnalysis: SceneAnalysis
}

// ─── System prompt ────────────────────────────────────────────────────────────

// Valid shoot intents — whitelist for prompt injection prevention
const VALID_INTENTS = ['portrait', 'landscape', 'street', 'event', 'astro', 'macro', 'general'] as const

/**
 * Builds the OpenAI system prompt incorporating camera DNA and environmental context.
 */
export function buildSystemPrompt(
  cameraProfile: CameraProfileRecord,
  weather: WeatherData,
  sun: SunData,
  locationName: string,
  shootIntent?: ShootIntent
): string {
  const db = cameraProfile.cameraDatabase
  const overrides = cameraProfile.customOverrides as Record<string, unknown> | null

  // Validate shootIntent against whitelist
  const safeIntent = VALID_INTENTS.includes(shootIntent as any) ? shootIntent : 'general'

  // Camera specs — prefer DB values, allow overrides
  const brand = String(overrides?.brand ?? cameraProfile.brand)
  const model = String(overrides?.model ?? cameraProfile.model)
  const sensorSize = String(overrides?.sensorSize ?? db?.sensorSize ?? 'Unknown')
  const baseIso = Number(overrides?.baseIso ?? db?.baseIso ?? 100)
  const maxUsableIso = Number(overrides?.maxUsableIso ?? db?.maxUsableIso ?? 6400)
  const ibis = Boolean(overrides?.ibis ?? db?.ibis ?? false)
  const ibisStops = Number(overrides?.ibisStops ?? db?.ibisStops ?? 0)
  const dynamicRangeEv = Number(overrides?.dynamicRangeEv ?? db?.dynamicRangeEv ?? 12)

  const ibisDescription = ibis ? `Yes (${ibisStops} stops)` : 'No'

  const now = new Date()
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const lightCondition = sun.isGoldenHour ? 'Golden hour' : 'Normal light'

  return `You are an expert photography assistant. Analyze this scene and recommend camera settings.

Camera: ${brand} ${model}
Sensor: ${sensorSize} | Base ISO: ${baseIso} | Max usable ISO: ${maxUsableIso}
IBIS: ${ibisDescription}
Dynamic range: ${dynamicRangeEv} EV

Current conditions:
- Location: ${locationName}
- Weather: ${weather.cloudCoverPct}% clouds, UV ${weather.uvIndex}, visibility ${weather.visibilityKm}km
- Temperature: ${weather.temperature}°C, Humidity: ${weather.humidity}%
- Sun altitude: ${sun.altitude}°
- Time: ${timeString} (${lightCondition})

Shoot intent: ${safeIntent}

Return EXACTLY this JSON (no markdown, no explanation):
{
  "sceneAnalysis": {
    "sceneType": "string",
    "estimatedEV": number,
    "subjectMotion": "static|slow|fast",
    "depthIntent": "shallow|deep|neutral"
  },
  "suggestions": [
    {
      "iso": number,
      "aperture": number,
      "shutter": "string (e.g. 1/500)",
      "whiteBalance": "string",
      "meteringMode": "string",
      "confidence": number (0-100),
      "primaryDriver": "string",
      "explanation": {
        "iso": "string",
        "aperture": "string",
        "shutter": "string",
        "whiteBalance": "string",
        "meteringMode": "string"
      }
    }
  ]
}
Provide exactly 3 suggestions ordered by confidence descending.`
}

// ─── User prompt ──────────────────────────────────────────────────────────────

/**
 * Builds the user-facing message portion of the OpenAI request.
 * The actual scene frame image is injected separately as an image_url content part.
 */
export function buildUserPrompt(
  shootIntent?: ShootIntent,
  quickMode = false
): string {
  // Validate shootIntent against whitelist
  const safeIntent = VALID_INTENTS.includes(shootIntent as any) ? shootIntent : 'general'
  const intentNote = safeIntent !== 'general'
    ? `I'm shooting ${safeIntent} photography. `
    : ''

  const explanationNote = quickMode
    ? 'Omit the explanation field from each suggestion.'
    : 'Include a brief 1-sentence explanation per setting field (iso, aperture, shutter, whiteBalance, meteringMode).'

  return `${intentNote}Based on the location and environmental conditions provided, give exactly 3 camera settings recommendations ordered by confidence (highest first). ${explanationNote} Return only valid JSON, no extra text.`
}

// ─── Response parser ──────────────────────────────────────────────────────────

/**
 * Extracts the first complete JSON object from a string using bracket-depth
 * tracking. Handles leading/trailing prose, code fences, and extra text after
 * the closing brace.
 */
function extractFirstJSON(text: string): string {
  const start = text.indexOf('{')
  if (start === -1) return text.trim()

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  // Fallback: return from start to end
  return text.slice(start)
}

/**
 * Validates and coerces a raw parsed suggestion object into a typed Suggestion.
 * Optionally clamps aperture to lensProfile.maxAperture.
 * Throws if critical fields are missing or unparseable.
 *
 * @param raw           Raw suggestion object from AI response
 * @param index         Index in the suggestions array (for error messages)
 * @param lensProfile   Optional lens profile for aperture clamping
 */
export function coerceSuggestion(
  raw: Record<string, unknown>,
  index: number,
  lensProfile?: LensProfileForCoercion
): Suggestion {
  const iso = Number(raw.iso)
  let aperture = Number(raw.aperture)
  const shutter = String(raw.shutter ?? '')
  const whiteBalance = String(raw.whiteBalance ?? '')
  const meteringMode = String(raw.meteringMode ?? '')
  const confidence = Math.min(100, Math.max(0, Number(raw.confidence ?? 0)))
  const primaryDriver = String(raw.primaryDriver ?? '')

  // Validate ISO range: 50–2,000,000
  if (!iso || iso < 50 || iso > 2000000) {
    throw new Error(`Suggestion[${index}] ISO must be between 50 and 2,000,000, got ${iso}`)
  }

  // Validate aperture range: f/0.7–f/64
  if (!aperture || aperture < 0.7 || aperture > 64) {
    throw new Error(`Suggestion[${index}] aperture must be between f/0.7 and f/64, got f/${aperture}`)
  }

  // Validate shutter speed format: e.g., "1/500", "2.5", "1/8000", "2.5s"
  const shutterRegex = /^(\d+(\.\d+)?|\d+\/\d+)s?$/i
  if (!shutter || !shutterRegex.test(shutter)) {
    throw new Error(`Suggestion[${index}] shutter speed format invalid (expected "1/500", "2.5", or "1/8000s"), got "${shutter}"`)
  }

  // Aperture clamp: if AI suggests wider (lower f-number) than lens max aperture, clamp
  let apertureClampApplied = false
  let apertureClampNote: string | undefined
  const requestedAperture = aperture

  if (lensProfile && aperture < lensProfile.maxAperture) {
    aperture = lensProfile.maxAperture
    apertureClampApplied = true
    apertureClampNote = `f/${requestedAperture} requested but your lens maximum is f/${lensProfile.maxAperture}`
  }

  const suggestion: Suggestion = {
    iso,
    aperture,
    shutter,
    whiteBalance,
    meteringMode,
    confidence,
    primaryDriver,
    apertureClampApplied,
  }

  if (apertureClampNote) {
    suggestion.apertureClampNote = apertureClampNote
  }

  // Include explanation if present (learning mode)
  if (raw.explanation && typeof raw.explanation === 'object') {
    const ex = raw.explanation as Record<string, unknown>
    suggestion.explanation = {
      iso: String(ex.iso ?? ''),
      aperture: String(ex.aperture ?? ''),
      shutter: String(ex.shutter ?? ''),
      whiteBalance: String(ex.whiteBalance ?? ''),
      meteringMode: String(ex.meteringMode ?? ''),
    }
  }

  return suggestion
}

/**
 * Parses the raw OpenAI response text into a typed RecommendationResult.
 * Strips markdown fences if present, then JSON.parses.
 * Validates that exactly 3 suggestions are returned.
 */
export function parseAIResponse(raw: string): RecommendationResult {
  const cleaned = extractFirstJSON(raw)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`Failed to parse AI response as JSON: ${(err as Error).message}`)
  }

  // Validate sceneAnalysis
  const sa = parsed.sceneAnalysis as Record<string, unknown> | undefined
  if (!sa) {
    throw new Error('AI response missing sceneAnalysis field')
  }

  const sceneAnalysis: SceneAnalysis = {
    sceneType: String(sa.sceneType ?? 'unknown'),
    estimatedEV: Number(sa.estimatedEV ?? 10),
    subjectMotion: (['static', 'slow', 'fast'].includes(sa.subjectMotion as string)
      ? sa.subjectMotion
      : 'static') as SceneAnalysis['subjectMotion'],
    depthIntent: (['shallow', 'deep', 'neutral'].includes(sa.depthIntent as string)
      ? sa.depthIntent
      : 'neutral') as SceneAnalysis['depthIntent'],
  }

  // Validate suggestions array
  const rawSuggestions = parsed.suggestions
  if (!Array.isArray(rawSuggestions)) {
    throw new Error('AI response missing suggestions array')
  }

  if (rawSuggestions.length === 0) {
    throw new Error('AI returned no suggestions')
  }

  // Take top 3 (in case AI returns more), coerce each
  const suggestions: Suggestion[] = rawSuggestions
    .slice(0, 3)
    .map((s, i) => coerceSuggestion(s as Record<string, unknown>, i))

  // Ensure sorted by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence)

  return { suggestions, sceneAnalysis }
}

// ─── Shutter speed check wrapper ──────────────────────────────────────────────

/**
 * Checks all suggestions for shutter speed warnings.
 * Returns the first warning found (for the highest-confidence suggestion),
 * or null if all suggestions are safe.
 *
 * @param suggestions     Parsed suggestions from AI
 * @param cameraProfile   Camera profile with IBIS data
 * @param focalLengthMm   Focal length to check against (optional, defaults to 50mm)
 */
export function checkShutterSpeed(
  suggestions: Suggestion[],
  cameraProfile: CameraProfileRecord,
  focalLengthMm?: number
): string | null {
  for (const suggestion of suggestions) {
    const warning = checkShutterWarning(suggestion.shutter, cameraProfile, focalLengthMm)
    if (warning) return warning
  }
  return null
}
