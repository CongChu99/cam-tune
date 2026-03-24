# Design: Detailed AI Camera Parameters
> Date: 2026-03-23
> Status: Draft

## Context

CamTune's current recommendation engine treats every lens as a hypothetical 50mm f/1.8 prime. This produces two systematic failure modes that erode user trust. First, the AI routinely suggests apertures that are physically impossible on the user's actual lens — recommending f/1.4 for a user shooting with an f/4 telephoto is not a confidence concern, it is a correctness failure. Second, the IBIS minimum-shutter calculation in `ibis-check.ts` defaults to 50mm regardless of the active focal length, meaning a photographer shooting at 200mm gets a handheld threshold calculated for a 50mm lens — an error of nearly 2 stops in the wrong direction. Both failures are silent: no warning is shown, and the 50mm constant is not visible to the user.

This design closes both gaps and adds five contextual signals (subject motion, output medium, flash, dual-native ISO, and XMP context propagation) that share the same prompt expansion path. The architecture is additive: all new parameters are optional with documented fallbacks, so the existing recommendation experience is fully preserved for users who do not configure a lens profile or shooting intent. The key structural changes are: `buildSystemPrompt()` gains typed optional parameters; `coerceSuggestion()` gains five new constraint validators; a new `LensDatabaseService` and `ExifExtractorClient` handle lens discovery; and `IntegrationService.buildXMP()` is extended with a versioned `cameratune:` namespace. An OpenAI `response_format: json_schema` path is added for compatible models, with `extractFirstJSON` fallback for older ones.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INPUT LAYER                             │
│                                                                     │
│  LensProfile (active)        ShootingIntent (session)               │
│  ┌─────────────────┐         ┌──────────────────────────┐           │
│  │ focalLengthMm   │         │ subjectMotionSpeed        │           │
│  │ maxAperture     │         │ outputMedium              │           │
│  │ isStabilized    │         │ flashAvailability         │           │
│  │ stabilizationSt │         │ backgroundBlurIntent      │           │
│  │ lensType        │         │ stabilizationMode         │           │
│  └────────┬────────┘         └────────────┬─────────────┘           │
│           │ (optional)                    │ (optional)              │
└───────────┼───────────────────────────────┼─────────────────────────┘
            │                               │
            ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXISTING SIGNAL LAYER                           │
│                                                                     │
│  CameraProfile: sensorSize, isoRange, ibisStops, noiseFloor,        │
│                 dynamicRangeEv, dualNativeIso, dualNativeIsoValues  │
│  WeatherContext: conditions, cloudCover, precipitation               │
│  SunContext: elevation, azimuth, goldenHour, uvIndex                │
│  GPS: latitude, longitude                                           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              buildSystemPrompt()  [lib/ai/prompt-builder.ts]        │
│                                                                     │
│  Serializes all available signals into structured system prompt.    │
│  New fields added when non-null: lensType, focalLengthMm,           │
│  maxAperture, combinedStabilizationStops, subjectMotionSpeed,       │
│  outputMedium, flashAvailability, dualNativeIsoValues               │
│                                                                     │
│  → getRecommendationSchema()  [lib/ai/recommendation-schema.ts]     │
│    isStructuredOutputSupported(modelId) → boolean                   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              OpenAI Completions API                                 │
│                                                                     │
│  Compatible models (gpt-4o-2024-08-06+):                           │
│    response_format: { type: 'json_schema',                          │
│                       json_schema: RecommendationResultSchema }     │
│                                                                     │
│  Older models (gpt-3.5, gpt-4-0613, etc.):                         │
│    Standard completion → extractFirstJSON() → raw object           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│         coerceSuggestion() / ConstraintValidator                    │
│                  [lib/ai/coerce-suggestion.ts]                      │
│                                                                     │
│  Existing:  type coercion, ISO/shutter/WB normalization             │
│  New:       enforceApertureClamp()                                  │
│             enforceStabilizationCap()                               │
│             enforceFlashSync()                                      │
│             enforceDiffractionGuard()                               │
│             enforceDualNativeISO()                                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              AIRecommendation[]   (recommendation result)           │
│                                                                     │
│  Existing fields: iso, aperture, shutterSpeed, whiteBalance,        │
│                   meteringMode, confidence, explanation             │
│  New fields: apertureClampApplied, stabilizationWarning,            │
│              diffractionWarning, flashSyncWarning,                  │
│              dualNativeIsoApplied, primarySignalDriver, warnings[]  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│         IntegrationService.buildXMP()  [lib/integrations/]          │
│                                                                     │
│  Existing XMP fields: cameratune:ISO, cameratune:Aperture, etc.     │
│  New XMP fields (omitted when null):                                │
│    cameratune:LensProfile, cameratune:OutputMedium,                 │
│    cameratune:ShadowPriority, cameratune:FlashMode,                 │
│    cameratune:SubjectMotion                                         │
│                                                                     │
│  → Lightroom OAuth path (existing)                                  │
│  → Capture One JS plugin path (existing)                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### LensDatabaseService (new)

