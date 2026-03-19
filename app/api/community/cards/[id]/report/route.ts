/**
 * POST /api/community/cards/[id]/report — Report a card (idempotent per user)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { reportCard } from '@/lib/community-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { id: cardId } = await params

  let reason: string | undefined
  try {
    const body = await request.json()
    if (typeof body.reason === 'string') reason = body.reason
  } catch {
    // reason is optional — ignore parse errors
  }

  try {
    const result = await reportCard(cardId, userId, reason)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to report card'
    if (message === 'Card not found') {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('[POST /api/community/cards/:id/report]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
