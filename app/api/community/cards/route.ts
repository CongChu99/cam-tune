/**
 * GET  /api/community/cards  — List public cards (optional location + camera filter)
 * POST /api/community/cards  — Publish a new settings card (GPS required)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCard, listCards } from '@/lib/community-service'

// ─── GET: List / search cards ─────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)

  const latParam = searchParams.get('lat')
  const lngParam = searchParams.get('lng')
  const cameraModel = searchParams.get('cameraModel') ?? undefined
  const pageParam = searchParams.get('page')
  const limitParam = searchParams.get('limit')

  const lat = latParam != null ? parseFloat(latParam) : undefined
  const lng = lngParam != null ? parseFloat(lngParam) : undefined
  const page = pageParam != null ? parseInt(pageParam, 10) : 1
  const limit = limitParam != null ? Math.min(parseInt(limitParam, 10), 50) : 20

  if (lat != null && (isNaN(lat) || lat < -90 || lat > 90)) {
    return NextResponse.json({ error: 'Invalid lat value' }, { status: 400 })
  }
  if (lng != null && (isNaN(lng) || lng < -180 || lng > 180)) {
    return NextResponse.json({ error: 'Invalid lng value' }, { status: 400 })
  }
  if ((lat == null) !== (lng == null)) {
    return NextResponse.json({ error: 'Both lat and lng must be provided together' }, { status: 400 })
  }

  try {
    const result = await listCards({ lat, lng, cameraModel, page, limit })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/community/cards]', err)
    return NextResponse.json({ error: 'Failed to list cards' }, { status: 500 })
  }
}

// ─── POST: Publish a new card ─────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate required GPS fields
  if (body.lat == null || body.lng == null) {
    return NextResponse.json(
      { error: 'GPS coordinates (lat/lng) are required to publish a settings card' },
      { status: 400 }
    )
  }
  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json({ error: 'lat and lng must be numbers' }, { status: 400 })
  }
  if (!body.cameraModel || typeof body.cameraModel !== 'string') {
    return NextResponse.json({ error: 'cameraModel is required' }, { status: 400 })
  }
  if (!body.locationName || typeof body.locationName !== 'string') {
    return NextResponse.json({ error: 'locationName is required' }, { status: 400 })
  }
  if (!body.settings || typeof body.settings !== 'object') {
    return NextResponse.json({ error: 'settings object is required' }, { status: 400 })
  }

  const settings = body.settings as Record<string, unknown>
  if (
    typeof settings.iso !== 'number' ||
    typeof settings.aperture !== 'number' ||
    typeof settings.shutter !== 'string' ||
    typeof settings.whiteBalance !== 'string' ||
    typeof settings.meteringMode !== 'string'
  ) {
    return NextResponse.json(
      { error: 'settings must include iso (number), aperture (number), shutter (string), whiteBalance (string), meteringMode (string)' },
      { status: 400 }
    )
  }

  try {
    const card = await createCard({
      userId,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
      cameraModel: body.cameraModel as string,
      lat: body.lat as number,
      lng: body.lng as number,
      locationName: body.locationName as string,
      settings: {
        iso: settings.iso as number,
        aperture: settings.aperture as number,
        shutter: settings.shutter as string,
        whiteBalance: settings.whiteBalance as string,
        meteringMode: settings.meteringMode as string,
      },
      weatherConditions:
        body.weatherConditions && typeof body.weatherConditions === 'object'
          ? (body.weatherConditions as Record<string, unknown>)
          : undefined,
      photoUrl: typeof body.photoUrl === 'string' ? body.photoUrl : undefined,
      caption: typeof body.caption === 'string' ? body.caption : undefined,
    })
    return NextResponse.json({ card }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create card'
    if (message.includes('GPS') || message.includes('lat') || message.includes('lng')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('[POST /api/community/cards]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
