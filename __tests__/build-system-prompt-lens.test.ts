/**
 * Tests for buildSystemPrompt LensProfile serialization.
 */
import { buildSystemPrompt } from '../lib/recommendation-engine'
import type { CameraProfileRecord } from '../lib/camera-database'
import type { WeatherData, SunData } from '../lib/weather-service'

function makeCameraProfile(): CameraProfileRecord {
  return {
    id: 'cam-1', userId: 'u-1', brand: 'Sony', model: 'A7 IV',
    cameraDatabaseId: 'db-1', isActive: true, isUserEntered: false,
    ibisVerified: false, customOverrides: null, createdAt: new Date(),
    cameraDatabase: {
      id: 'db-1', brand: 'Sony', model: 'A7 IV', slug: 'sony-a7-iv',
      sensorSize: 'FULL_FRAME', pixelCountMp: 33, baseIso: 100,
      maxUsableIso: 51200, maxNativeIso: 51200, ibis: true, ibisStops: 5.5,
      dualNativeIso: false, dualNativeIsoValues: null, dynamicRangeEv: 14.7,
      releaseYear: 2021, mount: 'Sony E', maxFlashSyncSpeed: 250,
    },
  }
}

const weather: WeatherData = {
  cloudCoverPct: 50, uvIndex: 5, visibilityKm: 10,
  temperature: 25, humidity: 60,
  sunrise: '06:00', sunset: '18:00',
  goldenHourStart: '17:00', goldenHourEnd: '18:30',
}

const sun: SunData = {
  altitude: 45, azimuth: 180, isGoldenHour: false, minutesToGoldenHour: 120,
}

describe('buildSystemPrompt with LensProfile', () => {
  it('includes lens info when lensProfile provided', () => {
    const prompt = buildSystemPrompt(
      makeCameraProfile(), weather, sun, 'Tokyo', 'portrait',
      {
        focalLengthMm: 85,
        maxAperture: 1.4,
        lensType: 'PRIME',
        isStabilized: false,
        stabilizationStops: null,
      }
    )
    expect(prompt).toContain('85mm')
    expect(prompt).toContain('f/1.4')
    expect(prompt).toContain('PRIME')
  })

  it('does not include lens section when no lensProfile', () => {
    const prompt = buildSystemPrompt(
      makeCameraProfile(), weather, sun, 'Tokyo', 'portrait'
    )
    expect(prompt).not.toContain('Lens:')
    expect(prompt).toContain('Sony A7 IV')
  })

  it('includes stabilization info for stabilized lens', () => {
    const prompt = buildSystemPrompt(
      makeCameraProfile(), weather, sun, 'Tokyo', 'portrait',
      {
        focalLengthMm: 70,
        maxAperture: 2.8,
        lensType: 'ZOOM',
        isStabilized: true,
        stabilizationStops: 5,
      }
    )
    expect(prompt).toContain('OIS')
    expect(prompt).toContain('5')
  })

  it('backward compatible — existing prompt structure preserved', () => {
    const prompt = buildSystemPrompt(
      makeCameraProfile(), weather, sun, 'Tokyo', 'portrait'
    )
    expect(prompt).toContain('Camera: Sony A7 IV')
    expect(prompt).toContain('IBIS: Yes')
    expect(prompt).toContain('Shoot intent: portrait')
  })
})
