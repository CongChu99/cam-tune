# Tech Stack: Detailed AI Camera Parameters
> Date: 2026-03-23

## Unchanged Stack

The following core dependencies are unaffected by this feature and require no version changes:

- **Next.js 14+ (App Router)** — routing, API routes, server components
- **TypeScript** — strict mode; all new modules must be fully typed
- **Supabase PostgreSQL** — primary database; new columns added to existing tables via migrations
- **Prisma ORM** — schema additions for `LensProfile` and `recommendation_requests`; existing client unchanged
- **OpenAI SDK** — already in use; `response_format` parameter added to existing completion calls
- **Zustand** — client-side state for active lens profile and shooting intent (session-level)
- **Tailwind CSS** — no new utility classes required; Shot Details panel uses existing component primitives
- **Zod** — validation library already in use; extended for new `ShootingIntent` and `LensProfile` input schemas
- **Lightroom OAuth integration** — unchanged; XMP builder extended, not replaced
- **Capture One JS plugin** — unchanged; XMP builder extended, not replaced

## New Dependencies

### Lens Database Seeding

**Lensfun XML (LGPL-3.0)**
Open-source lens database maintained by the Lensfun project, containing 1,000+ lens entries across all major manufacturers. Parsed at build time into the Supabase `lens_profiles` table; no runtime XML dependency.

- Source: `https://github.com/lensfun/lensfun` (official repository)
- Format: DTD-defined XML with `<lens>` elements containing `<model>`, `<mount>`, `<cropfactor>`, `<calibration>` blocks
- Tool: Custom Node.js seed script at `scripts/seed-lensfun.ts`
  - Parses XML using Node's built-in `DOMParser` or `fast-xml-parser` (MIT)
  - Extracts: `maker`, `model`, `type`, `focalLengthMm` (or min/max for zooms), `maxAperture`, `lensfunId`
  - Upserts into `lens_profiles` with `source = 'lensfun'`; existing manual entries are not overwritten
- Run: `npm run seed:lensfun` in CI before deploy; idempotent (upsert by `lensfunId`)
- **Attribution required**: Lensfun credit must appear in the app's About/Legal page per LGPL-3.0 terms

**fast-xml-parser (MIT)**
Lightweight, dependency-free XML parser for Node.js. Used exclusively in the seed script; not bundled into the browser build.

```
npm install --save-dev fast-xml-parser
```

### EXIF Extraction

**exifr (MIT)**
Browser + Node.js EXIF extraction library, actively maintained, handles all major camera brands (Canon CR2/CR3, Nikon NEF, Sony ARW, Fujifilm RAF, and JPEG/HEIC). Chosen over alternatives:

| Library | Status | Browser | Node | Notes |
|---|---|---|---|---|
| `exifr` | Active (2024) | Yes | Yes | Handles all major formats; tree-shakeable |
| `exif-js` | Unmaintained (2019) | Yes | No | Abandoned; missing Canon CR3/Sony ARW |
| `piexifjs` | Low activity | Yes | No | Write-focused; read support limited |

```
npm install exifr
```

Usage: client-side only in `ExifExtractorClient`; reads `LensModel`, `FocalLength`, `FNumber`, `Make`, `Model` tags from the uploaded reference photo File object. No photo data is uploaded to the server; extraction runs entirely in the browser.

### AI Structured Output

**OpenAI `response_format: json_schema`**
Available on `gpt-4o-2024-08-06` and later model versions. Eliminates the fragile regex-based `extractFirstJSON()` parse path for structured recommendation data when the user's BYOK key is on a compatible model.

- New file: `lib/ai/recommendation-schema.ts` — exports the `RecommendationResult` JSON Schema and the `isStructuredOutputSupported(modelId: string)` detector
- Model detection: parse the date suffix from the model ID string; structured output assumed supported for any `gpt-4o` variant dated `2024-08-06` or later, and any `gpt-4.1` or `o*` series
- Fallback: when structured output is not supported, existing `extractFirstJSON()` + `coerceSuggestion()` pipeline runs unchanged
- No new npm dependency; uses the `openai` SDK's existing `response_format` parameter

## Architecture Changes

### Prompt Layer

`buildSystemPrompt()` in `lib/ai/prompt-builder.ts` is expanded from a fixed template string to a typed function accepting optional `lensProfile` and `shootingIntent` parameters. Each new signal is serialized into the system prompt only when the field is non-null, so the prompt is never polluted with "unknown" or "null" placeholders.

