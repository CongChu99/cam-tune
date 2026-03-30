import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verifyAccessToken } from '@/lib/mobile-jwt'

export interface AuthUser {
  id: string
  email: string
}

/**
 * Resolves the authenticated user from either:
 * 1. Authorization: Bearer <token> header (mobile JWT)
 * 2. NextAuth session cookie (web fallback)
 *
 * Returns null if neither is present or valid.
 * IMPORTANT: Invalid Bearer token does NOT fall back to session (no silent downgrade).
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthUser | null> {
  const authHeader = request.headers.get('authorization')

  if (authHeader) {
    // Bearer token path — no session fallback on failure
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return null
    try {
      const payload = await verifyAccessToken(token)
      const id = payload.sub
      const email = payload.email as string
      if (!id || !email) return null
      return { id, email }
    } catch {
      return null
    }
  }

  // Session cookie fallback
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session?.user?.email) return null
  return { id: session.user.id, email: session.user.email }
}
