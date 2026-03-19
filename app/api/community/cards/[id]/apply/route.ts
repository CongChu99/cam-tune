/**
 * POST /api/community/cards/[id]/apply
 *
 * Returns the settings from a community card so the client can store them in
 * localStorage under key `camtune:pendingSettings` and pre-fill the
 * recommendation panel.
 *
 * Response: { settings: CardSettings; cardId: string; source: 'community' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { applySettings } from '@/lib/community-service'

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
    const settings = await applySettings(cardId, userId)
    if (!settings) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }
    return NextResponse.json({ settings, cardId, source: 'community' })
  } catch (err) {
    console.error('[POST /api/community/cards/:id/apply]', err)
    return NextResponse.json({ error: 'Failed to apply settings' }, { status: 500 })
  }
}
