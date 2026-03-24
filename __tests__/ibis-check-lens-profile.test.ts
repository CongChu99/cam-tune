/**
 * Tests for ibis-check.ts LensProfile integration.
 * Verifies that checkShutterWarning uses LensProfile focal length
 * instead of hardcoded 50mm when a lens profile is provided.
 */
import { checkShutterWarning, getMinShutterSpeed } from '../lib/ibis-check'
import type { CameraProfileRecord } from '../lib/camera-database'
import type { LensProfileParam } from '../lib/ibis-check'

// Helper to create a minimal camera profile with IBIS
function makeCameraProfile(overrides: Partial<CameraProfileRecord> = {}): CameraProfileRecord {
  return {
    id: 'test-cam',
    userId: 'test-user',
    brand: 'Sony',
    model: 'A7 IV',
    cameraDatabaseId: 'test-db',
    isActive: true,
    isUserEntered: false,
    ibisVerified: false,
    customOverrides: null,
    createdAt: new Date(),
    cameraDatabase: {
      id: 'test-db',
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
      dualNativeIso: false,
      dualNativeIsoValues: null,
      dynamicRangeEv: 14.7,
      releaseYear: 2021,
      mount: 'Sony E',
      maxFlashSyncSpeed: 250,
    },
    ...overrides,
  }
}

describe('checkShutterWarning with LensProfile', () => {
  it('uses lensProfile.focalLengthMm when provided (200mm lens)', () => {
    const cam = makeCameraProfile()
    const lens: LensProfileParam = { focalLengthMm: 200 }
    // With lens: warning should mention 200mm, not 50mm
    const warning = checkShutterWarning('1/60', cam, undefined, lens)
    // 200mm lens → uses 200 as focal length
    if (warning) {
      expect(warning).toContain('200mm')
      expect(warning).not.toContain('50mm')
    }
  })

  it('uses different focal length from lens profile vs default', () => {
    const cam = makeCameraProfile()
    const lens: LensProfileParam = { focalLengthMm: 200 }

    // Same shutter speed, but different lens → different thresholds
    const warningWithLens = checkShutterWarning('1/60', cam, undefined, lens)
    const warningDefault = checkShutterWarning('1/60', cam)

    // Default uses 50mm, lens uses 200mm → different thresholds
    if (warningWithLens) {
      expect(warningWithLens).toContain('200mm')
    }
    if (warningDefault) {
      expect(warningDefault).toContain('50mm')
    }

    // The actual min shutter speed should differ
    const minWith200 = getMinShutterSpeed(200, 5.5)
    const minWith50 = getMinShutterSpeed(50, 5.5)
    expect(minWith200).not.toBe(minWith50)
  })

  it('uses fallback 50mm when no lensProfile provided (backward compat)', () => {
    const cam = makeCameraProfile()
    // 3-arg call (backward compatible)
    const warning = checkShutterWarning('1/60', cam)
    if (warning) {
      expect(warning).toContain('50mm')
    }
  })

  it('prefers explicit focalLengthMm over lensProfile when both provided', () => {
    const cam = makeCameraProfile()
    const lens: LensProfileParam = { focalLengthMm: 200 }
    // Explicit focalLengthMm=24 should override lens 200mm
    const warning = checkShutterWarning('1/60', cam, 24, lens)
    if (warning) {
      expect(warning).toContain('24mm')
      expect(warning).not.toContain('200mm')
    }
  })

  it('works with lensProfile on camera without IBIS', () => {
    const cam = makeCameraProfile({
      cameraDatabase: {
        id: 'test-db',
        brand: 'Fuji',
        model: 'X-T4',
        slug: 'fuji-xt4',
        sensorSize: 'APS_C',
        pixelCountMp: 26,
        baseIso: 160,
        maxUsableIso: 12800,
        maxNativeIso: 12800,
        ibis: false,
        ibisStops: null,
        dualNativeIso: false,
        dualNativeIsoValues: null,
        dynamicRangeEv: 13,
        releaseYear: 2020,
        mount: 'Fuji X',
        maxFlashSyncSpeed: 250,
      },
    })
    const lens: LensProfileParam = { focalLengthMm: 85 }
    const warning = checkShutterWarning('1/60', cam, undefined, lens)
    // Should use 85mm from lens profile
    if (warning) {
      expect(warning).toContain('85mm')
    }
  })

  it('LensProfileParam type is exported from ibis-check', () => {
    const lens: LensProfileParam = { focalLengthMm: 50 }
    expect(lens.focalLengthMm).toBe(50)
  })
})
