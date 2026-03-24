# Spec: Detailed AI Camera Parameters
> Date: 2026-03-23
> Status: Draft

## ADDED Requirements

---

### Requirement: Lens Profile Management

Users can add, search, and select an active lens profile using three paths: searching a seeded Lensfun database, auto-detecting from an uploaded photo's EXIF `LensModel` field, or entering lens specs manually. An active lens profile indicator appears on the recommendation screen alongside the camera name. If no lens profile is set, a yellow indicator prompts the user to add one, and the recommendation is generated using a 50mm f/1.8 placeholder with a visible "Estimated — lens profile missing" label.

**Priority**: MUST

#### Scenario: Search and add a lens from database
- GIVEN user has no active lens profile
- WHEN user opens the lens picker and types "85mm" in the search field
- THEN the app queries the seeded Lensfun database and shows matching results within ≤1 second; results are ordered by manufacturer popularity (Canon, Nikon, Sony, Fujifilm first)
- WHEN user selects a lens from the results
- THEN a `LensProfile` record is saved with: `focalLengthMm`, `maxAperture`, `isStabilized`, `stabilizationStops`, `lensType`, `lensfunId`, `source = 'lensfun'`; the lens name appears in the active lens indicator on the recommendation screen

#### Scenario: Auto-detect lens from EXIF
- GIVEN user uploads a reference photo with EXIF data containing a `LensModel` field
- WHEN the app reads the EXIF data via `ExifExtractorClient`
- THEN the app calls `LensDatabaseService.matchExif(lensModelString)` using Levenshtein fuzzy matching
- AND the app shows a confirmation: "Detected: Canon EF 85mm f/1.4L IS USM — is this correct?" with an Edit option to correct the match
- WHEN user confirms
- THEN the matched `LensProfile` is saved as the active lens with `source = 'exif'`

#### Scenario: EXIF lens unrecognized
- GIVEN user uploads a photo and the EXIF `LensModel` string does not fuzzy-match any Lensfun entry above the confidence threshold (0.7)
- WHEN the match attempt returns null
- THEN the app shows: "Could not identify your lens (EXIF: '{rawLensModelString}')" with two options: "Search database" and "Enter manually"
- AND the raw EXIF string is stored for future matching improvement (logged to `lens_exif_unmatched` table)

#### Scenario: Manual lens entry fallback
- GIVEN lens not found in database or user selects "Enter manually"
- WHEN user completes the manual entry form
- THEN user can enter: focal length (single value for prime, or min–max range for zoom), maximum aperture (f-number), optical IS yes/no, IS stops (optional); all required fields validated before save
- THEN `LensProfile` is saved with `source = 'manual'` and a "user-entered" flag; no `lensfunId` is set
- AND the lens appears immediately as the active lens

#### Scenario: Active lens indicator
- GIVEN user has an active lens profile
- WHEN user is on the recommendation screen
- THEN the active lens name (e.g., "Sony FE 85mm f/1.4 GM") is shown adjacent to the camera name in the session header
- AND the confidence score displayed on the recommendation reflects the presence of lens data (higher confidence than placeholder)

#### Scenario: No active lens profile warning
- GIVEN user has no active lens profile
- WHEN a recommendation is generated
- THEN a yellow indicator is shown: "Set your lens for better recommendations" with a "Add Lens" shortcut button
- AND the recommendation is generated using focal length = 50mm, maxAperture = f/1.8 as placeholder values
- AND the recommendation card is labeled "Estimated — lens profile missing" in amber text
- AND the confidence score note reads: "Accuracy improves with your lens profile"

#### Scenario: Switch active lens mid-session
- GIVEN user has an active lens and is on the recommendation screen
- WHEN user taps the active lens name and selects a different lens from their saved profiles
- THEN the recommendation is regenerated immediately using the new lens profile; no full page reload required

---

### Requirement: Lens-Aware IBIS Calculation

The IBIS minimum-shutter check in `ibis-check.ts` uses the actual focal length from the active `LensProfile` instead of the hardcoded 50mm default. For zoom lenses, the current zoom position (`currentFocalLengthMm`) is used if set; otherwise, the midpoint of the focal length range is used. Combined IBIS and OIS stops are calculated together, capped at 8 stops.

