/**
 * Lensfun XML database parser.
 *
 * Downloads lens database XML files from the Lensfun GitHub repo and
 * extracts structured lens records suitable for seeding.
 *
 * Usage:
 *   npx tsx scripts/lensfun-parse.ts
 *
 * Output:
 *   data/lensfun/lenses.json
 */

import { XMLParser } from 'fast-xml-parser'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LensfunRecord {
  lensfunId: string
  manufacturer: string
  model: string
  focalLengthMinMm: number
  focalLengthMaxMm: number
  maxAperture: number
  lensType: 'PRIME' | 'ZOOM'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts max aperture (widest, i.e. smallest f-number) from a lens model name.
 * Handles formats: f/1.4, F1.4, f/3.5-5.6, F3.5-5.6
 * Returns the wide-end aperture (first number) or null if not found.
 */
export function extractApertureFromModel(model: string): number | null {
  // Match f/X.X, F/X.X, FX.X, fX.X patterns, optionally followed by -X.X
  const match = model.match(/[fF]\/?(\d+(?:\.\d+)?)/)
  if (match) {
    const val = parseFloat(match[1])
    if (val > 0 && val < 100) return val
  }
  return null
}

/**
 * Extracts focal length from a model name string.
 * Handles: "35mm", "18-55mm", "55-200mm"
 * Returns [min, max] or null.
 */
function extractFocalFromModel(model: string): [number, number] | null {
  // Match patterns like "35mm", "18-55mm", "55-200mm"
  const match = model.match(/(\d+)(?:\s*-\s*(\d+))?\s*mm/i)
  if (match) {
    const min = parseInt(match[1], 10)
    const max = match[2] ? parseInt(match[2], 10) : min
    if (min > 0 && max >= min) return [min, max]
  }
  return null
}

/**
 * Classifies a lens as PRIME or ZOOM based on focal length range.
 */
export function classifyLensType(
  minFocal: number,
  maxFocal?: number
): 'PRIME' | 'ZOOM' {
  if (maxFocal === undefined || maxFocal === minFocal) return 'PRIME'
  return 'ZOOM'
}

/**
 * Generates a stable ID from manufacturer + model.
 */
function generateLensfunId(maker: string, model: string): string {
  return `${maker}::${model}`
    .toLowerCase()
    .replace(/[^a-z0-9:]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── XML Parser ──────────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name: string) => name === 'lens' || name === 'model',
})

/**
 * Parses a Lensfun XML string and returns structured lens records.
 * Skips lenses where aperture cannot be extracted from the model name.
 */
export function parseLensXml(xml: string): LensfunRecord[] {
  const parsed = xmlParser.parse(xml)

  const db = parsed.lensdatabase
  if (!db) return []

  const lensEntries = db.lens
  if (!lensEntries || !Array.isArray(lensEntries)) return []

  const results: LensfunRecord[] = []

  for (const lens of lensEntries) {
    const maker = typeof lens.maker === 'string' ? lens.maker : ''
    if (!maker) continue

    // Get model: prefer lang="en" variant, fall back to first model
    let model = ''
    if (Array.isArray(lens.model)) {
      // Find English variant
      const enModel = lens.model.find(
        (m: Record<string, unknown>) => typeof m === 'object' && m['@_lang'] === 'en'
      )
      if (enModel && typeof enModel === 'object') {
        model = String((enModel as Record<string, unknown>)['#text'] ?? '')
      }
      if (!model) {
        // Fall back to first string model or first model's text
        for (const m of lens.model) {
          if (typeof m === 'string') {
            model = m
            break
          }
          if (typeof m === 'object' && (m as Record<string, unknown>)['#text']) {
            model = String((m as Record<string, unknown>)['#text'])
            break
          }
        }
      }
    } else if (typeof lens.model === 'string') {
      model = lens.model
    }

    if (!model) continue

    // Extract aperture from model name
    const maxAperture = extractApertureFromModel(model)
    if (maxAperture === null) continue

    // Extract focal length: prefer <focal> tag, fall back to model name
    let focalMin: number
    let focalMax: number

    if (lens.focal && typeof lens.focal === 'object') {
      const focalObj = lens.focal as Record<string, unknown>
      focalMin = Number(focalObj['@_min'] ?? 0)
      focalMax = Number(focalObj['@_max'] ?? focalMin)
    } else {
      const focalFromName = extractFocalFromModel(model)
      if (focalFromName) {
        ;[focalMin, focalMax] = focalFromName
      } else {
        // Skip lenses with no focal length info
        continue
      }
    }

    if (focalMin <= 0) continue

    const lensType = classifyLensType(focalMin, focalMax)

    results.push({
      lensfunId: generateLensfunId(maker, model),
      manufacturer: maker,
      model,
      focalLengthMinMm: focalMin,
      focalLengthMaxMm: focalMax,
      maxAperture,
      lensType,
    })
  }

  return results
}

