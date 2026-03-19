/**
 * GET  /api/plans  — List shoot plans for the authenticated user
 * POST /api/plans  — Create a new shoot plan with predicted settings
 *
 * GET query params:
 *   ?page=  (default 1)
 *   ?limit= (default 20)
 *
 * POST body:
 *   title          string
 *   description?   string
 *   plannedAt      ISO string  (planned shoot date/time)
 *   latitude       number
 *   longitude      number
 *   locationName?  string
 *   sceneType      string
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getLocationContext } from '@/lib/weather-service'
import { getSunPosition } from '@/lib/suncalc-wrapper'
import { decryptApiKey, createClient } from '@/lib/openai-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreatePlanBody {
  title?: string
  description?: string
  plannedAt?: string
  latitude?: number
  longitude?: number
  locationName?: string
  sceneType?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate predicted camera settings via OpenAI text completion.
 * Uses weather forecast + sun position + scene type to predict settings.
 */
async function generatePredictedSettings(
  apiKey: string,
  modelId: string,
  sceneType: string,
  latitude: number,
  longitude: number,
  plannedAt: Date
): Promise<{
  iso?: number
  aperture?: number
  shutter?: string
  whiteBalance?: string
  metering?: string
  forecastSnapshot?: string
}> {
  // Fetch weather / location context (uses current conditions as a proxy)
  let weather: Awaited<ReturnType<typeof getLocationContext>>['weather'] | null = null
  let locationName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`

  try {
    const ctx = await getLocationContext(latitude, longitude)
    weather = ctx.weather
    locationName = ctx.locationName
  } catch {
    // Non-fatal — proceed without weather data
  }

  const sunPos = getSunPosition(latitude, longitude, plannedAt)
  const hour = plannedAt.getHours()

  const timeOfDay =
    hour < 6 ? 'night' :
    hour < 9 ? 'early morning / golden hour' :
    hour < 11 ? 'morning' :
    hour < 14 ? 'midday' :
    hour < 17 ? 'afternoon' :
    hour < 20 ? 'evening / golden hour' :
    'night'

  const weatherDesc = weather
    ? `Cloud cover: ${weather.cloudCoverPct}%, UV index: ${weather.uvIndex}, ` +
      `Visibility: ${weather.visibilityKm}km, Temperature: ${weather.temperature}°C, ` +
      `Humidity: ${weather.humidity}%`
    : 'Weather data unavailable'

  const prompt = `You are an expert photography assistant. A photographer is planning a ${sceneType} shoot at:
- Location: ${locationName}
- Date/time: ${plannedAt.toISOString()} (${timeOfDay})
- Sun altitude: ${sunPos.altitudeDeg.toFixed(1)}°, azimuth: ${sunPos.azimuthDeg.toFixed(1)}°
- ${weatherDesc}

Based on these predicted conditions, recommend ONE set of camera settings.

Return EXACTLY this JSON (no markdown, no explanation):
{
  "iso": number,
  "aperture": number,
  "shutter": "string (e.g. 1/500)",
  "whiteBalance": "string",
  "metering": "string"
}`

  const openai = createClient(apiKey)
  const completion = await openai.chat.completions.create({
    model: modelId,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  const cleaned = raw.replace(/^```[\w]*\n?/gm, '').replace(/^```\s*$/gm, '').trim()
  const parsed = JSON.parse(cleaned)

  return {
    iso: typeof parsed.iso === 'number' ? parsed.iso : undefined,
    aperture: typeof parsed.aperture === 'number' ? parsed.aperture : undefined,
    shutter: typeof parsed.shutter === 'string' ? parsed.shutter : undefined,
    whiteBalance: typeof parsed.whiteBalance === 'string' ? parsed.whiteBalance : undefined,
    metering: typeof parsed.metering === 'string' ? parsed.metering : undefined,
    forecastSnapshot: weather ? JSON.stringify(weather) : undefined,
  }
}

// ─── GET: List plans ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
  const skip = (page - 1) * limit

  try {
    const [plans, total] = await Promise.all([
      prisma.shootPlan.findMany({
        where: { userId },
        orderBy: { plannedAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.shootPlan.count({ where: { userId } }),
    ])

    return NextResponse.json({ plans, total, page, limit })
  } catch (err) {
    console.error('[GET /api/plans]', err)
    return NextResponse.json({ error: 'Failed to list plans' }, { status: 500 })
  }
}

// ─── POST: Create plan ────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  let body: CreatePlanBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, description, plannedAt, latitude, longitude, locationName, sceneType } = body

  if (!title || !plannedAt || latitude == null || longitude == null || !sceneType) {
    return NextResponse.json(
      { error: 'title, plannedAt, latitude, longitude, and sceneType are required' },
      { status: 400 }
    )
  }

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return NextResponse.json({ error: 'latitude and longitude must be numbers' }, { status: 400 })
  }

  const plannedAtDate = new Date(plannedAt)
  if (isNaN(plannedAtDate.getTime())) {
    return NextResponse.json({ error: 'plannedAt must be a valid ISO date string' }, { status: 400 })
  }

  // Fetch user for OpenAI key
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { openaiApiKeyEncrypted: true, openaiModelId: true },
  })

  // Generate predicted settings if API key is available
  let predicted: Awaited<ReturnType<typeof generatePredictedSettings>> = {}
  if (user?.openaiApiKeyEncrypted) {
    try {
      const apiKey = decryptApiKey(user.openaiApiKeyEncrypted)
      const modelId = user.openaiModelId ?? 'gpt-4o'
      predicted = await generatePredictedSettings(apiKey, modelId, sceneType, latitude, longitude, plannedAtDate)
    } catch (err) {
      // Non-fatal: save plan without predictions
      console.error('[POST /api/plans] Failed to generate predictions:', err)
    }
  }

  try {
    const plan = await prisma.shootPlan.create({
      data: {
        userId,
        title,
        description: description ?? null,
        plannedAt: plannedAtDate,
        latitude,
        longitude,
        locationName: locationName ?? null,
        sceneType,
        predictedIso: predicted.iso ?? null,
        predictedAperture: predicted.aperture ?? null,
        predictedShutter: predicted.shutter ?? null,
        predictedWB: predicted.whiteBalance ?? null,
        predictedMetering: predicted.metering ?? null,
        forecastSnapshot: predicted.forecastSnapshot ?? null,
      },
    })

    return NextResponse.json({ plan }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/plans]', err)
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
  }
}
