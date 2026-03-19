import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getLocationContext } from '@/lib/weather-service'

// ─── Redis client (lazy singleton) ──────────────────────────────────────────
// Credentials are expected in UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// environment variables (set in .env.local / Vercel project settings).
let redis: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CachedPayload {
  locationName: string
  weather: {
    cloudCoverPct: number
    uvIndex: number
    visibilityKm: number
    temperature: number
    humidity: number
    sunrise: string
    sunset: string
    goldenHourStart: string
    goldenHourEnd: string
  }
  sun: {
    altitude: number
    azimuth: number
    isGoldenHour: boolean
    minutesToGoldenHour: number
  }
  cachedAt: string
}

const CACHE_TTL_SECONDS = 1800 // 30 minutes
const STALE_THRESHOLD_MS = CACHE_TTL_SECONDS * 1000

// ─── Cache key ───────────────────────────────────────────────────────────────

function cacheKey(lat: number, lng: number): string {
  const roundedLat = Math.round(lat * 100) / 100
  const roundedLng = Math.round(lng * 100) / 100
  return `location:${roundedLat}:${roundedLng}`
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl

  const latParam = searchParams.get('lat')
  const lngParam = searchParams.get('lng')

  if (!latParam || !lngParam) {
    return NextResponse.json(
      { error: 'Missing required query parameters: lat and lng' },
      { status: 400 }
    )
  }

  const lat = parseFloat(latParam)
  const lng = parseFloat(lngParam)

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: 'lat and lng must be valid numbers' },
      { status: 400 }
    )
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: 'lat must be in [-90, 90] and lng in [-180, 180]' },
      { status: 400 }
    )
  }

  const client = getRedis()
  const key = cacheKey(lat, lng)

  // ── Try cache first ──────────────────────────────────────────────────────
  if (client) {
    try {
      const cached = await client.get<CachedPayload>(key)
      if (cached) {
        const cachedAtMs = new Date(cached.cachedAt).getTime()
        const isStale = Date.now() - cachedAtMs > STALE_THRESHOLD_MS
        return NextResponse.json({ ...cached, isStale })
      }
    } catch {
      // Cache read failure is non-fatal — fall through to live fetch
    }
  }

  // ── Live fetch ───────────────────────────────────────────────────────────
  try {
    const context = await getLocationContext(lat, lng)

    const payload: CachedPayload = {
      ...context,
      cachedAt: new Date().toISOString(),
    }

    // Store in Redis (fire and forget — errors don't block the response)
    if (client) {
      client.set(key, payload, { ex: CACHE_TTL_SECONDS }).catch(() => {})
    }

    return NextResponse.json({ ...payload, isStale: false })
  } catch (err) {
    console.error('[/api/location] Failed to fetch location context:', err)
    return NextResponse.json(
      { error: 'Failed to retrieve location data. Please try again later.' },
      { status: 503 }
    )
  }
}
