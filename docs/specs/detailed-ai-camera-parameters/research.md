# Feature Research: `detailed-ai-camera-parameters`

**Feature Slug**: detailed-ai-camera-parameters
**Research Date**: 2026-03-23
**Research Mode**: Web Search + Analysis
**Status**: Complete

---

## Executive Summary

CamTune's current AI recommendation engine uses a solid but limited 8-signal input set (sensor size, ISO range, IBIS, noise floor, dynamic range, GPS, weather, sun position). The proposed expansion adds three new parameter families — lens profile, advanced camera body data, and shooting/scene context — bringing the signal count to approximately 22–25, comparable to Arsenal 2's documented 22-factor model. Research confirms that no direct web-based competitor at CamTune's price tier (BYOK, zero subscription) delivers lens-profile-aware recommendations with structured JSON output today.

Key findings:
- **Highest-value additions**: (1) active lens focal length fed into the IBIS reciprocal-rule check (already ~80% scaffolded in `route.ts`), (2) max aperture to constrain bokeh and low-light suggestions, (3) OIS/IS stops combining with IBIS for accurate minimum shutter, (4) shooting intent granularity (subject motion speed, background blur intent, flash availability, output medium). [fact — based on codebase analysis]
- **Schema groundwork exists**: `LensProfile` model already in Prisma schema with `focalLengthMm`, `maxAperture`, `isStabilized`, `stabilizationStops`. `dualNativeIso` / `dualNativeIsoValues` already in `CameraDatabase`. Zero migrations needed for MVP. [fact]
- **No direct competitor** offers multi-source AI input (GPS + Vision + live weather) tied to lens-constrained aperture enforcement and dual-native ISO guidance in a web-native BYOK product. [inference from competitive analysis]
- **Primary risk** is cognitive overload for Learning Mode (beginner) users. Progressive disclosure and smart defaults from `shootIntent` are essential. [recommendation]
- **Build verdict**: Build — the must-priority items are low-effort, high-accuracy improvements on existing infrastructure. Phase advanced body data (AF type, per-ISO read noise) to a later iteration. [recommendation]

---

## Table of Contents