**Priority**: MUST

#### Scenario: Correct focal length in IBIS check
- GIVEN user has an active lens profile with `focalLengthMm = 200`, camera has `ibisStops = 5.5`, lens has `stabilizationStops = 5` and `isStabilized = true`
- WHEN the AI recommendation is generated and the IBIS check runs
- THEN the system uses 200mm (not 50mm) as the focal length for the reciprocal rule calculation
- AND combined stabilization = `min(5.5 + 5, 8) = 8 stops`
- AND minimum handheld shutter is calculated as `1 / (focalLength / 2^combinedStops)` ≈ 1/1s
- AND no false "below safe shutter limit" warning is generated for a shutter speed of 1/15s

#### Scenario: IBIS check with prime lens, no OIS
- GIVEN user has a 135mm prime lens with `isStabilized = false`, camera has `ibisStops = 6`
- WHEN IBIS check runs
- THEN combined stabilization = 6 stops (camera only)
- AND minimum handheld shutter = 135 / 2^6 ≈ 1/2s
- AND UI shows minimum safe shutter without any OIS contribution note

#### Scenario: IBIS check with zoom lens at unknown focal length
- GIVEN active lens is a 70–200mm zoom with `focalLengthMinMm = 70`, `focalLengthMaxMm = 200`, and no `currentFocalLengthMm` set
- WHEN the IBIS check runs
- THEN the system uses 135mm (midpoint of 70–200) as the working focal length
- AND the UI shows a soft prompt: "Using estimated 135mm — set your zoom position for a more accurate handheld limit"

#### Scenario: User sets zoom position explicitly
- GIVEN zoom lens 70–200mm and user opens zoom position input
- WHEN user enters 200mm as the current focal length
- THEN `currentFocalLengthMm = 200` is saved at session level (not persisted to `LensProfile`)
- AND IBIS check immediately recalculates using 200mm
- AND the "estimated" soft prompt disappears

#### Scenario: Combined stabilization capped at 8 stops
- GIVEN camera with `ibisStops = 7` and active lens with `isStabilized = true`, `stabilizationStops = 5`
- WHEN combined stabilization is calculated
- THEN result = `min(7 + 5, 8) = 8 stops` (not 12)
- AND in Learning Mode, an explanatory note is shown: "Combined IS is capped at 8 stops — the maximum achievable with current hardware"
- AND `stabilizationWarning = "Combined IS exceeds 8 stops — using 8-stop maximum"` is logged (not shown in Quick Mode)

#### Scenario: No IBIS, no OIS — reciprocal rule only
- GIVEN camera has `ibisStops = 0` and active lens has `isStabilized = false`
- WHEN minimum shutter is calculated
- THEN result = reciprocal of focal length (e.g., 1/200s for a 200mm lens)
- AND UI shows: "No stabilization detected — minimum handheld: 1/200s"

---

### Requirement: Aperture Constraint Enforcement

After the AI returns its recommendation, `coerceSuggestion()` enforces the lens `maxAperture` as an absolute aperture ceiling. The clamp is applied regardless of what the AI suggests. When a clamp is applied, a note is added to the recommendation. For variable-aperture zoom lenses, the effective maximum aperture at the current focal length is used.

**Priority**: MUST

#### Scenario: Clamp impossible aperture
- GIVEN active lens has `maxAperture = f/4` (e.g., a 70–200mm f/4 telephoto)
- WHEN the AI suggests aperture = f/1.4 in its response
- THEN `coerceSuggestion()` clamps the aperture to f/4
- AND `apertureClampApplied = true` is set in the recommendation result
- AND the recommendation displays the note: "f/1.4 requested but your lens maximum is f/4"
- AND the confidence score is not penalized (the clamp is an enforcement action, not an error)

#### Scenario: AI suggestion within lens range — no clamp
- GIVEN active lens has `maxAperture = f/1.4`
- WHEN the AI suggests aperture = f/2.8
- THEN no clamp is applied; f/2.8 is returned as-is
- AND `apertureClampApplied = false`

#### Scenario: Zoom lens at fixed maximum aperture
- GIVEN a 24–70mm f/2.8 lens with `isVariableAperture = false`, `maxAperture = f/2.8`, at 70mm
- WHEN AI recommends aperture = f/2.8
- THEN f/2.8 is allowed; no clamp needed regardless of focal length position

