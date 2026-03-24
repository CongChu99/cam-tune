/**
 * Lensfun lens database seeder.
 *
 * Reads the parsed lens JSON from data/lensfun/lenses.json and upserts
 * into the LensfunLens table with popularity weighting.
 *
 * Usage:
 *   npx tsx scripts/lensfun-seed.ts
 *
 * Idempotent — safe to re-run after Lensfun updates.
 */

import type { LensfunRecord } from './lensfun-parse'

// ─── Popularity weights ──────────────────────────────────────────────────────

/**
 * Popularity weight mapping by manufacturer.
 * Higher weight = appears first in search results.
 */
export const POPULARITY_WEIGHTS: Record<string, number> = {
  canon: 10,
  nikon: 9,
  sony: 8,
  fujifilm: 7,
  sigma: 6,
  tamron: 5,
  olympus: 4,
  panasonic: 4,
  pentax: 3,
  samyang: 3,
  zeiss: 3,
  leica: 2,
  tokina: 2,
  viltrox: 2,
}

/**
 * Returns the popularity weight for a manufacturer.
 * Case-insensitive lookup. Returns 0 for unknown manufacturers.
 */
export function getPopularityWeight(manufacturer: string): number {
  return POPULARITY_WEIGHTS[manufacturer.toLowerCase()] ?? 0
}

// ─── Record mapping ──────────────────────────────────────────────────────────

export interface LensfunUpsertData {
  lensfunId: string
  manufacturer: string
  model: string
  focalLengthMinMm: number
  focalLengthMaxMm: number
  maxAperture: number
  lensType: 'PRIME' | 'ZOOM'
  popularityWeight: number
}

/**
 * Maps a parsed LensfunRecord to the data shape for Prisma upsert.
 */
export function mapLensfunRecordToUpsertData(record: LensfunRecord): LensfunUpsertData {
  return {
    lensfunId: record.lensfunId,
    manufacturer: record.manufacturer,
    model: record.model,
    focalLengthMinMm: record.focalLengthMinMm,
    focalLengthMaxMm: record.focalLengthMaxMm,
    maxAperture: record.maxAperture,
    lensType: record.lensType,
    popularityWeight: getPopularityWeight(record.manufacturer),
  }
}

// ─── CLI entrypoint ──────────────────────────────────────────────────────────

async function main() {
  const fs = await import('fs')
  const path = await import('path')

  // Dynamic import of Prisma client to avoid import issues in test env
  const { PrismaClient } = await import('../lib/generated/prisma')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const dotenv = await import('dotenv')
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Check .env.local')
    process.exit(1)
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl })
  const prisma = new PrismaClient({ adapter })

  const lensesPath = path.resolve(__dirname, '..', 'data', 'lensfun', 'lenses.json')

  if (!fs.existsSync(lensesPath)) {
    console.error(`Lenses JSON not found at ${lensesPath}. Run 'npx tsx scripts/lensfun-parse.ts' first.`)
    process.exit(1)
  }

  const lenses: LensfunRecord[] = JSON.parse(fs.readFileSync(lensesPath, 'utf-8'))
  console.log(`Seeding ${lenses.length} lenses into LensfunLens table...`)

  let upserted = 0
  let errors = 0

  for (const record of lenses) {
    const data = mapLensfunRecordToUpsertData(record)
    try {
      await prisma.lensfunLens.upsert({
        where: { lensfunId: data.lensfunId },
        create: data,
        update: {
          manufacturer: data.manufacturer,
          model: data.model,
          focalLengthMinMm: data.focalLengthMinMm,
          focalLengthMaxMm: data.focalLengthMaxMm,
          maxAperture: data.maxAperture,
          lensType: data.lensType,
          popularityWeight: data.popularityWeight,
        },
      })
      upserted++
    } catch (err) {
      errors++
      if (errors <= 5) {
        console.warn(`  Error upserting ${data.lensfunId}: ${(err as Error).message}`)
      }
    }
  }

  await prisma.$disconnect()
  console.log(`\nDone: ${upserted} lenses upserted, ${errors} errors.`)
}

// Only run main() when executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error)
}