New fields added to prompt when present:
- `lensType` (PRIME / ZOOM / MACRO / FISHEYE / TILT_SHIFT)
- `focalLengthMm` (actual focal length; or midpoint for zoom without set position)
- `maxAperture` (absolute aperture ceiling for this lens)
- `isStabilized` + `combinedStabilizationStops` (capped at 8)
- `subjectMotionSpeed` (stationary / walking / running / vehicle / sports)
- `outputMedium` (web_1080 / web_4k / print_a4 / print_a2_plus / commercial)
- `flashAvailability` (none / speedlight / studio_strobe / hss_capable)
- `dualNativeIsoValues` (array of two ISO values, only when `dualNativeIso = true`)

New file: `lib/ai/recommendation-schema.ts`
- Exports `RecommendationResultSchema` (JSON Schema object for OpenAI `response_format`)
- Exports `isStructuredOutputSupported(modelId: string) → boolean`
- Schema defines all required response fields plus new fields: `apertureClampApplied`, `stabilizationWarning`, `dualNativeIsoApplied`, `diffractionWarning`, `flashSyncWarning`

### Validation Layer

`coerceSuggestion()` in `lib/ai/coerce-suggestion.ts` gains five new constraint validators called in order after the existing coercions:

1. `enforceApertureClamp(aperture, lensProfile)` — clamp aperture to `maxAperture`; set `apertureClampApplied = true` if changed
2. `enforceStabilizationCap(ibisStops, oisStops)` — return `min(ibisStops + oisStops, 8)`; set `stabilizationWarning` if combined exceeded 8
3. `enforceFlashSync(shutterSpeed, flashAvailability, cameraSyncSpeed)` — set `flashSyncWarning` if non-HSS speedlight and shutter > 1/200s
4. `enforceDiffractionGuard(aperture, outputMedium, sensorSize, megapixels)` — set `diffractionWarning` for print_a2_plus above f/11 (APS-C) or f/16 (FF)
5. `enforceDualNativeISO(iso, dualNativeIsoValues)` — nudge ISO to nearest native stage when within 1/2-stop

New helper: `lib/ai/validate-lens-constraints.ts` — extracted standalone helpers for unit testing each validator in isolation.

### XMP Export Layer

`IntegrationService.buildXMP()` (used by both the Lightroom OAuth path and the Capture One plugin path) is extended to accept optional `lensProfile` and `shootingIntent` parameters and write new `cameratune:` namespace fields.

New XMP namespace declaration added to all exports:
```xml
xmlns:cameratune="https://cameratune.app/xmp/1.0/"
```

New XMP fields written when non-null:
- `cameratune:LensProfile` — JSON string: `{ focalLengthMm, maxAperture, lensType, stabilizationStops }`
- `cameratune:OutputMedium` — enum string
- `cameratune:ShadowPriority` — enum string
- `cameratune:FlashMode` — enum string
- `cameratune:SubjectMotion` — enum string

Fields with null values are omitted entirely from the XMP sidecar (no empty elements).

## Decisions

| Decision | Choice | Rationale | Alternative Considered |
|---|---|---|---|
| Lens DB source | Lensfun XML + custom seed script | LGPL-3.0 compatible, 1,000+ lenses, fully offline, no API dependency | DPReview scrape (deprecated), manual-only (too sparse for launch), B&H/Adorama API (terms unclear) |
| EXIF library | `exifr` | MIT license, browser + Node support, actively maintained, handles CR3/ARW/RAF, tree-shakeable | `exif-js` (unmaintained since 2019), `piexifjs` (write-focused, limited read) |
| AI output format | `json_schema` with `extractFirstJSON` fallback | Eliminates parse failures for new fields on compatible models; fully backward compatible for BYOK users on older models | `json_schema` only (breaks users with GPT-3.5/older keys), template string only (fragile with 13 output fields) |
| Stabilization cap | 8 stops maximum (hard cap) | Physical hardware limit per Olympus/Sony engineering documentation; prevents confidently wrong recommendations that defy physics | No cap (produces claims like 1/1s handheld at 200mm — not real-world achievable) |
| XMP field prefix | `cameratune:` with versioned URI (`https://cameratune.app/xmp/1.0/`) | Avoids conflict with Adobe reserved namespaces (`xmp:`, `exif:`, `crs:`) and Capture One reserved prefixes | Short prefix `ct:` (high collision risk), `camtune:` (ambiguous) |
| ShootingIntent persistence | Columns on `recommendation_requests`, not a separate table | Keeps intent per-recommendation (correct semantic); avoids join for the common read path; simpler schema for v1 | Separate `shooting_intents` table (premature normalization for v1 usage patterns) |
| Seed script timing | Build-time (CI step before deploy) | Idempotent upsert; lens DB does not change per request; avoids runtime Lensfun dependency | Runtime XML parse (adds latency, unnecessary); manual CSV (too brittle to maintain) |
