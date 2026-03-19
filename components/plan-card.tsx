'use client'

/**
 * PlanCard — Displays a single shoot plan summary.
 *
 * Shows title, location, planned date/time, scene type, and predicted settings.
 * Provides delete action and "Mark complete" action.
 * Shows proximity alert when user is near the planned location.
 */

import { useState } from 'react'
import { MapPin, Clock, Trash2, CheckCircle, Bell, BellOff, ClipboardEdit, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShootPlan {
  id: string
  title: string
  description?: string | null
  plannedAt: string
  latitude: number
  longitude: number
  locationName?: string | null
  sceneType: string
  predictedIso?: number | null
  predictedAperture?: number | null
  predictedShutter?: string | null
  predictedWB?: string | null
  predictedMetering?: string | null
  forecastSnapshot?: string | null
  notificationSent: boolean
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

interface ActualSettings {
  iso?: string
  aperture?: string
  shutter?: string
  wb?: string
}

interface PlanCardProps {
  plan: ShootPlan
  /** Whether user is currently near this plan's location (within 500m) */
  isNearby?: boolean
  onDelete?: (id: string) => void
  onMarkComplete?: (id: string, actualSettings?: ActualSettings) => void
  className?: string
}

// ─── Forecast snapshot parser ─────────────────────────────────────────────────

interface ForecastEntry {
  forecast?: Record<string, unknown>
  actual?: Record<string, unknown>
}

function parseForecastSnapshot(raw: string | null | undefined): ForecastEntry {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    // If it has a `forecast` key, it's the new format { forecast: {...}, actual: {...} }
    if (parsed && typeof parsed === 'object' && 'forecast' in parsed) {
      return parsed as ForecastEntry
    }
    // Otherwise it's the old format (raw weather object) — treat as forecast
    return { forecast: parsed }
  } catch {
    return {}
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPlannedAt(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isUpcoming(iso: string): boolean {
  return new Date(iso) > new Date()
}

function isWithinHour(iso: string): boolean {
  const diff = new Date(iso).getTime() - Date.now()
  return diff > 0 && diff <= 60 * 60 * 1000
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────

export function PlanCard({ plan, isNearby, onDelete, onMarkComplete, className }: PlanCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showActualForm, setShowActualForm] = useState(false)
  const [actualSettings, setActualSettings] = useState<ActualSettings>({})
  const [savingActual, setSavingActual] = useState(false)

  const upcoming = isUpcoming(plan.plannedAt)
  const approachingSoon = isWithinHour(plan.plannedAt)
  const isCompleted = !!plan.completedAt

  const forecastData = parseForecastSnapshot(plan.forecastSnapshot)

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete(plan.id)
    } finally {
      setDeleting(false)
    }
  }

  async function handleMarkComplete() {
    if (!onMarkComplete) return
    setCompleting(true)
    try {
      await onMarkComplete(plan.id)
    } finally {
      setCompleting(false)
    }
  }

  async function handleSaveActualSettings() {
    if (!onMarkComplete) return
    setSavingActual(true)
    try {
      await onMarkComplete(plan.id, actualSettings)
      setShowActualForm(false)
    } finally {
      setSavingActual(false)
    }
  }

  const hasPredictions =
    plan.predictedIso || plan.predictedAperture || plan.predictedShutter ||
    plan.predictedWB || plan.predictedMetering

  return (
    <div
      className={cn(
        'relative rounded-xl border bg-white p-4 shadow-sm dark:bg-zinc-900',
        isCompleted
          ? 'border-zinc-200 opacity-60 dark:border-zinc-700'
          : approachingSoon
            ? 'border-amber-400 ring-1 ring-amber-400/40 dark:border-amber-500 dark:ring-amber-500/30'
            : 'border-zinc-200 dark:border-zinc-700',
        className
      )}
    >
      {/* ── Proximity alert + forecast vs actual comparison ── */}
      {isNearby && !isCompleted && (
        <div className="mb-3 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="font-medium">You&apos;re near your planned location!</span>
          </div>

          {/* Forecast vs actual comparison section */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-900/10">
            <p className="mb-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
              Compare Forecast vs Current Conditions
            </p>

            {/* Forecast weather snapshot */}
            {forecastData.forecast && (
              <div className="mb-2 rounded-md border border-blue-100 bg-white/70 p-2 dark:border-blue-900/30 dark:bg-zinc-800/50">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                  Predicted at plan time
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {forecastData.forecast.cloudCoverPct !== undefined && (
                    <span>Cloud cover: {String(forecastData.forecast.cloudCoverPct)}%</span>
                  )}
                  {forecastData.forecast.temperature !== undefined && (
                    <span>Temp: {String(forecastData.forecast.temperature)}°C</span>
                  )}
                  {forecastData.forecast.uvIndex !== undefined && (
                    <span>UV: {String(forecastData.forecast.uvIndex)}</span>
                  )}
                  {forecastData.forecast.visibilityKm !== undefined && (
                    <span>Visibility: {String(forecastData.forecast.visibilityKm)}km</span>
                  )}
                  {forecastData.forecast.humidity !== undefined && (
                    <span>Humidity: {String(forecastData.forecast.humidity)}%</span>
                  )}
                </div>
              </div>
            )}

            {/* Actual settings already recorded */}
            {forecastData.actual && (() => {
              const a = forecastData.actual as Record<string, string | number | undefined>
              return (
                <div className="mb-2 rounded-md border border-emerald-100 bg-white/70 p-2 dark:border-emerald-900/30 dark:bg-zinc-800/50">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    Actual settings used
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                    {a.iso && <span>ISO: {String(a.iso)}</span>}
                    {a.aperture && <span>Aperture: f/{String(a.aperture)}</span>}
                    {a.shutter && <span>Shutter: {String(a.shutter)}s</span>}
                    {a.wb && <span>WB: {String(a.wb)}</span>}
                  </div>
                </div>
              )
            })()}

            {/* Record actual settings button / form */}
            {!showActualForm ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowActualForm(true)}
                className="w-full gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                <ClipboardEdit className="size-3.5" aria-hidden="true" />
                Record Actual Settings
              </Button>
            ) : (
              <div className="rounded-md border border-blue-200 bg-white p-2 dark:border-blue-800 dark:bg-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Enter settings you used
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowActualForm(false)}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    aria-label="Close form"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'ISO', field: 'iso' as keyof ActualSettings, placeholder: 'e.g. 400' },
                    { label: 'Aperture', field: 'aperture' as keyof ActualSettings, placeholder: 'e.g. 5.6' },
                    { label: 'Shutter', field: 'shutter' as keyof ActualSettings, placeholder: 'e.g. 1/500' },
                    { label: 'White Balance', field: 'wb' as keyof ActualSettings, placeholder: 'e.g. Daylight' },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field} className="space-y-0.5">
                      <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
                      <input
                        type="text"
                        value={actualSettings[field] ?? ''}
                        onChange={(e) => setActualSettings((prev) => ({ ...prev, [field]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveActualSettings}
                  disabled={savingActual}
                  className="w-full gap-1.5 text-xs"
                >
                  <CheckCircle className="size-3.5" aria-hidden="true" />
                  {savingActual ? 'Saving…' : 'Save & Mark Complete'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Upcoming reminder ── */}
      {approachingSoon && !isCompleted && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
          <Bell className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="font-medium">Shoot starts within 1 hour!</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {plan.title}
            </h3>
            {isCompleted && (
              <Badge className="shrink-0 rounded-full border-0 bg-emerald-100 px-2 py-0 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                Completed
              </Badge>
            )}
            {!isCompleted && upcoming && (
              <Badge className="shrink-0 rounded-full border-0 bg-blue-100 px-2 py-0 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                Upcoming
              </Badge>
            )}
            {!isCompleted && !upcoming && (
              <Badge className="shrink-0 rounded-full border-0 bg-zinc-100 px-2 py-0 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Past
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">{plan.sceneType}</p>
        </div>

        {/* Notification indicator */}
        <div className="shrink-0" title={plan.notificationSent ? 'Reminder sent' : 'Reminder pending'}>
          {plan.notificationSent ? (
            <BellOff className="size-4 text-zinc-400" aria-hidden="true" />
          ) : (
            <Bell className="size-4 text-zinc-400" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* ── Meta info ── */}
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{formatPlannedAt(plan.plannedAt)}</span>
        </div>
        {plan.locationName && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{plan.locationName}</span>
          </div>
        )}
      </div>

      {/* ── Description ── */}
      {plan.description && (
        <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
          {plan.description}
        </p>
      )}

      {/* ── Predicted settings ── */}
      {hasPredictions && (
        <div className="mb-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
          <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Predicted Settings
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {plan.predictedIso && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">ISO</span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{plan.predictedIso}</span>
              </div>
            )}
            {plan.predictedAperture && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Aperture</span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">f/{plan.predictedAperture.toFixed(1)}</span>
              </div>
            )}
            {plan.predictedShutter && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Shutter</span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{plan.predictedShutter}s</span>
              </div>
            )}
            {plan.predictedWB && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">WB</span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{plan.predictedWB}</span>
              </div>
            )}
            {plan.predictedMetering && (
              <div className="flex items-center justify-between col-span-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Metering</span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{plan.predictedMetering}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-2">
        {!isCompleted && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkComplete}
            disabled={completing}
            className="flex-1 gap-1.5 text-xs"
          >
            <CheckCircle className="size-3.5" aria-hidden="true" />
            {completing ? 'Saving…' : 'Mark Complete'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          aria-label={`Delete plan: ${plan.title}`}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {deleting ? 'Deleting…' : ''}
        </Button>
      </div>
    </div>
  )
}
