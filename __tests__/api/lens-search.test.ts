/**
 * Tests for GET /api/lens-search route.
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
  search: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import * as lensDatabaseService from '@/lib/lens-database-service'
import { GET } from '../../app/api/lens-search/route'

function makeRequest(url: string) {
  return new Request(url) as any
}

const mockSession = { user: { id: 'user-1', email: 'test@example.com' } }

const mockLenses = [
  {
    id: 'lens-1',
    lensfunId: 'canon/ef50f18',
    manufacturer: 'Canon',
    model: 'EF 50mm f/1.8 STM',
    minFocalLength: 50,
    maxFocalLength: 50,
    minAperture: 1.8,
    maxAperture: 22,
    popularityWeight: 100,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'lens-2',
    lensfunId: 'canon/ef85f18',
    manufacturer: 'Canon',
    model: 'EF 85mm f/1.8 USM',
    minFocalLength: 85,
    maxFocalLength: 85,
    minAperture: 1.8,
    maxAperture: 22,
    popularityWeight: 80,
    createdAt: new Date('2024-01-01'),
  },
]

describe('GET /api/lens-search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authentication', () => {
    it('returns 401 when not authenticated', async () => {
      ;(getServerSession as any).mockResolvedValue(null)

      const request = makeRequest('http://localhost:3000/api/lens-search?q=canon')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('input validation', () => {
    it('returns 400 when q param is missing', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)

      const request = makeRequest('http://localhost:3000/api/lens-search')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/q/)
    })

    it('returns 400 when q param is empty string', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)

      const request = makeRequest('http://localhost:3000/api/lens-search?q=')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/q/)
    })
  })

  describe('successful search', () => {
    it('returns LensfunLens[] when q is provided and authenticated', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)
      ;(lensDatabaseService.search as any).mockResolvedValue(mockLenses)

      const request = makeRequest('http://localhost:3000/api/lens-search?q=canon+50mm')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(2)
      expect(data[0].model).toBe('EF 50mm f/1.8 STM')
      expect(lensDatabaseService.search).toHaveBeenCalledWith('canon 50mm')
    })

    it('returns empty array when q yields no results', async () => {
      ;(getServerSession as any).mockResolvedValue(mockSession)
      ;(lensDatabaseService.search as any).mockResolvedValue([])

      const request = makeRequest('http://localhost:3000/api/lens-search?q=nonexistentlens')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(0)
    })
  })
})
