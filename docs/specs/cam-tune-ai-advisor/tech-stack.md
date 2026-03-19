# Tech Stack: CamTune — AI Camera Settings Advisor

> Direction: B — "Power Tool" (Dual-Mode UX)
> Date: 2026-03-18
> Status: Approved

---

## Frontend

- **Framework**: Next.js 14 (App Router) — SSR for SEO, API routes for backend logic, seamless Vercel deployment
  - *Alternative considered*: Remix — good but smaller ecosystem
- **Styling**: Tailwind CSS — utility-first, rapid dual-mode UI development
- **Component Library**: shadcn/ui (built on Radix UI) — accessible, unstyled primitives, no vendor lock-in
- **State Management**: Zustand — lightweight global state for camera profile, mode toggle (Learning/Quick), active session
  - *Alternative considered*: Redux Toolkit — overkill for this app's state complexity
- **Maps**: Leaflet.js + OpenStreetMap — free, no API key required, sufficient for location picking + community pins
  - *Lock-in risk*: Low — OSM/Leaflet is open source
- **Camera/Media Access**: Web APIs (getUserMedia, MediaDevices) — native browser camera feed capture for scene analysis
- **Sun/Ephemeris**: SunCalc.js — open source, pure JS, no API call needed for sun position + golden/blue hour

---

## Backend

- **Framework**: Next.js API Routes (Node.js) — unified codebase with frontend, sufficient for v1 traffic
  - *Alternative considered*: Separate Express.js service — unnecessary complexity for v1
- **Database**: PostgreSQL via Supabase — relational model fits domain entities (User, CameraProfile, ShootSession, SettingsCard); Supabase provides auth + realtime + storage in one
  - *Alternative considered*: PlanetScale (MySQL) — good but less feature-complete managed offering
  - *Lock-in risk*: Medium — Supabase is open source; self-host possible if needed
- **ORM**: Prisma — type-safe schema, migration tooling, excellent PostgreSQL support
  - *Alternative considered*: Drizzle — lighter but less mature tooling
- **Auth**: NextAuth.js — custom OAuth provider support for OpenAI BYOK flow; session-based encrypted API key storage
- **Cache / Rate Limiting**: Upstash Redis (serverless) — rate limiting per-user OpenAI API calls; cache weather + sun data per GPS location (TTL 30 min)
- **File Storage**: Supabase Storage — community settings card thumbnails, XMP sidecar file export
- **Message Queue**: N/A for v1 — Lightroom/Capture One sync is synchronous in v1

---

## AI & External APIs

- **AI Engine**: OpenAI Node.js SDK (`openai`) — BYOK model; user provides API key
  - User authenticates → key stored encrypted in session → server instantiates `new OpenAI({ apiKey: userKey })` per request
  - Model selection: `openai.models.list()` → filter Vision-capable models → user picks (GPT-4o, GPT-4o mini, o1, etc.)
  - *Lock-in risk*: Medium — BYOK model means user bears API cost + can switch models freely; CamTune is not locked to specific OpenAI pricing
- **Weather**: Open-Meteo API (free, no key) — cloud cover, UV index, visibility, temperature, humidity
  - *Fallback*: OpenWeatherMap free tier if Open-Meteo is unavailable
- **Geocoding**: Nominatim (OpenStreetMap) — reverse geocoding GPS → location name; free, no key
  - *Lock-in risk*: None — open source
- **Lightroom**: Adobe Lightroom Public API — OAuth 2.0 → XMP metadata write + catalog integration
  - *Lock-in risk*: Medium — Adobe could restrict API access; XMP export is fallback
- **Capture One**: Capture One Plugin SDK — JavaScript plugin for session data sync
  - *Lock-in risk*: Medium — plugin API is proprietary

---

## Infrastructure

- **Hosting**: Vercel — zero-config Next.js deployment, edge functions, preview deployments per PR
  - *Alternative considered*: Railway — better for backend-heavy workloads; revisit for v2 if API routes need more compute
- **Database Hosting**: Supabase (managed PostgreSQL) — free tier sufficient for MVP; managed scaling
  - *Alternative considered*: Neon (serverless PostgreSQL) — viable but less feature-complete
- **IaC Tool**: N/A for v1 — Vercel + Supabase managed; revisit with Terraform for v2 self-hosted option
- **Container Runtime**: N/A — serverless deployment via Vercel

---

## CI/CD

- **Pipeline**: GitHub Actions
  - PR: lint + type-check + unit tests + Vitest coverage gate (≥80% for recommendation logic)
  - Merge to main: full test suite + E2E Playwright + auto-deploy to Vercel production
- **Preview Deployments**: Vercel automatic preview per PR branch
- **Environments**: `development` (local) → `preview` (per PR) → `production` (main branch)

---

## Testing

- **Unit / Integration**: Vitest + React Testing Library
  - Coverage targets: ≥80% for recommendation engine, camera DNA lookup, settings calculation rules
- **E2E**: Playwright (cross-browser)
  - Critical paths:
    1. New user onboarding → OpenAI key setup → first AI recommendation
    2. Settings card create + publish + search by location
    3. Lightroom OAuth connect → XMP sync after shoot session
- **Coverage threshold**: 80% minimum before merge to main

---

## Monitoring & Logging

- **Error Monitoring**: Sentry (free tier) — error tracking + performance monitoring
- **Product Analytics**: PostHog (cloud free tier) — user flows, feature flag for dual-mode rollout, recommendation acceptance rate tracking
- **Logging**: Vercel built-in function logs for v1; structured JSON logs for API routes
- **Alerting**: Sentry alerts for error rate spikes; PostHog alerts for recommendation acceptance rate drop below 50%

---

## Deployment Strategy

- **Strategy**: Rolling deployment via Vercel (zero-downtime)
- **Feature Flags**: PostHog feature flags for gradual rollout of community features + Capture One integration
- **Environments**:
  - `local`: Next.js dev server + local Supabase instance
  - `preview`: Vercel preview + Supabase staging project
  - `production`: Vercel production + Supabase production project
