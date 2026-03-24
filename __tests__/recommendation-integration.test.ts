/**
 * Integration test — full recommendation flow with all signals:
 * lens profile + shooting intent + camera profile + structured output.
 *
 * Tests the complete chain:
 *   buildSystemPrompt → (mock AI) → parseAIResponse → runSuggestionPipeline → buildResponseFormat
 */
import { buildSystemPrompt, parseAIResponse } from '../lib/recommendation-engine'
import { runSuggestionPipeline } from '../lib/suggestion-pipeline'
import { buildResponseFormat, isStructuredOutputSupported } from '../lib/recommendation-schema'
import type { CameraProfileRecord } from '../lib/camera-database'
import type { WeatherData, SunData } from '../lib/weather-service'
import type { ShootingIntent } from '../types/shooting-intent'
import type { LensProfileForPrompt } from '../lib/recommendation-engine'
import type { PipelineContext } from '../lib/suggestion-pipeline'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCameraProfile(overrides?: Partial<CameraProfileRecord['cameraDatabase']>): CameraProfileRecord {
  return {
    id: 'cam-1',
    userId: 'u-1',
    brand: 'Sony',
    model: 'A7 IV',
    cameraDatabaseId: 'db-1',
    isActive: true,
    isUserEntered: false,
    ibisVerified: false,
    customOverrides: null,
    createdAt: new Date(),
    cameraDatabase: {
      id: 'db-1',
      brand: 'Sony',
      model: 'A7 IV',
      slug: 'sony-a7-iv',
      sensorSize: 'FULL_FRAME',
      pixelCountMp: 33,
      baseIso: 100,
      maxUsableIso: 51200,
      maxNativeIso: 51200,
      ibis: true,
      ibisStops: 5.5,
      dualNativeIso: true,
      dualNativeIsoValues: '640,12800',
      dynamicRangeEv: 14.7,
      releaseYear: 2021,
      mount: 'Sony E',
      maxFlashSyncSpeed: 250,
      ...overrides,
    },
  }
}

const weather: WeatherData = {
  cloudCoverPct: 50,
  uvIndex: 5,
  visibilityKm: 10,
  temperature: 25,
  humidity: 60,
  sunrise: '06:00',
  sunset: '18:00',
  goldenHourStart: '17:00',
  goldenHourEnd: '18:30',
}

const sun: SunData = {
  altitude: 45,
  azimuth: 180,
  isGoldenHour: false,
  minutesToGoldenHour: 120,
}

const lensProfile: LensProfileForPrompt = {
  focalLengthMm: 85,
  maxAperture: 1.4,
  lensType: 'PRIME',
  isStabilized: true,
  stabilizationStops: 5,
}

const shootingIntent: ShootingIntent = {
  subjectMotionSpeed: 'walking',
  outputMedium: 'print_a2_plus',
  flashAvailability: 'none',
}