**Purpose**: Manage the lens catalog — seed from Lensfun XML at build time, provide search by model name/focal length, and fuzzy-match raw EXIF `LensModel` strings to known entries.

**File**: `lib/lenses/lens-database-service.ts`

**Interface**:
```typescript
interface LensDatabaseService {
  search(query: string, options?: { brand?: string; limit?: number }): Promise<LensMatch[]>
  matchExif(lensModelString: string): Promise<{ lens: LensProfile | null; confidence: number; rawString: string }>
  getById(id: string): Promise<LensProfile | null>
  getByLensfunId(lensfunId: string): Promise<LensProfile | null>
}

interface LensMatch {
  lens: LensProfile
  score: number       // relevance score 0–1
  matchedOn: string   // 'model' | 'focal_length' | 'brand_model'
}
```

**Search logic**: Full-text search against `lens_profiles` table columns `maker`, `model` using PostgreSQL `ILIKE` with trigram index. Results ordered by: exact model match > focal length match > manufacturer popularity.

**EXIF matching logic**: Levenshtein distance normalized by string length. Confidence threshold for auto-accept: 0.85. Confidence threshold for "suggest with edit": 0.70. Below 0.70: show raw string with manual entry prompt. Unmatched strings are logged to `lens_exif_unmatched(raw_string, created_at, user_id)` for future training.

**Dependencies**: Supabase PostgreSQL (`lens_profiles` table), Lensfun XML seed (build-time via `scripts/seed-lensfun.ts`)

**Seed script**: `scripts/seed-lensfun.ts`
- Reads Lensfun XML from local clone or npm-installed package
- Parses `<lens>` elements using `fast-xml-parser`
- Maps each lens to `LensProfile` columns (see Data Model below)
- Upserts by `lensfun_id` (insert or update; does not overwrite `source = 'manual'` entries)
- Run: `npm run seed:lensfun` — idempotent, safe to re-run after Lensfun updates

---

### ExifExtractorClient (new)

**Purpose**: Client-side EXIF extraction from uploaded reference photos. Auto-populates `LensProfile` field suggestions without any server upload. The extracted `LensModel` string is passed to `LensDatabaseService.matchExif()` for database matching.

**File**: `lib/lenses/exif-extractor-client.ts`

**Interface**:
```typescript
interface ExifExtractorClient {
  extractLensData(file: File): Promise<ExifLensData>
}

interface ExifLensData {
  focalLength?: number          // mm, from EXIF FocalLength tag
  maxAperture?: number          // f-number, from FNumber or MaxApertureValue
  lensModel?: string            // raw string from LensModel tag
  isStabilized?: boolean        // inferred from lensModel string (contains "IS", "OSS", "VR", etc.)
  cameraMake?: string           // Make tag (for model detection context)
  cameraModel?: string          // Model tag
}
```

**Implementation notes**:
- Uses `exifr` library: `import { parse } from 'exifr'`
- Tags extracted: `FocalLength`, `FNumber`, `MaxApertureValue`, `LensModel`, `Make`, `Model`
- IS detection from `lensModel` string: check for substrings `IS`, `IS II`, `IS III`, `OSS`, `VR`, `VR II`, `OIS`, `MEGA OIS`, `VC`, `IBIS` (case-insensitive)
- No file data is sent to the server; `file.arrayBuffer()` is read in-browser
- Error handling: if EXIF is absent or unreadable, returns `{}` (all fields undefined); caller shows manual entry prompt

**Dependencies**: `exifr` (MIT), browser File API

---

### PromptBuilder (modified — buildSystemPrompt)

**Purpose**: Build the AI system prompt with all available signals. Extended to accept optional `LensProfile` and `ShootingIntent` parameters, serializing them into structured sections of the system prompt.

**File**: `lib/ai/prompt-builder.ts` (existing, modified)

