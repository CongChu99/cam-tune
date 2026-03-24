# Screen Map: Detailed AI Camera Parameters

## Recommendation Flow (4 screens)

### Web: Recommendation Dashboard — rec-dashboard-web
- **Components:** NavBar, LensIndicator, ConfidenceMeter, RecommendationCard×3, ShotDetailsPanel, WarningInline, Badge, Button(primary), Button(ghost)
- **Spec refs:** spec.md#AI-Settings-Recommendation-Engine, spec.md#Active-lens-indicator, spec.md#No-active-lens-warning
- **Notes:** 1440×900. Hero screen (web). Left: recommendation cards with ISO/aperture/shutter/WB. Right sidebar: shot details (motion speed, output medium, flash). Top: camera+lens indicator bar. Warnings shown inline per field. Learning Mode shows explanation panel below cards.

### Mobile: Recommendation Screen — rec-screen-mobile
- **Components:** TabBar, LensIndicator, ConfidenceMeter, RecommendationCard, WarningInline, Badge, Button(primary)
- **Spec refs:** spec.md#AI-Settings-Recommendation-Engine, spec.md#Active-lens-indicator
- **Notes:** 390×844. Hero screen (mobile). Single card scrollable view. Shot Details accessible via expandable section. Tab bar at bottom: Recommend / Cameras / Sessions / Community / Settings.

### Web: Shot Details Panel — shot-details-web
- **Components:** Select(SubjectMotion), Select(OutputMedium), Select(FlashAvailability), Toggle(StabilizationMode), Slider(ZoomPosition), Badge, Button(ghost)
- **Spec refs:** spec.md#Granular-Subject-Motion, spec.md#Output-Medium, spec.md#Flash-Availability
- **Notes:** Embedded sidebar panel in recommendation dashboard. Shows diffraction warning inline when triggered.

### Mobile: Shot Details Sheet — shot-details-mobile
- **Components:** Sheet, Select(SubjectMotion), Select(OutputMedium), Select(FlashAvailability), Toggle, Slider, Button(primary)
- **Spec refs:** spec.md#Granular-Subject-Motion, spec.md#Output-Medium, spec.md#Flash-Availability
- **Notes:** Bottom sheet overlay. Slides up from recommendation screen.

## Lens Management Flow (4 screens)

### Web: Lens Picker Modal — lens-picker-web
- **Components:** Modal, Input(search), LensResultCard×N, Button(primary), Button(secondary), Badge
- **Spec refs:** spec.md#Lens-Profile-Management, spec.md#Search-and-add-lens
- **Notes:** Modal overlay on recommendation dashboard. Search → results list → select → confirm.

### Mobile: Lens Picker Sheet — lens-picker-mobile
- **Components:** Sheet, Input(search), LensResultCard×N, Button(primary), Badge
- **Spec refs:** spec.md#Lens-Profile-Management
- **Notes:** Full-height bottom sheet. Same flow as web but optimized for thumb reach.

### Web: EXIF Detect Confirmation — exif-detect-web
- **Components:** Modal, LensResultCard, Input(editable fields), Button(primary: Confirm), Button(ghost: Search Instead), Badge
- **Spec refs:** spec.md#Auto-detect-lens-from-EXIF, spec.md#EXIF-lens-unrecognized
- **Notes:** Shown after photo upload. "Detected: Canon EF 85mm f/1.4L IS USM — is this correct?"

### Mobile: EXIF Detect Confirmation — exif-detect-mobile
- **Components:** Sheet, LensResultCard, Input(editable), Button(primary), Button(ghost)
- **Spec refs:** spec.md#Auto-detect-lens-from-EXIF
- **Notes:** Bottom sheet variant of EXIF confirmation.

### Web: Manual Lens Entry — manual-lens-web
- **Components:** Modal, Input(focalLength), Input(aperture), Toggle(IS), Input(IS stops), Select(lensType), Button(primary: Save)
- **Spec refs:** spec.md#Manual-lens-entry-fallback
- **Notes:** Fallback form when lens not found in database.

### Mobile: Manual Lens Entry — manual-lens-mobile
- **Components:** Sheet, Input(focalLength), Input(aperture), Toggle(IS), Input(IS stops), Select(lensType), Button(primary)
- **Spec refs:** spec.md#Manual-lens-entry-fallback
- **Notes:** Full-height sheet for manual entry.