// Mock AI response matching the expected schema
const mockAIResponse = JSON.stringify({
  sceneAnalysis: {
    sceneType: 'outdoor_daylight',
    estimatedEV: 13,
    subjectMotion: 'slow',
    depthIntent: 'shallow',
  },
  suggestions: [
    {
      iso: 100,
      aperture: 1.4,
      shutter: '1/2000',
      whiteBalance: 'Daylight',
      meteringMode: 'Matrix',
      confidence: 95,
      primaryDriver: 'Ambient light abundance',
      explanation: {
        iso: 'Base ISO for maximum dynamic range',
        aperture: 'Wide open for shallow DOF portrait look',
        shutter: 'Fast enough to freeze walking subject',
        whiteBalance: 'Daylight for outdoor sunny conditions',
        meteringMode: 'Matrix for even exposure across frame',
      },
    },
    {
      iso: 200,
      aperture: 2.0,
      shutter: '1/1000',
      whiteBalance: 'Daylight',
      meteringMode: 'Center-weighted',
      confidence: 80,
      primaryDriver: 'Balance of DOF and sharpness',
    },
    {
      iso: 640,
      aperture: 2.8,
      shutter: '1/500',
      whiteBalance: 'Auto',
      meteringMode: 'Spot',
      confidence: 65,
      primaryDriver: 'Dual native ISO base for optimal noise',
    },
  ],
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Full recommendation integration', () => {
  describe('buildSystemPrompt with all signals', () => {
    it('includes camera specs', () => {
      const prompt = buildSystemPrompt(
        makeCameraProfile(), weather, sun, 'Tokyo', 'portrait', lensProfile, shootingIntent
      )
      expect(prompt).toContain('Sony A7 IV')
      expect(prompt).toContain('FULL_FRAME')
      expect(prompt).toContain('Base ISO: 100')
      expect(prompt).toContain('Max usable ISO: 51200')
      expect(prompt).toContain('IBIS: Yes (5.5 stops)')
    })

    it('includes lens profile', () => {
      const prompt = buildSystemPrompt(
        makeCameraProfile(), weather, sun, 'Tokyo', 'portrait', lensProfile, shootingIntent
      )
      expect(prompt).toContain('85mm')
      expect(prompt).toContain('f/1.4')
      expect(prompt).toContain('PRIME')
      expect(prompt).toContain('OIS: Yes (5 stops)')
    })

    it('includes all shooting intent fields', () => {
      const prompt = buildSystemPrompt(
        makeCameraProfile(), weather, sun, 'Tokyo', 'portrait', lensProfile, shootingIntent
      )
      expect(prompt).toContain('walking')
      expect(prompt).toContain('print_a2_plus')
      expect(prompt).toContain('none')
    })

    it('includes motion floor hint for walking', () => {
      const prompt = buildSystemPrompt(
        makeCameraProfile(), weather, sun, 'Tokyo', 'portrait', lensProfile, shootingIntent
      )
      expect(prompt).toContain('1/250')
    })

    it('includes weather and location', () => {
      const prompt = buildSystemPrompt(
        makeCameraProfile(), weather, sun, 'Tokyo', 'portrait', lensProfile, shootingIntent
      )
      expect(prompt).toContain('Tokyo')
      expect(prompt).toContain('50% clouds')
      expect(prompt).toContain('UV 5')
    })
  })

  describe('parseAIResponse', () => {
    it('parses mock AI response into typed result', () => {
      const result = parseAIResponse(mockAIResponse)
      expect(result.sceneAnalysis.sceneType).toBe('outdoor_daylight')
      expect(result.sceneAnalysis.estimatedEV).toBe(13)
      expect(result.suggestions).toHaveLength(3)
      expect(result.suggestions[0].confidence).toBe(95)
      expect(result.suggestions[0].iso).toBe(100)
    })

    it('sorts suggestions by confidence descending', () => {
      const result = parseAIResponse(mockAIResponse)
      expect(result.suggestions[0].confidence).toBeGreaterThanOrEqual(result.suggestions[1].confidence)
      expect(result.suggestions[1].confidence).toBeGreaterThanOrEqual(result.suggestions[2].confidence)
    })

    it('preserves explanation fields', () => {
      const result = parseAIResponse(mockAIResponse)
      expect(result.suggestions[0].explanation).toBeDefined()
      expect(result.suggestions[0].explanation!.iso).toContain('Base ISO')
    })
  })

  describe('runSuggestionPipeline with full context', () => {
    const pipelineContext: PipelineContext = {
      lensProfile: {
        maxAperture: 1.4,
      },
      camera: {
        sensorSize: 'FULL_FRAME',
        maxFlashSyncSpeed: 250,
        dualNativeIso: true,
        dualNativeIsoValues: '640,12800',
        ibis: true,
        ibisStops: 5.5,
      },
      flashAvailability: 'none',
      outputMedium: 'print_a2_plus',
    }

    it('applies aperture clamp when AI suggests wider than lens max', () => {
      const raw = {
        iso: 100,
        aperture: 1.2, // wider than f/1.4
        shutter: '1/2000',
        whiteBalance: 'Daylight',
        meteringMode: 'Matrix',
        confidence: 90,
        primaryDriver: 'Test',
      }
      const result = runSuggestionPipeline(raw, 0, pipelineContext)
      expect(result.suggestion.aperture).toBe(1.4)
      expect(result.suggestion.apertureClampApplied).toBe(true)
      expect(result.suggestion.apertureClampNote).toContain('f/1.4')
    })

    it('does not clamp when aperture is within lens max', () => {
      const raw = {
        iso: 100,
        aperture: 2.8,
        shutter: '1/1000',
        whiteBalance: 'Daylight',
        meteringMode: 'Matrix',
        confidence: 80,
        primaryDriver: 'Test',
      }
      const result = runSuggestionPipeline(raw, 0, pipelineContext)
      expect(result.suggestion.aperture).toBe(2.8)
      expect(result.suggestion.apertureClampApplied).toBe(false)
    })

    it('detects dual native ISO', () => {
      const raw = {
        iso: 640,
        aperture: 2.8,
        shutter: '1/500',
        whiteBalance: 'Auto',
        meteringMode: 'Matrix',
        confidence: 70,
        primaryDriver: 'Test',
      }
      const result = runSuggestionPipeline(raw, 0, pipelineContext)
      expect(result.dualNativeIsoApplied).toBe(true)
      expect(result.dualNativeIsoHint).toBeTruthy()
      expect(result.dualNativeIsoHint).toContain('640')
    })

    it('no flash sync warning when flash is none', () => {
      const raw = {
        iso: 100,
        aperture: 2.8,
        shutter: '1/4000',
        whiteBalance: 'Daylight',
        meteringMode: 'Matrix',
        confidence: 90,
        primaryDriver: 'Test',
      }
      const result = runSuggestionPipeline(raw, 0, pipelineContext)
      expect(result.flashSyncWarning).toBeNull()
    })

    it('fires flash sync warning for speedlight with fast shutter', () => {
      const contextWithFlash: PipelineContext = {
        ...pipelineContext,
        flashAvailability: 'speedlight',
      }
      const raw = {
        iso: 100,
        aperture: 2.8,
        shutter: '1/4000',
        whiteBalance: 'Daylight',
        meteringMode: 'Matrix',
        confidence: 90,
        primaryDriver: 'Test',
      }
      const result = runSuggestionPipeline(raw, 0, contextWithFlash)
      expect(result.flashSyncWarning).toBeTruthy()
    })

    it('fires diffraction warning for print_a2_plus + FULL_FRAME at f/22', () => {
      const raw = {
        iso: 100,
        aperture: 22,
        shutter: '1/30',
        whiteBalance: 'Daylight',
        meteringMode: 'Matrix',
        confidence: 70,
        primaryDriver: 'Test',
      }
      const result = runSuggestionPipeline(raw, 0, pipelineContext)
      expect(result.diffractionWarning).toBeTruthy()
    })

    it('no diffraction warning for web output', () => {
      const webContext: PipelineContext = {
        ...pipelineContext,
        outputMedium: 'web_1080p',
      }
      const raw = {
        iso: 100,
        aperture: 22,
        shutter: '1/30',
        whiteBalance: 'Daylight',
        meteringMode: 'Matrix',
        confidence: 70,
        primaryDriver: 'Test',
      }
      const result = runSuggestionPipeline(raw, 0, webContext)
      expect(result.diffractionWarning).toBeNull()
    })
  })

  describe('buildResponseFormat integration', () => {
    it('uses structured output for compatible model', () => {
      const format = buildResponseFormat('gpt-4o-2024-08-06')
      expect(format).not.toBeNull()
      expect(format!.type).toBe('json_schema')
    })

    it('falls back to null for incompatible model', () => {
      const format = buildResponseFormat('gpt-3.5-turbo')
      expect(format).toBeNull()
    })

    it('isStructuredOutputSupported consistent with buildResponseFormat', () => {
      const models = ['gpt-4o-2024-08-06', 'gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4-0613']
      for (const model of models) {
        const supported = isStructuredOutputSupported(model)
        const format = buildResponseFormat(model)
        expect(format !== null).toBe(supported)
      }
    })
  })

  describe('end-to-end: prompt → parse → pipeline', () => {
    it('full flow produces valid results', () => {
      // 1. Build prompt
      const prompt = buildSystemPrompt(
        makeCameraProfile(), weather, sun, 'Tokyo', 'portrait', lensProfile, shootingIntent
      )
      expect(prompt).toBeTruthy()

      // 2. Parse mock AI response
      const parsed = parseAIResponse(mockAIResponse)
      expect(parsed.suggestions).toHaveLength(3)

      // 3. Run each suggestion through the pipeline
      const pipelineContext: PipelineContext = {
        lensProfile: { maxAperture: 1.4 },
        camera: {
          sensorSize: 'FULL_FRAME',
          maxFlashSyncSpeed: 250,
          dualNativeIso: true,
          dualNativeIsoValues: '640,12800',
          ibis: true,
          ibisStops: 5.5,
        },
        flashAvailability: 'none',
        outputMedium: 'print_a2_plus',
      }

      const results = parsed.suggestions.map((s, i) => {
        const raw = {
          iso: s.iso,
          aperture: s.aperture,
          shutter: s.shutter,
          whiteBalance: s.whiteBalance,
          meteringMode: s.meteringMode,
          confidence: s.confidence,
          primaryDriver: s.primaryDriver,
          explanation: s.explanation,
        }
        return runSuggestionPipeline(raw as Record<string, unknown>, i, pipelineContext)
      })

      // All 3 pass through pipeline
      expect(results).toHaveLength(3)

      // No aperture clamp needed (all within f/1.4)
      expect(results[0].suggestion.apertureClampApplied).toBe(false)

      // Third suggestion at ISO 640 should trigger dual native ISO hint
      expect(results[2].dualNativeIsoApplied).toBe(true)

      // No flash sync warnings (flash = none)
      results.forEach((r) => {
        expect(r.flashSyncWarning).toBeNull()
      })
    })
  })
})
