# Spec: CamTune — AI Camera Settings Advisor

> Direction: B — "Power Tool" (Dual-Mode UX)
> Date: 2026-03-18
> Status: Approved

---

## ADDED Requirements

### Requirement: OpenAI BYOK Authentication
User authenticates with their own OpenAI API key. App validates the key, fetches available Vision-capable models, and uses the user's key for all AI calls. Users can select and switch models freely, gaining immediate access to any new OpenAI model releases.

**Priority**: MUST

#### Scenario: Connect OpenAI account for the first time
- **GIVEN** user has not yet connected an OpenAI account
- **WHEN** user enters their OpenAI API key and clicks "Connect"
- **THEN** app validates key via `openai.models.list()` in ≤3 seconds; if valid → displays list of Vision-capable models (GPT-4o, GPT-4o mini, o1, etc.); user selects default model; key is stored encrypted in session

#### Scenario: Invalid or expired API key
- **GIVEN** user enters an incorrect or expired API key
- **WHEN** app attempts to validate the key
- **THEN** displays clear error "Invalid API key — please check your OpenAI dashboard" and does not save the key; user can retry

#### Scenario: Switch to a different model
- **GIVEN** user has a connected OpenAI account
- **WHEN** user goes to Settings → OpenAI → selects a different model from the dropdown
- **THEN** all subsequent AI calls use the new model; setting persists in user profile

#### Scenario: Model list updates automatically
- **GIVEN** OpenAI releases a new model (e.g., GPT-5)
- **WHEN** user opens the app or visits Settings
- **THEN** app calls `models.list()` again and shows the new model in the dropdown

---

### Requirement: Camera Profile Management
User searches for or manually enters their camera model. App loads the camera's technical DNA (sensor size, ISO range, noise floor, IBIS stops, dynamic range). All recommendations are calibrated to this specific camera. Multiple bodies are supported with a clear active-camera indicator.

**Priority**: MUST

#### Scenario: Search and set up camera profile for the first time
- **GIVEN** user has no camera profile
- **WHEN** user types a camera name (e.g., "Sony A7IV") into the search box
- **THEN** app shows matching results from the camera database in ≤1 second; user selects model → app loads Camera DNA (sensor size, base ISO, max usable ISO, IBIS stops, noise floor ISO, dynamic range EV); user confirms → profile is saved

#### Scenario: Camera not found in database
- **GIVEN** user searches for a camera model not in the database
- **WHEN** no search results appear
- **THEN** app allows manual entry: sensor size (dropdown: FF/APS-C/MFT), base ISO, max usable ISO, IBIS yes/no + stops; profile is saved with flag "user-entered — not verified"

#### Scenario: Manage multiple camera bodies
- **GIVEN** user already has at least one camera profile
- **WHEN** user adds a second camera
- **THEN** both profiles appear in the list; clear indicator shows which is "active"; user switches active camera in 1 tap

#### Scenario: Active camera always visible
- **GIVEN** user has multiple camera profiles
- **WHEN** user is on the main recommendation screen
- **THEN** the active camera name is always clearly shown in the header; every recommendation is labeled with that camera name

#### Scenario: Edit or delete a camera profile
- **GIVEN** user wants to correct IBIS stops or remove an old camera
- **WHEN** user goes to Camera Profiles → selects profile → Edit or Delete
- **THEN** Edit: user adjusts specs → saves; Delete: confirm dialog → profile removed; if this was the active profile, app requires selecting a new active profile before continuing

---

### Requirement: Multi-Signal Location Intelligence
App combines GPS coordinates, live weather data (Open-Meteo), and sun ephemeris (SunCalc) into a unified shooting context. All three signals feed into the AI recommendation engine. Data freshness is enforced with a 30-minute weather staleness threshold.

**Priority**: MUST

