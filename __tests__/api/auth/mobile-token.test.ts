/**
 * Tests for POST /api/auth/mobile/token and POST /api/auth/mobile/refresh routes.
 * TDD: cam-tune-mau.1
 *
 * Uses node environment because jose's webapi distribution relies on the native
 * Uint8Array constructor and TextEncoder, which behave differently in jsdom.
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma before any imports
vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}))

import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { POST as tokenPOST } from '../../../app/api/auth/mobile/token/route'
import { POST as refreshPOST } from '../../../app/api/auth/mobile/refresh/route'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../../lib/mobile-jwt'

const TEST_SECRET = 'test-secret-at-least-32-chars-long-for-jwt'

const mockUser = {
  id: 'user-abc-123',
  email: 'user@example.com',
  name: 'Test User',
  passwordHash: '$2a$10$hashedpassword',
}

function makeJsonRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

describe('lib/mobile-jwt helpers', () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = TEST_SECRET
  })

  it('signAccessToken returns a JWT string', async () => {
    const token = await signAccessToken('user-123', 'user@example.com')
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('signRefreshToken returns a JWT string', async () => {
    const token = await signRefreshToken('user-123')
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('verifyRefreshToken returns payload for valid token', async () => {
    const token = await signRefreshToken('user-123')
    const payload = await verifyRefreshToken(token)
    expect(payload.sub).toBe('user-123')
  })

  it('verifyRefreshToken throws for invalid token', async () => {
    await expect(verifyRefreshToken('not.a.valid.jwt')).rejects.toThrow()
  })

  it('access token has 15-minute TTL', async () => {
    const token = await signAccessToken('user-123', 'user@example.com')
    // Decode payload (base64url middle segment)
    const payloadB64 = token.split('.')[1]
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
    const ttlSeconds = payload.exp - payload.iat
    expect(ttlSeconds).toBe(15 * 60)
  })

  it('refresh token has 30-day TTL', async () => {
    const token = await signRefreshToken('user-123')
    const payloadB64 = token.split('.')[1]
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
    const ttlSeconds = payload.exp - payload.iat
    expect(ttlSeconds).toBe(30 * 24 * 60 * 60)
  })
})

describe('POST /api/auth/mobile/token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXTAUTH_SECRET = TEST_SECRET
  })

  it('returns 400 { error: "missing_fields" } when email is missing', async () => {
    const req = makeJsonRequest('http://localhost/api/auth/mobile/token', {
      password: 'somepassword',
    })
    const res = await tokenPOST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('missing_fields')
  })

  it('returns 400 { error: "missing_fields" } when password is missing', async () => {
    const req = makeJsonRequest('http://localhost/api/auth/mobile/token', {
      email: 'user@example.com',
    })
    const res = await tokenPOST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('missing_fields')
  })

  it('returns 400 { error: "missing_fields" } when both fields are missing', async () => {
    const req = makeJsonRequest('http://localhost/api/auth/mobile/token', {})
    const res = await tokenPOST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('missing_fields')
  })

  it('returns 401 { error: "invalid_grant" } when user not found', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(null)

    const req = makeJsonRequest('http://localhost/api/auth/mobile/token', {
      email: 'noexist@example.com',
      password: 'wrongpass',
    })
    const res = await tokenPOST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('invalid_grant')
  })

  it('returns 401 { error: "invalid_grant" } when user has no passwordHash', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue({ ...mockUser, passwordHash: null })

    const req = makeJsonRequest('http://localhost/api/auth/mobile/token', {
      email: 'user@example.com',
      password: 'somepass',
    })
    const res = await tokenPOST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('invalid_grant')
  })

  it('returns 401 { error: "invalid_grant" } on wrong password', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)
    ;(bcrypt.compare as any).mockResolvedValue(false)

    const req = makeJsonRequest('http://localhost/api/auth/mobile/token', {
      email: 'user@example.com',
      password: 'wrongpassword',
    })
    const res = await tokenPOST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('invalid_grant')
  })

  it('returns 200 with { accessToken, refreshToken, expiresIn } on valid credentials', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)
    ;(bcrypt.compare as any).mockResolvedValue(true)

    const req = makeJsonRequest('http://localhost/api/auth/mobile/token', {
      email: 'user@example.com',
      password: 'correctpassword',
    })
    const res = await tokenPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(typeof data.accessToken).toBe('string')
    expect(typeof data.refreshToken).toBe('string')
    expect(data.expiresIn).toBe(15 * 60)
  })

  it('access token contains correct sub and email claims', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)
    ;(bcrypt.compare as any).mockResolvedValue(true)

    const req = makeJsonRequest('http://localhost/api/auth/mobile/token', {
      email: 'user@example.com',
      password: 'correctpassword',
    })
    const res = await tokenPOST(req)
    const data = await res.json()

    // Decode access token payload
    const payloadB64 = data.accessToken.split('.')[1]
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())

    expect(payload.sub).toBe(mockUser.id)
    expect(payload.email).toBe(mockUser.email)
  })

  it('refresh token contains correct sub claim', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)
    ;(bcrypt.compare as any).mockResolvedValue(true)

    const req = makeJsonRequest('http://localhost/api/auth/mobile/token', {
      email: 'user@example.com',
      password: 'correctpassword',
    })
    const res = await tokenPOST(req)
    const data = await res.json()

    // Decode refresh token payload
    const payloadB64 = data.refreshToken.split('.')[1]
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())

    expect(payload.sub).toBe(mockUser.id)
  })
})

describe('POST /api/auth/mobile/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXTAUTH_SECRET = TEST_SECRET
  })

  it('returns 400 { error: "missing_fields" } when refreshToken is missing', async () => {
    const req = makeJsonRequest('http://localhost/api/auth/mobile/refresh', {})
    const res = await refreshPOST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('missing_fields')
  })

  it('returns 401 { error: "refresh_token_expired" } on invalid token', async () => {
    const req = makeJsonRequest('http://localhost/api/auth/mobile/refresh', {
      refreshToken: 'invalid.token.here',
    })
    const res = await refreshPOST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('refresh_token_expired')
  })

  it('returns 401 { error: "refresh_token_expired" } on expired token', async () => {
    // Create an expired token by using a past exp
    // We'll use jose directly to create an expired token
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(TEST_SECRET)
    const expiredToken = await new SignJWT({ sub: 'user-123', type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800) // expired 30 min ago
      .sign(secret)

    const req = makeJsonRequest('http://localhost/api/auth/mobile/refresh', {
      refreshToken: expiredToken,
    })
    const res = await refreshPOST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('refresh_token_expired')
  })

  it('returns 200 with new { accessToken, expiresIn } on valid refresh token', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)
    const validRefreshToken = await signRefreshToken(mockUser.id)

    const req = makeJsonRequest('http://localhost/api/auth/mobile/refresh', {
      refreshToken: validRefreshToken,
    })
    const res = await refreshPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(typeof data.accessToken).toBe('string')
    expect(data.expiresIn).toBe(15 * 60)
  })

  it('new access token contains correct sub from refresh token', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)
    const validRefreshToken = await signRefreshToken(mockUser.id)

    const req = makeJsonRequest('http://localhost/api/auth/mobile/refresh', {
      refreshToken: validRefreshToken,
    })
    const res = await refreshPOST(req)
    const data = await res.json()

    const payloadB64 = data.accessToken.split('.')[1]
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())

    expect(payload.sub).toBe(mockUser.id)
  })

  it('returns 401 when user no longer exists for valid refresh token', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(null)
    const validRefreshToken = await signRefreshToken('deleted-user-id')

    const req = makeJsonRequest('http://localhost/api/auth/mobile/refresh', {
      refreshToken: validRefreshToken,
    })
    const res = await refreshPOST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('refresh_token_expired')
  })
})
