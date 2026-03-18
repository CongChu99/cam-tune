import SunCalc from 'suncalc'
import { getSunPosition } from './suncalc-wrapper'

export interface WeatherData {
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

export interface SunData {
  altitude: number
  azimuth: number
  isGoldenHour: boolean
  minutesToGoldenHour: number
}

export interface LocationContext {
  locationName: string
  weather: WeatherData
  sun: SunData
}

// ─── Open-Meteo ──────────────────────────────────────────────────────────────

async function fetchWeather(lat: number, lng: number): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,cloud_cover,uv_index,visibility,relative_humidity_2m` +
    `&daily=sunrise,sunset` +
    `&timezone=auto`

  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status}`)
  }

  const data = await res.json()
  const current = data.current
  const daily = data.daily

  const now = new Date()
  const times = SunCalc.getTimes(now, lat, lng)

  // Open-Meteo visibility is in metres — convert to km
  const visibilityKm = (current.visibility ?? 0) / 1000

  // Golden hour: evening window (goldenHour key = start of evening golden hour)
  const goldenHourStart = times.goldenHour
  // goldenHourEnd in suncalc is the end of morning golden hour; use sunsetStart
  // as the end of evening golden hour
  const goldenHourEnd = times.sunsetStart

  return {
    cloudCoverPct: current.cloud_cover ?? 0,
    uvIndex: current.uv_index ?? 0,
    visibilityKm: Math.round(visibilityKm * 10) / 10,
    temperature: current.temperature_2m ?? 0,
    humidity: current.relative_humidity_2m ?? 0,
    sunrise: daily.sunrise?.[0] ?? '',
    sunset: daily.sunset?.[0] ?? '',
    goldenHourStart: goldenHourStart.toISOString(),
    goldenHourEnd: goldenHourEnd.toISOString(),
  }
}

// ─── Nominatim ───────────────────────────────────────────────────────────────

async function fetchLocationName(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'CamTune/1.0' },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }

  const data = await res.json()

  // Build a human-readable name: prefer named amenity/quarter + city, else
  // fall back to the display_name
  const addr = data.address ?? {}
  const parts: string[] = []

  const landmark =
    addr.tourism ||
    addr.leisure ||
    addr.amenity ||
    addr.quarter ||
    addr.neighbourhood ||
    addr.suburb

  if (landmark) parts.push(landmark)

  const city = addr.city || addr.town || addr.village || addr.county
  if (city) parts.push(city)

  if (parts.length > 0) {
    return parts.join(', ')
  }

  return data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

// ─── Sun data ─────────────────────────────────────────────────────────────────

function buildSunData(lat: number, lng: number, now: Date): SunData {
  const pos = getSunPosition(lat, lng, now)
  const times = SunCalc.getTimes(now, lat, lng)

  const goldenHourStart = times.goldenHour
  const goldenHourEnd = times.sunsetStart

  const nowMs = now.getTime()
  const isGoldenHour = nowMs >= goldenHourStart.getTime() && nowMs <= goldenHourEnd.getTime()

  const minutesToGoldenHour =
    nowMs < goldenHourStart.getTime()
      ? Math.round((goldenHourStart.getTime() - nowMs) / 60_000)
      : 0

  return {
    altitude: Math.round(pos.altitudeDeg * 10) / 10,
    azimuth: Math.round(pos.azimuthDeg * 10) / 10,
    isGoldenHour,
    minutesToGoldenHour,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches weather, sun position, and reverse-geocoded location name for the
 * provided coordinates. All external calls are made in parallel.
 */
export async function getLocationContext(lat: number, lng: number): Promise<LocationContext> {
  const now = new Date()

  const [weather, locationName] = await Promise.all([
    fetchWeather(lat, lng),
    fetchLocationName(lat, lng),
  ])

  const sun = buildSunData(lat, lng, now)

  return { locationName, weather, sun }
}
