/**
 * Community Service — business logic for SettingsCard community features.
 *
 * Provides:
 *  - haversineDistance   — calculate distance in metres between two GPS coords
 *  - createCard          — publish a new public settings card (GPS required)
 *  - listCards           — list public cards with optional location + camera filter
 *  - getCard             — fetch a single card by ID
 *  - updateCard          — patch owner's card fields
 *  - deleteCard          — soft-delete via isPublic=false, or hard delete
 *  - toggleLike          — idempotent like/unlike
 *  - toggleSave          — idempotent save/unsave
 *  - reportCard          — idempotent report
 *  - applySettings       — extract settings object from a card for display
 */

import prisma from '@/lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardSettings {
  iso: number
  aperture: number
  shutter: string
  whiteBalance: string
  meteringMode: string
}

export interface CreateCardInput {
  userId: string
  sessionId?: string
  cameraModel: string
  lat: number
  lng: number
  locationName: string
  settings: CardSettings
  weatherConditions?: Record<string, unknown>
  photoUrl?: string
  caption?: string
}

export interface CardListItem {
  id: string
  userId: string
  cameraModel: string
  lat: number
  lng: number
  locationName: string
  settings: CardSettings
  weatherConditions: unknown
  photoUrl: string | null
  caption: string | null
  likesCount: number
  savesCount: number
  createdAt: Date
  user: { id: string; email: string }
  /** Distance in metres from search origin (undefined when no location filter) */
  distanceMetres?: number
}

export interface ListCardsOptions {
  /** Filter to cards within 500 m of this point */
  lat?: number
  lng?: number
  /** Filter by camera model substring (case-insensitive) */
  cameraModel?: string
  page?: number
  limit?: number
}

export interface CardDetail extends CardListItem {
  sessionId: string | null
  isFlagged: boolean
  /** Whether the requesting user has liked this card */
  likedByUser?: boolean
  /** Whether the requesting user has saved this card */
  savedByUser?: boolean
}

// ─── Haversine ────────────────────────────────────────────────────────────────

/** Returns distance in metres between two WGS-84 coordinates. */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000 // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Narrow Prisma's Json type to CardSettings (throws if invalid). */
function parseSettings(raw: unknown): CardSettings {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid settings JSON in database')
  }
  const s = raw as Record<string, unknown>
  return {
    iso: Number(s.iso),
    aperture: Number(s.aperture),
    shutter: String(s.shutter),
    whiteBalance: String(s.whiteBalance),
    meteringMode: String(s.meteringMode),
  }
}

// ─── createCard ───────────────────────────────────────────────────────────────

/**
 * Publishes a new settings card.
 * GPS coordinates (lat/lng) are required — throws if missing.
 */
export async function createCard(input: CreateCardInput): Promise<CardDetail> {
  const {
    userId,
    sessionId,
    cameraModel,
    lat,
    lng,
    locationName,
    settings,
    weatherConditions,
    photoUrl,
    caption,
  } = input

  if (lat == null || lng == null) {
    throw new Error('GPS coordinates (lat/lng) are required to publish a settings card')
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('lat and lng must be numbers')
  }

  const card = await prisma.settingsCard.create({
    data: {
      userId,
      sessionId: sessionId ?? null,
      cameraModel,
      lat,
      lng,
      locationName,
      settings: settings as object,
      weatherConditions: weatherConditions ? (weatherConditions as object) : undefined,
      photoUrl: photoUrl ?? null,
      caption: caption ?? null,
      isPublic: true,
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  })

  return {
    id: card.id,
    userId: card.userId,
    cameraModel: card.cameraModel,
    lat: Number(card.lat),
    lng: Number(card.lng),
    locationName: card.locationName,
    settings: parseSettings(card.settings),
    weatherConditions: card.weatherConditions,
    photoUrl: card.photoUrl,
    caption: card.caption,
    likesCount: card.likesCount,
    savesCount: card.savesCount,
    createdAt: card.createdAt,
    sessionId: card.sessionId,
    isFlagged: card.isFlagged,
    user: card.user,
  }
}

// ─── listCards ────────────────────────────────────────────────────────────────

const SEARCH_RADIUS_METRES = 500

/**
 * Returns public settings cards, optionally filtered by:
 *  - location (within 500 m Haversine)
 *  - camera model (case-insensitive substring)
 */
export async function listCards(
  options: ListCardsOptions = {}
): Promise<{ cards: CardListItem[]; total: number; page: number; limit: number }> {
  const { lat, lng, cameraModel, page = 1, limit = 20 } = options
  const skip = (page - 1) * limit

  // Build Prisma where clause
  const where: {
    isPublic: boolean
    isFlagged: boolean
    cameraModel?: { contains: string; mode: 'insensitive' }
  } = {
    isPublic: true,
    isFlagged: false,
  }

  if (cameraModel) {
    where.cameraModel = { contains: cameraModel, mode: 'insensitive' as const }
  }

  // Fetch candidates — if location filter, we over-fetch and post-filter with Haversine
  // (SQLite has no spatial index, so we fetch all matching camera rows and filter in app)
  const hasLocationFilter = lat != null && lng != null

  const allMatching = await prisma.settingsCard.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, email: true } },
    },
  })

  let filtered: (typeof allMatching[number] & { distanceMetres?: number })[] = allMatching

  if (hasLocationFilter) {
    filtered = allMatching
      .map((card) => ({
        ...card,
        distanceMetres: haversineDistance(lat!, lng!, Number(card.lat), Number(card.lng)),
      }))
      .filter((card) => card.distanceMetres! <= SEARCH_RADIUS_METRES)
      .sort((a, b) => a.distanceMetres! - b.distanceMetres!)
  }

  const total = filtered.length
  const paginated = filtered.slice(skip, skip + limit)

  return {
    cards: paginated.map((card) => ({
      id: card.id,
      userId: card.userId,
      cameraModel: card.cameraModel,
      lat: Number(card.lat),
      lng: Number(card.lng),
      locationName: card.locationName,
      settings: parseSettings(card.settings),
      weatherConditions: card.weatherConditions,
      photoUrl: card.photoUrl,
      caption: card.caption,
      likesCount: card.likesCount,
      savesCount: card.savesCount,
      createdAt: card.createdAt,
      user: card.user,
      distanceMetres: card.distanceMetres,
    })),
    total,
    page,
    limit,
  }
}

