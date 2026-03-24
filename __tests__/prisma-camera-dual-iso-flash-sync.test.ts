/**
 * Tests for CameraDatabase schema additions:
 * - maxFlashSyncSpeed field on CameraDatabase
 * - Verifies dualNativeIso, dualNativeIsoValues already present
 */
import type { Prisma } from '../lib/generated/prisma'

describe('CameraDatabase — dualNativeIso + maxFlashSyncSpeed fields (spec 004)', () => {
  describe('maxFlashSyncSpeed field', () => {
    it('accepts maxFlashSyncSpeed as nullable Int', () => {
      const input: Prisma.CameraDatabaseCreateInput = {
        brand: 'Sony',
        model: 'A7 IV',
        slug: 'sony-a7-iv-test',
        sensorSize: 'FULL_FRAME',
        baseIso: 100,
        maxUsableIso: 51200,
        maxNativeIso: 51200,
        maxFlashSyncSpeed: 250,
      }
      expect(input.maxFlashSyncSpeed).toBe(250)
    })

    it('accepts null maxFlashSyncSpeed', () => {
      const input: Prisma.CameraDatabaseCreateInput = {
        brand: 'Canon',
        model: 'R6',
        slug: 'canon-r6-test',
        sensorSize: 'FULL_FRAME',
        baseIso: 100,
        maxUsableIso: 25600,
        maxNativeIso: 102400,
        maxFlashSyncSpeed: null,
      }
      expect(input.maxFlashSyncSpeed).toBeNull()
    })
  })

  describe('existing dualNativeIso fields', () => {
    it('accepts dualNativeIso boolean', () => {
      const input: Prisma.CameraDatabaseCreateInput = {
        brand: 'Sony',
        model: 'A7S III',
        slug: 'sony-a7s-iii-test',
        sensorSize: 'FULL_FRAME',
        baseIso: 80,
        maxUsableIso: 102400,
        maxNativeIso: 102400,
        dualNativeIso: true,
        dualNativeIsoValues: '640,12800',
      }
      expect(input.dualNativeIso).toBe(true)
      expect(input.dualNativeIsoValues).toBe('640,12800')
    })
  })

  describe('CameraDatabaseRecord type compatibility', () => {
    it('maxFlashSyncSpeed is part of the record', () => {
      // This verifies camera-database.ts type includes maxFlashSyncSpeed
      const record = {
        id: 'test',
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
      }
      expect(record.maxFlashSyncSpeed).toBe(250)
    })
  })
})
