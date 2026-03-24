/**
 * Tests for /api/lens-profiles CRUD routes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    lensProfile: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

// Mock next-auth
vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

import prisma from '@/lib/prisma'
import { GET, POST } from '../app/api/lens-profiles/route'
import { DELETE } from '../app/api/lens-profiles/[id]/route'
import { PATCH } from '../app/api/lens-profiles/[id]/activate/route'

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

describe('/api/lens-profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/lens-profiles', () => {
    it('returns lens profiles for user', async () => {
      const mockProfiles = [
        {
          id: 'lens-1',
          cameraProfileId: 'cam-1',
          focalLengthMm: 50,
          maxAperture: 1.8,
          minAperture: 22,
          isStabilized: false,
          stabilizationStops: null,
          lensType: 'PRIME',
          source: 'MANUAL',
        },
      ]
      ;(prisma.lensProfile.findMany as any).mockResolvedValue(mockProfiles)

      const request = makeRequest('http://localhost:3000/api/lens-profiles?cameraProfileId=cam-1')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.lensProfiles).toHaveLength(1)
      expect(data.lensProfiles[0].focalLengthMm).toBe(50)
    })
  })

  describe('POST /api/lens-profiles', () => {
    it('creates a lens profile', async () => {
      const mockCreated = {
        id: 'lens-2',
        cameraProfileId: 'cam-1',
        focalLengthMm: 85,
        maxAperture: 1.4,
        minAperture: 16,
        isStabilized: false,
        stabilizationStops: null,
        lensType: 'PRIME',
        source: 'MANUAL',
      }
      ;(prisma.lensProfile.create as any).mockResolvedValue(mockCreated)

      const request = makeRequest('http://localhost:3000/api/lens-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraProfileId: 'cam-1',
          focalLengthMm: 85,
          maxAperture: 1.4,
          minAperture: 16,
          lensType: 'PRIME',
          source: 'MANUAL',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.lensProfile.focalLengthMm).toBe(85)
    })

    it('returns 400 for missing required fields', async () => {
      const request = makeRequest('http://localhost:3000/api/lens-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraProfileId: 'cam-1' }),
      })
      const response = await POST(request)
      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /api/lens-profiles/[id]', () => {
    it('deletes a lens profile', async () => {
      ;(prisma.lensProfile.findFirst as any).mockResolvedValue({ id: 'lens-1', cameraProfileId: 'cam-1' })
      ;(prisma.lensProfile.delete as any).mockResolvedValue({ id: 'lens-1' })

      const request = makeRequest('http://localhost:3000/api/lens-profiles/lens-1', { method: 'DELETE' })
      const response = await DELETE(request, { params: Promise.resolve({ id: 'lens-1' }) })

      expect(response.status).toBe(200)
    })

    it('returns 404 for non-existent profile', async () => {
      ;(prisma.lensProfile.findFirst as any).mockResolvedValue(null)

      const request = makeRequest('http://localhost:3000/api/lens-profiles/bad-id', { method: 'DELETE' })
      const response = await DELETE(request, { params: Promise.resolve({ id: 'bad-id' }) })

      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /api/lens-profiles/[id]/activate', () => {
    it('activates a lens profile (placeholder)', async () => {
      ;(prisma.lensProfile.findFirst as any).mockResolvedValue({ id: 'lens-1', cameraProfileId: 'cam-1' })

      const request = makeRequest('http://localhost:3000/api/lens-profiles/lens-1/activate', { method: 'PATCH' })
      const response = await PATCH(request, { params: Promise.resolve({ id: 'lens-1' }) })

      expect(response.status).toBe(200)
    })
  })
})
