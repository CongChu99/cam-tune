/**
 * POST /api/plans/[id]/notify
 *
 * Marks the shoot plan's notificationSent flag to true and returns the plan.
 * This endpoint is called to trigger the reminder notification for an upcoming shoot.
 *
 * In the absence of VAPID keys, the client polls for upcoming plans and calls
 * this endpoint when the planned time is ≤1 hour away — the UI then shows an
 * in-app reminder. Full Web Push can be wired up by adding VAPID key env vars.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { id } = await params

  // Verify ownership
  const existing = await prisma.shootPlan.findFirst({ where: { id, userId } })
  if (!existing) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  try {
    const plan = await prisma.shootPlan.update({
      where: { id },
      data: { notificationSent: true },
    })

    return NextResponse.json({ plan, message: 'Notification marked as sent' })
  } catch (err) {
    console.error('[POST /api/plans/:id/notify]', err)
    return NextResponse.json({ error: 'Failed to update notification status' }, { status: 500 })
  }
}
