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
    // Any Authorization header (even non-Bearer) blocks session fallback.
    // A Basic/Digest/Token header must not silently downgrade to a session.
    if (!authHeader.startsWith('Bearer ')) return null
    const token = authHeader.slice(7).trim()
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
