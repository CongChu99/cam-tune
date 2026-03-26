import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LightroomShootContextPanelProps {
  outputMedium?: string | null
  shadowPriority?: string | null
  focalLengthMm?: number | null
  maxAperture?: number | null
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LightroomShootContextPanel({
  outputMedium,
  shadowPriority,
  focalLengthMm,
  maxAperture,
  className,
}: LightroomShootContextPanelProps) {
  const hasLens = focalLengthMm != null || maxAperture != null
  const hasAny = outputMedium != null || shadowPriority != null || hasLens

  if (!hasAny) return null

  // Build the lens string from whichever parts are present
  let lensText: string | null = null
  if (hasLens) {
    const parts: string[] = []
    if (focalLengthMm != null) parts.push(`${focalLengthMm}mm`)
    if (maxAperture != null) parts.push(`f/${maxAperture}`)
    lensText = parts.join(' ')
  }

  return (
    <section
      className={cn(
        'rounded-lg border border-zinc-200 bg-zinc-50/60 dark:border-zinc-700/50 dark:bg-zinc-800/30',
        className
      )}
    >
      <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Shoot Context
      </h3>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-700/40">
        {outputMedium != null && (
          <li className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200">
            {`Shot for: ${outputMedium}`}
          </li>
        )}
        {shadowPriority != null && (
          <li className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200">
            {`Shadow priority: ${shadowPriority}`}
          </li>
        )}
        {lensText != null && (
          <li className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200">
            {`Lens: ${lensText}`}
          </li>
        )}
      </ul>
    </section>
  )
}
