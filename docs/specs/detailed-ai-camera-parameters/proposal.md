# Proposal: Detailed AI Camera Parameters
> Feature: detailed-ai-camera-parameters
> Date: 2026-03-23
> Status: Draft

## Why

CamTune currently generates AI camera recommendations using 8 environmental signals (sensor size, ISO range, IBIS stops, noise floor, dynamic range EV, GPS, weather, sun position) but treats every lens as a hypothetical 50mm f/1.8 prime. This produces two classes of failures that erode user trust: the AI may recommend apertures physically impossible on the user's lens (e.g., f/1.4 on a kit zoom), and the IBIS minimum-shutter calculation defaults to 50mm regardless of whether the user is shooting a 14mm ultra-wide or a 400mm telephoto. For a semi-pro shooting an 85mm portrait lens, the current system silently misjudges the safe handheld threshold by nearly 3 stops.

Research confirmed this gap is the highest-leverage improvement available without adding hardware dependencies. The `LensProfile` model already exists in the Prisma schema and `route.ts` already queries `focalLengthMm` — the scaffolding is ~80% complete. Adding structured AI output (OpenAI `response_format: json_schema`) alongside lens-aware prompt signals and a post-parse constraint validator closes the remaining gap. Five additional "should" features (subject motion, output medium, flash awareness, dual-native ISO, and XMP context propagation) are included in this sprint because they share the same prompt expansion path and add disproportionate value relative to their implementation cost.

The competitive context reinforces urgency. Arsenal 2 is the only hardware-based competitor with lens awareness, but it requires a $149+ hardware dongle and a physical camera connection. PhotoPills and SetMyCamera are calculators, not AI systems. Adobe Lightroom and Luminar Neo are post-processing only. CamTune is the only web-native BYOK AI recommendation app — this feature makes it the only such app with lens-constrained aperture enforcement, output-medium-aware diffraction guarding, and dual-native ISO exploitation before the shutter is pressed.

## What Changes

- **Lens profile quick-add**: Users can search a seeded Lensfun database (~1,000+ lenses), auto-detect lens from uploaded photo EXIF, or enter lens specs manually. An active lens indicator appears on the recommendation screen.
- **Aperture recommendations become physically correct**: The AI can no longer suggest f/1.4 on an f/4 lens. Post-parse clamping enforces the lens `maxAperture` as an absolute ceiling, with a visible note when a clamp is applied.
- **IBIS shutter check uses the actual focal length**: The 50mm placeholder is replaced by the active lens focal length (or midpoint for zooms), correcting up to a 2–4 stop error in the handheld safety threshold.
- **Shot details expand AI context**: An expandable "Shot Details" panel lets users specify subject motion speed, intended output medium, and flash availability — inputs that directly shape shutter speed and aperture guidance.
- **Shooting context flows into XMP export**: Lens profile, output medium, shadow priority, and flash mode are written into the Lightroom/Capture One XMP sidecar under a `cameratune:` namespace, so post-processing decisions are pre-populated from the shooting plan.

## Capabilities (New)

1. **Lens-Aware IBIS Calculation**
   The IBIS minimum-shutter check replaces the hardcoded 50mm default with the active lens's actual focal length. For zoom lenses without a set zoom position, the midpoint focal length is used with a UI prompt to improve accuracy.

2. **Aperture Constraint Enforcement**
   After the AI returns its recommendation, `coerceSuggestion()` clamps the suggested aperture to the lens `maxAperture`. For variable-aperture zooms, the tele-end maximum aperture is used when the lens is at its telephoto position.

3. **Combined Stabilization (OIS + IBIS)**
   When both in-body IS (IBIS) and optical IS (OIS) are present, the combined stabilization stops are calculated as `min(ibisStops + oisStops, 8)`. The 8-stop cap reflects the physical hardware limit and prevents over-confident handheld shutter recommendations.

4. **Lens Profile Management**
   A lens quick-add UI allows users to search the seeded Lensfun database, auto-detect their lens from an uploaded photo's EXIF `LensModel` field (via fuzzy matching), or enter specs manually. The active lens is shown alongside the camera name on the recommendation screen.

5. **Granular Subject Motion Speed**
   A 5-level subject motion selector (Stationary / Walking / Running / Vehicle / Sports) lets users communicate motion to the AI. Each level maps to a minimum shutter speed floor injected into the prompt, preventing motion blur in action scenarios.

6. **Output Medium & Diffraction Guard**
   Users select their intended output medium (Web 1080p / Web 4K / Print A4 / Print A2+ / Commercial). For large-format print outputs, a diffraction warning fires when the recommended aperture exceeds the sensor-size-specific threshold (f/11 for APS-C, f/16 for full-frame).

7. **Flash Availability Intelligence**
   Users declare flash availability (none / speedlight / HSS-capable). The AI adjusts fill-flash guidance accordingly, and a flash sync speed warning fires when a non-HSS speedlight would require a shutter speed exceeding ~1/200s.