#### Scenario: Auto-detect location on app open
- **GIVEN** user opens the app and has granted location permission
- **WHEN** the recommendation screen loads
- **THEN** app fetches GPS coordinates → simultaneously fetches: (a) Open-Meteo weather data, (b) SunCalc sun position + golden/blue hour windows, (c) Nominatim reverse geocode → location name; all in ≤3 seconds; displays context bar: "Hồ Hoàn Kiếm, Hà Nội — Partly Cloudy 28°C — Sun 42° SW — Golden Hour in 1h 20m"

#### Scenario: Weather data is stale
- **GIVEN** weather data was fetched more than 30 minutes ago
- **WHEN** user requests an AI recommendation
- **THEN** app shows warning "Weather data may be outdated (fetched 35 min ago)" with "Refresh Now" button; recommendation can still be generated but is labeled "Estimated — conditions may have changed"

#### Scenario: No internet or GPS available
- **GIVEN** user is in an area with no connectivity
- **WHEN** app tries to fetch location/weather
- **THEN** displays "Location unavailable — using manual input"; user can enter conditions manually (indoor/outdoor, estimated light level, time of day); AI recommendation still works with manual data

#### Scenario: Manual location override
- **GIVEN** user wants to use a different location than current GPS (e.g., for planning)
- **WHEN** user taps the location bar → selects "Set Location Manually"
- **THEN** shows map picker; user pins location → app fetches weather + sun data for that location; context bar updates; "Manual Location" indicator appears

---

### Requirement: AI Settings Recommendation Engine
Core recommendation engine combining OpenAI Vision analysis of the live camera feed with GPS, weather, and camera DNA to produce top-3 settings combinations. Each recommendation includes confidence score, primary signal driver, and shutter speed safety check against IBIS data.

**Priority**: MUST

#### Scenario: Receive recommendation in ≤30 seconds
- **GIVEN** user has an active camera profile + location data loaded + OpenAI key connected
- **WHEN** user taps "Get Recommendation" or points phone camera at the scene
- **THEN** app captures one frame from camera feed → sends to OpenAI Vision API with structured prompt (scene type, EV estimate, subject motion, depth intent) + weather context + camera DNA → receives JSON response → computes top-3 settings combinations; full flow ≤30 seconds

#### Scenario: Top-3 settings with confidence scores
- **GIVEN** AI response is received successfully
- **WHEN** results are displayed
- **THEN** user sees 3 options, each with: ISO / Aperture / Shutter Speed / White Balance / Metering Mode; confidence score (e.g., 87%); primary signal driver (e.g., "Low ambient light is the main factor"); option 1 is highlighted as the top recommendation

#### Scenario: Learning Mode explanation
- **GIVEN** user is in Learning Mode
- **WHEN** recommendation is displayed
- **THEN** each setting has a plain-language explanation: "ISO 800 — Your A7IV handles ISO 800 cleanly with minimal noise. Going higher would add grain in shadows."; "f/2.8 — Wide aperture lets in more light for this indoor scene. Background will blur slightly."

#### Scenario: Quick Mode — results only
- **GIVEN** user is in Quick Mode
- **WHEN** recommendation is displayed
- **THEN** shows 3 settings combinations in compact layout, no explanations visible by default; confidence score still shown; user can tap any setting to view explanation on demand

#### Scenario: AI call fails
- **GIVEN** OpenAI API returns an error (rate limit, network error, model unavailable)
- **WHEN** recommendation request is sent
- **THEN** displays specific error: "Rate limit reached — your OpenAI key has hit its limit. Try again in a moment." or "Model unavailable — switch to GPT-4o mini in Settings"; does not crash; user can retry

#### Scenario: Minimum shutter speed enforcement (IBIS check)
- **GIVEN** camera profile has IBIS data (e.g., Sony A7IV: 5.5 stops)
- **WHEN** AI recommends a shutter speed below the reciprocal rule threshold
- **THEN** app flags the recommendation: "⚠️ Shutter speed 1/15s is below your safe handhold limit (~1/8s with IBIS). Consider a tripod or higher ISO."

---

