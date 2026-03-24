import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * DELETE /api/lens-profiles/[id]
 * Deletes a lens profile by ID.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const existing = await prisma.lensProfile.findFirst({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lens profile not found' }, { status: 404 })
    }

    await prisma.lensProfile.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/lens-profiles/[id]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete lens profile' },
      { status: 500 }
    )
  }
}
