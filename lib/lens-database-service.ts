/**
 * Lens Database Service — search and lookup against the LensfunLens table.
 *
 * Provides:
 *  - search(query)      — full-text ILIKE search with popularity sort, capped at 20 results
 *  - getByLensfunId(id) — lookup by Lensfun ID
 *
 * Pure helpers (testable without DB):
 *  - sanitizeSearchQuery     — input sanitization
 *  - buildSearchConditions   — generates Prisma WHERE conditions
 *  - normalizeForComparison  — lowercase + strip punctuation for fuzzy match
 *  - computeConfidence       — Levenshtein similarity score [0, 1]
 */

import { distance } from 'fastest-levenshtein'

// ─── Constants ───────────────────────────────────────────────────────────────

export const MAX_SEARCH_RESULTS = 20

/** Minimum Levenshtein similarity score to accept a fuzzy match. */
export const CONFIDENCE_THRESHOLD = 0.7

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalizes a lens name string for fuzzy comparison.
 * Lowercases, removes all punctuation except '/', and collapses whitespace.
 */
export function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Computes Levenshtein similarity between two lens name strings.
 * Normalizes both strings before comparison.
 * Returns a score in [0, 1]: 1.0 = identical, 0 = completely different.
 * Returns 0 if both strings are empty.
 */
export function computeConfidence(a: string, b: string): number {
  const normA = normalizeForComparison(a)
  const normB = normalizeForComparison(b)
  if (!normA && !normB) return 0
  const maxLen = Math.max(normA.length, normB.length)
  if (maxLen === 0) return 0
  return 1 - distance(normA, normB) / maxLen
}

/**
 * Sanitizes a search query string.
 * Allows alphanumeric, spaces, hyphens, dots, slashes, parentheses.
 * Trims whitespace and collapses multiple spaces.
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/[^a-zA-Z0-9\s\-./()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Builds Prisma WHERE conditions for lens search.
 * Each word in the query must match manufacturer OR model (AND across words).
 */
export function buildSearchConditions(query: string): {
  AND?: Array<{ OR: Array<Record<string, unknown>> }>
  OR?: Array<Record<string, unknown>>
} {
  const words = query.split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return {}
  }

  // For each word, match manufacturer or model
  const conditions = words.map((word) => ({
    OR: [
      { manufacturer: { contains: word, mode: 'insensitive' as const } },
      { model: { contains: word, mode: 'insensitive' as const } },
    ],
  }))

  // All words must match (AND)
  if (conditions.length === 1) {
    return { OR: conditions[0].OR }
  }

  return { AND: conditions }
}

// ─── Service methods ─────────────────────────────────────────────────────────

/**
 * Searches the LensfunLens table with ILIKE matching and popularity sort.
 *
 * @param query  Search query (manufacturer/model names, focal length, etc.)
 * @returns      Up to MAX_SEARCH_RESULTS matching lenses, sorted by popularity then model
 */
export async function search(query: string) {
  const { default: prisma } = await import('./prisma')
  const sanitized = sanitizeSearchQuery(query)
  if (!sanitized) return []

  const where = buildSearchConditions(sanitized)

  return prisma.lensfunLens.findMany({
    where,
    orderBy: [
      { popularityWeight: 'desc' },
      { model: 'asc' },
    ],
    take: MAX_SEARCH_RESULTS,
  })
}

/**
 * Looks up a lens by its Lensfun ID.
 */
export async function getByLensfunId(lensfunId: string) {
  const { default: prisma } = await import('./prisma')
  return prisma.lensfunLens.findUnique({
    where: { lensfunId },
  })
}

/**
 * Fuzzy-matches a raw EXIF lens model string against the LensfunLens table.
 * Uses Levenshtein similarity — if best match confidence >= CONFIDENCE_THRESHOLD,
 * returns { lens, confidence }. Otherwise logs the string to lens_exif_unmatched and returns null.
 *
 * @param lensModelString  Raw EXIF LensModel string (e.g. "Canon EF 50mm f/1.4 USM")
 * @param userId           ID of the user whose EXIF string was unmatched (for logging)
 */
export async function matchExif(
  lensModelString: string,
  userId: string
): Promise<{ lens: { id: string; lensfunId: string; manufacturer: string; model: string; focalLengthMinMm: number; focalLengthMaxMm: number; maxAperture: number; lensType: string; popularityWeight: number }, confidence: number } | null> {
  // Empty input — return null immediately
  if (!lensModelString.trim()) return null

  const { default: prisma } = await import('./prisma')

  // Fetch all lenses for comparison
  const lenses = await prisma.lensfunLens.findMany()

  if (lenses.length === 0) {
    await prisma.lensExifUnmatched.create({
      data: { rawLensModelString: lensModelString, userId },
    })
    return null
  }

  // Find best match by Levenshtein confidence
  let bestLens = lenses[0]
  let bestConfidence = computeConfidence(
    lensModelString,
    `${lenses[0].manufacturer} ${lenses[0].model}`
  )

  for (let i = 1; i < lenses.length; i++) {
    const lens = lenses[i]
    const conf = computeConfidence(lensModelString, `${lens.manufacturer} ${lens.model}`)
    if (conf > bestConfidence) {
      bestConfidence = conf
      bestLens = lens
    }
  }

  if (bestConfidence >= CONFIDENCE_THRESHOLD) {
    return {
      lens: {
        ...bestLens,
        maxAperture: Number(bestLens.maxAperture),
        lensType: String(bestLens.lensType),
      },
      confidence: bestConfidence,
    }
  }

  // Below threshold — log and return null
  await prisma.lensExifUnmatched.create({
    data: { rawLensModelString: lensModelString, userId },
  })
  return null
}