**Interface** (expanded signature):
```typescript
function buildSystemPrompt(
  cameraProfile: CameraProfile,
  weatherContext: WeatherContext,
  sunContext: SunContext,
  lensProfile?: LensProfile | null,
  shootingIntent?: ShootingIntent | null,
): string
```

**New prompt sections added** (each section is only emitted when its data is non-null):

```
## Lens Profile
Lens: {maker} {model} ({lensType})
Focal length: {focalLengthMm}mm
Maximum aperture: f/{maxAperture}
Optical stabilization: {isStabilized ? `Yes — ${stabilizationStops} stops OIS` : 'No'}
Combined stabilization (IBIS + OIS): {combinedStabilizationStops} stops (capped at 8)

## Shooting Intent
Subject motion: {subjectMotionSpeed} → minimum shutter: {motionFloorShutter}
Output medium: {outputMedium}
Flash: {flashAvailability}
{dualNativeIsoSection}  ← only emitted when dualNativeIso = true
```

**Dual-native ISO section template**:
```
## Dual-Native ISO
This camera has dual native ISO at {values[0]} and {values[1]}.
Prefer native gain stages ({values[0]}, {values[1]}) over intermediate ISO values.
```

**Fallback values** (used when field is absent):
| Field | Fallback |
|---|---|
| `focalLengthMm` | 50 (placeholder; yellow indicator shown in UI) |
| `maxAperture` | 1.8 (placeholder) |
| `isStabilized` | false |
| `subjectMotionSpeed` | 'stationary' |
| `outputMedium` | 'web_1080' |
| `flashAvailability` | 'none' |

---

### RecommendationSchema (new)

**Purpose**: JSON Schema definition for OpenAI `response_format: json_schema` structured output. Provides model version detection to enable/disable structured output per BYOK key.

**File**: `lib/ai/recommendation-schema.ts`

**Interface**:
```typescript
function getRecommendationSchema(): JSONSchema7
function isStructuredOutputSupported(modelId: string): boolean
```

**`isStructuredOutputSupported` logic**:
- Returns `true` for: any model ID matching `gpt-4o-\d{4}-\d{2}-\d{2}` where date ≥ `2024-08-06`, `gpt-4o-mini`, `gpt-4.1*`, `o1*`, `o3*`
- Returns `false` for: `gpt-3.5*`, `gpt-4-0\d{3}`, `gpt-4-turbo-preview` (pre-structured-output)
- Returns `false` (safe default) for: unrecognized model IDs

**JSON Schema fields** (all required in AI response):

| Field | Type | Description |
|---|---|---|
| `iso` | integer | Recommended ISO value |
| `aperture` | number | Recommended aperture (f-number, e.g., 2.8) |
| `shutterSpeed` | string | Recommended shutter speed (e.g., "1/500") |
| `whiteBalance` | string | Recommended white balance preset |
| `meteringMode` | string | Recommended metering mode |
| `confidence` | number | 0–1 confidence score |
| `primarySignalDriver` | string | Which signal most influenced the recommendation |
| `explanation` | string \| null | Human-readable explanation (null in Quick Mode) |
| `warnings` | string[] | Array of warning strings (empty if none) |
| `apertureClampApplied` | boolean | Whether aperture was clamped to lens max |
| `stabilizationWarning` | string \| null | Combined IS exceeded 8 stops warning |
| `dualNativeIsoApplied` | boolean | Whether dual-native ISO steering was applied |
| `diffractionWarning` | string \| null | Diffraction threshold exceeded warning |
| `flashSyncWarning` | string \| null | Flash sync speed exceeded warning |

---

### ConstraintValidator (modified — coerceSuggestion)

**Purpose**: Post-parse validation pipeline that enforces all business rules regardless of AI output. Acts as a safety net after both the `json_schema` path and the `extractFirstJSON` fallback path.

**File**: `lib/ai/coerce-suggestion.ts` (existing, modified)
**New helper file**: `lib/ai/validate-lens-constraints.ts` (new, for isolated unit testing)

**Interface** (expanded signature):
```typescript
function validateAndCoerce(
  raw: Partial<AIOutput>,
  lensProfile?: LensProfile | null,
  cameraProfile?: CameraProfile | null,
  shootingIntent?: ShootingIntent | null,
): RecommendationResult
```

**New validators** (called in this order, after existing type coercions):

