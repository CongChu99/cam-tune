/**
 * Tests for ibis-check zoom midpoint fallback and stabilizationWarning output.
 */
import { checkShutterWarningExtended } from '../lib/ibis-check'
import type { CameraProfileRecord } from '../lib/camera-database'
import type { LensProfileParam } from '../lib/ibis-check'

function makeCameraProfile(): CameraProfileRecord {
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
  }
}

describe('checkShutterWarningExtended — zoom midpoint fallback', () => {
  it('uses midpoint when zoom lens has no currentFocalLengthMm', () => {
    const cam = makeCameraProfile()
    const lens: LensProfileParam = {
      focalLengthMm: 70, // nominal
      focalLengthMinMm: 70,
      focalLengthMaxMm: 200,
      lensType: 'ZOOM',
    }
    const result = checkShutterWarningExtended('1/60', cam, undefined, lens)
    expect(result.estimatedFocalLength).toBe(true)
    // Midpoint = (70 + 200) / 2 = 135
    expect(result.usedFocalLengthMm).toBe(135)
  })

  it('uses actual currentFocalLengthMm when provided for zoom', () => {
    const cam = makeCameraProfile()
    const lens: LensProfileParam = {
      focalLengthMm: 70,
      focalLengthMinMm: 70,
      focalLengthMaxMm: 200,
      lensType: 'ZOOM',
      currentFocalLengthMm: 150,
    }
    const result = checkShutterWarningExtended('1/60', cam, undefined, lens)
    expect(result.estimatedFocalLength).toBe(false)
    expect(result.usedFocalLengthMm).toBe(150)
  })

  it('uses focalLengthMm for prime lens', () => {
    const cam = makeCameraProfile()
    const lens: LensProfileParam = {
      focalLengthMm: 85,
      lensType: 'PRIME',
    }
    const result = checkShutterWarningExtended('1/60', cam, undefined, lens)
    expect(result.estimatedFocalLength).toBe(false)
    expect(result.usedFocalLengthMm).toBe(85)
  })

  it('returns stabilizationWarning string when shutter speed is risky', () => {
    const cam = makeCameraProfile()
    const lens: LensProfileParam = { focalLengthMm: 200 }
    const result = checkShutterWarningExtended('1/60', cam, undefined, lens)
    expect(result.stabilizationWarning).toBeDefined()
    expect(result.stabilizationWarning).toContain('200mm')
  })

  it('returns null stabilizationWarning when shutter speed is within threshold', () => {
    const cam = makeCameraProfile()
    const lens: LensProfileParam = { focalLengthMm: 50 }
    // 50mm with 5.5-stop IBIS: min = 1/(50 * 0.022) ≈ 0.906s
    // 2s > 0.906 → no warning in existing logic
    const result = checkShutterWarningExtended('2', cam, undefined, lens)
    expect(result.stabilizationWarning).toBeNull()
  })

  it('defaults to 50mm with estimatedFocalLength=false when no lens', () => {
    const cam = makeCameraProfile()
    const result = checkShutterWarningExtended('1/60', cam)
    expect(result.estimatedFocalLength).toBe(false)
    expect(result.usedFocalLengthMm).toBe(50)
  })
})