#### Scenario: Variable aperture zoom at tele end
- GIVEN an 18–55mm f/3.5–5.6 lens with `isVariableAperture = true`, `maxAperture = f/3.5` (wide end), `maxApertureTele = f/5.6` (tele end), and `currentFocalLengthMm = 55`
- WHEN AI recommends aperture = f/3.5
- THEN system detects variable aperture zoom at tele position (55mm ≥ tele threshold)
- AND clamps to f/5.6 with note: "At 55mm, your lens maximum is f/5.6"

#### Scenario: Variable aperture zoom at wide end
- GIVEN same 18–55mm f/3.5–5.6 lens with `currentFocalLengthMm = 18`
- WHEN AI recommends aperture = f/3.5
- THEN f/3.5 is allowed; wide-end maximum aperture applies; no clamp

#### Scenario: No active lens profile — no aperture clamp
- GIVEN no active lens profile is set (50mm f/1.8 placeholder in use)
- WHEN AI suggests any aperture
- THEN clamp uses placeholder `maxAperture = f/1.8`; apertures wider than f/1.8 are clamped; existing behavior preserved with placeholder

---

### Requirement: Granular Subject Motion Speed

A 5-level subject motion speed selector in the Shot Details panel allows users to communicate motion context to the AI. Each level maps to a minimum shutter speed floor injected into the AI prompt, providing more accurate shutter speed guidance for action and sports scenarios.

**Priority**: SHOULD

#### Scenario: Subject motion speed selector in recommendation UI
- GIVEN user is on the recommendation screen
- WHEN user opens "Shot Details" (expandable section in Quick Mode)
- THEN the Shot Details section shows a subject motion selector with five options: Stationary / Walking / Running / Vehicle / Sports
- AND in Learning Mode, the selector is visible by default (not in an expandable section) with a label: "What's your subject doing?"

#### Scenario: Default subject motion inferred from shoot type
- GIVEN user has not explicitly set `subjectMotionSpeed`
- WHEN recommendation runs
- THEN system applies inference: if shoot type is portrait, landscape, or astro → `stationary`; if street or event → `walking`; if no shoot type set → `stationary` (conservative default)
- AND the inferred value is shown pre-selected in the UI so the user can override it

#### Scenario: Minimum shutter floors applied by motion level
- GIVEN user sets `subjectMotionSpeed = 'vehicle'`
- WHEN the AI builds the recommendation
- THEN the prompt includes: "Minimum shutter speed for this subject motion: 1/1000s"
- AND the final recommendation shutter speed is ≥ 1/1000s

Motion level to minimum shutter floor mapping:
| Level | Minimum Shutter |
|---|---|
| stationary | 1/focal_length (reciprocal rule) |
| walking | 1/250s |
| running | 1/500s |
| vehicle | 1/1000s |
| sports | 1/2000s |

#### Scenario: Motion speed combined with stabilization
- GIVEN `subjectMotionSpeed = 'walking'` (floor: 1/250s) and combined stabilization = 8 stops at 50mm
- WHEN minimum shutter is calculated
- THEN the system uses `max(1/250s, stabilization-limited floor)` — motion floor takes priority over IBIS savings when motion demands a faster shutter
- AND the IBIS-calculated minimum is shown as context but does not override the motion floor

---

### Requirement: Output Medium & Diffraction Guard

Users declare their intended output medium (Web 1080p, Web 4K, Print A4, Print A2+, Commercial) in the Shot Details panel. For large-format print outputs, the system applies a diffraction guard: a warning fires when the recommended aperture exceeds the diffraction threshold for the camera's sensor size and pixel pitch.

**Priority**: SHOULD

#### Scenario: Output medium selector in recommendation UI
- GIVEN user is in the recommendation screen
- WHEN user expands "Shot Details"
- THEN an "Output" dropdown appears with five options: Web (1080p) / Web (4K) / Print A4 / Print A2+ / Commercial
- AND the default selection is Web (1080p)
- AND the selected value is stored in `ShootingIntent.outputMedium` for the current recommendation session