#### `enforceApertureClamp(aperture, lensProfile)`
```
effectiveMaxAperture = lensProfile.isVariableAperture && atTeleEnd
  ? lensProfile.maxApertureTele
  : lensProfile.maxAperture

if (aperture < effectiveMaxAperture):  // smaller f-number = wider aperture
  return { aperture: effectiveMaxAperture, apertureClampApplied: true,
           note: `f/${raw} requested but your lens maximum is f/${effectiveMaxAperture}` }
```

#### `enforceStabilizationCap(ibisStops, oisStops)`
```
combined = ibisStops + oisStops
if (combined > 8):
  return { combinedStops: 8, stabilizationWarning: "Combined IS exceeds 8 stops — using 8-stop maximum" }
return { combinedStops: combined, stabilizationWarning: null }
```

#### `enforceFlashSync(shutterSpeed, flashAvailability, cameraSyncSpeed)`
```
syncLimit = cameraSyncSpeed ?? 1/200   // use camera DB value if available
if (flashAvailability === 'speedlight' || flashAvailability === 'studio_strobe'):
  if (shutterSpeed > syncLimit):
    return { flashSyncWarning: `${shutterSpeed}s exceeds flash sync speed (~1/${1/syncLimit}s). Lower shutter or use HSS flash.` }
// hss_capable: no sync check
// none: no sync check
```

#### `enforceDiffractionGuard(aperture, outputMedium, sensorSize)`
```
if (outputMedium NOT IN ['print_a2_plus', 'commercial']): return { diffractionWarning: null }

threshold = {
  'apsc': 11,    // f/11
  'fullframe': 16,
  'mft': 8,
  'mediumformat': 22,
}[sensorSize] ?? 16

if (aperture > threshold):
  return { diffractionWarning: `f/${aperture} may produce diffraction softness for ${outputMedium} on your ${sensorSize} sensor. Consider f/${threshold * 0.7}–f/${threshold}.` }
```

#### `enforceDualNativeISO(iso, dualNativeIsoValues)`
```
if (!dualNativeIsoValues || dualNativeIsoValues.length !== 2): return iso  // no change

[low, high] = dualNativeIsoValues.sort()
midpoint = Math.sqrt(low * high)  // geometric midpoint

if (iso > midpoint && iso < high):  // between native stages, above midpoint
  return { iso: high, dualNativeIsoApplied: true }
if (iso > 0 && iso < low):          // below lower native stage
  return { iso: low, dualNativeIsoApplied: true }  // prefer native floor
return { iso, dualNativeIsoApplied: false }
```

---

### XMPBuilder (modified — IntegrationService)

**Purpose**: Build XMP sidecar with extended shooting context fields. Used by both the Lightroom OAuth export path and the Capture One JS plugin path.

**File**: `lib/integrations/integration-service.ts` (existing, modified)

**Interface** (expanded signature):
```typescript
function buildXMP(
  session: RecommendationSession,
  lensProfile?: LensProfile | null,
  shootingIntent?: ShootingIntent | null,
): string  // XML string
```

**New XMP namespace** added to `x:xmpmeta` root element:
```xml
xmlns:cameratune="https://cameratune.app/xmp/1.0/"
```

**New XMP fields** (written only when value is non-null):
| XMP Field | Source | Value |
|---|---|---|
| `cameratune:LensProfile` | `lensProfile` | JSON string: `{focalLengthMm, maxAperture, lensType, stabilizationStops}` |
| `cameratune:OutputMedium` | `shootingIntent.outputMedium` | Enum string (e.g., `"print_a2_plus"`) |
| `cameratune:ShadowPriority` | `shootingIntent.backgroundBlurIntent` | Enum string |
| `cameratune:FlashMode` | `shootingIntent.flashAvailability` | Enum string |
| `cameratune:SubjectMotion` | `shootingIntent.subjectMotionSpeed` | Enum string |

**Serialization rule**: Fields with null or undefined values are entirely omitted from the XMP output. This keeps XMP files minimal and avoids null-handling requirements in Lightroom/Capture One panel code.

## Data Model

### LensProfile table (modified)

Existing columns retained unchanged. New columns added via Prisma migration:

```sql
ALTER TABLE "lens_profiles" ADD COLUMN "lens_type"
  lens_type_enum NOT NULL DEFAULT 'PRIME';

ALTER TABLE "lens_profiles" ADD COLUMN "focal_length_min_mm"
  INTEGER NULL;

ALTER TABLE "lens_profiles" ADD COLUMN "focal_length_max_mm"
  INTEGER NULL;

ALTER TABLE "lens_profiles" ADD COLUMN "lensfun_id"
  VARCHAR(255) NULL;

ALTER TABLE "lens_profiles" ADD COLUMN "is_variable_aperture"
  BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "lens_profiles" ADD COLUMN "max_aperture_tele"
  FLOAT NULL;

ALTER TABLE "lens_profiles" ADD COLUMN "source"
  lens_source_enum NOT NULL DEFAULT 'manual';
```

