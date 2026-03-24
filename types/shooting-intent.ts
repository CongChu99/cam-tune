/**
 * Shooting intent types for the recommendation engine.
 */

export type SubjectMotionSpeed =
  | 'stationary'
  | 'walking'
  | 'running'
  | 'vehicle'
  | 'sports'

export type OutputMedium =
  | 'web_1080p'
  | 'social_media'
  | 'print_standard'
  | 'print_a2_plus'
  | 'commercial'

export type FlashAvailability =
  | 'none'
  | 'speedlight'
  | 'studio_strobe'
  | 'hss_capable'

export interface ShootingIntent {
  subjectMotionSpeed?: SubjectMotionSpeed
  outputMedium?: OutputMedium
  flashAvailability?: FlashAvailability
}

/**
 * Motion floor shutter speeds — minimum shutter to freeze subject motion.
 * Values are in 1/x seconds.
 */
export const MOTION_FLOOR_MAP: Record<SubjectMotionSpeed, number> = {
  stationary: 0, // Use reciprocal rule (1/focal_length)
  walking: 250,
  running: 500,
  vehicle: 1000,
  sports: 2000,
}

/**
 * Infer subject motion from shoot intent when not explicitly set.
 */
export function inferSubjectMotion(
  shootIntent?: string
): SubjectMotionSpeed {
  switch (shootIntent) {
    case 'portrait':
    case 'landscape':
    case 'astro':
    case 'macro':
      return 'stationary'
    case 'street':
    case 'event':
      return 'walking'
    default:
      return 'stationary'
  }
}
