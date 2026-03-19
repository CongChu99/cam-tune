'use client'

/**
 * Plan page — /plan
 *
 * Pre-shoot planning mode: users plan future shoots with predicted settings
 * based on weather forecast + sun position + scene type.
 *
 * Features:
 * - Create plans with location, date/time, and scene type
 * - AI-predicted camera settings (text prompt, no image needed)
 * - View all plans sorted by planned date
 * - In-app reminder when plan is within 1 hour
 * - GPS proximity detection (shows alert when within 500m of plan location)
 * - Delete and mark-complete actions
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, X, CalendarClock, Loader2, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlanCard, type ShootPlan } from '@/components/plan-card'
import { LocationMapPicker, type LatLng } from '@/components/location-map-picker'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreatePlanForm {
  title: string
  description: string
  plannedAt: string
  latitude: string
  longitude: string
  locationName: string
  sceneType: string
}

const SCENE_TYPES = [
  'landscape', 'portrait', 'street', 'event', 'astro', 'macro',
  'architecture', 'wildlife', 'travel', 'sports'
]

const EMPTY_FORM: CreatePlanForm = {
  title: '',
  description: '',
  plannedAt: '',
  latitude: '',
  longitude: '',
  locationName: '',
  sceneType: 'landscape',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Haversine distance in metres between two lat/lng pairs */