New enum types:
```sql
CREATE TYPE lens_type_enum AS ENUM ('PRIME','ZOOM','MACRO','FISHEYE','TILT_SHIFT');
CREATE TYPE lens_source_enum AS ENUM ('lensfun','exif','manual');
```

Prisma schema additions:
```prisma
model LensProfile {
  // ... existing fields ...
  lensType          LensType    @default(PRIME)
  focalLengthMinMm  Int?
  focalLengthMaxMm  Int?
  lensfunId         String?     @unique
  isVariableAperture Boolean   @default(false)
  maxApertureTele   Float?
  source            LensSource  @default(manual)
}

enum LensType { PRIME ZOOM MACRO FISHEYE TILT_SHIFT }
enum LensSource { lensfun exif manual }
```

New supporting table for unmatched EXIF strings:
```sql
CREATE TABLE "lens_exif_unmatched" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_string  VARCHAR(500) NOT NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### ShootingIntent (session-level — columns on recommendation_requests)

New columns added to `recommendation_requests` table:

```sql
ALTER TABLE "recommendation_requests" ADD COLUMN "subject_motion_speed"
  subject_motion_enum NOT NULL DEFAULT 'stationary';

ALTER TABLE "recommendation_requests" ADD COLUMN "background_blur_intent"
  background_blur_enum NOT NULL DEFAULT 'irrelevant';

ALTER TABLE "recommendation_requests" ADD COLUMN "flash_availability"
  flash_availability_enum NOT NULL DEFAULT 'none';

ALTER TABLE "recommendation_requests" ADD COLUMN "output_medium"
  output_medium_enum NOT NULL DEFAULT 'web_1080';

ALTER TABLE "recommendation_requests" ADD COLUMN "stabilization_mode"
  stabilization_mode_enum NOT NULL DEFAULT 'handheld';
```

New enum types:
```sql
CREATE TYPE subject_motion_enum AS ENUM ('stationary','walking','running','vehicle','sports');
CREATE TYPE background_blur_enum AS ENUM ('maximum','moderate','deep','irrelevant');
CREATE TYPE flash_availability_enum AS ENUM ('none','speedlight','studio_strobe','hss_capable');
CREATE TYPE output_medium_enum AS ENUM ('web_1080','web_4k','print_a4','print_a2_plus','commercial');
CREATE TYPE stabilization_mode_enum AS ENUM ('handheld','tripod','monopod');
```

## API Design

### GET /api/lenses/search (new)

Search the seeded Lensfun database by model name, focal length keyword, or brand.

```
GET /api/lenses/search?q=85mm&brand=sony&limit=10
```

**Response**:
```typescript
{
  results: Array<{
    id: string
    maker: string
    model: string
    lensType: LensType
    focalLengthMm: number | null
    focalLengthMinMm: number | null
    focalLengthMaxMm: number | null
    maxAperture: number
    isStabilized: boolean
    stabilizationStops: number
    lensfunId: string
    source: 'lensfun'
    score: number
  }>
}
```

**Implementation**: PostgreSQL full-text search with trigram similarity on `maker || ' ' || model`. Response cached at CDN edge for 24h (lens DB does not change between deploys).

---

### POST /api/lenses/detect-exif (new)

Match a raw EXIF `LensModel` string to the closest Lensfun entry. Called client-side after `ExifExtractorClient` reads the EXIF data.

```
POST /api/lenses/detect-exif
Content-Type: application/json

{ "exifData": { "lensModel": "EF85mm f/1.4L IS USM", "focalLength": 85, "fNumber": 1.4, "make": "Canon" } }
```

**Response**:
```typescript
{
  matched: LensProfile | null
  confidence: number          // 0–1 Levenshtein normalized score
  rawString: string           // original lensModel input
  suggestions: LensProfile[]  // top-3 alternatives when confidence < 0.85
}
```

**Logic**: Levenshtein distance normalized by max string length. If `confidence >= 0.85` → single `matched` result. If `0.70 <= confidence < 0.85` → `matched` + `suggestions`. If `confidence < 0.70` → `matched: null` + `suggestions`. Unmatched strings are logged to `lens_exif_unmatched`.

---

### PATCH /api/lenses/:id (new)

Update lens profile fields, including the session-level `currentFocalLengthMm` zoom position (not stored in the database — stored in Zustand session state on the client; this endpoint handles durable updates to the `LensProfile` record itself).

```
PATCH /api/lenses/:id
Content-Type: application/json