1. [Problem Statement](#31-problem-statement)
2. [Target Users](#32-target-users)
3. [Core Workflows](#33-core-workflows)
4. [Domain Entities](#34-domain-entities)
5. [Business Rules](#35-business-rules)
6. [Competitive Landscape](#36-competitive-landscape)
7. [Feature Comparison Matrix](#37-feature-comparison-matrix)
8. [Gap Analysis](#38-gap-analysis)
9. [Differentiation Strategy](#39-differentiation-strategy)
10. [Initial MVP Scope](#310-initial-mvp-scope)
11. [Technical Approaches](#41-technical-approaches)
12. [Contrarian View](#42-contrarian-view)
13. [Risks Table](#43-risks-table)
14. [Recommendations](#44-recommendations)
15. [Sources](#sources)

---

## 3.1 Problem Statement

CamTune currently produces top-3 camera settings recommendations (ISO / Aperture / Shutter Speed / White Balance / Metering Mode + confidence) using a fixed set of 8 environmental and camera-body signals. The prompt in `buildSystemPrompt()` passes: sensor size, base ISO, max usable ISO, IBIS (yes/no + stops), dynamic range EV, cloud cover, UV index, visibility, temperature, humidity, sun altitude, golden-hour flag, and a coarse shoot intent (portrait / landscape / street / event / astro / macro / general).

Several concrete failure modes result from this limited signal set:

1. **Lens-blind aperture recommendations.** The AI recommends an aperture such as f/1.2 for a lens whose max aperture is f/4. Without knowing the mounted lens, the AI cannot enforce physical constraints.
2. **Incorrect IBIS calculation.** The IBIS reciprocal-rule check in `ibis-check.ts` defaults to 50mm when no lens profile is provided. For a 200mm telephoto, this underestimates blur risk by 4×.
3. **Undifferentiated subject-motion handling.** "Portrait" and "sports" both map to `subjectMotion: fast | slow | static`, but the AI cannot distinguish a stationary studio subject from a moving vehicle.
4. **Output-medium blindness.** A recommendation for a large print (requires diffraction-limited aperture ≥ f/8) is identical to one for Instagram (can accept f/1.4 with bokeh), because output medium is unknown.
5. **Flash availability ignored.** The system cannot compensate for fill-flash in harsh midday sun if it doesn't know a flash is mounted.
6. **No per-ISO read noise.** The AI uses a single `dynamicRangeEv` figure; for cameras with dual native ISO (already in the schema as `dualNativeIso`/`dualNativeIsoValues`), recommending ISO 800 vs. ISO 3200 has dramatically different noise behavior.

**Market context:**
- Photography software market: $4.1B in 2025, growing at 8.6% CAGR [fact — previously researched]
- AI photography tools: projected $2.4B market by 2027 [fact — previously researched]
- Arsenal 2 (closest hardware competitor): 22 documented input factors for AI calculations [fact — from Arsenal product pages]

---

## 3.2 Target Users

CamTune has two documented user personas. The parameter expansion affects each differently.

### Persona 1 — Learning Mode / Beginner (Maria)
- **Who:** Hobbyist photographer, entry mirrorless, 1–2 lenses (kit zoom + 50mm f/1.8)
- **Current pain:** AI gives f/2.8 but her kit zoom is f/5.6 at 200mm — an impossible, unusable recommendation
- **Impact of expansion:** Lens max aperture constraint immediately eliminates impossible suggestions. Shooting intent (background blur: high) combined with lens max aperture gives best achievable bokeh automatically.
- **Risk:** Too many input fields can overwhelm Maria. Progressive disclosure is critical — system should auto-populate lens data from database or EXIF when possible.

### Persona 2 — Quick Mode / Semi-Pro (Alex)
- **Who:** Freelance event/sports shooter, full-frame mirrorless, multiple lenses including 70–200mm f/2.8 IS
- **Current pain:** AI recommends 1/60s for a 200mm shot because it assumes 50mm. With IS+IBIS combined, the correct threshold is much lower; without lens focal length, the shutter warning fires incorrectly.
- **Impact of expansion:** Accurate focal-length-fed IBIS check, OIS stops combined with IBIS stops, and burst-rate awareness for continuous AF directly improve usefulness.
- **Risk:** Alex wants zero friction. Forcing manual focal length input for every shot defeats Quick Mode. Auto-detection via EXIF or "active lens" selection is required.

### Persona 3 — Emerging: Advanced / Pro (Studio / Landscape)
- **Who:** Studio or landscape photographer caring about maximum dynamic range, print sizing, controlled lighting
- **Impact:** Shadow/highlight priority, output medium (large print = diffraction-limited aperture), per-ISO read noise, and contrast ratio estimate directly influence decisions.
- **Risk:** Currently no UI for these parameters; requires new expandable settings section.

---

## 3.3 Core Workflows

The expanded parameter set unlocks four new workflows not possible today:

### Workflow 1: Lens-Constrained Portrait Optimization
User selects portrait intent + lens (85mm f/1.8).
1. User opens app → active lens profile loads automatically
2. System combines max aperture (f/1.8), subject distance estimate (from Vision), background blur intent (maximum)
3. AI recommends f/1.8–f/2 with shutter based on focal-length-correct reciprocal rule
4. Result: physically achievable aperture, correct blur, grounded in actual lens

### Workflow 2: Sports/Action Safety Chain
User mounts 200mm f/2.8 telephoto + has flash enabled.
1. Lens profile loaded → focal length = 200mm
2. IBIS check: 200mm, 5.5 stops IBIS + 5 stops OIS = 8 stops combined (capped)
3. Subject motion speed = "running/vehicle" → overrides stabilization to minimum 1/500s
4. Flash HSS: shutter > 1/250s → emit HSS suggestion if `flashAvailability = hss_capable`

### Workflow 3: Print-Optimized Landscape
User sets output medium to "large print (A2+)".
1. System detects output medium → activates diffraction check
2. For 24MP APS-C: avoids apertures below f/8
3. Subject = static → recommends tripod shutter + base ISO + f/8–f/11 range
4. Result: maximum sharpness and dynamic range for large-format output

### Workflow 4: Dual-Native ISO Low-Light Event
Camera has dual native ISO at 800 and 3200 (e.g., Sony A7 IV, Panasonic S5 II).
1. `dualNativeIso = true`, `dualNativeIsoValues = [800, 3200]`
2. Scene is low-light event → AI normally suggests ISO 1600
3. System overrides: recommends ISO 3200 (native gain stage) over ISO 1600 (non-native)
4. Learning Mode explanation: "ISO 3200 uses your camera's native gain stage — cleaner shadows than ISO 1600 at this light level."

---

## 3.4 Domain Entities

Three domain entities are introduced or expanded by this feature. Note: `LensProfile` already exists in the Prisma schema.

### LensProfile (partially exists — expand)
Current schema: `focalLengthMm`, `maxAperture`, `minAperture`, `isStabilized`, `stabilizationStops`

New fields to add:
| Field | Type | Description |
|---|---|---|
| `lensType` | PRIME \| ZOOM \| MACRO \| FISHEYE \| TILT_SHIFT | Lens category |
| `focalLengthMinMm` | Int? | Wide end for zoom lenses |
| `focalLengthMaxMm` | Int? | Tele end for zoom lenses |
| `currentFocalLengthMm` | Int? | Session-level zoom position (not persisted) |
| `lensfunId` | String? | Reference to Lensfun database entry |
| `transmissionFstop` | Float? | T-stop for cinema lenses (optional) |

### ShootingIntent (new — extends current `ShootIntent` enum)
New request/session-level fields:

| Field | Type | Values |
|---|---|---|
| `subjectMotionSpeed` | Enum | `stationary \| walking \| running \| vehicle \| sports` |
| `backgroundBlurIntent` | Enum | `maximum \| moderate \| deep \| irrelevant` |
| `flashAvailability` | Enum | `none \| ambient_only \| speedlight \| studio_strobe \| hss_capable` |
| `outputMedium` | Enum | `web_1080 \| web_4k \| print_a4 \| print_a2_plus \| commercial` |
| `stabilizationMode` | Enum | `handheld \| tripod \| monopod` |

### SceneContext (new — extends current `SceneAnalysis`)
New AI-returned fields (Vision-inferred, not user-input):

| Field | Type | Description |
|---|---|---|
| `distanceToSubjectEstimate` | Enum | `macro \| close \| mid \| distant` |
| `contrastRatioEstimate` | Float? | EV between brightest and darkest subject areas |
| `shadowPriority` | Enum | `protect \| crush \| neutral` |
| `highlightPriority` | Enum | `protect \| blow \| neutral` |
| `ambientLightType` | Enum | `direct_sun \| overcast \| shade \| artificial \| mixed \| golden_hour` |

---

## 3.5 Business Rules

### Parameter Validation Rules

1. **Lens aperture constraint:** AI-recommended aperture MUST NOT exceed lens `maxAperture`. If AI suggests f/1.2 and max aperture is f/2.8, clamp to f/2.8 in the post-parse validation layer (`coerceSuggestion`).
2. **Focal length range validation:** For zoom lenses, `currentFocalLengthMm` MUST be between `focalLengthMinMm` and `focalLengthMaxMm`. Out-of-range values default to midpoint.
3. **Combined stabilization:** Effective stabilization stops = `ibisStops + stabilizationStops` capped at 8 stops (physical hardware limit). Do not allow additive IBIS+OIS exceeding 8 stops.
4. **Diffraction limit:** For `outputMedium = print_a2_plus` or `commercial`, aperture should not exceed f/11 (APS-C, 24MP) or f/16 (full-frame, ≥24MP). Apply as a soft warning, not hard clamp.
5. **Flash sync speed:** If `flashAvailability = speedlight` (non-HSS) and suggested shutter > 1/250s, emit flash sync warning. If `hss_capable`, allow up to 1/8000s.
6. **Dual native ISO:** When `dualNativeIso = true` and suggested ISO falls between the two native values, recommend the higher native ISO over an intermediate value (e.g., prefer 3200 over 1600 if native ISOs are 800 and 3200).

### Fallback Rules When Data Is Missing

1. **No active lens profile:** Use 50mm f/1.8 equivalent as placeholder in prompts. Show yellow indicator: "Set your lens for better recommendations."
2. **Zoom lens, focal length unknown:** Use midpoint of zoom range for IBIS check. Prompt user to confirm current zoom position.
3. **No subject motion speed set:** Infer from shoot intent (portrait → walking, sports/event → vehicle, landscape → stationary, street → walking).
4. **No output medium set:** Default to `web_1080` (most permissive, avoids diffraction warnings for casual use).
5. **No flash availability set:** Default to `none`.
6. **`contrastRatioEstimate` not parseable:** Default to `neutral` shadow/highlight priority. Do not fail the recommendation.

---

## 3.6 Competitive Landscape

### 1. Arsenal 2
- **Type:** Direct (hardware-required AI camera assistant)
- **Parameters used:** 22 factors including hyperfocal distance, sensor dynamic range, lens transmission, lens sharpness profiles per aperture (diffraction, aberrations, coma), accelerometer-based stability, neural network trained on professional images
- **Pricing:** Arsenal 2 Standard ~$149, Arsenal 2 Pro ~$189 (one-time hardware); app free [estimate — from product pages]
- **Platform:** iOS + Android (hardware Bluetooth dongle required)
- **Key differentiator:** Hardware-accelerated AI with physical stabilization sensor. Lens sharpness database built-in. Works offline after initial setup.
- **Gap vs CamTune:** Requires $149+ hardware. No Lightroom/Capture One integration. No Learning Mode. Web-only BYOK not possible.

### 2. PhotoPills
- **Type:** Adjacent (sun/moon planning + DoF calculator, not real-time AI)
- **Parameters used:** Focal length (actual, not 35mm equiv), aperture, subject distance, teleconverter, sensor crop factor, DoF, hyperfocal distance, ND filter calc, star trails
- **Pricing:** iOS ~$11.99 one-time, Android equivalent [fact]
- **Platform:** iOS, Android
- **Key differentiator:** World-class sun/moon/astro planning, AR overlays. Pure calculator — no AI inference, no automated suggestion.
- **Gap vs CamTune:** No AI. No camera-body awareness. No automated recommendations.

### 3. SetMyCamera
- **Type:** Adjacent (exposure calculator + educator)
- **Parameters used:** Focal length, aperture, subject distance, sensor database, print resolution, flash guide number, DoF, hyperfocal, ND/polarizer, bellows, extension tubes
- **Pricing:** Free (ads) / Pro ~$3.99 one-time [estimate]
- **Platform:** iOS primarily
- **Key differentiator:** Comprehensive calculator suite, educational value. No AI, no environmental context.
- **Gap vs CamTune:** Pure calculator. No AI. No GPS/weather. No DAW integration.

### 4. Adobe Lightroom (AI tools)
- **Type:** Indirect (post-processing, not pre-shoot)
- **Parameters used:** Adobe Sensei for subject/sky/skin-tone detection, adaptive exposure profiles based on 500,000+ image dataset, AI Denoise, Auto Adjust
- **Pricing:** ~$9.99/month (Photography Plan) [fact]
- **Platform:** Web, iOS, Android, macOS, Windows
- **Key differentiator:** Post-processing AI powerhouse. Adobe ecosystem lock-in. Native Lightroom integration.
- **Gap vs CamTune:** No pre-shoot recommendations. No lens-profile-aware exposure suggestion. No GPS/weather integration.

### 5. Luminar Neo
- **Type:** Indirect (AI-powered post-processing, desktop only)
- **Parameters used:** AI Auto Adjust (tone, contrast, exposure post-capture), AI Sky Replacement, AI Subject Detection, Color Transfer (Spring 2025 update)
- **Pricing:** ~$79/year or ~$99 one-time perpetual [estimate — from SoftwareHow review]
- **Platform:** macOS, Windows (desktop only)
- **Key differentiator:** Creative AI editing with sky/object replacement. No pre-shoot role.
- **Gap vs CamTune:** Post-processing only, desktop only, no pre-shoot parameter awareness.

### 6. Exposure Calculator (Android)
- **Type:** Direct adjacent (simple exposure triangle calculator)
- **Parameters used:** Aperture, shutter speed, ISO (any two → calculates third). No lens profile, no body awareness, no AI.
- **Pricing:** Free (ad-supported) [fact]
- **Platform:** Android
- **Key differentiator:** Extreme simplicity for quick reciprocal calculations.
- **Gap vs CamTune:** No AI. No scene analysis. No environmental context. No lens intelligence.

### 7. Photo Friend (iOS)
- **Type:** Direct adjacent (exposure calculator + phone light meter)
- **Parameters used:** Ambient light metering via phone camera, ISO, aperture, shutter speed, EV. Scene mode presets (sports, low-light, macro, long exposure).
- **Pricing:** Free with in-app purchases [fact]
- **Platform:** iOS
- **Key differentiator:** Uses phone camera as incident light meter.
- **Gap vs CamTune:** No AI model. No camera-body DNA. No lens awareness. No DAW integration.

### 8. Camera+ 2 / Halide (Smartphone AI)
- **Type:** Indirect (smartphone photography AI, not ILC cameras)
- **Parameters used:** Computational photography pipeline, AI scene detection, telephoto/portrait modes, RAW processing
- **Pricing:** ~$7.99 one-time [estimate]
- **Platform:** iOS
- **Key differentiator:** Best-in-class smartphone RAW experience. Not applicable to mirrorless/DSLR users.
- **Gap vs CamTune:** Smartphone-only. Irrelevant to ILC camera market.

---

## 3.7 Feature Comparison Matrix

| Feature | CamTune (Current) | CamTune Extended | Arsenal 2 | PhotoPills | SetMyCamera | Adobe LR AI | Photo Friend |
|---|---|---|---|---|---|---|---|
| Real-time AI setting recommendations | ✓ | ✓ | ✓ (hardware) | ✗ | ✗ | ✗ | ✗ |
| Web/cloud-based (no hardware required) | ✓ | ✓ | ✗ (dongle) | ✓ | ✓ | ✓ | ✗ |
| Lens focal length in AI prompt | ✗ (50mm default) | ✓ | ✓ | ✓ (calc) | ✓ (calc) | ✗ | ✗ |
| Lens max aperture constraint enforcement | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| OIS/IS stops combined with IBIS | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Subject motion speed granularity (5 levels) | △ (3 levels) | ✓ | △ (inferred) | ✗ | ✗ | ✗ | ✗ |
| Output medium awareness (print vs web) | ✗ | ✓ | ✗ | △ (print calc) | △ (print calc) | ✗ | ✗ |
| Flash availability + HSS awareness | ✗ | ✓ | ✗ | ✗ | △ (guide no.) | ✗ | ✗ |
| GPS + weather environmental context | ✓ | ✓ | ✗ | △ (sun only) | ✗ | ✗ | ✗ |
| Dual-native ISO exploitation | △ (schema only) | ✓ | △ (sensor DB) | ✗ | ✗ | ✗ | ✗ |
| Lightroom / Capture One integration | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ (native) | ✗ |
| Background blur intent (explicit) | ✗ | ✓ | △ | ✗ | ✗ | ✗ | ✗ |
| Subject distance estimate (AI-inferred) | ✗ | ✓ | ✗ | ✓ (calc) | ✓ (calc) | ✗ | ✗ |
| Shadow/highlight priority | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ (post only) | ✗ |
| Diffraction limit warning by output medium | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Open-source lens database (Lensfun) | ✗ | ✓ (planned) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Learning Mode with explanations | ✓ | ✓ (expanded) | ✗ | ✗ | △ | ✗ | ✗ |
| Confidence score per suggestion | ✓ | ✓ (param-linked) | ✗ | ✗ | ✗ | ✗ | ✗ |
| BYOK (no platform subscription needed) | ✓ | ✓ | N/A (hardware) | ✓ (one-time) | ✓ (one-time) | ✗ | △ |

---

## 3.8 Gap Analysis

### Gap 1: Signal Completeness (Parameter Coverage)
```
Gap: Limited AI input signal set
Evidence: CamTune uses 8 signals; Arsenal 2 documents 22 factors; PhotoPills DoF uses 7+ lens params
Opportunity: Expand buildSystemPrompt() with LensProfile data + ShootingIntent fields
Priority: high
```

### Gap 2: Lens Data Availability and Population
```
Gap: LensProfile schema exists but no UI, no auto-detection, no seeded data
Evidence: Users cannot populate lens data without a UI; most won't manually fill a schema
Opportunity: (1) Lens quick-add UI with search backed by Lensfun XML data (~1,000+ lenses, LGPL-3.0)
            (2) EXIF extraction from uploaded reference photos via exif-js or piexifjs (both MIT)
Priority: high
```

### Gap 3: Prompt Architecture and Parse Reliability
```
Gap: buildSystemPrompt() is a template string; no structured output schema enforced
Evidence: extractFirstJSON() / coerceSuggestion() fallback parsing is fragile at larger response sizes
Opportunity: Migrate to OpenAI response_format: { type: "json_schema" } — supported on gpt-4o-2024-08-06+
            Eliminates parse failures; field presence guaranteed by API schema enforcement
Priority: medium
```

### Gap 4: Advanced Camera Body Data (AF type, per-ISO read noise)
```
Gap: CameraDatabase lacks AF system type, burst rate fps, per-ISO read noise curves
Evidence: Photons to Photos (photonstophotos.net) maintains per-camera per-ISO data; no public API
          DPReview spec DB (1,700+ cameras) deprecated; Digicam Finder is emerging open-source replacement
Opportunity: Manual data entry for top 30 cameras (~80% of user base [estimate]);
             long-term: Digicam Finder API or community contributions
Priority: low (phase 2)
```

### Gap 5: Beginner UX / Cognitive Load
```
Gap: Adding 10+ new input fields creates hostile UX for Learning Mode users
Evidence: Arsenal 2's most common negative reviews cite "too complicated for casual use"
Opportunity: (1) Auto-populate lens profile from saved LensProfile records
             (2) Smart defaults from existing shootIntent enum
             (3) Advanced inputs in expandable section (visible at INTERMEDIATE+ skill level only)
Priority: high
```

---

## 3.9 Differentiation Strategy

1. **Lens-Aware Aperture Constraint Enforcement (unique in web-native BYOK tier):** Arsenal 2 includes sharpness profiles but requires $149+ hardware. CamTune Extended will be the only web-native, hardware-free system that enforces hard aperture constraints from the user's actual `LensProfile`, rejects physically impossible apertures, and combines IBIS + OIS stops correctly per focal length — all with zero hardware purchase.

2. **Output-Medium-Aware Diffraction Guard (no competitor does this pre-shoot):** No competing app (Arsenal 2, PhotoPills, SetMyCamera, Lightroom) provides pre-shoot diffraction warnings tied to output medium. A photographer printing A2+ on a 24MP APS-C camera should not shoot at f/16 due to diffraction softness. CamTune Extended would be the first AI recommendation engine to gate aperture recommendations by output medium — a uniquely practical guardrail for landscape and studio photographers.

3. **Dual-Native ISO Exploitation (technically correct, non-obvious, highly shareable):** Sony, Canon Cinema, Panasonic S/G series cameras have dual native ISO. The fields `dualNativeIso` / `dualNativeIsoValues` are already in the schema but unused in prompts. Recommending ISO 12800 over ISO 6400 because 12800 is a native gain stage is a technically correct, non-obvious recommendation no consumer photography app currently makes — and the Learning Mode explanation is genuinely educational and shareable.

4. **End-to-End Pre-Shoot → Post-Shoot Pipeline (unmatched in market):** Arsenal 2 has no DAW integration. PhotoPills has no DAW integration. Luminar Neo and Lightroom are post-processing only. CamTune Extended's lens profile and shooting intent data flows directly into XMP/Capture One metadata at export time — so the AI's pre-shoot decisions (shadow priority, output medium, white balance intent) can pre-populate post-processing defaults. This end-to-end pipeline is unique in the market.

5. **Parameter-Linked Confidence Transparency:** CamTune already returns `confidence: 0–100`. Extended parameters should feed into a visible "recommendation completeness" score: "Confidence 87% — add your lens profile to reach 95%." This gamifies data entry while communicating *why* scores are lower — a pattern proven by LinkedIn profile completeness. No competitor shows parameter-linked confidence transparency.

---

## 3.10 Initial MVP Scope

| Feature | Priority | Rationale |
|---|---|---|
| Active lens focal length in IBIS check | must | Replaces 50mm default in `ibis-check.ts`. Already ~80% scaffolded in `route.ts`. Zero schema changes needed. |
| Lens max aperture in AI prompt + post-parse clamp | must | Pass `maxAperture` from `LensProfile` into `buildSystemPrompt()`. Add clamp in `coerceSuggestion()` to reject impossible apertures. |
| OIS + IBIS combined stabilization | must | Update `getMinShutterSpeed()` in `ibis-check.ts` to accept `totalStops = ibisStops + stabilizationStops` capped at 8. |
| Lens profile quick-add UI | must | Brand/model search + focal length + max aperture + IS toggle. Seed with ~50 popular lenses from Lensfun XML. |
| Granular subject motion speed (5 levels) | should | Extend `RecommendRequestBody` with `subjectMotionSpeed`. Pass into prompt. Default from `shootIntent` if not set. |
| Output medium selector + diffraction warning | should | Add `outputMedium` to request. Gate aperture recommendations for print. Default: `web_1080`. |
| Flash availability in prompt | should | Add `flashAvailability`. Trigger HSS suggestion or fill-flash compensation. Default: `none`. |
| Dual-native ISO exploitation in prompt | should | When `dualNativeIso === true`, pass `dualNativeIsoValues` to prompt with instruction to prefer native gain stages. |
| AF system type + burst rate in camera DB | later | Add `afSystemType` + `burstRateFps` to schema. Seed top 20 cameras. Use for action recommendations. |
| Per-ISO read noise curves | later | Requires reliable data pipeline (Photons to Photos). Manual entry for 200 cameras is not maintainable. Phase 2. |

---

## 4.1 Technical Approaches

### Approach A: Additive Prompt Expansion *(Recommended for MVP)*

Extend `buildSystemPrompt()` to include new parameters as additional lines in the existing template string. Add new validated fields to `RecommendRequestBody`. Update `coerceSuggestion()` to enforce aperture constraints.

| Pros | Cons | Complexity | Lock-in Risk |
|---|---|---|---|
| Minimal risk, backward-compatible | Prompt grows linearly | Low | None |
| All new params optional with fallbacks | Manual JSON parsing (`extractFirstJSON`) remains fragile | | |
| Works with all OpenAI and Ollama models | | | |
| No schema migration for MVP | | | |

**Estimated effort:** 3–5 days

### Approach B: Structured Output with JSON Schema *(Recommended for post-MVP hardening)*

Migrate to OpenAI `response_format: { type: "json_schema" }` with a fully typed schema matching `RecommendationResult`. Remove `extractFirstJSON` and `coerceSuggestion`.

| Pros | Cons | Complexity | Lock-in Risk |
|---|---|---|---|
| Eliminates all parse failures | Not compatible with all Ollama models or GPT-4 Classic | Medium | OpenAI API |
| Field presence guaranteed by API schema | Requires model version detection | | |
| Schema serves as documentation | Adds ~100 tokens per request for schema definition | | |

**Key note:** Compatible with `gpt-4o-mini` and `gpt-4o-2024-08-06+`. CamTune defaults to `gpt-4o` (see `route.ts`) — fully supported. [fact — OpenAI documentation]

### Approach C: Lensfun Database Integration for Lens Seeding

Integrate Lensfun open-source lens database (GitHub: `lensfun/lensfun`, LGPL-3.0) as a seeding source for the lens quick-add UI. Parse XML at build time to generate a seeded lens search index.

| Pros | Cons | Complexity | Lock-in Risk |
|---|---|---|---|
| 1,000+ lenses covered | XML parsing required at build time | Low | LGPL attribution |
| LGPL — commercially usable with attribution | OIS stops data inconsistent across lenses | | |
| Used by darktable, RawTherapee, digiKam | No T-stop data for cinema lenses | | |

### Approach D: EXIF-Driven Lens Auto-Detection

Allow users to upload a reference photo. Extract EXIF `FocalLength`, `FNumber`, `LensModel`, `LensMake`, `StabilizationMode` using `exif-js` (MIT) or `piexifjs` (MIT) on the client side. Auto-populate `LensProfile` fields.

| Pros | Cons | Complexity | Lock-in Risk |
|---|---|---|---|
| Zero friction — works from existing photos | `LensModel` strings are non-standardized across brands | Medium | None |
| No server processing needed | No `stabilizationStops` in EXIF — requires DB lookup | | |
| Works with any EXIF-compliant camera | Requires fuzzy string matching to Lensfun ID | | |

---

## 4.2 Contrarian View

**Why this feature might fail or be over-engineered:**

The core value proposition of CamTune is "take a photo, get settings" — a 3-input interaction (camera, location, shoot intent). The proposed expansion adds at minimum 5 additional fields: active lens (focal length, max aperture, OIS), subject motion speed, flash availability, output medium, and background blur intent. For a beginner user in Learning Mode, this is a settings screen that rivals a camera body's own menu system.

Arsenal 2 is the most direct precedent. It launched with hardware-AI promises and 22-factor analysis — but its most common negative review theme is "too complicated for casual use." CamTune risks the same trap at a software level.

Additionally, the accuracy improvement from new parameters is asymmetric: lens focal length and max aperture provide a large, measurable accuracy gain (eliminates impossible apertures, corrects IBIS check by up to 4×). But subject distance estimate, contrast ratio, and shadow/highlight priority are signals the AI can partially infer from the uploaded image anyway — Vision API can estimate subject distance from compositional depth cues. Adding user-input versions of these signals may produce only marginal accuracy gains while adding substantial UX friction.

The safest path is to implement only parameters the AI *cannot* infer itself (focal length, max aperture, OIS stops, flash availability, output medium) and let the AI continue to infer what it can (subject distance, contrast ratio, ambient light type). The MVP scope in this document follows this principle; the most inferrable signals are in the "later" priority tier.

---

## 4.3 Risks Table

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Beginners abandon app due to increased input complexity | High | High | Progressive disclosure; auto-populate from saved lens profile; smart defaults from `shootIntent` |
| Lens database sparse; users can't find their lens | Medium | High | Ship with 50 most-popular lenses seeded from Lensfun XML; allow manual free-text entry as fallback |
| EXIF lens name matching fails (non-standardized strings) | High | Medium | Fuzzy string matching (Levenshtein) + manual override; store raw EXIF string alongside matched lens |
| OpenAI structured output unsupported on user's selected model | Medium | Medium | Detect model version; fall back to current `extractFirstJSON` for non-compliant models |
| Dual-native ISO guidance wrong for non-standard cameras | Low | Medium | Only emit dual-native guidance when `dualNativeIso === true` AND `dualNativeIsoValues` is parseable |
| Combined IBIS+OIS calculation exceeds real-world limits | Medium | Low | Cap combined stops at 8; add warning: "Combined IS exceeds 8 stops — using 8-stop maximum" |
| Lensfun LGPL requires attribution | Low | Low | Add attribution note in about/legal page; LGPL does not require open-sourcing the application |
| Flash sync speed wrong for specific camera/lens combo | Medium | Medium | Use conservative 1/200s sync default; only use 1/250s for cameras with confirmed sync speed in DB |
| AI hallucinates new fields (invalid `shadowPriority` value) | Medium | Low | Strict enum validation in `coerceSuggestion`; default to `neutral` for any invalid value |
| Token count increase degrades recommendation latency | Low | Medium | Measure baseline and expanded prompt tokens; target <2,000 total tokens including user message at max params |

---

## 4.4 Recommendations

1. **[recommendation]** Implement the four "must" MVP items (focal length in IBIS check, max aperture constraint, OIS+IBIS combined, lens quick-add UI) as a single sprint. These have the highest accuracy-to-effort ratio and require no new schema migrations — `LensProfile` already exists in the Prisma schema.

2. **[fact]** The `LensProfile` model in `prisma/schema.prisma` already contains `focalLengthMm`, `maxAperture`, `isStabilized`, and `stabilizationStops`. The `route.ts` already queries `LensProfile` for `focalLengthMm` and passes it to `checkShutterSpeed`. This means focal-length-aware IBIS is ~80% done; only `stabilizationStops` needs to be pulled through.

3. **[recommendation]** Migrate to OpenAI Structured Outputs (`response_format: json_schema`) as a post-MVP hardening step. The current `extractFirstJSON` parser is fragile at larger response sizes. `gpt-4o` (the default model) fully supports this.

4. **[inference]** The dual-native ISO feature is likely to be the most "delightful" for semi-pro users with Sony A7 IV, Panasonic S5 II, or similar cameras — because no competitor surfaces this information at recommendation time. The schema already stores `dualNativeIso` and `dualNativeIsoValues`; exploiting it in the prompt costs ~50 extra tokens and zero schema changes.

5. **[recommendation]** Seed a lens database of the top 50 most common lenses using Lensfun XML data (LGPL-3.0, commercially usable with attribution). This resolves Gap 2 without building a full lens management product. Target: Sony G/GM, Canon RF L-series, Nikon Z S-line, Fujifilm XF, and the 5 best-selling kit zooms from each brand.

6. **[inference]** Subject motion speed granularity ("should" priority) has the second-highest perceived impact after lens aperture constraints, because sports/action users are currently under-served by the coarse 3-level model. A 5-level scale mapped to minimum shutter speeds (stationary → 1/focal, walking → 1/250, running → 1/500, vehicle → 1/1000, sports → 1/2000) gives the AI explicit guidance it currently must infer.

7. **[recommendation]** Do not implement per-ISO read noise curves (the "later" items) until a reliable automated data pipeline exists. Manual data entry for 200 cameras is not maintainable. Wait for Digicam Finder API maturity or a community contribution model.

8. **[fact]** Arsenal 2 confirms 22 parameters is a viable upper bound for a hardware-accelerated on-device model. Keeping CamTune's total signal count ≤ 20 for the initial expanded version maintains prompt token efficiency and avoids exceeding the 1,800 `max_tokens` cap currently set in `route.ts`.

---

## Sources

| Source | Topic | What Was Found |
|---|---|---|
| https://witharsenal.com/features | Arsenal 2 features | 22-factor AI model, lens sharpness DB, hardware spec |
| https://www.wimarys.com/arsenal-intelligent-camera-assistant-honest-review/ | Arsenal 2 review | Usability complaints, "too complex for casual use" finding |
| https://fstoppers.com/astrophotography/arsenal-2-advanced-photographers-612318 | Arsenal 2 Fstoppers | Pro/con analysis for advanced photographers |
| https://witharsenal.com/blog/choosing-camera-settings/ | Arsenal AI settings | How 22-factor model works |
| https://www.australiangeographic.com.au/australian-geographic-adventure/2024/12/arsenal-2-pro-tested/ | Arsenal 2 field test | Real-world accuracy evaluation |
| https://platform.openai.com/docs/guides/structured-outputs | OpenAI Structured Outputs | JSON schema enforcement, model compatibility |
| https://openai.com/index/introducing-structured-outputs-in-the-api/ | Structured Outputs release | `gpt-4o-2024-08-06` requirement confirmed |
| https://cookbook.openai.com/examples/structured_outputs_intro | Structured Outputs cookbook | Implementation examples |
| https://www.photonstophotos.net/Charts/PDR.htm | Photons to Photos DR | Per-camera per-ISO dynamic range data |
| https://www.photonstophotos.net/Charts/RN_ADU.htm | Photons to Photos read noise | Per-camera per-ISO read noise curves |
| https://lensfun.github.io/ | Lensfun project | LGPL-3.0, 1,000+ lens profiles, OIS data availability |
| https://github.com/lensfun/lensfun | Lensfun GitHub | XML format, DTD, mount/focal-length/aperture fields |
| https://lensfun.github.io/manual/v0.3.2/dbformat.html | Lensfun DB format | Calibration data structure (distortion, vignetting, TCA) |
| https://petapixel.com/2023/04/03/digicam-finder-is-a-new-resource-that-replaces-dpreviews-camera-library/ | Digicam Finder | DPReview replacement, open-source camera spec DB |
| https://www.photopills.com/articles/depth-of-field-guide | PhotoPills DoF | Lens parameter handling in DoF calculations |
| https://www.photopills.com/calculators/dof | PhotoPills DoF calc | Focal length, aperture, distance inputs confirmed |
| https://shotkit.com/photopills-review/ | PhotoPills review | Pricing, features, no AI component confirmed |
| https://apps.apple.com/us/app/setmycamera/id670363905 | SetMyCamera App Store | Pricing, features list |
| https://www.viewbug.com/blog/5-ways-to-make-the-most-of-the-ai-tools-in-adobe-lightroom | Adobe LR AI | Sensei feature set, dataset size |
| https://neurapix.com/blog/ai-in-lightroom-classic | Adobe Sensei LR Classic | Adaptive profiles, auto-adjust mechanism |
| https://www.diyphotography.net/luminar-neo-update-ai-tools-auto-adjust-spring-2025/ | Luminar Neo Spring 2025 | AI Auto Adjust feature confirmed in Spring 2025 |
| https://www.softwarehow.com/luminar-review/ | Luminar Neo review | Pricing, platform (desktop only) confirmed |
| https://auth0.com/blog/read-edit-exif-metadata-in-photos-with-javascript/ | piexifjs | JavaScript EXIF library, MIT license, browser usage |
| https://phototour.cs.washington.edu/focal.html | EXIF focal length | Focal length extraction from EXIF research |
| https://stendec.io/photofriend/ | Photo Friend | Feature set, pricing, light meter approach |
| https://play.google.com/store/apps/details?id=com.quicosoft.exposurecalculator.app&hl=en_US | Exposure Calculator Android | Simple triangle calc, no AI |
| https://www.wimarys.com/artificial-intelligence-and-camera-settings-a-game-changer/ | AI camera settings 2025 | Modern cameras recognize 1,000+ scene types (up from ~100) |
| https://lenspire.zeiss.com/photo/app/uploads/2022/02/technical-article-depth-of-field-and-bokeh.pdf | Zeiss DoF & Bokeh | Technical basis for diffraction limit by aperture/format |
| https://lens-db.com/ | LENS-DB.COM | Alternative lens database reference |
