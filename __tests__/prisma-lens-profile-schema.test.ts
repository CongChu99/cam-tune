/**
 * RED test: Verifies LensProfile model has the new optical fields
 * and LensType/LensSource enums exist in the Prisma generated client.
 *
 * This test will FAIL until prisma/schema.prisma is updated and
 * `npx prisma generate` is run.
 */
import { LensType, LensSource } from '../lib/generated/prisma'
import type { Prisma } from '../lib/generated/prisma'

describe('LensProfile optical fields — schema spec 001', () => {
  describe('LensType enum', () => {
    it('has PRIME value', () => {
      expect(LensType.PRIME).toBe('PRIME')
    })

    it('has ZOOM value', () => {
      expect(LensType.ZOOM).toBe('ZOOM')
    })

    it('has exactly 2 values', () => {
      expect(Object.keys(LensType)).toHaveLength(2)
    })
  })

  describe('LensSource enum', () => {
    it('has LENSFUN value', () => {
      expect(LensSource.LENSFUN).toBe('LENSFUN')
    })

    it('has EXIF value', () => {
      expect(LensSource.EXIF).toBe('EXIF')
    })

    it('has MANUAL value', () => {
      expect(LensSource.MANUAL).toBe('MANUAL')
    })

    it('has exactly 3 values', () => {
      expect(Object.keys(LensSource)).toHaveLength(3)
    })
  })

  describe('LensProfile model type', () => {
    it('accepts focalLengthMinMm as nullable Int', () => {
      const input: Prisma.LensProfileCreateInput = {
        focalLengthMm: 50,
        maxAperture: 1.8,
        minAperture: 22,
        focalLengthMinMm: null,
        cameraProfile: { connect: { id: 'test-id' } },
      }
      expect(input.focalLengthMinMm).toBeNull()
    })

    it('accepts focalLengthMaxMm as nullable Int', () => {
      const input: Prisma.LensProfileCreateInput = {
        focalLengthMm: 50,
        maxAperture: 1.8,
        minAperture: 22,
        focalLengthMaxMm: null,
        cameraProfile: { connect: { id: 'test-id' } },
      }
      expect(input.focalLengthMaxMm).toBeNull()
    })

    it('accepts isVariableAperture with default false', () => {
      const input: Prisma.LensProfileCreateInput = {
        focalLengthMm: 18,
        maxAperture: 3.5,
        minAperture: 22,
        isVariableAperture: false,
        cameraProfile: { connect: { id: 'test-id' } },
      }
      expect(input.isVariableAperture).toBe(false)
    })

    it('accepts maxApertureTele as nullable Decimal', () => {
      const input: Prisma.LensProfileCreateInput = {
        focalLengthMm: 18,
        maxAperture: 3.5,
        minAperture: 22,
        isVariableAperture: true,
        maxApertureTele: 5.6,
        cameraProfile: { connect: { id: 'test-id' } },
      }
      expect(input.maxApertureTele).toBe(5.6)
    })

    it('accepts lensType as nullable LensType enum', () => {
      const input: Prisma.LensProfileCreateInput = {
        focalLengthMm: 50,
        maxAperture: 1.8,
        minAperture: 22,
        lensType: LensType.PRIME,
        cameraProfile: { connect: { id: 'test-id' } },
      }
      expect(input.lensType).toBe('PRIME')
    })

    it('accepts lensfunId as nullable String', () => {
      const input: Prisma.LensProfileCreateInput = {
        focalLengthMm: 50,
        maxAperture: 1.8,
        minAperture: 22,
        lensfunId: 'sony/sel50f18f',
        cameraProfile: { connect: { id: 'test-id' } },
      }
      expect(input.lensfunId).toBe('sony/sel50f18f')
    })

    it('accepts source as nullable LensSource enum', () => {
      const input: Prisma.LensProfileCreateInput = {
        focalLengthMm: 50,
        maxAperture: 1.8,
        minAperture: 22,
        source: LensSource.LENSFUN,
        cameraProfile: { connect: { id: 'test-id' } },
      }
      expect(input.source).toBe('LENSFUN')
    })
  })
})
