'use client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutputMediumDropdownProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTPUT_MEDIUM_OPTIONS = [
  'Web (1080p)',
  'Web (4K)',
  'Print A4',
  'Print A2+',
  'Commercial',
] as const

// ─── Component ────────────────────────────────────────────────────────────────

export function OutputMediumDropdown({
  value,
  onChange,
  className,
}: OutputMediumDropdownProps) {
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
      {OUTPUT_MEDIUM_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
