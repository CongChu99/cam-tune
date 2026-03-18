'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface WeatherData {
  cloudCoverPct: number
  uvIndex: number
  visibilityKm: number
  temperature: number
  humidity: number
  sunrise: string
  sunset: string
  goldenHourStart: string
  goldenHourEnd: string
}

interface SunData {
  altitude: number
  azimuth: number
  isGoldenHour: boolean
  minutesToGoldenHour: number
}

interface LocationData {
  locationName: string
  weather: WeatherData
  sun: SunData
  cachedAt: string
  isStale: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return 'Now'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── Manual location override modal ──────────────────────────────────────────

interface ManualInputProps {
  onSubmit: (lat: number, lng: number) => void
  onClose: () => void
}

function ManualLocationInput({ onSubmit, onClose }: ManualInputProps) {
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedLat = parseFloat(lat)
    const parsedLng = parseFloat(lng)
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setError('Please enter valid coordinates.')
      return
    }
    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      setError('Latitude must be in [-90, 90] and longitude in [-180, 180].')
      return
    }
    onSubmit(parsedLat, parsedLng)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set manual location"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Set location manually
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="manual-lat"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Latitude
            </label>
            <input
              id="manual-lat"
              type="number"
              step="any"
              placeholder="e.g. 21.0285"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label
              htmlFor="manual-lng"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Longitude
            </label>
            <input
              id="manual-lng"
              type="number"
              step="any"
              placeholder="e.g. 105.8542"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 focus:outline-none dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LocationContextBarProps {
  /** Additional CSS classes for the outer wrapper */
  className?: string
}

export function LocationContextBar({ className }: LocationContextBarProps) {
  const [data, setData] = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showManualInput, setShowManualInput] = useState(false)

  // Keep track of current coords so we can re-fetch on demand
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null)

  const fetchData = useCallback(async (lat: number, lng: number) => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/location?lat=${lat}&lng=${lng}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const json: LocationData = await res.json()
      setData(json)
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : 'Unable to load location data.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-detect GPS on mount
  useEffect(() => {
    if (!navigator?.geolocation) {
      setGpsError('Geolocation is not supported by this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        coordsRef.current = { lat, lng }
        fetchData(lat, lng)
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access denied. Enter coordinates manually.'
            : 'Unable to determine your location. Enter coordinates manually.'
        )
      },
      { timeout: 8000 }
    )
  }, [fetchData])

  function handleManualSubmit(lat: number, lng: number) {
    coordsRef.current = { lat, lng }
    setGpsError(null)
    setShowManualInput(false)
    fetchData(lat, lng)
  }

  // ── No-GPS / error state ────────────────────────────────────────────────
  if (gpsError && !data) {
    return (
      <>
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800 dark:border-yellow-700/50 dark:bg-yellow-900/20 dark:text-yellow-300',
            className
          )}
        >
          <span className="text-base">&#x26A0;&#xFE0F;</span>
          <span>{gpsError}</span>
          <button
            onClick={() => setShowManualInput(true)}
            className="ml-auto rounded-lg bg-yellow-200 px-3 py-1 text-xs font-medium transition hover:bg-yellow-300 dark:bg-yellow-800 dark:hover:bg-yellow-700"
          >
            Set location
          </button>
        </div>
        {showManualInput && (
          <ManualLocationInput
            onSubmit={handleManualSubmit}
            onClose={() => setShowManualInput(false)}
          />
        )}
      </>
    )
  }

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div
        className={cn(
          'flex h-12 animate-pulse items-center gap-4 rounded-xl bg-zinc-100 px-4 dark:bg-zinc-800',
          className
        )}
        aria-busy="true"
        aria-label="Loading location data"
      />
    )
  }

  // ── Fetch error (no cached data available) ──────────────────────────────
  if (fetchError && !data) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400',
          className
        )}
      >
        <span>&#x26A0;&#xFE0F;</span>
        <span>Location unavailable: {fetchError}</span>
        {coordsRef.current && (
          <button
            onClick={() => fetchData(coordsRef.current!.lat, coordsRef.current!.lng)}
            className="ml-auto rounded-lg bg-red-100 px-3 py-1 text-xs font-medium transition hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  if (!data) return null

  const { locationName, weather, sun, isStale } = data

  return (
    <>
      <div
        className={cn(
          'relative flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900',
          isStale && 'border-amber-300 dark:border-amber-700/60',
          className
        )}
        aria-label="Location context"
      >
        {/* Location name */}
        <span className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-4 shrink-0 text-blue-500"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.079 3.678-5.067 3.678-8.827a8 8 0 10-16 0c0 3.76 1.734 6.748 3.678 8.827a19.58 19.58 0 002.683 2.282 16.974 16.974 0 001.215.754zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
          {locationName}
        </span>

        {/* Divider */}
        <span className="hidden h-4 w-px bg-zinc-200 dark:bg-zinc-700 sm:block" aria-hidden="true" />

        {/* Cloud cover */}
        <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400" title="Cloud cover">
          <span aria-hidden="true">&#x2601;&#xFE0F;</span>
          {weather.cloudCoverPct}%
        </span>

        {/* Temperature */}
        <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400" title="Temperature">
          <span aria-hidden="true">&#x1F321;&#xFE0F;</span>
          {Math.round(weather.temperature)}&deg;C
        </span>

        {/* UV index */}
        <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400" title="UV index">
          <span aria-hidden="true">&#x2600;&#xFE0F;</span>
          UV {weather.uvIndex}
        </span>

        {/* Divider */}
        <span className="hidden h-4 w-px bg-zinc-200 dark:bg-zinc-700 sm:block" aria-hidden="true" />

        {/* Sun altitude */}
        <span
          className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400"
          title="Sun altitude"
        >
          <span aria-hidden="true">&#x1F506;</span>
          {sun.altitude}&deg;
        </span>

        {/* Golden hour */}
        {sun.isGoldenHour ? (
          <span className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            Golden hour
          </span>
        ) : sun.minutesToGoldenHour > 0 ? (
          <span
            className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400"
            title="Time until golden hour"
          >
            <span aria-hidden="true">&#x1F7E0;</span>
            Golden in {formatCountdown(sun.minutesToGoldenHour)}
          </span>
        ) : null}

        {/* Stale warning */}
        {isStale && (
          <span
            className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
            title="Data may be outdated"
            role="status"
          >
            &#x26A0;&#xFE0F; Stale data
          </span>
        )}

        {/* Manual override pin */}
        <button
          onClick={() => setShowManualInput(true)}
          className="ml-auto rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          title="Set location manually"
          aria-label="Set location manually"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
      </div>

      {showManualInput && (
        <ManualLocationInput
          onSubmit={handleManualSubmit}
          onClose={() => setShowManualInput(false)}
        />
      )}
    </>
  )
}
