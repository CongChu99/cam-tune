import SunCalc from 'suncalc'
import { getSunPosition } from './suncalc-wrapper'
import https from 'node:https'

/** HTTP GET using node:https — bypasses Next.js fetch instrumentation */
function httpsGet(url: string, headers?: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let raw = ''
      res.on('data', (chunk: Buffer) => { raw += chunk.toString() })
      res.on('end', () => {
        try { resolve(JSON.parse(raw)) }
        catch (e) { reject(e) }
      })
    })
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')) })
    req.on('error', reject)
  })
}

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

  const data = await httpsGet(url) as { current: Record<string, number>; daily: Record<string, string[]> }
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

  let data: Record<string, unknown>
  try {
    data = await httpsGet(url, { 'User-Agent': 'CamTune/1.0' }) as Record<string, unknown>
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }

  // Build a human-readable name: prefer named amenity/quarter + city, else
  // fall back to the display_name
  const addr = (data.address ?? {}) as Record<string, string>
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

// ─── Open-Meteo Hourly Forecast ───────────────────────────────────────────────

/**
 * Fetches hourly forecast from Open-Meteo for the given coordinates and returns
 * weather data for the specific hour matching `targetDate`. Falls back to the
 * closest available hour if exact match is not found.
 *
 * Supports up to 16 days in the future.
 */
export async function getWeatherForecast(
  lat: number,
  lng: number,
  targetDate: Date
): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,precipitation,wind_speed_10m,cloud_cover,relative_humidity_2m,uv_index,visibility` +
    `&daily=sunrise,sunset` +
    `&forecast_days=16` +
    `&timezone=auto`

  const data = await httpsGet(url) as { hourly: Record<string, unknown[]>; daily: Record<string, string[]> }
  const hourly = data.hourly
  const daily = data.daily

  // Find the hourly index closest to targetDate
  const targetMs = targetDate.getTime()
  const times: string[] = hourly.time ?? []
  let bestIdx = 0
  let bestDiff = Infinity

  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - targetMs)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIdx = i
    }
  }

  // Find the daily index for sunrise/sunset
  const targetDateStr = targetDate.toISOString().slice(0, 10)
  const dailyTimes: string[] = daily.time ?? []
  const dailyIdx = dailyTimes.findIndex((t) => t === targetDateStr)
  const sunriseStr = dailyIdx >= 0 ? (daily.sunrise?.[dailyIdx] ?? '') : (daily.sunrise?.[0] ?? '')
  const sunsetStr = dailyIdx >= 0 ? (daily.sunset?.[dailyIdx] ?? '') : (daily.sunset?.[0] ?? '')

  const times2 = SunCalc.getTimes(targetDate, lat, lng)
  const goldenHourStart = times2.goldenHour
  const goldenHourEnd = times2.sunsetStart

  const visibilityRaw = hourly.visibility?.[bestIdx] ?? 0
  const visibilityKm = Math.round((visibilityRaw / 1000) * 10) / 10

  return {
    cloudCoverPct: hourly.cloud_cover?.[bestIdx] ?? 0,
    uvIndex: hourly.uv_index?.[bestIdx] ?? 0,
    visibilityKm,
    temperature: hourly.temperature_2m?.[bestIdx] ?? 0,
    humidity: hourly.relative_humidity_2m?.[bestIdx] ?? 0,
    sunrise: sunriseStr,
    sunset: sunsetStr,
    goldenHourStart: goldenHourStart.toISOString(),
    goldenHourEnd: goldenHourEnd.toISOString(),
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
