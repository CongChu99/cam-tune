import { NextRequest, NextResponse } from 'next/server'
import Redis from 'ioredis'
import { getLocationContext, type WeatherData, type SunData } from '@/lib/weather-service'
import SunCalc from 'suncalc'

// ─── Redis client (lazy singleton) ──────────────────────────────────────────
// Credentials are expected in UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// environment variables (set in .env.local / Vercel project settings).
let redis: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null
  }
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL).on('error', () => {})
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
      const raw = await client.get(key)
      const cached: CachedPayload | null = raw ? JSON.parse(raw) : null
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

    if (client) {
      client.set(key, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS).catch(() => {})
    }

    return NextResponse.json({ ...payload, isStale: false })
  } catch (err) {
    console.warn('[/api/location] Weather fetch failed, returning local fallback:', err instanceof Error ? err.message : err)

    // Compute sun data locally (no network needed)
    const now = new Date()
    const times = SunCalc.getTimes(now, lat, lng)
    const pos = SunCalc.getPosition(now, lat, lng)
    const altitudeDeg = (pos.altitude * 180) / Math.PI
    const azimuthDeg = ((pos.azimuth * 180) / Math.PI + 180) % 360
    const goldenStart = times.goldenHour.getTime()
    const goldenEnd = times.sunsetStart.getTime()
    const nowMs = now.getTime()

    const sun: SunData = {
      altitude: Math.round(altitudeDeg * 10) / 10,
      azimuth: Math.round(azimuthDeg * 10) / 10,
      isGoldenHour: nowMs >= goldenStart && nowMs <= goldenEnd,
      minutesToGoldenHour: nowMs < goldenStart ? Math.round((goldenStart - nowMs) / 60_000) : 0,
    }

    const weather: WeatherData = {
      cloudCoverPct: 0, uvIndex: 0, visibilityKm: 10,
      temperature: 25, humidity: 60,
      sunrise: times.sunrise.toISOString(),
      sunset: times.sunset.toISOString(),
      goldenHourStart: times.goldenHour.toISOString(),
      goldenHourEnd: times.sunsetStart.toISOString(),
    }

    const fallback: CachedPayload = {
      locationName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      weather,
      sun,
      cachedAt: now.toISOString(),
    }

    return NextResponse.json({ ...fallback, isStale: true })
  }
}
