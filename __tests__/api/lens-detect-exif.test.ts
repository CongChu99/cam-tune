/**
 * Tests for POST /api/lens-detect-exif route.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next-auth
vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

// Mock the lens-database-service
vi.mock('@/lib/lens-database-service', () => ({
  matchExif: vi.fn(),
}))

// Mock the ExifExtractorClient
vi.mock('@/lib/exif-extractor-client', () => {
  const MockExifExtractorClient = vi.fn()
  return { ExifExtractorClient: MockExifExtractorClient }
})

import { getServerSession } from 'next-auth'
import * as lensDatabaseService from '@/lib/lens-database-service'
import { ExifExtractorClient } from '@/lib/exif-extractor-client'
import { POST } from '../../app/api/lens-detect-exif/route'

const mockSession = { user: { id: 'user-123', email: 'test@example.com' } }

const mockMatchedLens = {
  id: 'lens-1',
  lensfunId: 'canon/ef85f14l',
  manufacturer: 'Canon',
  model: 'EF 85mm f/1.4L IS USM',
  focalLengthMinMm: 85,
  focalLengthMaxMm: 85,
  maxAperture: 1.4,
  lensType: 'normal',
  popularityWeight: 100,
}

function makeMultipartRequest(file: File | null) {
  const formData = new FormData()
  if (file) {
    formData.append('image', file)
  }
  return new Request('http://localhost:3000/api/lens-detect-exif', {
    method: 'POST',
    body: formData,
  }) as any
}

describe('POST /api/lens-detect-exif', () => {
  let mockExtractLensModel: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractLensModel = vi.fn()
    ;(ExifExtractorClient as any).mockImplementation(function (this: any) {
      this.extractLensModel = mockExtractLensModel
    })
  })

  describe('authentication', () => {
    it('returns 401 when not authenticated', async () => {
      ;(getServerSession as any).mockResolvedValue(null)

      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })
      const request = makeMultipartRequest(file)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('input validation', () => {
    it('returns 400 when no image is provided', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)

      const request = makeMultipartRequest(null)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No image provided')
    })

    it('returns 400 when file exceeds 20 MB size limit', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)

      // Mock request.formData() to return a File-like object with large size
      const bigFile = { size: 21 * 1024 * 1024, type: 'image/jpeg', arrayBuffer: vi.fn() }
      const mockFormData = { get: vi.fn().mockReturnValue(bigFile) }
      const request = {
        formData: vi.fn().mockResolvedValue(mockFormData),
      } as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('File too large')
    })

    it('returns 400 when file type is not an allowed image type', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)

      const file = new File(['<script>alert(1)</script>'], 'evil.html', { type: 'text/html' })
      const request = makeMultipartRequest(file)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Unsupported file type')
    })

    it('returns 400 when image has no LensModel in EXIF', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)
      mockExtractLensModel.mockResolvedValue(null)

      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })
      const request = makeMultipartRequest(file)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No LensModel found in EXIF')
    })
  })

  describe('successful match', () => {
    it('returns matched lens with confidence when EXIF matches', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)
      mockExtractLensModel.mockResolvedValue('Canon EF 85mm f/1.4L IS USM')
      ;(lensDatabaseService.matchExif as any).mockResolvedValue({
        lens: mockMatchedLens,
        confidence: 0.95,
      })

      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })
      const request = makeMultipartRequest(file)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.matched).toEqual(mockMatchedLens)
      expect(data.confidence).toBe(0.95)
      expect(data.rawLensModelString).toBe('Canon EF 85mm f/1.4L IS USM')
      expect(lensDatabaseService.matchExif).toHaveBeenCalledWith(
        'Canon EF 85mm f/1.4L IS USM',
        'user-123'
      )
    })
  })

  describe('no match', () => {
    it('returns matched:null when confidence is below threshold', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)
      mockExtractLensModel.mockResolvedValue('Unknown 50mm Cheap Lens')
      ;(lensDatabaseService.matchExif as any).mockResolvedValue(null)

      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })
      const request = makeMultipartRequest(file)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.matched).toBeNull()
      expect(data.rawLensModelString).toBe('Unknown 50mm Cheap Lens')
      expect(lensDatabaseService.matchExif).toHaveBeenCalledWith(
        'Unknown 50mm Cheap Lens',
        'user-123'
      )
    })
  })

  describe('buffer handling', () => {
    it('passes the image buffer from form data to ExifExtractorClient', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)
      mockExtractLensModel.mockResolvedValue('Canon EF 50mm f/1.8 STM')
      ;(lensDatabaseService.matchExif as any).mockResolvedValue({
        lens: mockMatchedLens,
        confidence: 0.88,
      })

      const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe1])
      const file = new File([imageData], 'photo.jpg', { type: 'image/jpeg' })
      const request = makeMultipartRequest(file)
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockExtractLensModel).toHaveBeenCalledOnce()
      const calledWith = mockExtractLensModel.mock.calls[0][0]
      expect(calledWith).toBeInstanceOf(Buffer)
    })
  })

  describe('error handling', () => {
    it('returns 500 when matchExif throws unexpectedly', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)
      mockExtractLensModel.mockResolvedValue('Canon EF 50mm f/1.8 STM')
      ;(lensDatabaseService.matchExif as any).mockRejectedValue(new Error('DB connection failed'))

      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })
      const request = makeMultipartRequest(file)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('returns 500 when extractLensModel throws unexpectedly', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)
      mockExtractLensModel.mockRejectedValue(new Error('EXIF parse error'))

      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' })
      const request = makeMultipartRequest(file)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})