{ "focalLengthMm": 135, "maxAperture": 2.8, "isStabilized": true, "stabilizationStops": 4 }
```

**Response**: Updated `LensProfile` record.
**Authorization**: User must own the lens profile (`userId` check on server).

---

### POST /api/recommend (modified)

Extended with optional new request fields. All new fields are optional; missing fields use documented defaults.

**New request fields**:
```typescript
{
  // ... existing fields ...
  lensProfileId?: string          // UUID of active LensProfile
  currentFocalLengthMm?: number   // current zoom position (session-level, not saved to DB)
  subjectMotionSpeed?: SubjectMotionSpeed
  outputMedium?: OutputMedium
  flashAvailability?: FlashAvailability
  backgroundBlurIntent?: BackgroundBlurIntent
  stabilizationMode?: StabilizationMode
}
```

**New response fields**:
```typescript
{
  // ... existing fields ...
  apertureClampApplied: boolean
  stabilizationWarning: string | null
  diffractionWarning: string | null
  flashSyncWarning: string | null
  dualNativeIsoApplied: boolean
  lensProfileUsed: 'active' | 'placeholder_50mm' | null
}
```

## Error Handling

| Scenario | Behavior |
|---|---|
| Lens not found in database (search returns 0 results) | Allow manual entry; save with `source: 'manual'`; recommendation proceeds without blocking |
| EXIF `LensModel` string unrecognized (confidence < 0.70) | Show raw EXIF string with "Could not identify lens" message; offer manual correction; log raw string to `lens_exif_unmatched` for future improvement |
| EXIF parse fails entirely (no EXIF in file) | Show "No lens data found in photo"; offer manual search or entry; no error thrown |
| OpenAI `json_schema` not supported (old model) | `isStructuredOutputSupported()` returns false; fall back to standard completion + `extractFirstJSON` + `coerceSuggestion`; no user-facing error or quality indicator change |
| AI returns invalid JSON even on fallback path | `extractFirstJSON` returns null; recommendation request fails with 422; user sees "AI response could not be parsed — try again"; logged for monitoring |
| Aperture clamp applied | Note added inline to recommendation: "Aperture adjusted to match your lens maximum (f/X)"; `apertureClampApplied: true` in response |
| Combined IS > 8 stops (IBIS + OIS) | Silently capped to 8 in `coerceSuggestion`; `stabilizationWarning` set in response; shown in Learning Mode tooltip; hidden in Quick Mode |
| Flash sync exceeded (non-HSS speedlight) | Inline warning on shutter speed field: "⚠️ Exceeds flash sync — reduce to 1/200s or use HSS flash"; `flashSyncWarning` set |
| Diffraction threshold exceeded | Inline warning on aperture field: "⚠️ Diffraction possible at f/X for A2+ print — consider f/8–f/11" |
| Dual-native ISO adjustment applied | No user-facing warning; `dualNativeIsoApplied: true` in response metadata; Learning Mode shows ISO explanation note |
| `LensProfile.maxAperture` is null (data integrity issue) | Skip aperture clamp; log warning; proceed with recommendation; do not block |
| XMP export with all-null new fields | Omit all new `cameratune:` fields from XMP; existing fields export normally; XMP remains valid |
| Lensfun seed script fails in CI | Block deploy; seed errors are fatal; alert via CI notification; last successful seed state remains in DB |

## Goals / Non-Goals

### Goals
- Eliminate impossible aperture recommendations by enforcing lens `maxAperture` as a hard ceiling in `coerceSuggestion()`
- Correct the IBIS handheld shutter calculation from the 50mm default to actual lens focal length
- Surface the dual-native ISO advantage for Sony (A7S III, ZV-E1), Panasonic (S5 II, GH6), and other dual-native cameras
- Extend XMP export with shooting context (lens profile, output medium, shadow priority, flash mode) for better post-processing pre-population
- Achieve zero regression for users without lens profiles — all new parameters are optional with documented fallbacks
- Maintain full backward compatibility for BYOK users on older OpenAI model versions

### Non-Goals
- AF system type and burst rate recommendations (phase 2 — requires separate data model and prompt design)
- Per-ISO read noise curves (requires automated data pipeline scraping DxOMark or sensorgen.info)
- Cinema T-stop support (professional video workflow — separate sprint with separate UX)
- Mobile app changes (web-only platform for this sprint)
- Full per-aperture lens sharpness profiles (Arsenal 2 hardware territory — not feasible without physical camera data)
- Community lens database contribution model (phase 2 — requires moderation workflow)
- Automated lens DB updates (phase 2 — Lensfun seed is manually triggered for now)

## Decisions

| Decision | Choice | Rationale | Alternative |
|---|---|---|---|
| Structured output | `json_schema` with `extractFirstJSON` fallback | Eliminates parse failures for new fields on compatible models; transparent backward compatibility for all BYOK users | `json_schema` only (breaks GPT-3.5 / GPT-4-0613 users who cannot change their key) |
| Lens DB source | Lensfun XML parsed at build time | LGPL-3.0 compatible, 1,000+ lenses, no runtime API dependency, offline-capable | Runtime Lensfun API (no such API exists), manual CSV (unmaintainable at scale) |
| EXIF library | `exifr` (MIT) | Browser + Node support, handles CR2/CR3/NEF/ARW/RAF/HEIC, tree-shakeable, actively maintained (2024) | `exif-js` (unmaintained since 2019, missing modern raw formats) |
| Stabilization cap | 8 stops hard cap in `coerceSuggestion` | Physical hardware limit per manufacturer specifications; prevents recommendations that imply impossible stability | No cap (would produce recommendations like "safe at 1/1s handheld at 400mm" — not achievable in practice) |
| ShootingIntent persistence | Columns on `recommendation_requests` table | Correct semantic: intent is per-recommendation; avoids join overhead; simpler schema for v1 usage patterns | Separate `shooting_intents` table (premature normalization; adds join for every recommendation read) |
| XMP namespace | `cameratune:` prefix with versioned URI `https://cameratune.app/xmp/1.0/` | Avoids collision with Adobe reserved prefixes (`xmp:`, `crs:`, `exif:`) and Capture One's `Catalog:` namespace | Short prefix `ct:` (collision risk with multiple third-party plugins using the same short prefix) |
| EXIF matching confidence threshold | 0.85 auto-accept / 0.70 suggest / below = manual | Conservative enough to avoid false-positive matches (e.g., "EF 85mm f/1.8" vs "EF 85mm f/1.4"); liberal enough that minor formatting differences (spacing, punctuation) auto-resolve | Fixed threshold 0.90 (too strict; rejects valid matches like "Canon EF 85/1.4" vs "Canon EF 85mm f/1.4") |
| Zoom focal length session storage | Zustand client state, not persisted to DB | Zoom position is a moment-in-time value, not a property of the lens; persisting it would require per-shoot lens records | Persisting `currentFocalLengthMm` to `lens_profiles` (wrong abstraction; a lens has one focal range, many positions) |
| Variable aperture zoom at tele end | Use `maxApertureTele` field from DB | Most zooms narrow by 1–2 stops at tele end; ignoring this produces impossible aperture clamps (claiming f/3.5 is achievable at 55mm on an 18–55 f/3.5–5.6) | Calculate from focal length ratio (theoretically correct but complex; use explicit DB field for reliability) |

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Beginners abandon due to input complexity (Shot Details panel) | High | High | Progressive disclosure: Shot Details collapsed by default in Quick Mode; Learning Mode shows inline with default values; measure setup completion rate at launch; target ≤3 taps to complete lens setup |
| Lens DB sparse for niche / vintage / third-party lenses | Medium | High | Manual entry fallback always available; raw EXIF string logged for retroactive matching; community contribution model planned for phase 2; Lensfun is actively maintained (3,000+ lenses in full DB) |
| EXIF `LensModel` string format inconsistency across manufacturers | High | Medium | Levenshtein fuzzy match handles punctuation and spacing differences; manufacturer-specific normalization rules (e.g., Canon "EF" vs "Canon EF") applied before matching; test corpus of 50 canonical strings in CI |
| Structured output `json_schema` breaks older BYOK model users | Medium | Medium | `isStructuredOutputSupported()` detection runs before every request; `extractFirstJSON` fallback is proven and tested; failure is transparent to user |
| Combined IS overclaims convince users to shoot at physically impossible shutter speeds | Medium | Low | Hard 8-stop cap in `coerceSuggestion`; Learning Mode tooltip: "8 stops is the maximum achievable with current hardware"; IBIS + OIS manufacturers themselves publish 8-stop combined benchmarks |
| Flash sync speed advice wrong for specific camera body | Medium | Medium | Conservative 1/200s default; override only when `maxFlashSyncSpeed` is present in `CameraDatabase`; warn rather than block; user always has final control |
| XMP field conflicts with Lightroom or Capture One internal metadata | Low | Low | `cameratune:` namespace with versioned URI; tested against Lightroom 13+ and Capture One v24+; XMP spec requires namespace uniqueness to prevent conflicts |
| Feature too complex → Arsenal 2 trap (hardware-comparable complexity, no hardware simplicity advantage) | High | High | Strict progressive disclosure policy: every new input must be invisible or auto-populated until the user explicitly engages with it; measure post-launch: if ≥30% of users never reach Shot Details, collapse it further or auto-infer from session history |
| Lensfun LGPL-3.0 attribution requirement missed | Low | Medium | Documented in `tech-stack.md`; attribution text required on About/Legal page before launch; CI check for presence of attribution string in production build |

