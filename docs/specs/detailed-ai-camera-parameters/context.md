# Design Context

> Spec: docs/specs/detailed-ai-camera-parameters/spec.md
> Generated: 2026-03-24

## Product
- **Type:** Web-native AI camera settings advisor (SaaS, BYOK) — Web app + Mobile app
- **Target users:** Semi-pro to pro photographers managing 2–4 lenses, familiar with Lightroom/Capture One
- **Core value:** AI-powered camera settings that respect your actual gear constraints

## Brand
- **Personality:** Precise, Trustworthy, Technical
- **Emotional goal:** Users should feel confident — like consulting an experienced photographer mentor
- **Aesthetic direction:** Dark-mode-first photography tool. High contrast, clear typographic hierarchy, no gradient/glassmorphism. More like an f-stop meter than a SaaS dashboard
- **Anti-references:** No gradient text, no glassmorphism, no hero metric dashboard, no generic card grids, no pure gray neutrals

## Guiding Principles
- Content first, chrome second — settings data is the hero, not UI decoration
- Progressive disclosure — beginners see simple controls, pros unlock full context
- Gear-aware honesty — never suggest settings your lens can't achieve
- Motion should feel physical, not digital — ease-out for entering, ease-in for leaving

## Design Tokens (Existing)
- Tailwind v4 + shadcn/ui + OKLCH colors (currently pure gray neutrals chroma=0 → will add tinted blue hue)
- Radix UI primitives + lucide-react icons
- Existing components: Button, Badge, Sheet

## Accessibility
- Target: WCAG AA
- Dark mode primary, light mode secondary

## Tech Stack
- Next.js 16, React 19, Tailwind CSS v4, Zustand, Prisma 7, Supabase PostgreSQL
