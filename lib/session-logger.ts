/**
 * Session Logger — server-side helpers for shoot session lifecycle management.
 *
 * Provides:
 *  - startSession    — creates a ShootSession record with GPS, weather, and sun data
 *  - endSession      — updates session with endedAt, actual settings, rating, notes
 *  - getUserSessions — paginated list of sessions for a user
 *  - getSessionById  — session detail with ownership check
 *  - exportSessions  — export sessions as CSV or JSON string
 */

import prisma from '@/lib/prisma'
import { getLocationContext } from '@/lib/weather-service'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StartSessionContext {
  lat: number
  lng: number
  cameraProfileId: string
  sceneType?: string
  /** Pre-built AI recommendation to snapshot (optional) */
  aiRecommendation?: Record<string, unknown>
}

export interface ActualSettings {
  iso: number
  aperture: number
  shutter: string
  whiteBalance?: string
  meteringMode?: string
}

export interface SessionListItem {
  id: string
  locationName: string | null
  startedAt: Date
  endedAt: Date | null
  sceneType: string | null
  userRating: number | null
  notes: string | null
  actualSettings: unknown
  aiRecommendation: unknown
  isPlan: boolean
  cameraProfile: {
    id: string
    brand: string
    model: string
    cameraDatabase: {
      brand: string
      model: string
    } | null
  }
}

export interface SessionDetail extends SessionListItem {
  lat: number
  lng: number
  weatherSnapshot: unknown
  sunSnapshot: unknown
  createdAt: Date
}

// ─── startSession ─────────────────────────────────────────────────────────────

/**
 * Creates a new ShootSession record. Fetches live weather + sun data from
 * Open-Meteo / Nominatim based on the provided coordinates.
 */
export async function startSession(
  userId: string,
  cameraProfileId: string,
  context: Omit<StartSessionContext, 'cameraProfileId'>
): Promise<{ id: string; locationName: string | null }> {
  const { lat, lng, sceneType, aiRecommendation } = context

  // Fetch live location context (weather + sun + reverse-geocoded name)
  const locationCtx = await getLocationContext(lat, lng)
  const { weather, sun, locationName } = locationCtx

  const session = await prisma.shootSession.create({
    data: {
      userId,
      cameraProfileId,
      lat,
      lng,
      locationName,
      startedAt: new Date(),
      weatherSnapshot: weather as object,
      sunSnapshot: sun as object,
      sceneType: sceneType ?? null,
      aiRecommendation: aiRecommendation ? (aiRecommendation as object) : undefined,
      isPlan: false,
    },
  })

  return { id: session.id, locationName: session.locationName }
}

// ─── endSession ───────────────────────────────────────────────────────────────

/**
 * Marks a session as ended. Optionally stores the actual settings used,
 * a rating (1–5), and free-text notes.
 */
export async function endSession(
  id: string,
  userId: string,
  actualSettings: ActualSettings,
  rating?: number,
  notes?: string
): Promise<void> {
  // Validate rating range at app layer (SQLite has no CHECK constraint via Prisma)
  if (rating !== undefined && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    throw new Error('Rating must be an integer between 1 and 5')
  }

  // Verify ownership before update
  const existing = await prisma.shootSession.findFirst({
    where: { id, userId },
    select: { id: true },
  })

  if (!existing) {
    throw new Error('Session not found or access denied')
  }

  await prisma.shootSession.update({
    where: { id },
    data: {
      endedAt: new Date(),
      actualSettings: actualSettings as object,
      userRating: rating ?? null,
      notes: notes ?? null,
    },
  })
}

// ─── getUserSessions ──────────────────────────────────────────────────────────

/**
 * Returns a paginated list of sessions for the given user, newest first.
 * Joins CameraProfile + CameraDatabase for display names.
 */
