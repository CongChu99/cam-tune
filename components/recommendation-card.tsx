'use client'

/**
 * RecommendationCard — Displays one camera settings suggestion.
 *
 * Learning Mode: explanation panel visible by default per setting.
 * Quick Mode:    compact layout; tap any setting row → bottom sheet with explanation.
 *
 * First suggestion (index 0) is highlighted as "Recommended".
 *
 * Inline warnings/notes supported:
 *   shutterSpeedWarning        — IBIS / hand-hold limit amber box
 *   diffractionWarning         — aperture diffraction amber box
 *   apertureClampNote          — amber text below aperture row
 *   flashSyncWarning           — amber text below shutter row
 *   ibisEstimatedFocalLengthPrompt — soft informational note (always visible)
 *   stabilizationCapNote       — soft note (Learning Mode only)
 *   dualNativeIsoHint          — soft note (Learning Mode only)
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
  /** Aperture was clamped to lens maximum — show amber note below aperture row */
  apertureClampNote?: string | null
  /** Shutter speed exceeds flash sync — show inline warning near shutter row */
  flashSyncWarning?: string | null
  /** Aperture may cause diffraction at chosen output size */
  diffractionWarning?: string | null
  /** IBIS focal length was estimated — soft informational prompt */
  ibisEstimatedFocalLengthPrompt?: string | null
  /** Combined IS cap reached — Learning Mode only */
  stabilizationCapNote?: string | null
  /** Dual-native ISO in use — Learning Mode only */
  dualNativeIsoHint?: string | null
}

// ─── Shared inline helpers ────────────────────────────────────────────────────

/** Amber warning box with triangle icon — used for shutterSpeedWarning and diffractionWarning. */
function AmberWarningBox({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

/** Small amber text note rendered inline inside the settings grid. */
function InlineAmberNote({ message }: { message: string }) {
  return (
    <p className="px-1 pb-1 text-xs text-amber-600 dark:text-amber-400">{message}</p>
  )
}

/** Muted informational note — no warning role. */
function SoftNote({ message }: { message: string }) {
  return (
    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{message}</p>
  )
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
  apertureClampNote,
  flashSyncWarning,
  diffractionWarning,
  ibisEstimatedFocalLengthPrompt,
  stabilizationCapNote,
  dualNativeIsoHint,
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
          {apertureClampNote && <InlineAmberNote message={apertureClampNote} />}
          <SettingRow
            label="Shutter"
            value={`${suggestion.shutter}s`}
            clickable={isQuick && !!suggestion.explanation}
            onClick={() => openSheet('shutter')}
          />
          {flashSyncWarning && <InlineAmberNote message={flashSyncWarning} />}
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

        {/* ── Card-level amber warning boxes ── */}
        {shutterSpeedWarning && <AmberWarningBox message={shutterSpeedWarning} />}
        {diffractionWarning && <AmberWarningBox message={diffractionWarning} />}

        {/* ── Soft informational notes ── */}
        {ibisEstimatedFocalLengthPrompt && <SoftNote message={ibisEstimatedFocalLengthPrompt} />}
        {!isQuick && stabilizationCapNote && <SoftNote message={stabilizationCapNote} />}
        {!isQuick && dualNativeIsoHint && <SoftNote message={dualNativeIsoHint} />}

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
