/**
 * Tests for ExifExtractorClient
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock exifr module
vi.mock('exifr', () => ({
  default: {
    parse: vi.fn(),
  },
}))

import exifr from 'exifr'
import { ExifExtractorClient } from '@/lib/exif-extractor-client'

describe('ExifExtractorClient', () => {
  let client: ExifExtractorClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new ExifExtractorClient()
  })

  describe('extractLensModel', () => {
    it('returns LensModel string when EXIF contains LensModel', async () => {
      ;(exifr.parse as any).mockResolvedValue({ LensModel: 'Canon EF 85mm f/1.4L IS USM' })

      const buffer = Buffer.from('fake-jpeg-data')
      const result = await client.extractLensModel(buffer)

      expect(result).toBe('Canon EF 85mm f/1.4L IS USM')
      expect(exifr.parse).toHaveBeenCalledWith(buffer, { LensModel: true })
    })

    it('returns null when EXIF does not contain LensModel', async () => {
      ;(exifr.parse as any).mockResolvedValue({ Make: 'Canon', Model: 'EOS R5' })

      const buffer = Buffer.from('fake-jpeg-data')
      const result = await client.extractLensModel(buffer)

      expect(result).toBeNull()
    })

    it('returns null when exifr.parse returns null', async () => {
      ;(exifr.parse as any).mockResolvedValue(null)

      const buffer = Buffer.from('fake-jpeg-data')
      const result = await client.extractLensModel(buffer)

      expect(result).toBeNull()
    })

    it('returns null when exifr.parse returns undefined', async () => {
      ;(exifr.parse as any).mockResolvedValue(undefined)

      const buffer = Buffer.from('fake-jpeg-data')
      const result = await client.extractLensModel(buffer)

      expect(result).toBeNull()
    })

    it('returns null when LensModel is an empty string', async () => {
      ;(exifr.parse as any).mockResolvedValue({ LensModel: '' })

      const buffer = Buffer.from('fake-jpeg-data')
      const result = await client.extractLensModel(buffer)

      expect(result).toBeNull()
    })

    it('accepts Uint8Array in addition to Buffer', async () => {
      ;(exifr.parse as any).mockResolvedValue({ LensModel: 'Nikon AF-S NIKKOR 50mm f/1.4G' })

      const uint8Array = new Uint8Array([0xff, 0xd8, 0xff])
      const result = await client.extractLensModel(uint8Array)

      expect(result).toBe('Nikon AF-S NIKKOR 50mm f/1.4G')
      expect(exifr.parse).toHaveBeenCalledWith(uint8Array, { LensModel: true })
    })

    it('returns null when exifr.parse throws an error', async () => {
      ;(exifr.parse as any).mockRejectedValue(new Error('Parse error'))

      const buffer = Buffer.from('not-a-valid-image')
      const result = await client.extractLensModel(buffer)

      expect(result).toBeNull()
    })

    it('trims whitespace from LensModel', async () => {
      ;(exifr.parse as any).mockResolvedValue({ LensModel: '  Canon EF 50mm f/1.8 STM  ' })

      const buffer = Buffer.from('fake-jpeg-data')
      const result = await client.extractLensModel(buffer)

      expect(result).toBe('Canon EF 50mm f/1.8 STM')
    })
  })
})
