/**
 * Tests for POST /api/recommend — Bearer token auth (additive, no web regression)
 * TDD: cam-tune-mau.2 — PHASE 1: RED
 *
 * Verifies that the recommend endpoint accepts Bearer token auth via
 * getAuthenticatedUser(), while preserving existing session-cookie behaviour.
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock @/lib/mobile-auth before any imports ─────────────────────────────────
// This is the new helper that the modified route will call instead of
// getServerSession directly.  It doesn't exist yet → tests are RED.
vi.mock('@/lib/mobile-auth', () => ({
  getAuthenticatedUser: vi.fn(),
}))

// ── Mock heavy dependencies so the route can be imported in isolation ─────────
vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    cameraProfile: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/openai-client', () => ({
  decryptApiKey: vi.fn(),
  createClient: vi.fn(),
  isOllamaMode: false,
}))

vi.mock('@/lib/weather-service', () => ({
  getLocationContext: vi.fn(),
}))

vi.mock('@/lib/recommendation-engine', () => ({
  buildSystemPrompt: vi.fn(),
  buildUserPrompt: vi.fn(),
  parseAIResponse: vi.fn(),
  checkShutterSpeed: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

// next-auth mock — should NOT be called directly by the modified route
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { NextRequest } from 'next/server'
import { POST } from '../../app/api/recommend/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecommendRequest(
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest('http://localhost/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  cameraProfileId: 'profile-uuid-123',
  lat: 10.123,
  lng: 20.456,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/recommend — auth via getAuthenticatedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no auth (no header, no session) — getAuthenticatedUser returns null', async () => {
    ;(getAuthenticatedUser as any).mockResolvedValue(null)

    const req = makeRecommendRequest(VALID_BODY)
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('calls getAuthenticatedUser with the request object', async () => {
    ;(getAuthenticatedUser as any).mockResolvedValue(null)

    const req = makeRecommendRequest(VALID_BODY)
    await POST(req)

    expect(getAuthenticatedUser).toHaveBeenCalledWith(req)
  })

  it('accepts request with valid Bearer token — proceeds past auth check', async () => {
    ;(getAuthenticatedUser as any).mockResolvedValue({
      id: 'bearer-user-id',
      email: 'bearer@example.com',
    })

    // After auth passes, the route will try to fetch user from DB and camera
    // profile — those will return null/undefined, giving a 400 or 404.
    // The point of this test is that auth was accepted (not a 401).
    const req = makeRecommendRequest(VALID_BODY, {
      Authorization: 'Bearer valid.token.here',
    })
    const res = await POST(req)

    // Must NOT be 401 — auth passed
    expect(res.status).not.toBe(401)
  })

  it('session-based auth still works — backward compatibility', async () => {
    // Simulate getAuthenticatedUser returning a user via session path
    ;(getAuthenticatedUser as any).mockResolvedValue({
      id: 'session-user-id',
      email: 'session@example.com',
    })

    // No Authorization header — purely session-based
    const req = makeRecommendRequest(VALID_BODY)
    const res = await POST(req)

    // Must NOT be 401
    expect(res.status).not.toBe(401)
  })

  it('does NOT call getServerSession directly — delegates entirely to getAuthenticatedUser', async () => {
    const { getServerSession } = await import('next-auth')
    ;(getAuthenticatedUser as any).mockResolvedValue(null)

    const req = makeRecommendRequest(VALID_BODY)
    await POST(req)

    // The route must NOT call getServerSession directly after the refactor
    expect(getServerSession).not.toHaveBeenCalled()
  })
})
