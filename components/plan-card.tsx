'use client'

/**
 * PlanCard — Displays a single shoot plan summary.
 *
 * Shows title, location, planned date/time, scene type, and predicted settings.
 * Provides delete action and "Mark complete" action.
 * Shows proximity alert when user is near the planned location.
 */

import { useState } from 'react'
import { MapPin, Clock, Trash2, CheckCircle, Bell, BellOff } from 'lucide-react'
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

interface PlanCardProps {
  plan: ShootPlan
  /** Whether user is currently near this plan's location (within 500m) */
  isNearby?: boolean
  onDelete?: (id: string) => void
  onMarkComplete?: (id: string) => void
  className?: string
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

  const upcoming = isUpcoming(plan.plannedAt)
  const approachingSoon = isWithinHour(plan.plannedAt)
  const isCompleted = !!plan.completedAt

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
      {/* ── Proximity alert ── */}
      {isNearby && !isCompleted && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="font-medium">You&apos;re near your planned location!</span>
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