### Requirement: Dual-Mode UX (Learning / Quick)
Two distinct UI modes toggle-able at any time. Learning Mode shows full explanations for every recommended setting. Quick Mode shows only the results in a compact layout for faster workflow. Mode persists across sessions.

**Priority**: MUST

#### Scenario: Toggle between Learning and Quick Mode
- **GIVEN** user is on the main recommendation screen
- **WHEN** user taps the "Learning / Quick" toggle in the header
- **THEN** UI switches in ≤1 second; mode persists in profile (does not reset on reload); Learning Mode: explanations visible by default; Quick Mode: compact layout, settings values + confidence only

#### Scenario: Learning Mode — expanded explanation
- **GIVEN** user is in Learning Mode
- **WHEN** user taps a specific setting (e.g., "ISO 800")
- **THEN** expand panel shows: reason for the setting, trade-offs (what happens if you go higher/lower), camera-specific context (e.g., "Your Fuji X-T5 has excellent noise performance up to ISO 6400")

#### Scenario: Quick Mode — on-demand explanation
- **GIVEN** user is in Quick Mode
- **WHEN** user taps any setting value
- **THEN** bottom sheet slides up with the same explanation content as Learning Mode; dismiss with swipe down or tap outside

#### Scenario: Mode indicator always visible
- **GIVEN** user is on any screen in the app
- **WHEN** user looks at the header/nav
- **THEN** current mode (Learning/Quick) is always clearly labeled; never ambiguous

#### Scenario: First-time user defaults to Learning Mode
- **GIVEN** new user has not set a mode preference
- **WHEN** user opens the recommendation screen for the first time
- **THEN** app defaults to Learning Mode; shows tooltip "You're in Learning Mode — explanations are shown. Switch to Quick Mode for a faster workflow."

---

### Requirement: Shoot Session Logging
App logs shoot sessions with GPS, weather, AI recommendation, and actual settings used. Users can rate sessions and add notes. Full history is viewable and exportable. All data is user-owned and deletable.

**Priority**: SHOULD

#### Scenario: Start a shoot session
- **GIVEN** user has received an AI recommendation and is ready to shoot
- **WHEN** user taps "Start Session"
- **THEN** app creates a session record with: GPS coordinates, timestamp, weather snapshot, active camera profile, AI recommendation (JSON), location name; session indicator appears in the header

#### Scenario: Log actual settings used vs AI recommendation
- **GIVEN** a session is active
- **WHEN** user ends the session via "End Session"
- **THEN** app asks "What settings did you actually use?" pre-filled with AI recommendation; user can confirm (used as suggested) or adjust; both AI recommendation and actual settings are stored for comparison

#### Scenario: Rating and notes
- **GIVEN** a session just ended
- **WHEN** end session dialog appears
- **THEN** user can rate the session 1-5 stars and add free-text notes (e.g., "Light changed quickly, had to bump ISO"); both optional; dialog auto-dismisses after 30 seconds saving without rating if user does not interact

#### Scenario: View shoot history
- **GIVEN** user has at least one completed session
- **WHEN** user opens the "History" tab
- **THEN** list of sessions in reverse chronological order; each shows: location name, date, camera used, settings used, rating; tapping a session shows full detail including weather conditions at shoot time

#### Scenario: Export shoot history
- **GIVEN** user wants to export their data
- **WHEN** user goes to History → "Export"
- **THEN** app generates CSV or JSON with all sessions: timestamp, GPS, weather, camera, settings, rating, notes; file downloads to the browser

#### Scenario: Delete all data
- **GIVEN** user wants to delete their account or all data
- **WHEN** user goes to Settings → "Delete All My Data"
- **THEN** confirm dialog with clear warning; after confirm → all sessions, settings cards, camera profiles are deleted permanently; cannot be undone

---

### Requirement: Community Settings Cards
Users can create and publish settings cards (photo + settings + verified GPS location) to a public community feed. Cards are searchable by location and camera model. Users can like, save, and apply community settings.

**Priority**: SHOULD