export async function getUserSessions(
  userId: string,
  page: number,
  limit: number
): Promise<{ sessions: SessionListItem[]; total: number; page: number; limit: number }> {
  const skip = (page - 1) * limit

  const [sessions, total] = await Promise.all([
    prisma.shootSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
      include: {
        cameraProfile: {
          include: {
            cameraDatabase: {
              select: { brand: true, model: true },
            },
          },
        },
      },
    }),
    prisma.shootSession.count({ where: { userId } }),
  ])

  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      locationName: s.locationName,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      sceneType: s.sceneType,
      userRating: s.userRating,
      notes: s.notes,
      actualSettings: s.actualSettings,
      aiRecommendation: s.aiRecommendation,
      isPlan: s.isPlan,
      cameraProfile: {
        id: s.cameraProfile.id,
        brand: s.cameraProfile.brand,
        model: s.cameraProfile.model,
        cameraDatabase: s.cameraProfile.cameraDatabase
          ? {
              brand: s.cameraProfile.cameraDatabase.brand,
              model: s.cameraProfile.cameraDatabase.model,
            }
          : null,
      },
    })),
    total,
    page,
    limit,
  }
}

// ─── getSessionById ───────────────────────────────────────────────────────────

/**
 * Returns a session detail, including lat/lng and snapshots, for the given
 * session ID. Ownership is enforced — returns null if not found or access denied.
 */
export async function getSessionById(
  id: string,
  userId: string
): Promise<SessionDetail | null> {
  const s = await prisma.shootSession.findFirst({
    where: { id, userId },
    include: {
      cameraProfile: {
        include: {
          cameraDatabase: {
            select: { brand: true, model: true },
          },
        },
      },
    },
  })

  if (!s) return null

  return {
    id: s.id,
    locationName: s.locationName,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    sceneType: s.sceneType,
    userRating: s.userRating,
    notes: s.notes,
    actualSettings: s.actualSettings,
    aiRecommendation: s.aiRecommendation,
    isPlan: s.isPlan,
    lat: Number(s.lat),
    lng: Number(s.lng),
    weatherSnapshot: s.weatherSnapshot,
    sunSnapshot: s.sunSnapshot,
    createdAt: s.createdAt,
    cameraProfile: {
      id: s.cameraProfile.id,
      brand: s.cameraProfile.brand,
      model: s.cameraProfile.model,
      cameraDatabase: s.cameraProfile.cameraDatabase
        ? {
            brand: s.cameraProfile.cameraDatabase.brand,
            model: s.cameraProfile.cameraDatabase.model,
          }
        : null,
    },
  }
}

// ─── exportSessions ───────────────────────────────────────────────────────────

/**
 * Exports all sessions for a user as a CSV string or a JSON array.
 *
 * CSV columns: id,location,date,camera,iso,aperture,shutter,rating,notes
 */
export async function exportSessions(
  userId: string,
  format: 'csv' | 'json'
): Promise<string> {
  const sessions = await prisma.shootSession.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    include: {
      cameraProfile: {
        include: {
          cameraDatabase: {
            select: { brand: true, model: true },
          },
        },
      },
    },
  })

  if (format === 'json') {
    const rows = sessions.map((s) => {
      const actual = s.actualSettings as Record<string, unknown> | null
      const db = s.cameraProfile.cameraDatabase
      const cameraName = db
        ? `${db.brand} ${db.model}`
        : `${s.cameraProfile.brand} ${s.cameraProfile.model}`

      return {
        id: s.id,
        location: s.locationName ?? '',
        date: s.startedAt.toISOString(),
        camera: cameraName,
        iso: actual?.iso ?? null,
        aperture: actual?.aperture ?? null,
        shutter: actual?.shutter ?? null,
        rating: s.userRating ?? null,
        notes: s.notes ?? '',
      }
    })
    return JSON.stringify(rows, null, 2)
  }

  // CSV — manual string building (no external library)
  const escapeCsv = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value)
    // Wrap in quotes if the value contains commas, quotes, or newlines
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const header = 'id,location,date,camera,iso,aperture,shutter,rating,notes'
  const lines = sessions.map((s) => {
    const actual = s.actualSettings as Record<string, unknown> | null
    const db = s.cameraProfile.cameraDatabase
    const cameraName = db
      ? `${db.brand} ${db.model}`
      : `${s.cameraProfile.brand} ${s.cameraProfile.model}`

    return [
      escapeCsv(s.id),
      escapeCsv(s.locationName ?? ''),
      escapeCsv(s.startedAt.toISOString()),
      escapeCsv(cameraName),
      escapeCsv(actual?.iso ?? ''),
      escapeCsv(actual?.aperture ?? ''),
      escapeCsv(actual?.shutter ?? ''),
      escapeCsv(s.userRating ?? ''),
      escapeCsv(s.notes ?? ''),
    ].join(',')
  })

  return [header, ...lines].join('\n')
}