// ─── getCard ──────────────────────────────────────────────────────────────────

/**
 * Returns a single card by ID.
 * If requestingUserId is provided, includes likedByUser and savedByUser flags.
 * Returns null if card not found or is private/flagged (unless owner).
 */
export async function getCard(
  id: string,
  requestingUserId?: string
): Promise<CardDetail | null> {
  const card = await prisma.settingsCard.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true } },
    },
  })

  if (!card) return null

  // Non-owners can only see public, non-flagged cards
  if (!card.isPublic || card.isFlagged) {
    if (card.userId !== requestingUserId) return null
  }

  let likedByUser = false
  let savedByUser = false

  if (requestingUserId) {
    const [like, save] = await Promise.all([
      prisma.cardLike.findUnique({
        where: { userId_cardId: { userId: requestingUserId, cardId: id } },
        select: { userId: true },
      }),
      prisma.savedCard.findUnique({
        where: { userId_cardId: { userId: requestingUserId, cardId: id } },
        select: { userId: true },
      }),
    ])
    likedByUser = like != null
    savedByUser = save != null
  }

  return {
    id: card.id,
    userId: card.userId,
    cameraModel: card.cameraModel,
    lat: Number(card.lat),
    lng: Number(card.lng),
    locationName: card.locationName,
    settings: parseSettings(card.settings),
    weatherConditions: card.weatherConditions,
    photoUrl: card.photoUrl,
    caption: card.caption,
    likesCount: card.likesCount,
    savesCount: card.savesCount,
    createdAt: card.createdAt,
    sessionId: card.sessionId,
    isFlagged: card.isFlagged,
    user: card.user,
    likedByUser,
    savedByUser,
  }
}

// ─── updateCard ───────────────────────────────────────────────────────────────

export interface UpdateCardInput {
  caption?: string
  locationName?: string
  photoUrl?: string
  isPublic?: boolean
}

/**
 * Updates a settings card. Only the owner may update.
 * Returns null if card not found or not owned by userId.
 */
export async function updateCard(
  id: string,
  userId: string,
  data: UpdateCardInput
): Promise<CardDetail | null> {
  const existing = await prisma.settingsCard.findFirst({
    where: { id, userId },
    select: { id: true },
  })

  if (!existing) return null

  const updated = await prisma.settingsCard.update({
    where: { id },
    data: {
      ...(data.caption !== undefined && { caption: data.caption }),
      ...(data.locationName !== undefined && { locationName: data.locationName }),
      ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
      ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
    },
    include: { user: { select: { id: true, email: true } } },
  })

  return {
    id: updated.id,
    userId: updated.userId,
    cameraModel: updated.cameraModel,
    lat: Number(updated.lat),
    lng: Number(updated.lng),
    locationName: updated.locationName,
    settings: parseSettings(updated.settings),
    weatherConditions: updated.weatherConditions,
    photoUrl: updated.photoUrl,
    caption: updated.caption,
    likesCount: updated.likesCount,
    savesCount: updated.savesCount,
    createdAt: updated.createdAt,
    sessionId: updated.sessionId,
    isFlagged: updated.isFlagged,
    user: updated.user,
  }
}

