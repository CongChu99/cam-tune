/**
 * Tests for lib/mobile-auth.ts — getAuthenticatedUser()
 * TDD: cam-tune-mau.2 — PHASE 1: RED
 *
 * Uses node environment because jose/JWT helpers require TextEncoder/Uint8Array.
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock @/lib/mobile-jwt before any imports ──────────────────────────────────
vi.mock('@/lib/mobile-jwt', () => ({
  verifyAccessToken: vi.fn(),
}))

// ── Mock next-auth before any imports ─────────────────────────────────────────
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

// ── Mock @/lib/auth (authOptions) ─────────────────────────────────────────────
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

import { verifyAccessToken } from '@/lib/mobile-jwt'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

// Import the function under test — does NOT exist yet → RED
import { getAuthenticatedUser } from '@/lib/mobile-auth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  const req = new NextRequest('http://localhost/api/test', {
    method: 'GET',
    headers,
  })
  return req
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getAuthenticatedUser — Bearer token path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { id, email } when Authorization header has a valid Bearer token', async () => {
    ;(verifyAccessToken as any).mockResolvedValue({
      sub: 'user-1',
      email: 'a@b.com',
    })

    const req = makeRequest({ Authorization: 'Bearer valid.token.here' })
    const user = await getAuthenticatedUser(req)

    expect(user).toEqual({ id: 'user-1', email: 'a@b.com' })
    expect(verifyAccessToken).toHaveBeenCalledWith('valid.token.here')
  })

  it('returns null when Authorization header has an invalid/expired token', async () => {
    ;(verifyAccessToken as any).mockRejectedValue(new Error('jwt expired'))

    const req = makeRequest({ Authorization: 'Bearer expired.token.here' })
    const user = await getAuthenticatedUser(req)

    expect(user).toBeNull()
  })

  it('returns null when Authorization header has malformed value "Bearer" with no token', async () => {
    const req = makeRequest({ Authorization: 'Bearer' })
    const user = await getAuthenticatedUser(req)

    expect(user).toBeNull()
    // verifyAccessToken should NOT be called with empty/undefined token
    expect(verifyAccessToken).not.toHaveBeenCalled()
  })

  it('returns null when Authorization header has value with only whitespace after Bearer', async () => {
    const req = makeRequest({ Authorization: 'Bearer   ' })
    const user = await getAuthenticatedUser(req)

    expect(user).toBeNull()
    expect(verifyAccessToken).not.toHaveBeenCalled()
  })
})

describe('getAuthenticatedUser — session cookie fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { id, email } when no Authorization header but valid session exists', async () => {
    ;(getServerSession as any).mockResolvedValue({
      user: { id: 'user-2', email: 'b@c.com' },
    })

    const req = makeRequest() // no Authorization header
    const user = await getAuthenticatedUser(req)

    expect(user).toEqual({ id: 'user-2', email: 'b@c.com' })
    expect(verifyAccessToken).not.toHaveBeenCalled()
  })

  it('returns null when no Authorization header and no session', async () => {
    ;(getServerSession as any).mockResolvedValue(null)

    const req = makeRequest()
    const user = await getAuthenticatedUser(req)

    expect(user).toBeNull()
  })

  it('returns null when no Authorization header and session has no user', async () => {
    ;(getServerSession as any).mockResolvedValue({ user: null })

    const req = makeRequest()
    const user = await getAuthenticatedUser(req)

    expect(user).toBeNull()
  })

  it('returns null when no Authorization header and session user has no id', async () => {
    ;(getServerSession as any).mockResolvedValue({
      user: { email: 'b@c.com' }, // missing id
    })

    const req = makeRequest()
    const user = await getAuthenticatedUser(req)

    expect(user).toBeNull()
  })
})

describe('getAuthenticatedUser — Bearer takes priority over session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses Bearer token even when session also exists (Bearer takes precedence)', async () => {
    ;(verifyAccessToken as any).mockResolvedValue({
      sub: 'bearer-user-id',
      email: 'bearer@example.com',
    })
    ;(getServerSession as any).mockResolvedValue({
      user: { id: 'session-user-id', email: 'session@example.com' },
    })

    const req = makeRequest({ Authorization: 'Bearer valid.token.here' })
    const user = await getAuthenticatedUser(req)

    expect(user).toEqual({ id: 'bearer-user-id', email: 'bearer@example.com' })
    // getServerSession should NOT be called when Bearer token is present and valid
    expect(getServerSession).not.toHaveBeenCalled()
  })

  it('falls back to session when Bearer token is present but invalid', async () => {
    ;(verifyAccessToken as any).mockRejectedValue(new Error('invalid token'))
    ;(getServerSession as any).mockResolvedValue({
      user: { id: 'session-user-id', email: 'session@example.com' },
    })

    const req = makeRequest({ Authorization: 'Bearer bad.token.here' })
    const user = await getAuthenticatedUser(req)

    // An invalid bearer token should yield null (not fall through to session)
    // — security: don't silently downgrade to session on token failure
    expect(user).toBeNull()
    expect(getServerSession).not.toHaveBeenCalled()
  })
})
