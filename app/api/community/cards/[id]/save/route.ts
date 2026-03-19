/**
 * POST /api/community/cards/[id]/save — Toggle save on a card (idempotent)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { toggleSave } from '@/lib/community-service'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { id: cardId } = await params

  try {
    const result = await toggleSave(cardId, userId)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to toggle save'
    if (message === 'Card not found') {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('[POST /api/community/cards/:id/save]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