function haversineMetres(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/** Format ISO string to datetime-local input value */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden="true" />
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [plans, setPlans] = useState<ShootPlan[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create plan form state
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreatePlanForm>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Action error state (delete / mark complete)
  const [actionError, setActionError] = useState<string | null>(null)

  // GPS state for proximity detection
  const [userCoords, setUserCoords] = useState<LatLng | null>(null)
  const notifiedRef = useRef<Set<string>>(new Set())
  // In-app notification fallback state
  const [upcomingAlert, setUpcomingAlert] = useState<string | null>(null)

  // ── Fetch plans ────────────────────────────────────────────────────────────

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/plans?limit=50')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPlans(data.plans ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError('Failed to load plans. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  // ── Request browser notification permission on mount ───────────────────────

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {/* non-fatal */})
      }
    }
  }, [])

  // ── GPS watching for proximity detection ───────────────────────────────────

  useEffect(() => {
    if (!navigator?.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {/* silently ignore */},
      { enableHighAccuracy: true, timeout: 10_000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // ── Reminder check: trigger notify endpoint 1h before planned time ─────────

  useEffect(() => {
    if (plans.length === 0) return

    const interval = setInterval(async () => {
      const now = Date.now()
      for (const plan of plans) {
        if (plan.notificationSent || plan.completedAt) continue
        const diff = new Date(plan.plannedAt).getTime() - now
        // Within 1 hour and not yet notified in this session
        if (diff > 0 && diff <= 60 * 60 * 1000 && !notifiedRef.current.has(plan.id)) {
          notifiedRef.current.add(plan.id)

          // Show browser notification if permission granted, else use in-app fallback
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('Shoot time in 1 hour!', {
                body: plan.title,
                icon: '/favicon.ico',
              })
            } catch {/* non-fatal */}
          } else {
            // In-app fallback alert
            setUpcomingAlert(`Reminder: "${plan.title}" is within 1 hour!`)
          }

          // Fire the notify endpoint
          try {
            await fetch(`/api/plans/${plan.id}/notify`, { method: 'POST' })
            // Update local state to reflect notificationSent
            setPlans((prev) =>
              prev.map((p) => p.id === plan.id ? { ...p, notificationSent: true } : p)
            )
          } catch {/* non-fatal */}
        }
      }
    }, 30_000) // check every 30 seconds

    return () => clearInterval(interval)
  }, [plans])

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleFormChange(field: keyof CreatePlanForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleLocationChange(coords: LatLng, locationName?: string) {
    setForm((prev) => ({
      ...prev,
      latitude: coords.lat.toString(),
      longitude: coords.lng.toString(),
      locationName: locationName ?? prev.locationName,
    }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)

    if (!form.title.trim()) {
      setCreateError('Title is required.')
      return
    }
    if (!form.plannedAt) {
      setCreateError('Planned date/time is required.')
      return
    }
    const lat = parseFloat(form.latitude)
    const lng = parseFloat(form.longitude)
    if (isNaN(lat) || isNaN(lng)) {
      setCreateError('Valid latitude and longitude are required.')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          plannedAt: new Date(form.plannedAt).toISOString(),
          latitude: lat,
          longitude: lng,
          locationName: form.locationName.trim() || undefined,
          sceneType: form.sceneType,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      setPlans((prev) => [data.plan, ...prev].sort(
        (a, b) => new Date(a.plannedAt).getTime() - new Date(b.plannedAt).getTime()
      ))
      setTotal((t) => t + 1)
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create plan.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    setActionError(null)
    try {
      const res = await fetch(`/api/plans/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      setPlans((prev) => prev.filter((p) => p.id !== id))
      setTotal((t) => Math.max(0, t - 1))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete plan.')
    }
  }

  async function handleMarkComplete(id: string, actualSettings?: { iso?: string; aperture?: string; shutter?: string; wb?: string }) {
    // If actual settings were provided, merge them into the forecastSnapshot alongside the existing forecast data
    const plan = plans.find((p) => p.id === id)
    let forecastSnapshotUpdate: string | undefined

    if (actualSettings && plan) {
      try {
        const existing = plan.forecastSnapshot ? JSON.parse(plan.forecastSnapshot) : {}
        // Preserve existing forecast data, add actual settings
        const forecast = existing.forecast ?? (existing.cloudCoverPct !== undefined ? existing : undefined)
        forecastSnapshotUpdate = JSON.stringify({ forecast, actual: actualSettings })
      } catch {
        forecastSnapshotUpdate = JSON.stringify({ actual: actualSettings })
      }
    }

    const body: Record<string, unknown> = { completedAt: new Date().toISOString() }
    if (forecastSnapshotUpdate !== undefined) {
      body.forecastSnapshot = forecastSnapshotUpdate
    }

    setActionError(null)
    try {
      const res = await fetch(`/api/plans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}))
        throw new Error(resBody?.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setPlans((prev) => prev.map((p) => p.id === id ? data.plan : p))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark plan as complete.')
    }
  }

  // ── Default datetime (now + 1 day) ─────────────────────────────────────────

  function getDefaultPlannedAt(): string {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setMinutes(0, 0, 0)
    return toDatetimeLocalValue(d)
  }

  function handleShowForm() {
    setForm({ ...EMPTY_FORM, plannedAt: getDefaultPlannedAt() })
    setCreateError(null)
    setShowForm(true)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-base font-bold leading-tight text-zinc-900 dark:text-zinc-100">
              Shoot Plans
            </h1>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {total === 0 ? 'No plans yet' : `${total} plan${total === 1 ? '' : 's'}`}
            </span>
          </div>
          <Button size="sm" onClick={handleShowForm} className="gap-1.5">
            <Plus className="size-3.5" aria-hidden="true" />
            New Plan
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-4">
        {/* ── In-app notification fallback (shown when browser notifications denied) ── */}
        {upcomingAlert && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400"
          >
            <span>{upcomingAlert}</span>
            <button
              type="button"
              onClick={() => setUpcomingAlert(null)}
              className="shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
              aria-label="Dismiss reminder"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ── Action error (delete / mark complete) ── */}
        {actionError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
          >
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="shrink-0 text-red-400 hover:text-red-600 dark:hover:text-red-300"
              aria-label="Dismiss error"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ── Create form ── */}
        {showForm && (
          <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-800/50 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Plan a New Shoot
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                aria-label="Close form"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  placeholder="e.g. Sunrise at the lake"
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Notes
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Any notes about this shoot…"
                  rows={2}
                  className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>

              {/* Date/time */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Planned Date &amp; Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.plannedAt}
                  onChange={(e) => handleFormChange('plannedAt', e.target.value)}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:color-scheme-dark"
                  required
                />
              </div>

              {/* Scene type */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Scene Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.sceneType}
                  onChange={(e) => handleFormChange('sceneType', e.target.value)}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {SCENE_TYPES.map((type) => (
                    <option key={type} value={type} className="capitalize">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Location <span className="text-red-500">*</span>
                </label>
                <LocationMapPicker
                  value={
                    form.latitude && form.longitude
                      ? { lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }
                      : null
                  }
                  onChange={handleLocationChange}
                  disabled={creating}
                />
                {/* Optional manual location name override */}
                {(form.latitude && form.longitude) && (
                  <input
                    type="text"
                    value={form.locationName}
                    onChange={(e) => handleFormChange('locationName', e.target.value)}
                    placeholder="Location name (optional override)"
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                )}
              </div>

              {/* Error */}
              {createError && (
                <p className="text-xs text-red-500 dark:text-red-400" role="alert">
                  {createError}
                </p>
              )}

              {/* Info about AI prediction */}
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                AI-predicted settings will be generated automatically if you have an OpenAI API key configured in settings.
              </p>

              {/* Submit */}
              <Button type="submit" disabled={creating} className="w-full gap-2">
                {creating ? (
                  <>
                    <Spinner />
                    Saving &amp; predicting…
                  </>
                ) : (
                  <>
                    <CalendarClock className="size-4" aria-hidden="true" />
                    Save Plan
                  </>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
            <Spinner className="size-6" />
            <p className="text-sm">Loading plans…</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
          >
            {error}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && plans.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <CalendarClock className="size-12 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No shoot plans yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Create your first plan to get AI-predicted camera settings for your upcoming shoot.
            </p>
            <Button size="sm" onClick={handleShowForm} className="mt-2 gap-1.5">
              <Plus className="size-3.5" aria-hidden="true" />
              New Plan
            </Button>
          </div>
        )}

        {/* ── Plan cards ── */}
        {!loading && plans.length > 0 && (
          <section aria-label="Shoot plans" className="space-y-3">
            {plans.map((plan) => {
              const isNearby =
                userCoords != null &&
                haversineMetres(userCoords, { lat: plan.latitude, lng: plan.longitude }) <= 500

              return (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isNearby={isNearby}
                  onDelete={handleDelete}
                  onMarkComplete={handleMarkComplete}
                />
              )
            })}
          </section>
        )}

        {/* Spacer to prevent content going behind bottom nav */}
        <div className="h-16" aria-hidden="true" />
      </main>
    </div>
  )
}
