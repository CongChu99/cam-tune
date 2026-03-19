'use client'

/**
 * RecommendationCard — Displays one camera settings suggestion.
 *
 * Learning Mode: explanation panel visible by default per setting.
 * Quick Mode:    compact layout; tap any setting row → bottom sheet with explanation.
 *
 * First suggestion (index 0) is highlighted as "Recommended".
 * IBIS warning is shown when shutterSpeedWarning is passed.
 */

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  InlineExplanationPanel,
  ExplanationSheet,
  type SuggestionExplanation,
} from '@/components/explanation-panel'
import { useUIMode } from '@/store/ui-mode'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Suggestion {
  iso: number
  aperture: number
  shutter: string
  whiteBalance: string
  meteringMode: string
  confidence: number
  primaryDriver: string
  explanation?: SuggestionExplanation
}

type SettingKey = keyof SuggestionExplanation

interface RecommendationCardProps {
  suggestion: Suggestion
  /** 0-based index; first card (0) is marked "Recommended" */
  index: number
  /** Warn about shutter speed / IBIS issue */
  shutterSpeedWarning?: string | null
  /** Camera model name for explanation sheet header */
  cameraName?: string
  className?: string
}

// ─── Setting row ─────────────────────────────────────────────────────────────

interface SettingRowProps {
  label: string
  value: string
  onClick?: () => void
  clickable?: boolean
}

function SettingRow({ label, value, onClick, clickable }: SettingRowProps) {
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        'flex items-center justify-between gap-2 py-1.5',
        clickable &&
          'cursor-pointer rounded-md px-1 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800'
      )}
      aria-label={clickable ? `${label}: ${value} — tap for explanation` : undefined}
    >
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

export function RecommendationCard({
  suggestion,
  index,
  shutterSpeedWarning,
  cameraName,
  className,
}: RecommendationCardProps) {
  const { mode } = useUIMode()
  const isRecommended = index === 0
  const isQuick = mode === 'quick'

  // Quick mode: track which setting key is open in the bottom sheet
  const [sheetKey, setSheetKey] = useState<SettingKey | null>(null)

  function openSheet(key: SettingKey) {
    if (!suggestion.explanation) return
    setSheetKey(key)
  }

  const confidenceColor =
    suggestion.confidence >= 80
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
      : suggestion.confidence >= 60
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'

  return (
    <>
      <div
        className={cn(
          'relative rounded-xl border bg-white p-4 shadow-sm dark:bg-zinc-900',
          isRecommended
            ? 'border-blue-400 bg-blue-50/30 ring-1 ring-blue-400/40 dark:border-blue-600 dark:bg-blue-950/20 dark:ring-blue-600/30'
            : 'border-zinc-200 dark:border-zinc-700',
          className
        )}
      >
        {/* ── Header row ── */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            {isRecommended && (
              <span className="mb-1 inline-flex w-fit items-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                Recommended
              </span>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {suggestion.primaryDriver}
            </p>
          </div>

          {/* Confidence badge */}
          <Badge
            className={cn(
              'shrink-0 rounded-full border-0 px-2 py-0.5 text-xs font-semibold',
              confidenceColor
            )}
          >
            {suggestion.confidence}% confident
          </Badge>
        </div>

        {/* ── Settings grid ── */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <SettingRow
            label="ISO"
            value={`${suggestion.iso}`}
            clickable={isQuick && !!suggestion.explanation}
            onClick={() => openSheet('iso')}
          />
          <SettingRow
            label="Aperture"
            value={`f/${suggestion.aperture.toFixed(1)}`}
            clickable={isQuick && !!suggestion.explanation}
            onClick={() => openSheet('aperture')}
          />
          <SettingRow
            label="Shutter"
            value={`${suggestion.shutter}s`}
            clickable={isQuick && !!suggestion.explanation}
            onClick={() => openSheet('shutter')}
          />
          <SettingRow
            label="White Balance"
            value={suggestion.whiteBalance}
            clickable={isQuick && !!suggestion.explanation}
            onClick={() => openSheet('whiteBalance')}
          />
          <SettingRow
            label="Metering"
            value={suggestion.meteringMode}
            clickable={isQuick && !!suggestion.explanation}
            onClick={() => openSheet('meteringMode')}
          />
        </div>

        {/* ── IBIS / shutter warning ── */}
        {shutterSpeedWarning && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{shutterSpeedWarning}</span>
          </div>
        )}

        {/* ── Inline explanations (Learning Mode only) ── */}
        {!isQuick && suggestion.explanation && (
          <InlineExplanationPanel
            explanation={suggestion.explanation}
            className="mt-3"
          />
        )}

        {/* Quick Mode hint: tap to see explanation */}
        {isQuick && suggestion.explanation && (
          <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Tap any setting for explanation
          </p>
        )}
      </div>

      {/* ── Quick Mode bottom sheet ── */}
      {isQuick && (
        <ExplanationSheet
          open={sheetKey !== null}
          onOpenChange={(open) => {
            if (!open) setSheetKey(null)
          }}
          settingKey={sheetKey}
          explanation={suggestion.explanation ?? null}
          cameraName={cameraName}
        />
      )}
    </>
  )
}
