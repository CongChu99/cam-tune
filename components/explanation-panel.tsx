'use client'

/**
 * ExplanationPanel — Shows per-setting explanations.
 *
 * Usage:
 *  - Learning Mode: rendered inline inside RecommendationCard (expanded by default)
 *  - Quick Mode:    rendered as a shadcn Sheet (bottom drawer), triggered by tapping a setting
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SuggestionExplanation {
  iso: string
  aperture: string
  shutter: string
  whiteBalance: string
  meteringMode: string
}

type SettingKey = keyof SuggestionExplanation

const SETTING_LABELS: Record<SettingKey, string> = {
  iso: 'ISO',
  aperture: 'Aperture',
  shutter: 'Shutter Speed',
  whiteBalance: 'White Balance',
  meteringMode: 'Metering Mode',
}

// ─── Inline panel (Learning Mode) ─────────────────────────────────────────────

interface InlineExplanationPanelProps {
  explanation: SuggestionExplanation
  /** Which setting to highlight (optional) */
  highlightKey?: SettingKey
  className?: string
}

export function InlineExplanationPanel({
  explanation,
  highlightKey,
  className,
}: InlineExplanationPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className={cn(
        'rounded-lg border border-blue-100 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20',
        className
      )}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400"
        aria-expanded={!collapsed}
      >
        <span>Why these settings?</span>
        {collapsed ? (
          <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronUp className="size-3.5 shrink-0" aria-hidden="true" />
        )}
      </button>

      {!collapsed && (
        <dl className="divide-y divide-blue-100 dark:divide-blue-900/40">
          {(Object.keys(SETTING_LABELS) as SettingKey[]).map((key) => {
            const text = explanation[key]
            if (!text) return null
            return (
              <div
                key={key}
                className={cn(
                  'grid grid-cols-[6rem_1fr] gap-2 px-3 py-2 text-xs',
                  highlightKey === key &&
                    'bg-blue-100/70 dark:bg-blue-900/30'
                )}
              >
                <dt className="font-medium text-zinc-700 dark:text-zinc-300">
                  {SETTING_LABELS[key]}
                </dt>
                <dd className="text-zinc-600 dark:text-zinc-400">{text}</dd>
              </div>
            )
          })}
        </dl>
      )}
    </div>
  )
}

// ─── Bottom-sheet panel (Quick Mode) ──────────────────────────────────────────

interface ExplanationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settingKey: SettingKey | null
  explanation: SuggestionExplanation | null
  /** Camera model name for context header */
  cameraName?: string
}

export function ExplanationSheet({
  open,
  onOpenChange,
  settingKey,
  explanation,
  cameraName,
}: ExplanationSheetProps) {
  const label = settingKey ? SETTING_LABELS[settingKey] : null
  const text = settingKey && explanation ? explanation[settingKey] : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-base">
            {label ?? 'Setting Explanation'}
          </SheetTitle>
          {cameraName && (
            <SheetDescription className="text-xs text-muted-foreground">
              Camera-specific guidance for {cameraName}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="px-4 pb-6 pt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {text ?? 'No explanation available for this setting.'}
        </div>
      </SheetContent>
    </Sheet>
  )
}
