# Design: CamTune — AI Camera Settings Advisor

> Direction: B — "Power Tool" (Dual-Mode UX)
> Date: 2026-03-18
> Status: Approved

---

## Context

Photography settings decisions (ISO, aperture, shutter speed, white balance, metering mode) require real-time adaptation to scene conditions, camera capabilities, and shooting intent. No existing software-only tool combines GPS, live weather, computer vision scene analysis, and camera-model-specific sensor data into unified recommendations.

CamTune is a greenfield web app that delivers AI-powered settings guidance using the user's own OpenAI API key (BYOK). A dual-mode UX serves both amateurs (Learning Mode with explanations) and semi-pros (Quick Mode with compact results). Community settings cards, shoot history, and Lightroom/Capture One integrations create workflow continuity and network effects.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Browser (Next.js)                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ Learning │  │  Quick   │  │  Community / Plan  │ │
│  │   Mode   │  │   Mode   │  │       Feed         │ │
│  └────┬─────┘  └────┬─────┘  └────────┬───────────┘ │
│       └─────────────┴────────────────┘              │
│              Zustand State Layer                     │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS
┌─────────────────▼───────────────────────────────────┐
│              Next.js API Routes                      │
│  /api/recommend  /api/weather  /api/session          │
│  /api/community  /api/integrations  /api/cameras     │
└──┬──────────┬────────────┬──────────────┬────────────┘
   │          │            │              │
   ▼          ▼            ▼              ▼
OpenAI    Open-Meteo   Supabase      Adobe/C1
(BYOK)    + SunCalc    PostgreSQL    OAuth APIs
```

**Key architectural decisions:**
- **Monolith (Next.js)** for v1: API routes + frontend in the same repo, simple Vercel deployment, zero inter-service latency
- **BYOK pattern**: OpenAI key never persists server-side long-term; instantiate `new OpenAI({ apiKey })` per-request from encrypted session
- **Supabase** handles auth (NextAuth + Supabase adapter), PostgreSQL, realtime (community feed), and storage (thumbnails)

---

## Components

### RecommendationEngine
- **Purpose**: Orchestrate all input signals (scene frame, GPS, weather, camera DNA) → AI call → structured top-3 settings output with confidence scores and explanations
- **Interface**: `recommend(cameraProfileId, sceneFrame, lat, lng, shootIntent?) → AIRecommendation[]`
- **Dependencies**: OpenAIClient, WeatherService, CameraDatabase

### OpenAIClient
- **Purpose**: BYOK wrapper — instantiate per-request with user's encrypted API key; list Vision-capable models; call Vision API with structured prompt
- **Interface**: `validateKey(apiKey) → ModelList`, `analyzeScene(apiKey, modelId, imageFrame, context) → SceneAnalysis`
- **Dependencies**: openai Node.js SDK

### WeatherService
- **Purpose**: Fetch and cache weather data and sun ephemeris per GPS coordinates (TTL 30 minutes via Upstash Redis); enforce staleness threshold
- **Interface**: `getContext(lat, lng, timestamp) → { weather: WeatherSnapshot, sun: SunPosition, locationName: string }`
- **Dependencies**: Open-Meteo API, SunCalc.js, Nominatim, Upstash Redis

### CameraDatabase
- **Purpose**: Lookup camera DNA by model name/slug from self-curated PostgreSQL table (~200 models for MVP)
- **Interface**: `search(query) → CameraMatch[]`, `getById(id) → CameraProfile`
- **Dependencies**: Supabase PostgreSQL

### SessionLogger
- **Purpose**: Create, update, and end shoot sessions; persist all signals + AI recommendation + actual settings used; export user data
- **Interface**: `startSession(userId, cameraProfileId, context) → ShootSession`, `endSession(id, actualSettings, rating?, notes?) → ShootSession`, `export(userId, format) → File`
- **Dependencies**: Supabase PostgreSQL

### CommunityService
- **Purpose**: CRUD for settings cards; search by location + camera model; like/save/report; GPS verification enforcement
- **Interface**: `publish(card) → SettingsCard`, `search(lat, lng, radius, filters) → SettingsCard[]`, `like(cardId, userId)`, `save(cardId, userId)`, `report(cardId, userId)`
- **Dependencies**: Supabase PostgreSQL, Supabase Storage (thumbnails)

### IntegrationService
- **Purpose**: Handle OAuth flows and data sync for Lightroom and Capture One; token refresh; local sync queue for graceful degradation
- **Interface**: `connectLightroom(code) → TokenResult`, `syncSession(sessionId, target) → SyncResult`, `getTokenStatus(userId, target) → TokenStatus`
- **Dependencies**: Adobe Lightroom Public API, Capture One Plugin SDK

### DualModeUIController
- **Purpose**: Manage Learning/Quick mode state; persist preference; control explanation visibility and layout switching
- **Interface**: `toggleMode() → UIMode`, `getMode(userId) → 'learning' | 'quick'`, `setExplanationVisible(settingKey, visible)`
- **Dependencies**: Zustand store

---

## Data Model

```sql
-- Users
User {
  id: uuid PK
  email: string UNIQUE NOT NULL
  skill_level: enum('beginner','intermediate','advanced') DEFAULT 'beginner'
  ui_mode: enum('learning','quick') DEFAULT 'learning'
  openai_api_key_encrypted: string NULL  -- encrypted at rest
  openai_model_id: string NULL           -- e.g. 'gpt-4o'
  created_at: timestamp
}

