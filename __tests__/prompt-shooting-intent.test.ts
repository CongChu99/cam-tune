/**
 * Tests for buildSystemPrompt shooting intent serialization.
 */
import { buildSystemPrompt } from '../lib/recommendation-engine'
import type { CameraProfileRecord } from '../lib/camera-database'
import type { WeatherData, SunData } from '../lib/weather-service'
import type { ShootingIntent } from '../types/shooting-intent'
import { inferSubjectMotion, MOTION_FLOOR_MAP } from '../types/shooting-intent'

function makeCameraProfile(): CameraProfileRecord {
  return {
    id: 'cam-1', userId: 'u-1', brand: 'Sony', model: 'A7 IV',
    cameraDatabaseId: 'db-1', isActive: true, isUserEntered: false,
    ibisVerified: false, customOverrides: null, createdAt: new Date(),
    cameraDatabase: {
      id: 'db-1', brand: 'Sony', model: 'A7 IV', slug: 'sony-a7-iv',
      sensorSize: 'FULL_FRAME', pixelCountMp: 33, baseIso: 100,
      maxUsableIso: 51200, maxNativeIso: 51200, ibis: true, ibisStops: 5.5,
      dualNativeIso: true, dualNativeIsoValues: '640,12800', dynamicRangeEv: 14.7,
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

describe('buildSystemPrompt with ShootingIntent', () => {
  it('includes shooting intent section when provided', () => {
    const intent: ShootingIntent = {
      subjectMotionSpeed: 'running',
      outputMedium: 'print_a2_plus',
      flashAvailability: 'speedlight',
    }
    const prompt = buildSystemPrompt(
      makeCameraProfile(), weather, sun, 'Tokyo', 'street',
      undefined, intent
    )
    expect(prompt).toContain('running')
    expect(prompt).toContain('print_a2_plus')
    expect(prompt).toContain('speedlight')
  })

  it('includes motion floor hint when subject is moving', () => {
    const intent: ShootingIntent = {
      subjectMotionSpeed: 'running',
    }
    const prompt = buildSystemPrompt(
      makeCameraProfile(), weather, sun, 'Tokyo', 'street',
      undefined, intent
    )
    expect(prompt).toContain('1/500')
  })

  it('backward compatible when no shooting intent', () => {
    const prompt = buildSystemPrompt(
      makeCameraProfile(), weather, sun, 'Tokyo', 'portrait'
    )
    expect(prompt).toContain('Shoot intent: portrait')
    expect(prompt).not.toContain('Subject motion')
  })
})

describe('inferSubjectMotion', () => {
  it('portrait → stationary', () => {
    expect(inferSubjectMotion('portrait')).toBe('stationary')
  })

  it('street → walking', () => {
    expect(inferSubjectMotion('street')).toBe('walking')
  })

  it('event → walking', () => {
    expect(inferSubjectMotion('event')).toBe('walking')
  })

  it('unknown → stationary', () => {
    expect(inferSubjectMotion('unknown')).toBe('stationary')
  })
})

describe('MOTION_FLOOR_MAP', () => {
  it('has correct values', () => {
    expect(MOTION_FLOOR_MAP.stationary).toBe(0)
    expect(MOTION_FLOOR_MAP.walking).toBe(250)
    expect(MOTION_FLOOR_MAP.running).toBe(500)
    expect(MOTION_FLOOR_MAP.vehicle).toBe(1000)
    expect(MOTION_FLOOR_MAP.sports).toBe(2000)
  })
})
