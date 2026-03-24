/**
 * Lens Database Service — search and lookup against the LensfunLens table.
 *
 * Provides:
 *  - search(query)      — full-text ILIKE search with popularity sort, capped at 20 results
 *  - getByLensfunId(id) — lookup by Lensfun ID
 *
 * Pure helpers (testable without DB):
 *  - sanitizeSearchQuery — input sanitization
 *  - buildSearchConditions — generates Prisma WHERE conditions
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export const MAX_SEARCH_RESULTS = 20

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