#### Scenario: Diffraction warning for APS-C large-format print
- GIVEN `outputMedium = 'print_a2_plus'`, camera is a 24MP APS-C sensor
- WHEN AI recommends aperture = f/16
- THEN the recommendation shows: "f/16 may produce diffraction softness for A2+ print on your APS-C sensor. Consider f/8–f/11 for maximum sharpness at this output size."
- AND `diffractionWarning` is set in the recommendation result

#### Scenario: Diffraction warning for full-frame large-format print
- GIVEN `outputMedium = 'print_a2_plus'`, camera is a 45MP full-frame sensor
- WHEN AI recommends aperture = f/22
- THEN warning fires: "f/22 may produce diffraction softness for A2+ print on your full-frame sensor. Consider f/11–f/16."
- AND for AI-suggested f/16 on a 24MP full-frame, no warning fires (f/16 is at the threshold, not over)

Diffraction threshold by sensor size:
| Sensor Size | Diffraction Warning Threshold (print_a2_plus) |
|---|---|
| APS-C (1.5×/1.6×) | aperture > f/11 |
| Full-frame | aperture > f/16 |
| MFT (2×) | aperture > f/8 |
| Medium format | aperture > f/22 |

#### Scenario: No diffraction warning for web output
- GIVEN `outputMedium = 'web_1080'` or `'web_4k'`
- WHEN AI recommends any aperture including f/22
- THEN no diffraction warning is shown; diffraction is irrelevant at web resolution
- AND `diffractionWarning = null`

#### Scenario: Commercial output uses print_a2_plus thresholds
- GIVEN `outputMedium = 'commercial'`
- WHEN diffraction check runs
- THEN commercial output applies the same conservative threshold as `print_a2_plus` (strictest thresholds)

#### Scenario: Output medium propagates to XMP
- GIVEN user completes a session with `outputMedium = 'print_a2_plus'`
- WHEN user taps "Sync to Lightroom"
- THEN XMP field `cameratune:OutputMedium = "print_a2_plus"` is written to the sidecar

---

### Requirement: Flash Availability Intelligence

Users declare flash availability (none, speedlight, HSS-capable) in the Shot Details panel. The AI adjusts fill-flash guidance, and the constraint validator checks for flash sync speed violations when a non-HSS speedlight is selected and the recommended shutter speed exceeds ~1/200s.

**Priority**: SHOULD

#### Scenario: Flash availability selector in Shot Details
- GIVEN user is in Shot Details
- WHEN user expands the "Flash" option
- THEN a selector appears: No Flash / Speedlight / HSS-capable Flash / Studio Strobe
- AND the default is "No Flash"

#### Scenario: AI includes fill-flash guidance when flash available
- GIVEN `flashAvailability = 'speedlight'`, outdoor harsh sunlight at midday
- WHEN recommendation is generated
- THEN the AI prompt includes flash context; the recommendation may suggest: "Fill flash at -1 to -2 EV to balance shadows under direct sun"
- AND the explanation (Learning Mode) notes: "Flash prevents harsh shadows on your subject in direct sunlight"

#### Scenario: Flash sync speed warning — non-HSS speedlight
- GIVEN `flashAvailability = 'speedlight'` (non-HSS), camera sync speed = 1/200s
- WHEN AI recommends shutter speed = 1/500s
- THEN `enforceFlashSync()` fires a warning: "1/500s exceeds flash sync speed (~1/200s). Lower shutter to 1/200s or use an HSS-capable flash."
- AND `flashSyncWarning` is set in the recommendation result
- AND the warning is shown inline next to the shutter speed value (not as a modal)

#### Scenario: Flash sync speed threshold from CameraDatabase
- GIVEN camera has `maxFlashSyncSpeed = 1/250s` in `CameraDatabase`
- WHEN flash sync check runs
- THEN the camera-specific sync speed (1/250s) is used instead of the 1/200s conservative default

#### Scenario: HSS flash allows high shutter speed
- GIVEN `flashAvailability = 'hss_capable'`, bright outdoor sun
- WHEN AI recommends shutter speed = 1/4000s for outdoor fill-flash
- THEN no sync warning fires; HSS allows any shutter speed up to the camera's mechanical limit
- AND AI prompt notes: "HSS flash available — shutter speed unrestricted by sync limit"

