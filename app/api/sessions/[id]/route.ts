/**
 * GET   /api/sessions/[id]  — Get session detail
 * PATCH /api/sessions/[id]  — Update rating, notes, and/or actual settings
 *
 * PATCH body (all fields optional):
 *   userRating?    number   1–5
 *   notes?         string
 *   actualSettings? object { iso, aperture, shutter, whiteBalance?, meteringMode? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSessionById } from '@/lib/session-logger'
import prisma from '@/lib/prisma'

// ─── GET: Session detail ──────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { id } = await params

  try {
    const detail = await getSessionById(id, userId)
    if (!detail) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    return NextResponse.json({ session: detail })
  } catch (err) {
    console.error('[GET /api/sessions/[id]]', err)
    return NextResponse.json({ error: 'Failed to retrieve session' }, { status: 500 })
  }
}

// ─── PATCH: Update session ────────────────────────────────────────────────────

export async function PATCH(
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
    userRating?: number
    notes?: string
    actualSettings?: {
      iso: number
      aperture: number
      shutter: string
      whiteBalance?: string
      meteringMode?: string
    }
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate rating if provided
  if (
    body.userRating !== undefined &&
    (body.userRating < 1 || body.userRating > 5 || !Number.isInteger(body.userRating))
  ) {
    return NextResponse.json(
      { error: 'userRating must be an integer between 1 and 5' },
      { status: 400 }
    )
  }

  // Verify ownership
  const existing = await prisma.shootSession.findFirst({
    where: { id, userId },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {}
  if (body.userRating !== undefined) updateData.userRating = body.userRating
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.actualSettings !== undefined) updateData.actualSettings = body.actualSettings as object

  try {
    const updated = await prisma.shootSession.update({
      where: { id },
      data: updateData,
    })
    return NextResponse.json({ session: { id: updated.id, ...updateData } })
  } catch (err) {
    console.error('[PATCH /api/sessions/[id]]', err)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}
