/**
 * GET    /api/plans/[id]   — Get a single shoot plan
 * PATCH  /api/plans/[id]   — Update a shoot plan
 * DELETE /api/plans/[id]   — Delete a shoot plan
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// ─── GET: Get plan ────────────────────────────────────────────────────────────

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
    const plan = await prisma.shootPlan.findFirst({
      where: { id, userId },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    return NextResponse.json({ plan })
  } catch (err) {
    console.error('[GET /api/plans/:id]', err)
    return NextResponse.json({ error: 'Failed to get plan' }, { status: 500 })
  }
}

// ─── PATCH: Update plan ───────────────────────────────────────────────────────

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

  // Verify ownership
  const existing = await prisma.shootPlan.findFirst({ where: { id, userId } })
  if (!existing) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  // Build safe update payload — only allow known fields
  const updateData: Record<string, unknown> = {}
  if (typeof body.title === 'string') updateData.title = body.title
  if (typeof body.description === 'string' || body.description === null) {
    updateData.description = body.description
  }
  if (typeof body.plannedAt === 'string') {
    const d = new Date(body.plannedAt)
    if (!isNaN(d.getTime())) updateData.plannedAt = d
  }
  if (typeof body.latitude === 'number') updateData.latitude = body.latitude
  if (typeof body.longitude === 'number') updateData.longitude = body.longitude
  if (typeof body.locationName === 'string' || body.locationName === null) {
    updateData.locationName = body.locationName
  }
  if (typeof body.sceneType === 'string') updateData.sceneType = body.sceneType
  if (typeof body.completedAt === 'string') {
    const d = new Date(body.completedAt)
    if (!isNaN(d.getTime())) updateData.completedAt = d
  }
  if (body.completedAt === null) updateData.completedAt = null
  if (typeof body.forecastSnapshot === 'string' || body.forecastSnapshot === null) {
    updateData.forecastSnapshot = body.forecastSnapshot
  }

  try {
    const plan = await prisma.shootPlan.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ plan })
  } catch (err) {
    console.error('[PATCH /api/plans/:id]', err)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}

// ─── DELETE: Delete plan ──────────────────────────────────────────────────────

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

  // Verify ownership
  const existing = await prisma.shootPlan.findFirst({ where: { id, userId } })
  if (!existing) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  try {
    await prisma.shootPlan.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/plans/:id]', err)
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}