#### Scenario: Studio strobe — sync speed warning applies
- GIVEN `flashAvailability = 'studio_strobe'`
- WHEN AI recommends shutter speed above sync speed
- THEN same flash sync warning fires as for non-HSS speedlight (studio strobes do not support HSS)

#### Scenario: No flash — ambient only, no changes
- GIVEN `flashAvailability = 'none'` (default)
- WHEN recommendation runs
- THEN no flash-related adjustments made; no flash guidance in output; existing behavior is fully preserved

---

### Requirement: Dual-Native ISO Optimization

For cameras with confirmed dual-native ISO support (`dualNativeIso = true` and `dualNativeIsoValues` set in `CameraDatabase`), the AI prompt is instructed to prefer native gain stages over intermediate ISOs. In Learning Mode, an explanation is shown connecting native ISO to shadow noise quality.

**Priority**: SHOULD

#### Scenario: Prefer native ISO over intermediate
- GIVEN camera has `dualNativeIso = true`, `dualNativeIsoValues = [800, 3200]`
- WHEN the AI would normally suggest ISO 1600 (intermediate, between native stages)
- THEN the system injects into the prompt: "This camera has dual native ISO at 800 and 3200. Prefer ISO 3200 (native gain stage) over ISO 1600 (non-native analog gain) at this light level."
- AND the final recommendation reflects ISO 3200 or another native stage rather than 1600
- AND in Learning Mode, the explanation reads: "ISO 3200 uses your camera's native gain stage — cleaner shadow detail than ISO 1600 on this sensor"

#### Scenario: AI selects lower native ISO when light is sufficient
- GIVEN camera has `dualNativeIsoValues = [800, 3200]`, scene is well-lit
- WHEN AI determines ISO 800 is sufficient to achieve the target exposure
- THEN AI selects ISO 800 (native) rather than ISO 400 (non-native, would require analog gain below native floor)
- AND explanation: "ISO 800 is the lower native gain stage on your camera — using it avoids unnecessary read noise"

#### Scenario: Dual-native ISO not applicable — standard ISO recommendation
- GIVEN camera has `dualNativeIso = false` (or `dualNativeIsoValues = null`)
- WHEN recommendation runs
- THEN no dual-native instruction is added to the prompt
- AND standard ISO recommendation logic applies unchanged

#### Scenario: Dual-native hint logged in recommendation metadata
- GIVEN `dualNativeIsoApplied = true` after prompt injection
- WHEN recommendation result is returned
- THEN `dualNativeIsoApplied = true` is present in the recommendation result metadata
- AND in Quick Mode, no visible change; in Learning Mode, the ISO explanation note includes the dual-native context

---

### Requirement: XMP Export with Shooting Context

Lens profile and shooting intent data are included in the Lightroom/Capture One XMP sidecar export using a versioned `cameratune:` namespace. Missing optional fields are omitted from the XMP output rather than written as empty or null elements. The Lightroom and Capture One panels surface shooting context when `cameratune:` fields are present.

**Priority**: SHOULD

#### Scenario: XMP includes full shooting context
- GIVEN user ends a session with: active lens profile (85mm f/1.4, 5 stops OIS), `outputMedium = 'print_a2_plus'`, `shadowPriority = 'protect'`, `flashAvailability = 'none'`
- WHEN user taps "Sync to Lightroom" or "Sync to Capture One"
- THEN XMP sidecar includes:
  - `cameratune:LensProfile = '{"focalLengthMm":85,"maxAperture":1.4,"lensType":"PRIME","stabilizationStops":5}'`
  - `cameratune:OutputMedium = "print_a2_plus"`
  - `cameratune:ShadowPriority = "protect"`
  - `cameratune:FlashMode = "none"`

#### Scenario: Post-processing panel shows shooting context
- GIVEN photo has CamTune XMP with `outputMedium = 'print_a2_plus'`, `shadowPriority = 'protect'`, and lens profile present
- WHEN user opens the photo in Lightroom with the CamTune panel active
- THEN the panel shows a "Shoot Context" section: "Shot for: A2+ Print | Shadow priority: Protect | Lens: 85mm f/1.4"
- AND develop preset suggestions (if applicable) account for the output medium