#### Scenario: Create and publish a settings card
- **GIVEN** user just ended a shoot session
- **WHEN** user taps "Share to Community"
- **THEN** app pre-fills card with: verified GPS location, camera model, settings used, weather conditions; user optionally adds photo thumbnail and caption; user selects public/private → publishes; card appears in community feed in ≤5 seconds

#### Scenario: GPS verification required to publish
- **GIVEN** user tries to share a settings card
- **WHEN** GPS coordinates are unavailable or unverifiable
- **THEN** app blocks publishing with "Location required to share settings cards — please enable GPS or set location manually"; cards for fictional/unverifiable locations are not allowed

#### Scenario: Search settings cards by location
- **GIVEN** user wants to see settings from other photographers at a specific location
- **WHEN** user searches "Hồ Hoàn Kiếm" or taps a location on the map
- **THEN** displays all public settings cards within 500m of that location; sorted by: Most Recent / Highest Rated / Best Match (similar camera model); each card shows: photo thumbnail, settings, camera model, shooting conditions, rating

#### Scenario: Filter by camera model
- **GIVEN** user is viewing the community feed or search results
- **WHEN** user applies "My Camera Model" filter or selects a specific model
- **THEN** only settings cards from the same camera model are shown

#### Scenario: Like and save a settings card
- **GIVEN** user is viewing a settings card
- **WHEN** user taps ♥ (like) or 🔖 (save)
- **THEN** like: increments like count, visible to all (optimistic update); save: adds card to user's private "Saved Settings" collection

#### Scenario: Apply community settings
- **GIVEN** user is viewing another photographer's settings card
- **WHEN** user taps "Apply These Settings"
- **THEN** settings are copied into the active session recommendation panel; labeled "From community — @username at [location]"; user can still edit before using

#### Scenario: Report inappropriate content
- **GIVEN** user sees a settings card with incorrect information or spam
- **WHEN** user taps "Report" on the card
- **THEN** report is submitted to the moderation queue; card is not immediately hidden (awaits review); user receives confirmation "Report submitted"

---

### Requirement: Pre-Shoot Planning Mode
Users can select a future location and datetime to receive predicted settings ranges based on weather forecast and sun position. Plans can be saved with push notification reminders.

**Priority**: SHOULD

#### Scenario: Plan a shoot for a future location and time
- **GIVEN** user wants to prepare for a shoot tomorrow
- **WHEN** user opens the "Plan" tab → selects location on map + selects date/time
- **THEN** app fetches: weather forecast for that time (Open-Meteo 7-day forecast), predicted sun position/altitude (SunCalc), golden/blue hour windows; displays shooting context summary: "Tomorrow 5:45 PM — Partly Cloudy, UV 3, Sun 8° WSW — Golden Hour starts 5:30 PM"

#### Scenario: Get predicted settings for planned shoot
- **GIVEN** user has selected location + datetime + shoot intent (portrait/landscape/street/event)
- **WHEN** user taps "Get Predicted Settings"
- **THEN** app calls AI with predicted context (no live camera feed — uses manual scene type) → returns settings range: "Portrait: f/1.8-2.8, ISO 400-800, 1/250-1/500s — based on predicted soft evening light"; labeled "Forecast — actual conditions may vary"

#### Scenario: Save a shooting plan
- **GIVEN** user is satisfied with predicted settings
- **WHEN** user taps "Save Plan"
- **THEN** plan is saved to "Upcoming Shoots" list with: location, datetime, predicted settings, weather summary

#### Scenario: Shoot reminder notification
- **GIVEN** user has a saved shooting plan
- **WHEN** 1 hour before the planned shoot time
- **THEN** browser push notification: "Your shoot at [location] starts in 1 hour — Current conditions: [weather update]"; tapping notification opens app with context pre-loaded

