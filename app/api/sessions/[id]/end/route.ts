/**
 * POST /api/sessions/[id]/end — End a shoot session
 *
 * Body:
 *   actualSettings  object { iso, aperture, shutter, whiteBalance?, meteringMode? }
 *   userRating?     number   1–5
 *   notes?          string
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { endSession, type ActualSettings } from '@/lib/session-logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { id } = await params

  let body: {
    actualSettings?: ActualSettings
    userRating?: number
    notes?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.actualSettings) {
    return NextResponse.json(
      { error: 'actualSettings is required' },
      { status: 400 }
    )
  }

  const { actualSettings, userRating, notes } = body

  // Validate required actualSettings fields
  if (
    typeof actualSettings.iso !== 'number' ||
    typeof actualSettings.aperture !== 'number' ||
    typeof actualSettings.shutter !== 'string'
  ) {
    return NextResponse.json(
      { error: 'actualSettings must include numeric iso, aperture, and string shutter' },
      { status: 400 }
    )
  }

  try {
    await endSession(id, userId, actualSettings, userRating, notes)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to end session'
    const status = message.includes('not found') || message.includes('access denied') ? 404 : 500
    console.error('[POST /api/sessions/[id]/end]', err)
    return NextResponse.json({ error: message }, { status })
  }
}
