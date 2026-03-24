import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/lens-profiles?cameraProfileId=<id>
 * Lists all lens profiles for a given camera profile.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cameraProfileId = searchParams.get('cameraProfileId')

  if (!cameraProfileId) {
    return NextResponse.json(
      { error: 'cameraProfileId query parameter is required' },
      { status: 400 }
    )
  }

  try {
    const lensProfiles = await prisma.lensProfile.findMany({
      where: { cameraProfileId },
      orderBy: { focalLengthMm: 'asc' },
    })
    return NextResponse.json({ lensProfiles })
  } catch (error) {
    console.error('[GET /api/lens-profiles] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lens profiles' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lens-profiles
 * Creates a new lens profile.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      cameraProfileId,
      focalLengthMm,
      maxAperture,
      minAperture,
      isStabilized,
      stabilizationStops,
      focalLengthMinMm,
      focalLengthMaxMm,
      isVariableAperture,
      maxApertureTele,
      lensType,
      lensfunId,
      source,
    } = body

    // Validate required fields
    if (!cameraProfileId || focalLengthMm === undefined || maxAperture === undefined || minAperture === undefined) {
      return NextResponse.json(
        { error: 'cameraProfileId, focalLengthMm, maxAperture, and minAperture are required' },
        { status: 400 }
      )
    }

    const lensProfile = await prisma.lensProfile.create({
      data: {
        cameraProfileId,
        focalLengthMm: Number(focalLengthMm),
        maxAperture: Number(maxAperture),
        minAperture: Number(minAperture),
        isStabilized: Boolean(isStabilized ?? false),
        stabilizationStops: stabilizationStops != null ? Number(stabilizationStops) : null,
        focalLengthMinMm: focalLengthMinMm != null ? Number(focalLengthMinMm) : null,
        focalLengthMaxMm: focalLengthMaxMm != null ? Number(focalLengthMaxMm) : null,
        isVariableAperture: Boolean(isVariableAperture ?? false),
        maxApertureTele: maxApertureTele != null ? Number(maxApertureTele) : null,
        lensType: lensType ?? null,
        lensfunId: lensfunId ?? null,
        source: source ?? null,
      },
    })

    return NextResponse.json({ lensProfile }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/lens-profiles] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create lens profile' },
      { status: 500 }
    )
  }
}
