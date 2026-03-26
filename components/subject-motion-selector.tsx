'use client'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECT_MOTION_OPTIONS = [
  'Stationary',
  'Walking',
  'Running',
  'Vehicle',
  'Sports',
] as const

type SubjectMotionOption = (typeof SUBJECT_MOTION_OPTIONS)[number]

// ─── Inference helper ─────────────────────────────────────────────────────────

export function inferSubjectMotion(shootType?: string): string {
  if (shootType === 'street' || shootType === 'event') return 'Walking'
  return 'Stationary'
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubjectMotionSelectorProps {
  value: string
  onChange: (value: string) => void
  shootType?: string
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubjectMotionSelector({
  value,
  onChange,
  className,
}: SubjectMotionSelectorProps) {
  return (
    <div
      role="group"
      className={[
        'inline-flex rounded-md border border-zinc-700 bg-zinc-900 p-0.5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {SUBJECT_MOTION_OPTIONS.map((option) => {
        const isSelected = value === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option}
            onClick={() => onChange(option)}
            className={[
              'rounded px-3 py-1 text-sm font-medium transition-colors',
              isSelected
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-100',
            ].join(' ')}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
