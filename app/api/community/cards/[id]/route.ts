/**
 * GET    /api/community/cards/[id]  — Get a single card
 * PATCH  /api/community/cards/[id]  — Update a card (owner only)
 * DELETE /api/community/cards/[id]  — Delete a card (owner only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCard, updateCard, deleteCard } from '@/lib/community-service'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  const { id } = await params

  try {
    const card = await getCard(id, userId)
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }
    return NextResponse.json({ card })
  } catch (err) {
    console.error('[GET /api/community/cards/:id]', err)
    return NextResponse.json({ error: 'Failed to get card' }, { status: 500 })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data: { caption?: string; locationName?: string; photoUrl?: string; isPublic?: boolean } = {}
  if (typeof body.caption === 'string' || body.caption === null) {
    data.caption = body.caption as string | undefined
  }
  if (typeof body.locationName === 'string') {
    data.locationName = body.locationName
  }
  if (typeof body.photoUrl === 'string' || body.photoUrl === null) {
    data.photoUrl = body.photoUrl as string | undefined
  }
  if (typeof body.isPublic === 'boolean') {
    data.isPublic = body.isPublic
  }

  try {
    const card = await updateCard(id, userId, data)
    if (!card) {
      return NextResponse.json({ error: 'Card not found or not owned by you' }, { status: 404 })
    }
    return NextResponse.json({ card })
  } catch (err) {
    console.error('[PATCH /api/community/cards/:id]', err)
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
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
    const deleted = await deleteCard(id, userId)
    if (!deleted) {
      return NextResponse.json({ error: 'Card not found or not owned by you' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/community/cards/:id]', err)
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 })
  }
}