#### Scenario: XMP export graceful when fields missing
- GIVEN user exports without a lens profile or `outputMedium` set
- WHEN XMP is built via `IntegrationService.buildXMP()`
- THEN missing `cameratune:` fields are omitted entirely from the XMP output (no null values, no empty elements)
- AND existing CamTune XMP fields (e.g., `cameratune:ISO`, `cameratune:Aperture`) export normally as before
- AND the XMP is valid per the XMP specification despite the omissions

#### Scenario: XMP namespace declared correctly
- GIVEN any export that includes at least one `cameratune:` field
- WHEN XMP is serialized
- THEN the namespace declaration `xmlns:cameratune="https://cameratune.app/xmp/1.0/"` is present in the `x:xmpmeta` root element
- AND no Adobe or Capture One reserved namespace prefixes are reused

---

## MODIFIED Requirements

---

### Requirement: AI Settings Recommendation Engine (Modified)

The recommendation engine now incorporates `LensProfile` and `ShootingIntent` signals in addition to the existing 8 environmental signals. `buildSystemPrompt()` is extended to serialize new fields into the system prompt when present. The response is validated against a JSON Schema for compatible OpenAI models, with automatic fallback to the existing `extractFirstJSON` + `coerceSuggestion` pipeline for older model versions. All new parameters are optional; the recommendation engine degrades gracefully to existing behavior when any or all new parameters are absent.

**Priority**: MUST (existing)

#### Scenario: Expanded signal set in recommendation
- GIVEN user has active lens profile (85mm f/1.4, 5 stops OIS) + `outputMedium = 'print_a2_plus'` + `subjectMotionSpeed = 'walking'` + `flashAvailability = 'none'` + camera with `dualNativeIso = true`
- WHEN recommendation is generated
- THEN `buildSystemPrompt()` includes all of: `lensType`, `focalLengthMm`, `maxAperture`, `isStabilized`, `stabilizationStops`, `combinedStabilizationStops`, `subjectMotionSpeed`, `outputMedium`, `flashAvailability`, `dualNativeIsoValues`
- AND for compatible model IDs (`gpt-4o-2024-08-06+`), `response_format: { type: 'json_schema', json_schema: RecommendationResultSchema }` is used
- AND response is validated against the schema before `coerceSuggestion()` runs
- AND new `coerceSuggestion()` validators run: aperture clamp, IS cap, flash sync, diffraction guard, dual-native ISO

#### Scenario: Structured output model detection
- GIVEN BYOK user's model ID is `gpt-4o-2024-08-06`
- WHEN recommendation request is prepared
- THEN `isStructuredOutputSupported('gpt-4o-2024-08-06')` returns `true`
- AND `response_format: json_schema` is sent in the OpenAI API call
- AND JSON parsing bypasses `extractFirstJSON()` (response is already valid JSON)

#### Scenario: Fallback for older model
- GIVEN BYOK user's model ID is `gpt-3.5-turbo` or `gpt-4-0613`
- WHEN recommendation request is prepared
- THEN `isStructuredOutputSupported()` returns `false`
- AND request is sent without `response_format` parameter (standard completion)
- AND response is parsed via existing `extractFirstJSON()` + `coerceSuggestion()` pipeline
- AND no user-facing error or degraded-quality indicator is shown

#### Scenario: Backward compatible — no lens profile
- GIVEN user has no active lens profile and no `ShootingIntent` fields set
- WHEN recommendation runs
- THEN `buildSystemPrompt()` is called without lens or intent parameters
- AND the prompt is identical to the pre-feature prompt for the same environmental inputs
- AND the 50mm f/1.8 placeholder is used for IBIS calculation
- AND recommendation output is identical to pre-feature behavior

#### Scenario: Partial ShootingIntent — only some fields set
- GIVEN user has set `subjectMotionSpeed = 'running'` but not `outputMedium` or `flashAvailability`
- WHEN recommendation runs
- THEN only `subjectMotionSpeed` is injected into the prompt; missing intent fields use documented defaults (`outputMedium = 'web_1080'`, `flashAvailability = 'none'`)
- AND no error is thrown for missing optional fields

---

## REMOVED Requirements

*(None — all existing requirements are preserved or extended in this sprint.)*
