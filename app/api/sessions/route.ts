/**
 * POST /api/sessions  — Start a new shoot session
 * GET  /api/sessions  — List paginated sessions for the authenticated user
 *
 * POST body:
 *   cameraProfileId  string   UUID of user's camera profile
 *   lat              number
 *   lng              number
 *   sceneType?       string
 *   aiRecommendation? object  optional AI recommendation snapshot
 *
 * GET query params:
 *   ?page=  (default 1)
 *   ?limit= (default 20)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { startSession, getUserSessions } from '@/lib/session-logger'

// ─── POST: Start session ──────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  let body: {
    cameraProfileId?: string
    lat?: number
    lng?: number
    sceneType?: string
    aiRecommendation?: Record<string, unknown>
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { cameraProfileId, lat, lng, sceneType, aiRecommendation } = body

  if (!cameraProfileId || lat == null || lng == null) {
    return NextResponse.json(
      { error: 'cameraProfileId, lat, and lng are required' },
      { status: 400 }
    )
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json(
      { error: 'lat and lng must be numbers' },
      { status: 400 }
    )
  }

  try {
    const result = await startSession(userId, cameraProfileId, {
      lat,
      lng,
      sceneType,
      aiRecommendation,
    })
    return NextResponse.json({ id: result.id, locationName: result.locationName }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/sessions]', err)
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 })
  }
}

// ─── GET: List sessions ───────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))

  try {
    const result = await getUserSessions(userId, page, limit)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/sessions]', err)
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 })
  }
}
