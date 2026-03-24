'use client'

/**
 * ShotDetailsPanel — Expandable section for shoot intent inputs.
 *
 * Quick Mode:    collapsed by default, tap chevron to expand
 * Learning Mode: expanded by default with guiding labels
 *
 * Provides slots for:
 *  - SubjectMotionSelector
 *  - OutputMediumDropdown
 *  - FlashAvailabilitySelector
 *  - ZoomPositionInput
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

export type UiMode = 'quick' | 'learning'

export interface ShotDetailsPanelProps {
  mode: UiMode
  children: React.ReactNode
  className?: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ShotDetailsPanel({ mode, children, className }: ShotDetailsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(mode === 'learning')

  return (
    <div className={cn('rounded-lg border border-zinc-800 bg-zinc-900/50', className)}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-medium text-zinc-200">
            Shot Details
          </span>
          {mode === 'learning' && (
            <span className="text-xs text-zinc-500">
              What&apos;s your subject doing?
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        )}
      </button>

      {/* Content — expandable */}
      {isExpanded && (
        <div className="space-y-4 border-t border-zinc-800 px-4 py-4">
          {children}
        </div>
      )}
    </div>
  )
}