#### Scenario: Compare forecast vs actual on arrival
- **GIVEN** user has a saved plan and arrives at the location at the planned time
- **WHEN** user opens the app at that GPS location
- **THEN** app detects GPS match → shows side-by-side: "Forecasted: Partly Cloudy 28°C" vs "Actual: Overcast 26°C"; suggests updated settings if conditions changed significantly

---

### Requirement: Lightroom Integration
OAuth-based connection to Adobe Lightroom. After a shoot session, CamTune exports metadata (weather, AI recommendation, settings used) as XMP to the Lightroom catalog. A contextual panel in Lightroom shows shoot conditions while editing.

**Priority**: SHOULD

#### Scenario: Connect Lightroom via OAuth
- **GIVEN** user has not connected Lightroom
- **WHEN** user goes to Settings → Integrations → "Connect Lightroom"
- **THEN** app redirects to Adobe OAuth flow; after user authorizes → CamTune receives access token; token stored encrypted; Settings shows "Lightroom Connected — Last synced: never"

#### Scenario: Export shoot session metadata to Lightroom
- **GIVEN** user has connected Lightroom and just ended a shoot session
- **WHEN** user taps "Sync to Lightroom" or auto-sync triggers
- **THEN** app creates XMP sidecar with: GPS, timestamp, weather conditions, settings used, AI recommendation, confidence score, user rating; pushes to Lightroom catalog in ≤5 seconds; shows "Session synced to Lightroom"

#### Scenario: Contextual panel in Lightroom
- **GIVEN** user is editing a photo in Lightroom that has CamTune metadata
- **WHEN** user selects that photo in Library/Develop module
- **THEN** CamTune panel shows: location name, weather at shoot time, AI recommendation vs settings actually used, confidence score

#### Scenario: Token expiry — graceful degradation
- **GIVEN** Lightroom OAuth token has expired during an active shoot session
- **WHEN** app attempts to sync
- **THEN** does not block the shoot workflow; queues sync locally; shows non-intrusive banner "Lightroom token expired — sync queued"; after user re-authorizes → auto-flushes the queue

#### Scenario: Re-authorization prompt after 90 days
- **GIVEN** OAuth token needs refresh after 90 days
- **WHEN** user opens the app or starts a new session
- **THEN** app proactively prompts "Please re-authorize Lightroom connection to continue syncing" with "Re-authorize" button; if dismissed → sync disabled until re-authorized

---

### Requirement: Capture One Integration
JavaScript plugin for Capture One that syncs CamTune shoot session data into the Capture One catalog. Metadata (weather, AI recommendation, settings) is visible in the Capture One metadata panel while editing.

**Priority**: SHOULD

#### Scenario: Install CamTune plugin in Capture One
- **GIVEN** user uses Capture One and wants to connect CamTune
- **WHEN** user downloads CamTune plugin from the app → installs via Capture One Plugin Manager
- **THEN** plugin appears in Capture One Scripts/Plugins menu; user authorizes connection with CamTune account; confirmation "CamTune connected"

#### Scenario: Sync shoot session data into Capture One catalog
- **GIVEN** user has connected Capture One and just ended a CamTune session
- **WHEN** user taps "Sync to Capture One" or auto-sync triggers
- **THEN** plugin writes metadata to Capture One catalog: GPS, weather, timestamp, AI recommendation, settings used, rating; metadata visible in the Capture One metadata panel; sync ≤5 seconds

#### Scenario: View CamTune context in Capture One
- **GIVEN** user is editing a photo in Capture One that has CamTune metadata
- **WHEN** user selects that photo in the browser
- **THEN** CamTune plugin panel shows: shoot conditions, AI recommendation at time of shoot, actual settings, location name

#### Scenario: Plugin not installed or Capture One unavailable
- **GIVEN** user has not installed the plugin or does not use Capture One
- **WHEN** user goes to Settings → Integrations → Capture One
- **THEN** displays step-by-step plugin installation guide; if user selects "Skip" → Capture One integration is disabled; no other features are affected

---

## MODIFIED Requirements

*(None — greenfield product)*

---

## REMOVED Requirements

*(None — greenfield product)*
