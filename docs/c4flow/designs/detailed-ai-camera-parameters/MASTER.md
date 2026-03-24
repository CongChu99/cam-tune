# MASTER.md — CamTune Design System

## Color Tokens (OKLCH-compatible, blue-tinted neutrals)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | `#3B82F6` | `#60A5FA` | CTAs, active states, links |
| `--primary-fg` | `#FFFFFF` | `#0C1929` | Text on primary |
| `--bg` | `#F8F9FC` | `#0C1218` | Page background |
| `--fg` | `#1A2332` | `#E8ECF2` | Primary text |
| `--card` | `#FFFFFF` | `#141C26` | Card/surface backgrounds |
| `--muted` | `#6B7B8D` | `#7B8FA3` | Secondary text |
| `--border` | `#E2E6ED` | `#1E2A38` | Borders, dividers |
| `--input` | `#F1F3F7` | `#1A2433` | Input backgrounds |
| `--destructive` | `#E5484D` | — | Errors, delete |
| `--success` | `#30A46C` | — | Confirmations |
| `--warning` | `#F5A623` | — | Warnings |

## Typography

| Role | Family | Size/Weight | Spacing |
|------|--------|-------------|---------|
| H1 | DM Sans | 36px / 700 | -0.5 |
| H2 | DM Sans | 28px / 600 | -0.3 |
| H3 | DM Sans | 22px / 600 | 0 |
| Body | Plus Jakarta Sans | 16px / 400 | 0 |
| Small | Plus Jakarta Sans | 14px / 400 | 0 |
| Caption | DM Sans | 12px / 500 | 1 |

## Spacing Scale (4pt base)

`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`

## Components (16 reusable)

- **Button/** Primary, Secondary, Ghost, Destructive
- **Input** — Label + field + placeholder
- **Select** — Label + dropdown with chevron
- **Badge/** Default, Warning, Success
- **Warning/Inline** — Icon + message
- **Lens/Indicator** — Aperture icon + lens name + Active badge
- **Recommendation/Card** — ISO, Aperture, Shutter, WB with confidence %

## Screens Designed

| Screen | Platform | Size |
|--------|----------|------|
| Recommendation Dashboard | Web | 1440×900 |
| Recommendation Screen | Mobile | 390×844 |
| Lens Picker Modal | Web | 520×auto |
| Lens Picker Sheet | Mobile | 390×844 |
| Shot Details Sheet | Mobile | 390×844 |
| Design System | — | 1200×auto |
