'use client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlashAvailabilitySelectorProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FLASH_AVAILABILITY_OPTIONS = [
  'No Flash',
  'Speedlight',
  'HSS-capable Flash',
  'Studio Strobe',
] as const

// ─── Component ────────────────────────────────────────────────────────────────

export function FlashAvailabilitySelector({
  value,
  onChange,
  className,
}: FlashAvailabilitySelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        'rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100',
        'focus:outline-none focus:ring-2 focus:ring-zinc-500',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {FLASH_AVAILABILITY_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