// ─── CLI entrypoint ──────────────────────────────────────────────────────────

const LENSFUN_BASE_URL =
  'https://raw.githubusercontent.com/lensfun/lensfun/master/data/db'

const XML_FILES = [
  'mil-canon.xml',
  'mil-fujifilm.xml',
  'mil-hasselblad.xml',
  'mil-leica.xml',
  'mil-nikon.xml',
  'mil-olympus.xml',
  'mil-panasonic.xml',
  'mil-pentax.xml',
  'mil-samsung.xml',
  'mil-samyang.xml',
  'mil-sigma.xml',
  'mil-sony.xml',
  'mil-tamron.xml',
  'mil-tokina.xml',
  'mil-zeiss.xml',
  'om-system.xml',
  'slr-canon.xml',
  'slr-nikon.xml',
  'slr-pentax.xml',
  'slr-sigma.xml',
  'slr-sony.xml',
  'slr-tamron.xml',
  'slr-tokina.xml',
  'slr-samyang.xml',
  'slr-zeiss.xml',
  'slr-vivitar.xml',
  'slr-ricoh.xml',
  'slr-olympus.xml',
  'slr-panasonic.xml',
  'slr-leica.xml',
  'slr-hasselblad.xml',
  'slr-konica-minolta.xml',
  'rf-leica.xml',
  'compact-canon.xml',
  'compact-fujifilm.xml',
  'compact-nikon.xml',
  'compact-olympus.xml',
  'compact-panasonic.xml',
  'compact-sony.xml',
  'compact-ricoh.xml',
  'compact-leica.xml',
  'compact-sigma.xml',
  'generic.xml',
  'misc.xml',
]

async function main() {
  const fs = await import('fs')
  const path = await import('path')

  const allLenses: LensfunRecord[] = []
  let filesProcessed = 0

  console.log(`Downloading and parsing ${XML_FILES.length} Lensfun XML files...`)

  for (const file of XML_FILES) {
    const url = `${LENSFUN_BASE_URL}/${file}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        console.warn(`  SKIP ${file}: HTTP ${res.status}`)
        continue
      }
      const xml = await res.text()
      const lenses = parseLensXml(xml)
      allLenses.push(...lenses)
      filesProcessed++
      console.log(`  OK ${file}: ${lenses.length} lenses`)
    } catch (err) {
      console.warn(`  SKIP ${file}: ${(err as Error).message}`)
    }
  }

  // Deduplicate by lensfunId
  const seen = new Set<string>()
  const unique = allLenses.filter((l) => {
    if (seen.has(l.lensfunId)) return false
    seen.add(l.lensfunId)
    return true
  })

  // Sort by manufacturer, then model
  unique.sort((a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.model.localeCompare(b.model))

  const outDir = path.resolve(__dirname, '..', 'data', 'lensfun')
  fs.mkdirSync(outDir, { recursive: true })

  const outPath = path.join(outDir, 'lenses.json')
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2))

  console.log(`\nDone: ${unique.length} unique lenses from ${filesProcessed} files → ${outPath}`)
}

// Only run main() when executed directly (not imported)
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error)
}