8. **Dual-Native ISO Optimization**
   For cameras with confirmed dual-native ISO (e.g., `dualNativeIso = true`, `dualNativeIsoValues = [800, 3200]`), the AI prompt is instructed to prefer native gain stages over intermediate ISOs. In Learning Mode, an explanation note is shown explaining why native ISOs produce cleaner shadows.

## Capabilities (Modified)

**AI Settings Recommendation Engine**: The recommendation engine's prompt builder (`buildSystemPrompt()`) is expanded to accept `LensProfile` and `ShootingIntent` as optional parameters. When present, these fields are serialized into the system prompt alongside existing environmental signals. The AI response is now validated against a JSON Schema (`response_format: json_schema`) for compatible OpenAI models (gpt-4o-2024-08-06 and later), with automatic fallback to `extractFirstJSON` + `coerceSuggestion` for older models. The `coerceSuggestion()` function gains five new constraint validators: aperture clamp, combined-IS cap, flash sync check, diffraction guard, and dual-native ISO adjustment.

**XMP Export (Lightroom + Capture One)**: The `IntegrationService.buildXMP()` method is extended to include new `cameratune:` namespace fields: `cameratuneLensProfile`, `cameratuneOutputMedium`, `cameratuneShadowPriority`, `cameratuneFlashMode`, and `cameratuneSubjectMotion`. Missing fields are omitted from the XMP output rather than written as null/empty values. The Lightroom and Capture One panel displays are updated to surface shooting context when these fields are present.

## Scope

### In Scope
1. Lens-aware IBIS calculation (replace 50mm default with active lens focal length)
2. Aperture constraint enforcement (clamp in `coerceSuggestion()` + prompt signal)
3. Combined OIS + IBIS stabilization calculation with 8-stop cap
4. Lens profile management UI (search, EXIF auto-detect, manual entry, active indicator)
5. Granular subject motion speed (5 levels) in Shot Details panel
6. Output medium selector with diffraction warning for large-format print
7. Flash availability intelligence with sync speed warning
8. Dual-native ISO exploitation for supported cameras
9. XMP export extended with lens profile and shooting intent fields
10. Lensfun XML seed script (~1,000+ lenses) with build-time Supabase import
11. JSON Schema structured output with `extractFirstJSON` fallback

### Out of Scope
- AF system type and burst rate recommendations (phase 2)
- Per-ISO read noise curves (requires automated data collection pipeline)
- Cinema T-stop support (professional video workflow, separate sprint)
- Aperture flow for this sprint (planned for a separate feature)
- Mobile app changes (web-only platform)
- Full per-aperture lens sharpness profiles (Arsenal 2 hardware territory)
- Community lens database contributions (phase 2)

## Success Criteria

1. **Aperture correctness**: AI never recommends an aperture exceeding `lensProfile.maxAperture` in a production recommendation (verified by unit + integration tests with 0 failures).
2. **IBIS focal length accuracy**: IBIS check uses the active lens focal length, not the 50mm default, for 100% of recommendations where a lens profile is set.
3. **Lens quick-add speed**: Lens quick-add flow finds the correct lens in ≤3 keystrokes for the top 50 most common lenses in the Lensfun database (verified by E2E test).
4. **Backward compatibility**: 100% of existing recommendation scenarios (no lens profile set) produce results identical to pre-feature behavior, verified by regression test suite.
5. **Structured output coverage**: `response_format: json_schema` is used for all compatible model versions; fallback fires correctly for incompatible models with no user-facing error.
6. **Diffraction warning accuracy**: Diffraction warning fires for `print_a2_plus` + APS-C + aperture > f/11 and for full-frame + aperture > f/16; does not fire for web outputs.
7. **XMP round-trip**: Lens profile and shooting intent fields written to XMP are readable and correctly displayed in the Lightroom CamTune panel for all non-null fields; null fields are omitted from the XMP sidecar.

## Impact

CamTune's primary competitive gap versus Arsenal 2 has always been hardware dependency. Arsenal 2 achieves lens awareness through a physical camera connection ($149+ dongle); CamTune achieves it through user-declared lens profiles and EXIF detection — no hardware required. This feature establishes lens-constrained AI recommendations as a web-native capability for the first time among BYOK photography AI tools.

The immediately addressable audience is semi-professional photographers who already manage lens profiles in Lightroom or Capture One, carry 2–4 lenses regularly, and would benefit from pre-shoot settings that account for the specific glass they are mounting. Learning Mode users (beginners) benefit without any additional effort: the progressive disclosure model surfaces only the lens name once set, hides advanced controls by default, and auto-populates shooting intent from saved preferences. The XMP integration extends value into the post-processing phase — a CamTune session with a lens profile and output medium set produces a richer sidecar that pre-populates develop settings, closing the loop between pre-shoot planning and post-processing execution.
