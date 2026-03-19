'use client'

/**
 * CommunityFeed — feed of public settings cards with location + camera filters.
 *
 * - Fetches cards from /api/community/cards
 * - Optional location search (500m radius using device GPS)
 * - Optional camera model text filter
 * - Like / save / report / apply actions wired to API routes
 * - "Apply" writes camtune:pendingSettings to localStorage
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, MapPin, Loader2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsCard, type SettingsCardData } from '@/components/settings-card'

interface FeedResponse {
  cards: SettingsCardData[]
  total: number
  page: number
  limit: number
}

interface CommunityFeedProps {
  currentUserId?: string
}

export function CommunityFeed({ currentUserId }: CommunityFeedProps) {
  const [cards, setCards] = useState<SettingsCardData[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 20

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [cameraFilter, setCameraFilter] = useState('')
  const [locationEnabled, setLocationEnabled] = useState(false)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  const cameraFilterRef = useRef(cameraFilter)
  cameraFilterRef.current = cameraFilter

  // ── Fetch cards ──────────────────────────────────────────────────────────────

  const fetchCards = useCallback(
    async (targetPage: number, append: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(limit),
        })
        if (cameraFilterRef.current.trim()) {
          params.set('cameraModel', cameraFilterRef.current.trim())
        }
        if (locationEnabled && userLat != null && userLng != null) {
          params.set('lat', String(userLat))
          params.set('lng', String(userLng))
        }

        const res = await fetch(`/api/community/cards?${params.toString()}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error ?? 'Failed to load cards')
        }
        const data: FeedResponse = await res.json()
        setCards((prev) => (append ? [...prev, ...data.cards] : data.cards))
        setTotal(data.total)
        setPage(targetPage)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cards')
      } finally {
        setLoading(false)
      }
    },
    [locationEnabled, userLat, userLng]
  )

  // Initial load and when location filters change
  useEffect(() => {
    fetchCards(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationEnabled, userLat, userLng])

  // Refetch when cameraFilter is cleared
  useEffect(() => {
    if (cameraFilter === '') {
      fetchCards(1, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraFilter])

  // ── GPS ──────────────────────────────────────────────────────────────────────

  const enableLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser')
      return
    }
    setGpsLoading(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        setLocationEnabled(true)
        setGpsLoading(false)
      },
      () => {
        setGpsError('Unable to get your location. Please allow location access.')
        setGpsLoading(false)
      },
      { timeout: 10000 }
    )
  }

  const disableLocation = () => {
    setLocationEnabled(false)
    setUserLat(null)
    setUserLng(null)
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleLike = async (cardId: string) => {
    const res = await fetch(`/api/community/cards/${cardId}/like`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to toggle like')
    return res.json() as Promise<{ liked: boolean; likesCount: number }>
  }

  const handleSave = async (cardId: string) => {
    const res = await fetch(`/api/community/cards/${cardId}/save`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to toggle save')
    return res.json() as Promise<{ saved: boolean; savesCount: number }>
  }

  const handleReport = async (cardId: string, reason: string) => {
    const res = await fetch(`/api/community/cards/${cardId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (!res.ok) throw new Error('Failed to report card')
  }

  const handleApply = async (cardId: string) => {
    const res = await fetch(`/api/community/cards/${cardId}/apply`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to apply settings')
    const data = await res.json() as {
      settings: {
        iso: number
        aperture: number
        shutter: string
        whiteBalance: string
        meteringMode: string
      }
      cardId: string
      source: string
    }
    // Persist to localStorage so the camera page can pre-fill the recommendation panel
    try {
      localStorage.setItem(
        'camtune:pendingSettings',
        JSON.stringify({
          iso: data.settings.iso,
          aperture: data.settings.aperture,
          shutter: data.settings.shutter,
          whiteBalance: data.settings.whiteBalance,
          meteringMode: data.settings.meteringMode,
          source: 'community',
          cardId: data.cardId,
        })
      )
    } catch {
      // localStorage might be unavailable (private browsing etc.) — not fatal
    }
  }

  // ── Search submit ─────────────────────────────────────────────────────────────

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCards(1, false)
  }

  const clearCameraFilter = () => {
    setCameraFilter('')
    // fetchCards will be triggered by the useEffect watching cameraFilter === ''
  }

  const hasMore = cards.length < total
  const loadMore = () => fetchCards(page + 1, true)

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Filters bar ── */}
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Search &amp; Filter</h2>

        {/* Camera model filter */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              type="text"
              value={cameraFilter}
              onChange={(e) => setCameraFilter(e.target.value)}
              placeholder="Filter by camera model…"
              className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              aria-label="Filter by camera model"
            />
            {cameraFilter && (
              <button
                type="button"
                onClick={clearCameraFilter}
                aria-label="Clear filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          <Button type="submit" size="sm" variant="outline" className="text-xs">
            Search
          </Button>
        </form>

        {/* Location filter */}
        <div className="flex items-center gap-2">
          {locationEnabled ? (
            <button
              onClick={disableLocation}
              className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
            >
              <MapPin className="size-3.5 fill-current" aria-hidden />
              Within 500m
              <X className="size-3 ml-0.5" aria-hidden />
            </button>
          ) : (
            <button
              onClick={enableLocation}
              disabled={gpsLoading}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 disabled:opacity-50 transition-colors"
            >
              {gpsLoading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <MapPin className="size-3.5" aria-hidden />
              )}
              {gpsLoading ? 'Getting location…' : 'Near me (500m)'}
            </button>
          )}
          {gpsError && (
            <p className="text-xs text-red-500 dark:text-red-400">{gpsError}</p>
          )}
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
          <span>{error}</span>
          <button
            onClick={() => fetchCards(1, false)}
            className="flex items-center gap-1 text-xs hover:underline"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Retry
          </button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && cards.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl border border-zinc-100 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800"
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && cards.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No settings cards found</p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {locationEnabled
              ? 'No cards within 500m of your location. Try removing the location filter.'
              : 'Be the first to share your camera settings!'}
          </p>
        </div>
      )}

      {/* ── Cards grid ── */}
      {cards.length > 0 && (
        <div className="space-y-3">
          {cards.map((card) => (
            <SettingsCard
              key={card.id}
              card={card}
              currentUserId={currentUserId}
              onLike={currentUserId ? handleLike : undefined}
              onSave={currentUserId ? handleSave : undefined}
              onReport={currentUserId ? handleReport : undefined}
              onApply={currentUserId ? handleApply : undefined}
            />
          ))}
        </div>
      )}

      {/* ── Load more ── */}
      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore} className="text-xs">
            Load more ({total - cards.length} remaining)
          </Button>
        </div>
      )}

      {/* ── Load more spinner ── */}
      {loading && cards.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-zinc-400" aria-hidden />
        </div>
      )}
    </div>
  )
}