## Testing Strategy

| Test Type | Scope | Key Cases |
|---|---|---|
| Unit: `ConstraintValidator` | All 5 new validators with boundary values | Aperture clamp: AI suggests f/1.4 on f/4 lens → clamps to f/4; combined IS: 7+5=12 → 8; flash sync: 1/500s + speedlight → warning; diffraction: f/16 + APS-C + print_a2_plus → warning; dual ISO: ISO 1600 on [800,3200] camera → 3200 |
| Unit: `PromptBuilder` | All new fields serialized correctly | Each new field present in prompt when supplied; fallback values used when field is null; prompt unchanged when all new params are null |
| Unit: `RecommendationSchema` | `isStructuredOutputSupported()` returns correct boolean | `gpt-4o-2024-08-06` → true; `gpt-4o-2024-05-13` → false; `gpt-3.5-turbo` → false; `gpt-4.1` → true; unknown model → false |
| Unit: `LensDatabaseService.matchExif` | Fuzzy match returns correct lens for top 50 EXIF strings | Canon "EF85mm f/1.4L IS USM" → correct match; Nikon "AF-S NIKKOR 50mm f/1.8G" → correct; unrecognized string → null + logged |
| Unit: `ExifExtractorClient` | EXIF extraction from known test files | JPEG with Canon EXIF → `focalLength: 85, lensModel: 'EF85mm f/1.4L IS USM'`; file without EXIF → all fields undefined; `isStabilized` IS detection from model string |
| Integration: `POST /api/recommend` | Full recommendation with all new fields | Request with lens profile + all ShootingIntent fields → response contains all new fields; aperture clamped when needed; diffraction warning present when applicable |
| Integration: `POST /api/lenses/detect-exif` | 10 canonical EXIF strings → correct Lensfun match | Confidence ≥ 0.85 for exact matches; 0.70–0.85 for formatting variants; null for completely unknown strings |
| Integration: `GET /api/lenses/search` | Search returns relevant results ≤1s | "85mm" returns ≥5 results; "sony 24-70" returns Sony GM; "xyz999" returns 0 results without error |
| E2E: Lens quick-add flow | Full user journey from no lens to active lens | User adds lens in ≤3 taps (tap "Add Lens" → type query → select result); recommendation immediately shows new focal length; IBIS check uses new focal length (not 50mm) |
| E2E: EXIF auto-detect | Upload reference photo → lens confirmed | Upload JPEG with Canon EF 85mm EXIF → "Detected: Canon EF 85mm f/1.4L IS USM — confirm?" → confirm → lens active; verify no server upload occurs (network tab) |
| E2E: XMP export round-trip | Full session → Lightroom/C1 panel | Session with active lens + outputMedium + flashAvailability → "Sync to Lightroom" → verify `cameratune:LensProfile` and `cameratune:OutputMedium` in XMP sidecar; null fields absent |
| Regression: No lens profile | All existing scenarios unchanged | Every pre-feature test scenario runs without modification; recommendations with no lens profile produce identical output; confidence scores unchanged; no new UI elements visible when lens not set (except yellow indicator) |
| Regression: Old OpenAI model | Fallback path produces valid recommendations | `gpt-3.5-turbo` BYOK key → structured output disabled → `extractFirstJSON` path → valid recommendation returned; no error thrown; user experience unchanged |