// ─── deleteCard ───────────────────────────────────────────────────────────────

/**
 * Hard-deletes a settings card. Only the owner may delete.
 * Returns true on success, false if not found or not owned.
 */
export async function deleteCard(id: string, userId: string): Promise<boolean> {
  const existing = await prisma.settingsCard.findFirst({
    where: { id, userId },
    select: { id: true },
  })

  if (!existing) return false

  await prisma.settingsCard.delete({ where: { id } })
  return true
}

// ─── toggleLike ───────────────────────────────────────────────────────────────

/**
 * Idempotent like toggle.
 *
 * - If the user has NOT liked the card → creates like record, increments likesCount.
 * - If the user HAS liked the card   → removes like record, decrements likesCount.
 *
 * Returns { liked: boolean; likesCount: number }.
 */
export async function toggleLike(
  cardId: string,
  userId: string
): Promise<{ liked: boolean; likesCount: number }> {
  const card = await prisma.settingsCard.findUnique({
    where: { id: cardId },
    select: { id: true, likesCount: true },
  })

  if (!card) throw new Error('Card not found')

  const existing = await prisma.cardLike.findUnique({
    where: { userId_cardId: { userId, cardId } },
  })

  if (existing) {
    // Already liked → unlike
    await prisma.$transaction([
      prisma.cardLike.delete({ where: { userId_cardId: { userId, cardId } } }),
      prisma.settingsCard.update({
        where: { id: cardId },
        data: { likesCount: Math.max(0, card.likesCount - 1) },
      }),
    ])
    return { liked: false, likesCount: Math.max(0, card.likesCount - 1) }
  } else {
    // Not liked → like
    await prisma.$transaction([
      prisma.cardLike.create({ data: { userId, cardId } }),
      prisma.settingsCard.update({
        where: { id: cardId },
        data: { likesCount: card.likesCount + 1 },
      }),
    ])
    return { liked: true, likesCount: card.likesCount + 1 }
  }
}

// ─── toggleSave ───────────────────────────────────────────────────────────────

/**
 * Idempotent save toggle.
 * Returns { saved: boolean; savesCount: number }.
 */
export async function toggleSave(
  cardId: string,
  userId: string
): Promise<{ saved: boolean; savesCount: number }> {
  const card = await prisma.settingsCard.findUnique({
    where: { id: cardId },
    select: { id: true, savesCount: true },
  })

  if (!card) throw new Error('Card not found')

  const existing = await prisma.savedCard.findUnique({
    where: { userId_cardId: { userId, cardId } },
  })

  if (existing) {
    await prisma.$transaction([
      prisma.savedCard.delete({ where: { userId_cardId: { userId, cardId } } }),
      prisma.settingsCard.update({
        where: { id: cardId },
        data: { savesCount: Math.max(0, card.savesCount - 1) },
      }),
    ])
    return { saved: false, savesCount: Math.max(0, card.savesCount - 1) }
  } else {
    await prisma.$transaction([
      prisma.savedCard.create({ data: { userId, cardId } }),
      prisma.settingsCard.update({
        where: { id: cardId },
        data: { savesCount: card.savesCount + 1 },
      }),
    ])
    return { saved: true, savesCount: card.savesCount + 1 }
  }
}

// ─── reportCard ───────────────────────────────────────────────────────────────

/**
 * Reports a settings card. Idempotent per user (upsert).
 * Returns { reported: boolean }.
 */
export async function reportCard(
  cardId: string,
  userId: string,
  reason?: string
): Promise<{ reported: boolean }> {
  const card = await prisma.settingsCard.findUnique({
    where: { id: cardId },
    select: { id: true },
  })

  if (!card) throw new Error('Card not found')

  await prisma.cardReport.upsert({
    where: { userId_cardId: { userId, cardId } },
    create: { userId, cardId, reason: reason ?? null },
    update: { reason: reason ?? null },
  })

  return { reported: true }
}

// ─── applySettings ────────────────────────────────────────────────────────────

/**
 * Returns the settings object from a card, ready to be applied to the
 * recommendation panel in the UI.
 *
 * Returns null if card is not found or not accessible.
 */
export async function applySettings(
  cardId: string,
  requestingUserId: string
): Promise<CardSettings | null> {
  const card = await getCard(cardId, requestingUserId)
  if (!card) return null
  return card.settings
}
