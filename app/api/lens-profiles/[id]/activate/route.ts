import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * PATCH /api/lens-profiles/[id]/activate
 * Marks a lens profile as the active lens for its camera profile.
 * Currently a placeholder that confirms the lens exists.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const existing = await prisma.lensProfile.findFirst({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lens profile not found' }, { status: 404 })
    }

    // Activation is tracked at application layer — return success
    return NextResponse.json({ success: true, lensProfileId: id })
  } catch (error) {
    console.error('[PATCH /api/lens-profiles/[id]/activate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to activate lens profile' },
      { status: 500 }
    )
  }
}
