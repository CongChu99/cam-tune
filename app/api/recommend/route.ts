/**
 * POST /api/recommend
 *
 * Core AI recommendation endpoint. Combines scene frame + GPS + weather +
 * camera DNA to produce top-3 camera settings via OpenAI Vision.
 *
 * Query params:
 *   ?mode=quick  — strip explanation fields from suggestions
 *
 * Request body:
 *   cameraProfileId  string   UUID of user's camera profile
 *   sceneFrame       string   base64 encoded JPEG from getUserMedia
 *   lat              number
 *   lng              number
 *   shootIntent?     'portrait'|'landscape'|'street'|'event'|'astro'|'macro'
 *
 * Response:
 *   suggestions      Suggestion[]    exactly 3, ordered by confidence desc
 *   sceneAnalysis    SceneAnalysis
 *   shutterSpeedWarning?  string
 *   weatherSnapshot  object
 *   modelUsed        string
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import OpenAI from 'openai'

import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { decryptApiKey, createClient } from '@/lib/openai-client'
import { getLocationContext } from '@/lib/weather-service'
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseAIResponse,
  checkShutterSpeed,
  type ShootIntent,
  type Suggestion,
} from '@/lib/recommendation-engine'

// ─── Request / Response types ─────────────────────────────────────────────────

interface RecommendRequestBody {
  cameraProfileId: string
  sceneFrame: string
  lat: number
  lng: number
  shootIntent?: ShootIntent
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startMs = Date.now()

  // ── Auth ────────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: RecommendRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { cameraProfileId, sceneFrame, lat, lng, shootIntent } = body

  if (!cameraProfileId || !sceneFrame || lat == null || lng == null) {
    return NextResponse.json(
      { error: 'cameraProfileId, sceneFrame, lat, and lng are required' },
      { status: 400 }
    )
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json(
      { error: 'lat and lng must be numbers' },
      { status: 400 }
    )
  }

  // ── Mode ────────────────────────────────────────────────────────────────────
  const mode = request.nextUrl.searchParams.get('mode') // 'quick' | null
  const isQuickMode = mode === 'quick'

  // ── Fetch user (API key + model preference) ─────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      openaiApiKeyEncrypted: true,
      openaiModelId: true,
    },
  })

  if (!user?.openaiApiKeyEncrypted) {
    return NextResponse.json(
      { error: 'No OpenAI API key configured. Please add your API key in settings.' },
      { status: 400 }
    )
  }

  let apiKey: string
  try {
    apiKey = decryptApiKey(user.openaiApiKeyEncrypted)
  } catch {
    return NextResponse.json(
      { error: 'Failed to decrypt API key. Please reconnect your OpenAI account.' },
      { status: 500 }
    )
  }

  // ── Fetch camera profile with DB join ────────────────────────────────────────
  const rawProfile = await prisma.cameraProfile.findFirst({
    where: { id: cameraProfileId, userId },
    include: { cameraDatabase: true },
  })

  if (!rawProfile) {
    return NextResponse.json(
      { error: 'Camera profile not found or does not belong to this user.' },
      { status: 404 }
    )
  }

  // Build a typed CameraProfileRecord (mirrors camera-database.ts shape)
  const cameraProfile = {
    id: rawProfile.id,
    userId: rawProfile.userId,
    brand: rawProfile.brand,
    model: rawProfile.model,
    cameraDatabaseId: rawProfile.cameraDatabaseId ?? null,
    isActive: rawProfile.isActive,
    isUserEntered: rawProfile.isUserEntered,
    ibisVerified: rawProfile.ibisVerified,
    customOverrides: rawProfile.customOverrides ?? null,
    createdAt: rawProfile.createdAt,
    cameraDatabase: rawProfile.cameraDatabase
      ? {
          id: rawProfile.cameraDatabase.id,
          brand: rawProfile.cameraDatabase.brand,
          model: rawProfile.cameraDatabase.model,
          slug: rawProfile.cameraDatabase.slug,
          sensorSize: rawProfile.cameraDatabase.sensorSize,
          pixelCountMp:
            rawProfile.cameraDatabase.pixelCountMp !== null
              ? Number(rawProfile.cameraDatabase.pixelCountMp)
              : null,
          baseIso: rawProfile.cameraDatabase.baseIso,
          maxUsableIso: rawProfile.cameraDatabase.maxUsableIso,
          maxNativeIso: rawProfile.cameraDatabase.maxNativeIso,
          ibis: rawProfile.cameraDatabase.ibis,
          ibisStops:
            rawProfile.cameraDatabase.ibisStops !== null
              ? Number(rawProfile.cameraDatabase.ibisStops)
              : null,
          dualNativeIso: rawProfile.cameraDatabase.dualNativeIso,
          dualNativeIsoValues: rawProfile.cameraDatabase.dualNativeIsoValues ?? null,
          dynamicRangeEv:
            rawProfile.cameraDatabase.dynamicRangeEv !== null
              ? Number(rawProfile.cameraDatabase.dynamicRangeEv)
              : null,
          releaseYear: rawProfile.cameraDatabase.releaseYear ?? null,
          mount: rawProfile.cameraDatabase.mount ?? null,
        }
      : null,
  }

  // ── Fetch weather / location context ─────────────────────────────────────────
  let locationContext: Awaited<ReturnType<typeof getLocationContext>>
  try {
    locationContext = await getLocationContext(lat, lng)
  } catch (err) {
    console.error('[/api/recommend] Failed to fetch location context:', err)
    return NextResponse.json(
      { error: 'Failed to retrieve weather/location data. Please try again.' },
      { status: 503 }
    )
  }

  const { weather, sun, locationName } = locationContext

  // ── Build prompts ─────────────────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(
    cameraProfile,
    weather,
    sun,
    locationName,
    shootIntent
  )
  const userPrompt = buildUserPrompt(shootIntent)

  // ── Call OpenAI Vision ────────────────────────────────────────────────────────
  const modelId = user.openaiModelId ?? 'gpt-4o'
  const openai: OpenAI = createClient(apiKey)

  let rawAIResponse: string
  try {
    const completion = await openai.chat.completions.create({
      model: modelId,
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${sceneFrame}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    })

    rawAIResponse = completion.choices[0]?.message?.content ?? ''
    if (!rawAIResponse) {
      throw new Error('Empty response from OpenAI')
    }
  } catch (err) {
    // ── OpenAI error handling ────────────────────────────────────────────────
    if (err instanceof OpenAI.APIError) {
      if (err.status === 401) {
        return NextResponse.json(
          { error: 'Invalid OpenAI API key. Please reconnect your account.' },
          { status: 401 }
        )
      }
      if (err.status === 429) {
        return NextResponse.json(
          { error: 'OpenAI rate limit exceeded. Please wait a moment and try again.' },
          { status: 429 }
        )
      }
      if (err.status === 503 || err.status === 500) {
        return NextResponse.json(
          { error: 'OpenAI service is temporarily unavailable. Please try again later.' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: `OpenAI error: ${err.message}` },
        { status: err.status ?? 500 }
      )
    }
    console.error('[/api/recommend] OpenAI call failed:', err)
    return NextResponse.json(
      { error: 'Failed to get AI recommendation. Please try again.' },
      { status: 500 }
    )
  }

  // ── Parse AI response ─────────────────────────────────────────────────────────
  let parsed: ReturnType<typeof parseAIResponse>
  try {
    parsed = parseAIResponse(rawAIResponse)
  } catch (err) {
    console.error('[/api/recommend] Failed to parse AI response:', err)
    console.error('[/api/recommend] Raw response:', rawAIResponse)
    return NextResponse.json(
      { error: 'Failed to parse AI response. Please try again.' },
      { status: 500 }
    )
  }

  const { suggestions: rawSuggestions, sceneAnalysis } = parsed

  // ── Strip explanations in quick mode ─────────────────────────────────────────
  const suggestions: Suggestion[] = rawSuggestions.map((s) => {
    if (isQuickMode) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { explanation: _explanation, ...rest } = s
      return rest
    }
    return s
  })

  // ── IBIS shutter warning ──────────────────────────────────────────────────────
  // Use focal length from the first lens profile if available, else 50mm default
  const lensProfiles = await prisma.lensProfile.findMany({
    where: { cameraProfileId: cameraProfile.id },
    orderBy: { focalLengthMm: 'asc' },
    take: 1,
  })
  const defaultFocalLength = lensProfiles[0]?.focalLengthMm ?? undefined

  const shutterSpeedWarning = checkShutterSpeed(suggestions, cameraProfile, defaultFocalLength)

  // ── Log to AIRecommendation table ─────────────────────────────────────────────
  const latencyMs = Date.now() - startMs

  // AIRecommendation requires a sessionId (ShootSession). We create a minimal
  // ShootSession on-the-fly so that every recommendation is traceable.
  let aiRecommendationId: string | null = null
  try {
    const session_ = await prisma.shootSession.create({
      data: {
        userId,
        cameraProfileId: cameraProfile.id,
        lat,
        lng,
        locationName,
        startedAt: new Date(),
        weatherSnapshot: weather as object,
        sunSnapshot: sun as object,
        sceneType: sceneAnalysis.sceneType,
        aiRecommendation: {
          sceneAnalysis,
          suggestions,
        } as object,
      },
    })

    const confidenceScores = suggestions
      .map((s) => (s.confidence / 100).toFixed(2))
      .join(',')

    const rec = await prisma.aIRecommendation.create({
      data: {
        sessionId: session_.id,
        modelId,
        inputSignals: {
          lat,
          lng,
          locationName,
          weather,
          sun,
          cameraProfileId: cameraProfile.id,
          shootIntent: shootIntent ?? null,
        } as object,
        rawResponse: { text: rawAIResponse } as object,
        parsedSuggestions: suggestions as unknown as object,
        confidenceScores,
        primarySignalDriver: suggestions[0]?.primaryDriver ?? null,
        latencyMs,
      },
    })

    aiRecommendationId = rec.id
  } catch (dbErr) {
    // DB logging failure is non-fatal — do not block the response
    console.error('[/api/recommend] Failed to log AIRecommendation:', dbErr)
  }

  // ── Build and return response ─────────────────────────────────────────────────
  const response: Record<string, unknown> = {
    suggestions,
    sceneAnalysis,
    weatherSnapshot: weather,
    modelUsed: modelId,
  }

  if (shutterSpeedWarning) {
    response.shutterSpeedWarning = shutterSpeedWarning
  }

  if (aiRecommendationId) {
    response.recommendationId = aiRecommendationId
  }

  return NextResponse.json(response)
}