-- Camera Profiles (user's gear)
CameraProfile {
  id: uuid PK
  user_id: uuid FK → User
  brand: string NOT NULL
  model: string NOT NULL
  camera_db_id: uuid FK → CameraDatabase NULL  -- null if user-entered
  is_active: boolean DEFAULT false
  is_user_entered: boolean DEFAULT false
  ibis_verified: boolean DEFAULT false
  custom_overrides: jsonb NULL
  created_at: timestamp
  -- Partial unique index: one active profile per user
}

-- Camera Database (self-curated, ~200 models MVP)
CameraDatabase {
  id: uuid PK
  brand: string NOT NULL
  model: string NOT NULL
  slug: string UNIQUE NOT NULL
  sensor_size: enum('FF','APS-C','MFT','1-inch','Other')
  pixel_count_mp: decimal
  base_iso: integer
  max_usable_iso: integer
  max_native_iso: integer
  ibis: boolean DEFAULT false
  ibis_stops: decimal NULL
  dual_native_iso: boolean DEFAULT false
  dual_native_iso_values: integer[] NULL
  dynamic_range_ev: decimal NULL
  release_year: integer
  mount: string
  updated_at: timestamp
}

-- Lens Profiles (optional, per camera)
LensProfile {
  id: uuid PK
  camera_profile_id: uuid FK → CameraProfile
  focal_length_mm: integer NOT NULL
  max_aperture: decimal NOT NULL
  min_aperture: decimal NOT NULL
  is_stabilized: boolean DEFAULT false
  stabilization_stops: decimal NULL
}

-- Shoot Sessions
ShootSession {
  id: uuid PK
  user_id: uuid FK → User
  camera_profile_id: uuid FK → CameraProfile
  lat: decimal NOT NULL
  lng: decimal NOT NULL
  location_name: string NULL
  started_at: timestamp NOT NULL
  ended_at: timestamp NULL
  weather_snapshot: jsonb NOT NULL
  sun_snapshot: jsonb NOT NULL
  scene_type: string NULL
  ai_recommendation: jsonb NULL
  actual_settings: jsonb NULL
  user_rating: integer NULL CHECK(user_rating BETWEEN 1 AND 5)
  notes: text NULL
  is_plan: boolean DEFAULT false
  CONSTRAINT ended_after_started CHECK (ended_at IS NULL OR ended_at > started_at)
}

-- AI Recommendations (detailed log)
AIRecommendation {
  id: uuid PK
  session_id: uuid FK → ShootSession
  model_id: string NOT NULL
  input_signals: jsonb NOT NULL
  raw_response: jsonb NOT NULL
  parsed_suggestions: jsonb NOT NULL
  confidence_scores: decimal[] NOT NULL
  primary_signal_driver: string NULL
  latency_ms: integer
  created_at: timestamp
}

-- Settings Cards (community)
SettingsCard {
  id: uuid PK
  user_id: uuid FK → User
  session_id: uuid FK → ShootSession NULL
  camera_model: string NOT NULL
  lat: decimal NOT NULL
  lng: decimal NOT NULL
  location_name: string NOT NULL
  settings: jsonb NOT NULL
  weather_conditions: jsonb NULL
  photo_url: string NULL
  caption: text NULL
  is_public: boolean DEFAULT true
  likes_count: integer DEFAULT 0
  saves_count: integer DEFAULT 0
  is_flagged: boolean DEFAULT false
  created_at: timestamp
}

-- Saved Cards (user's private collection)
SavedCard {
  user_id: uuid FK → User
  card_id: uuid FK → SettingsCard
  saved_at: timestamp
  PRIMARY KEY (user_id, card_id)
}
```

**Business rules enforced at DB level:**
- `CameraProfile.is_active`: max 1 active per user (partial unique index)
- `SettingsCard`: GPS required (lat/lng NOT NULL) — no anonymous location sharing
- `ShootSession`: `ended_at > started_at` (CHECK constraint)

---

## API Design

```
# Authentication
POST   /api/auth/openai/validate         -- validate API key + fetch models
GET    /api/auth/openai/models           -- list Vision-capable models

# Camera
GET    /api/cameras/search?q=            -- search camera database
GET    /api/cameras/:id                  -- get camera DNA
GET    /api/user/cameras                 -- list user's camera profiles
POST   /api/user/cameras                 -- add camera profile
PATCH  /api/user/cameras/:id             -- edit / set active
DELETE /api/user/cameras/:id             -- remove profile

# Location & Weather
GET    /api/location?lat=&lng=           -- weather + sun + reverse geocode
                                         -- (cached 30 min in Upstash)

# AI Recommendation
POST   /api/recommend
  body: { cameraProfileId, sceneFrame (base64), lat, lng, shootIntent? }
  response: {
    suggestions: [{ iso, aperture, shutter, wb, metering,
                    confidence, primaryDriver, explanations? }],
    sceneAnalysis: { sceneType, estimatedEV, subjectMotion, depthIntent },
    shutterSpeedWarning?: string,
    weatherSnapshot: {...},
    modelUsed: string
  }

# Sessions
POST   /api/sessions                     -- start session
PATCH  /api/sessions/:id                 -- update (actual settings, rating, notes)
POST   /api/sessions/:id/end             -- end session
GET    /api/sessions                     -- paginated history
GET    /api/sessions/:id                 -- session detail
GET    /api/sessions/export?format=      -- CSV or JSON export

# Community
GET    /api/community/cards?lat=&lng=&radius=&model=&sort=
POST   /api/community/cards              -- publish settings card
GET    /api/community/cards/:id
POST   /api/community/cards/:id/like
POST   /api/community/cards/:id/save
POST   /api/community/cards/:id/report
GET    /api/user/saved-cards

# Pre-Shoot Planning
POST   /api/plans
GET    /api/plans
GET    /api/plans/:id
PATCH  /api/plans/:id
DELETE /api/plans/:id

# Integrations
GET    /api/integrations/lightroom/auth
GET    /api/integrations/lightroom/callback
POST   /api/integrations/lightroom/sync/:sessionId
DELETE /api/integrations/lightroom
GET    /api/integrations/captureone/status
POST   /api/integrations/captureone/sync/:sessionId

# User
GET    /api/user/profile
PATCH  /api/user/profile
DELETE /api/user                         -- delete account + all data
```

All endpoints require NextAuth session cookie. OpenAI key injected from session server-side; never exposed in API responses.

---

## Error Handling

```
OpenAI Errors
  401 invalid_api_key     → Clear key from session; redirect to Settings
                            "Invalid API key — check your OpenAI dashboard"
  429 rate_limit          → Retry button; suggest lighter model inline
  503 model_unavailable   → Inline model switcher dropdown
  timeout (>30s)          → Retry button; session not lost

Location / Weather Errors
  GPS denied/timeout      → Immediate manual input fallback; non-blocking
  Open-Meteo unavailable  → Use cached snapshot if <2h old (labeled)
                            If no cache → manual light level input
  Nominatim failure       → Show lat/lng coords; recommendation unaffected

Camera Database Errors
  Camera not found        → Manual entry form; flag as "user-entered"
  Bad IBIS data           → ⚠️ "IBIS data unverified" warning on recommendation

Session / Sync Errors
  Lightroom token expired → Queue sync locally; non-intrusive banner
                            Auto-flush after re-authorization
  Capture One offline     → Queue sync; retry on next plugin connection
  DB write failure        → 3x retry with exponential backoff
                            Final fallback: "Session save failed — export now?"

Community Errors
  GPS missing on publish  → Block with clear message; no silent failure
  Photo upload fails      → Allow publish without photo; retry later
  Report fails            → Silent retry 2x; show error on 3rd failure

General
  All 500 errors          → Log to Sentry; "Something went wrong" to client
                            Never expose stack traces
  Rate limiting           → 429 with Retry-After; Upstash sliding window
```

---

## Goals / Non-Goals

**Goals:**
- Deliver AI camera settings recommendations in ≤30 seconds using user's own OpenAI key
- Support dual-mode UX (Learning/Quick) serving both amateurs and semi-pros
- Build community settings database as long-term network effect moat
- Provide seamless shoot-to-edit workflow via Lightroom and Capture One integrations
- Make all recommendations camera-model-specific using self-curated Camera DNA database

**Non-Goals (v1):**
- Native mobile app (iOS/Android) — v2
- On-device ML scene analysis — v2
- Video settings guidance — v2
- Hardware camera control (Arsenal-style) — not aligned with "AI Advisor" positioning
- AI personalization based on shoot history — requires data accumulation, v2
- Offline mode — v2
- Third-party OAuth login (Google, GitHub) — OpenAI auth only in v1

---

## Decisions

### Decision 1: BYOK over hosted API key
**Chosen**: User provides their own OpenAI API key
**Why**: Zero API cost for the product; users access latest models immediately on release; no billing infrastructure needed
**Alternative**: Host a single OpenAI key, charge subscription fee
**Trade-off**: Higher onboarding friction (user needs OpenAI account); mitigated by clear setup wizard

### Decision 2: Next.js monolith over microservices
**Chosen**: Single Next.js app with API routes
**Why**: Faster v1 development; single deployment; zero inter-service latency; sufficient for MVP traffic
**Alternative**: Separate Node.js API + Next.js frontend
**Trade-off**: Harder to scale individual components later; acceptable for v1, revisit at v2

### Decision 3: Supabase over raw PostgreSQL + custom auth
**Chosen**: Supabase (managed PostgreSQL + auth + realtime + storage)
**Why**: Realtime subscriptions for community feed; built-in storage for thumbnails; auth integration saves 2-3 weeks
**Alternative**: Neon (PostgreSQL) + Clerk (auth) + S3 (storage)
**Trade-off**: Supabase vendor dependency; mitigated by open-source self-host option

### Decision 4: Self-curated camera database over third-party API
**Chosen**: PostgreSQL table of ~200 curated camera models
**Why**: Third-party APIs lack noise floor, dual native ISO, and IBIS stops data critical to recommendation accuracy; proprietary data is a moat
**Alternative**: RapidAPI Camera Database + manual enrichment
**Trade-off**: ~60 hours upfront data entry; justified by differentiation value

### Decision 5: GPT-4o Vision for MVP, on-device ML for v2
**Chosen**: OpenAI Vision API (user's key) for scene analysis in v1
**Why**: No ML training required; state-of-the-art scene understanding; ships in days not months
**Alternative**: Fine-tuned EfficientNet on MIT Places365 (on-device)
**Trade-off**: Requires internet + OpenAI account; v2 roadmap = on-device model for offline + privacy mode

---

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| AI recommendation quality too low → user trust lost | Medium | Very High | Confidence scoring; feedback loop; ≥60% acceptance rate gate before wider rollout |
| Wrong camera DNA (IBIS, ISO) → bad shutter speed suggestions | Low | High | "User-entered — unverified" flag; ⚠️ warning on unconfirmed IBIS; manual override always available |
| In-camera AI commoditizes recommendations in 3-5 years | Medium | High | Build community moat + workflow integrations early; camera-agnostic positioning |
| Privacy: camera frame sent to OpenAI | Medium | High | Explicit consent prompt; clear "frames not stored" policy; BYOK = user's own account; v2 on-device option |
| Low retention: users try once and don't return | High | High | Shoot history + golden hour notifications + community feed as daily engagement drivers |
| Lightroom/Capture One API deprecation | Low | High | XMP sidecar export as permanent fallback; integrations are optional enhancement |
| Camera database maintenance burden | Medium | Medium | Start with 200 models (~95% market); community verification for long tail in v2 |
| Community spam / false settings cards | Medium | Medium | GPS verification required; moderation queue; rating system surfaces quality |

---

## Testing Strategy

### MUST requirements — Unit + Integration

**RecommendationEngine**
- Unit: settings calculation rules (reciprocal rule, IBIS correction, diffraction limit); mock OpenAI response → verify top-3 parsing; confidence score normalization
- Integration: full `/api/recommend` flow with Supabase test DB; stale weather detection; shutter speed warning trigger

**OpenAIClient (BYOK)**
- Unit: API key validation logic; model list filtering (Vision-capable only); encrypted key storage/retrieval
- Integration: mock OpenAI SDK → verify BYOK per-request instantiation; error handling (401, 429, 503)

**CameraDatabase**
- Unit: fuzzy search matching; DNA lookup by slug; manual entry validation
- Integration: Supabase query performance ≤1s for search

**WeatherService**
- Unit: SunCalc golden hour calculation; 30-minute staleness check; Open-Meteo response parsing
- Integration: Redis cache TTL behavior; Nominatim fallback to coordinates

**DualModeUIController**
- Unit: mode toggle state transitions; persistence across sessions; first-time default to Learning Mode

### SHOULD requirements — Integration + E2E

**SessionLogger**: start/end flow; actual vs recommended diff; CSV/JSON export correctness; cascade delete

**CommunityService**: GPS verification enforcement; 500m radius search accuracy; like/save idempotency; report queue

**IntegrationService**: Lightroom OAuth (mock Adobe); XMP generation; token expiry queue behavior; Capture One plugin sync

### E2E — Playwright (3 critical paths)

1. **Onboarding → Recommendation**: New user → enter OpenAI key → select model → setup camera profile → grant GPS → receive top-3 recommendations in ≤30s → toggle Learning/Quick
2. **Community Settings Card**: End session → share to community → publish with GPS → search by location → card appears → like → save → apply settings
3. **Lightroom Sync**: Connect OAuth → complete session → sync → verify XMP written → simulate token expiry → verify queue

**Coverage gate**: ≥80% on recommendation engine, camera DNA lookup, settings calculation rules
