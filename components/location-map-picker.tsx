'use client'

/**
 * LocationMapPicker — A lat/lng picker with map preview.
 *
 * Provides:
 * 1. Interactive OpenStreetMap embed (iframe) that shows a marker at the
 *    selected coordinates and updates when coordinates change.
 * 2. "Use my current location" button (navigator.geolocation)
 * 3. Manual lat/lng input fields for precise entry
 *
 * The parent receives coordinates via the `onChange` callback.
 */

import { useState, useCallback } from 'react'
import { MapPin, LocateFixed, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number
  lng: number
}

interface LocationMapPickerProps {
  value?: LatLng | null
  onChange?: (coords: LatLng, locationName?: string) => void
  disabled?: boolean
  className?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'CamTune/1.0' } }
    )
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    const data = await res.json()
    const addr = data.address ?? {}
    const landmark =
      addr.tourism || addr.leisure || addr.amenity ||
      addr.quarter || addr.neighbourhood || addr.suburb
    const city = addr.city || addr.town || addr.village || addr.county
    const parts = []
    if (landmark) parts.push(landmark)
    if (city) parts.push(city)
    return parts.length > 0 ? parts.join(', ') : (data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LocationMapPicker({
  value,
  onChange,
  disabled,
  className,
}: LocationMapPickerProps) {
  const [latInput, setLatInput] = useState(value?.lat?.toString() ?? '')
  const [lngInput, setLngInput] = useState(value?.lng?.toString() ?? '')
  const [locating, setLocating] = useState(false)
  const [locationName, setLocationName] = useState<string>('')
  const [locError, setLocError] = useState<string | null>(null)

  const handleUseCurrentLocation = useCallback(async () => {
    if (!navigator?.geolocation) {
      setLocError('Geolocation is not supported by your browser.')
      return
    }
    setLocating(true)
    setLocError(null)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 1e6) / 1e6
        const lng = Math.round(pos.coords.longitude * 1e6) / 1e6
        setLatInput(lat.toString())
        setLngInput(lng.toString())

        const name = await reverseGeocode(lat, lng)
        setLocationName(name)
        onChange?.({ lat, lng }, name)
        setLocating(false)
      },
      () => {
        setLocError('Unable to get your location. Please enter coordinates manually.')
        setLocating(false)
      },
      { timeout: 10_000, enableHighAccuracy: true }
    )
  }, [onChange])

  function handleManualInput() {
    const lat = parseFloat(latInput)
    const lng = parseFloat(lngInput)
    if (isNaN(lat) || isNaN(lng)) return
    if (lat < -90 || lat > 90) return
    if (lng < -180 || lng > 180) return
    onChange?.({ lat, lng }, locationName || undefined)
  }

  function handleLatChange(val: string) {
    setLatInput(val)
    const lat = parseFloat(val)
    const lng = parseFloat(lngInput)
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90) {
      onChange?.({ lat, lng }, locationName || undefined)
    }
  }

  function handleLngChange(val: string) {
    setLngInput(val)
    const lat = parseFloat(latInput)
    const lng = parseFloat(val)
    if (!isNaN(lat) && !isNaN(lng) && lng >= -180 && lng <= 180) {
      onChange?.({ lat, lng }, locationName || undefined)
    }
  }

  // Derive the map src when we have valid coordinates
  const lat = parseFloat(latInput)
  const lng = parseFloat(lngInput)
  const hasCoords = !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  // OpenStreetMap export/embed URL — shows a marker pin at the given coordinates
  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02},${lat - 0.015},${lng + 0.02},${lat + 0.015}&layer=mapnik&marker=${lat},${lng}`
    : null

  return (
    <div className={cn('space-y-3', className)}>
      {/* Use current location button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleUseCurrentLocation}
        disabled={disabled || locating}
        className="w-full gap-2"
      >
        {locating ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <LocateFixed className="size-3.5" aria-hidden="true" />
        )}
        {locating ? 'Getting location…' : 'Use my current location'}
      </Button>

      {/* Detected location name */}
      {locationName && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
          <MapPin className="size-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
          <span className="truncate">{locationName}</span>
        </div>
      )}

      {/* OpenStreetMap embed — updates whenever coordinates change */}
      {mapSrc ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          <iframe
            key={mapSrc}
            src={mapSrc}
            title="Map preview"
            width="100%"
            height="200"
            loading="lazy"
            style={{ border: 0 }}
            aria-label={`Map showing location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`}
          />
          <p className="px-2 py-1 text-[10px] text-zinc-400 dark:text-zinc-500">
            Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> contributors
          </p>
        </div>
      ) : (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="flex flex-col items-center gap-1.5">
            <MapPin className="size-5 opacity-40" aria-hidden="true" />
            <span>Enter coordinates or use GPS to see map</span>
          </div>
        </div>
      )}

      {/* Manual coordinate inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Latitude
          </label>
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            value={latInput}
            onChange={(e) => handleLatChange(e.target.value)}
            onBlur={handleManualInput}
            disabled={disabled}
            placeholder="e.g. 48.8566"
            className={cn(
              'w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900',
              'placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
              'dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500',
              'disabled:opacity-50'
            )}
            aria-label="Latitude"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Longitude
          </label>
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            value={lngInput}
            onChange={(e) => handleLngChange(e.target.value)}
            onBlur={handleManualInput}
            disabled={disabled}
            placeholder="e.g. 2.3522"
            className={cn(
              'w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900',
              'placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
              'dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500',
              'disabled:opacity-50'
            )}
            aria-label="Longitude"
          />
        </div>
      </div>

      {/* Error */}
      {locError && (
        <p className="text-xs text-red-500 dark:text-red-400" role="alert">
          {locError}
        </p>
      )}
    </div>
  )
}
