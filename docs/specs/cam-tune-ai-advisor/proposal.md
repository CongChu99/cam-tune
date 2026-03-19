# Proposal: CamTune — AI Camera Settings Advisor

> Direction: B — "Power Tool" (Dual-Mode UX, Amateur-first + Pro-ready)
> Date: 2026-03-18
> Status: Approved

---

## Why

Photography requires mastering an interdependent trio of settings (ISO, aperture, shutter speed) plus white balance, metering mode, and scene-specific variables — all in real time, adapted to the specific camera body in hand. No existing tool solves this:

- **Passive calculators** (SetMyCamera, LExp) require users to already know what they want — they provide math, not judgment
- **Location planners** (PhotoPills) predict light timing but never translate conditions into actual camera settings
- **Hardware AI assistants** (Arsenal 2) require a ~$200 physical device, work only when tethered, and have no weather, GPS, or community integration
- **Generic AI** (smartphone camera apps) target phone cameras, not interchangeable-lens systems

The market is validated: $4.1B photography software market growing at 8.6% CAGR; AI photography tools projected at $2.4B by 2027. No competitor has combined GPS + weather + computer vision scene analysis + camera-model-specific sensor data into one web-based, software-only product.

**Build verdict**: Build. The gap is real, the timing is right (web AI infrastructure mature, OpenAI Vision API available), and integrations (Lightroom API, Capture One SDK) are developer-accessible. Primary risk (in-camera AI commoditization in 3-5 years) is mitigated by the community settings database moat.

---

## What Changes

Greenfield product — all capabilities are new:

1. **AI Settings Recommendation Engine** — Scene analysis (camera feed) + GPS + weather + camera profile → top-3 settings suggestions with confidence score and plain-language explanation
2. **Dual-Mode UX** — "Learning Mode" (explains why each setting was chosen) and "Quick Mode" (compact dashboard for pros, results only)
3. **OpenAI BYOK Authentication** — User authenticates with their OpenAI account → app fetches available models → user selects model (GPT-4o, GPT-4o mini, o1...)
4. **Camera Profile Management** — User enters camera model → app loads Camera DNA (ISO range, noise floor, IBIS stops, sensor size, base ISO) → all recommendations calibrated to that specific camera
5. **Multi-Signal Location Intelligence** — GPS + Open-Meteo weather + SunCalc ephemeris data synthesized into shooting context
6. **Shoot History & Session Logging** — Log GPS, weather, settings, timestamp + user rating → basis for learning loop
7. **Community Settings Cards** — Share settings cards (photo + settings + location tag) publicly; searchable by location + camera model
8. **Lightroom Integration** — OAuth connect → export XMP metadata post-shoot; contextual panel in Lightroom
9. **Capture One Integration** — Plugin SDK integration for post-processing workflow
10. **Pre-Shoot Planning Mode** — Enter location + future datetime → predicted settings range based on forecast weather + sun position

---

## Capabilities

### New Capabilities

- `ai-settings-recommendation`: Scene analysis via OpenAI Vision (BYOK) combined with GPS + weather + camera profile → top-3 settings with confidence score
- `dual-mode-ux`: Toggle between Learning Mode (explains each setting) and Quick Mode (compact, results-only — for pros)
- `openai-byok-auth`: Login with OpenAI account → fetch available models → select model; app uses user's API key for all AI calls
- `camera-profile-management`: Search/enter camera model → load Camera DNA (ISO range, noise floor, IBIS stops, sensor size, base ISO); supports multiple bodies
- `multi-signal-location-intelligence`: Combine GPS coordinates + Open-Meteo weather (cloud cover, UV, visibility) + SunCalc (sun altitude, golden hour, blue hour)
- `shoot-session-logging`: Auto-log GPS, weather, timestamp, settings used, AI recommendation vs actual; user adds notes + rating (1-5 stars)
- `community-settings-cards`: Create and share settings cards (thumbnail + settings + location tag + camera model); searchable by location/camera model; like/save
- `lightroom-integration`: OAuth connect → export XMP metadata after shoot; contextual panel in Lightroom with shoot conditions
- `capture-one-integration`: Plugin SDK → sync shoot session data into Capture One catalog
- `pre-shoot-planning`: Select location + future datetime → predicted settings range based on forecast weather + sun position

### Modified Capabilities

*(None — greenfield product)*

---

## Scope

### In Scope (v1)

- AI settings recommendation (ISO, aperture, shutter speed, white balance, metering mode) via OpenAI BYOK
- OpenAI account authentication + model selection (GPT-4o, GPT-4o mini, o1, and latest available models)
- Dual-mode UX: Learning Mode + Quick Mode, toggleable at any time
- Camera profile setup: search/enter model, load Camera DNA, manage multiple bodies
- Multi-signal location intelligence: GPS + Open-Meteo + SunCalc
- Shoot session logging with rating and notes
- Community settings cards: create, share, search by location + camera model, like/save
- Pre-shoot planning mode
- Lightroom integration (OAuth + XMP export + contextual panel)
- Capture One integration (Plugin SDK)
- Web app (Next.js), responsive for mobile browser

### Out of Scope — Non-Goals (v1)

- **Native mobile app** (iOS/Android) — v2
- **On-device ML model** for scene analysis — v2 (use OpenAI API in v1)
- **Video settings guidance** — v2
- **Hardware camera control** (Arsenal-style tethering) — not aligned with "AI Advisor" positioning
- **AI personalization based on shoot history** — requires data accumulation, v2
- **Third-party OAuth login** (Google, GitHub) — OpenAI auth only in v1
- **Advanced community feed algorithm** (ranking, recommendations) — v2
- **Offline mode** — v2 (requires on-device model first)

---

## Success Criteria

- **Recommendation acceptance rate ≥ 60%**: At least 60% of AI recommendations are used without significant modification (measured via session logging)
- **Time-to-first-recommendation ≤ 30 seconds**: From app open to first settings suggestion (with camera profile already set up)
- **Camera profile setup ≤ 2 minutes**: New user finds and sets up camera profile in under 2 minutes
- **Dual-mode toggle ≤ 2 taps**: Switch between Learning Mode and Quick Mode in at most 2 taps
- **Community: 100 settings cards in first 30 days**: Enough to seed community feed with value for new users
- **Lightroom sync ≤ 5 seconds**: After shoot session, XMP metadata syncs to Lightroom in under 5 seconds
- **OpenAI key validation ≤ 3 seconds**: After user enters API key, validation and model list fetch completes in 3 seconds
- **Zero wrong camera DNA**: No recommendation uses incorrect camera specs (IBIS, ISO range) — critical trust failure

---

## Impact

**Competitive positioning:**
- Directly competes with **Arsenal 2** ($175-249 hardware) — CamTune delivers equivalent AI recommendation quality, software-only, free
- Complements **PhotoPills** (planning) and **PhotoWeather** (weather) — users can use in parallel
- Surpasses **SetMyCamera/LExp** (passive calculators) with AI + location intelligence

**Dependencies:**
- **OpenAI API** — core AI engine; user provides own key (BYOK)
- **Open-Meteo API** — weather data (free, no key required)
- **SunCalc.js** — ephemeris calculations (open source)
- **Adobe Lightroom Public API** — OAuth + catalog integration
- **Capture One Plugin SDK** — post-processing integration
- **Nominatim/OpenStreetMap** — reverse geocoding (free)
- **Camera database** — self-curated dataset (~200 models for MVP)

**Platform:**
- Web app (Next.js + React), responsive
- No native mobile dependencies in v1
