'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Camera, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocationContextBar } from '@/components/location-context-bar'
import { ModeToggle } from '@/components/mode-toggle'
import { RecommendationCard, type Suggestion } from '@/components/recommendation-card'
import { ActiveLensIndicator } from '@/components/active-lens-indicator'
import { LensPickerModal } from '@/components/lens-picker-modal'
import { useUIMode } from '@/store/ui-mode'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CameraProfile {
  id: string
  brand: string
  model: string
  isActive: boolean
}

interface WeatherSnapshot {
  cloudCoverPct: number
  uvIndex: number
  visibilityKm: number
  temperature: number
  humidity: number
  sunrise?: string
  sunset?: string
  goldenHourStart?: string
  goldenHourEnd?: string
}

interface SceneAnalysis {
  sceneType: string
  estimatedEV: number
  subjectMotion: string
  depthIntent: string
}

interface RecommendResponse {
  suggestions: Suggestion[]
  shutterSpeedWarning?: string
  sceneAnalysis?: SceneAnalysis
  weatherSnapshot?: WeatherSnapshot
  modelUsed?: string
  recommendationId?: string
}

// localStorage key to track first-time tooltip display
const TOOLTIP_SEEN_KEY = 'camtune-learning-tooltip-seen'

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="size-5 animate-spin text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MainPage() {
  const { status } = useSession()
  const router = useRouter()
  const { mode } = useUIMode()

  // ── Active camera profile ────────────────────────────────────────────────
  const [activeCamera, setActiveCamera] = useState<CameraProfile | null>(null)

  // ── Active lens ──────────────────────────────────────────────────────────
  const [activeLens, setActiveLens] = useState<{ id: string; name: string } | null>(null)
  const [showLensModal, setShowLensModal] = useState(false)

  // ── Geolocation for the recommend call ──────────────────────────────────
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  // ── Recommendation state ─────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RecommendResponse | null>(null)

  // ── First-time tooltip ───────────────────────────────────────────────────
  const [showTooltip, setShowTooltip] = useState(false)

  // router kept for potential future use
  void router

  // ─── Init: tooltip, camera profiles, geolocation ─────────────────────────

  useEffect(() => {
    // First-time tooltip (Learning Mode default)
    const seen = localStorage.getItem(TOOLTIP_SEEN_KEY)
    if (!seen && mode === 'learning') {
      setShowTooltip(true)
    }
  }, [mode])

  function dismissTooltip() {
    setShowTooltip(false)
    localStorage.setItem(TOOLTIP_SEEN_KEY, '1')
  }

  // Fetch active camera profile and active lens
  useEffect(() => {
    fetch('/api/user/cameras')
      .then((r) => r.json())
      .then((data: { profiles?: CameraProfile[] }) => {
        const profiles = data.profiles ?? []
        const active = profiles.find((p) => p.isActive) ?? profiles[0] ?? null
        setActiveCamera(active)
      })
      .catch(() => {
        // Non-fatal: we'll show unknown camera
      })

    fetch('/api/lens-profiles?active=true')
      .then((r) => r.json())
      .then((data: { profiles?: Array<{ id: string; manufacturer: string; model: string; isActive: boolean }> }) => {
        const profiles = data.profiles ?? []
        const active = profiles.find((p) => p.isActive) ?? null
        if (active) {
          setActiveLens({ id: active.id, name: `${active.manufacturer} ${active.model}` })
        }
      })
      .catch(() => {
        // Non-fatal: lens is optional
      })
  }, [])

  // Geolocation
  useEffect(() => {
    if (!navigator?.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        // Silently ignore; LocationContextBar handles its own GPS state
      },
      { timeout: 8000 }
    )
  }, [])

  // ─── Get recommendation ───────────────────────────────────────────────────

  async function handleGetRecommendation() {
    setError(null)
    setResult(null)

    if (!activeCamera) {
      setError('No camera profile found. Please add a camera in Settings → Cameras.')
      return
    }

    if (!coords) {
      setError('Location not available. Please allow location access and try again.')
      return
    }

    setLoading(true)
    try {
      const modeParam = mode === 'quick' ? '?mode=quick' : ''
      const res = await fetch(`/api/recommend${modeParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraProfileId: activeCamera.id,
          lat: coords.lat,
          lng: coords.lng,
        }),
        signal: AbortSignal.timeout(180_000),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }

      const data: RecommendResponse = await res.json()
      setResult(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to get recommendation. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (status === 'loading') return null

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <h1 className="text-base font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                CamTune
              </h1>
              {activeCamera ? (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {activeCamera.brand} {activeCamera.model}
                </span>
              ) : (
                <span className="text-xs text-red-400">Chưa có camera</span>
              )}
            </div>
            <Link
              href="/cameras"
              className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Quản lý camera"
            >
              + Camera
            </Link>
            <ActiveLensIndicator
              activeLensName={activeLens?.name ?? null}
              onLensClick={() => setShowLensModal(true)}
            />
          </div>

          {/* Right side: mode toggle + auth */}
          <div className="flex items-center gap-2">
            <ModeToggle />
            {status === 'authenticated' ? (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Đăng xuất
              </button>
            ) : (
              <Link
                href="/auth/signin"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── First-time tooltip ── */}
      {showTooltip && (
        <div
          role="status"
          aria-live="polite"
          className="relative mx-auto mt-3 w-full max-w-lg rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300"
        >
          <span>
            📚 You&apos;re in <strong>Learning Mode</strong> — explanations are shown by default.
            Switch to <strong>Quick</strong> for a faster, compact workflow.
          </span>
          <button
            type="button"
            onClick={dismissTooltip}
            className="absolute right-3 top-3 text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300"
            aria-label="Dismiss tooltip"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-4">
        {/* Location context */}
        <LocationContextBar />

        {/* Get Recommendation button */}
        <Button
          size="lg"
          onClick={handleGetRecommendation}
          disabled={loading || !activeCamera}
          className="w-full gap-2"
        >
          {loading ? (
            <>
              <Spinner />
              Analyzing scene…
            </>
          ) : (
            <>
              <Camera className="size-4" aria-hidden="true" />
              Get Recommendation
            </>
          )}
        </Button>

        {/* Error state */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
          >
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={handleGetRecommendation}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-medium hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700"
              aria-label="Retry recommendation"
            >
              <RefreshCw className="size-3" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {/* Recommendation results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Scene analysis */}
            {result.sceneAnalysis && (
              <section aria-label="Scene analysis" className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Scene Analysis
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-400">Scene Type</p>
                    <p className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-100">{result.sceneAnalysis.sceneType}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-400">Est. EV</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.sceneAnalysis.estimatedEV} EV</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-400">Subject Motion</p>
                    <p className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-100">{result.sceneAnalysis.subjectMotion}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-400">Depth Intent</p>
                    <p className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-100">{result.sceneAnalysis.depthIntent}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Weather snapshot */}
            {result.weatherSnapshot && (
              <section aria-label="Weather conditions" className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Conditions
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-400">Clouds</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.weatherSnapshot.cloudCoverPct}%</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-400">UV Index</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.weatherSnapshot.uvIndex}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-400">Visibility</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.weatherSnapshot.visibilityKm} km</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-400">Temp</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.weatherSnapshot.temperature}°C</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-400">Humidity</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.weatherSnapshot.humidity}%</p>
                  </div>
                  {result.weatherSnapshot.sunrise && (
                    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                      <p className="text-xs text-zinc-400">Sunrise</p>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.weatherSnapshot.sunrise}</p>
                    </div>
                  )}
                  {result.weatherSnapshot.sunset && (
                    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                      <p className="text-xs text-zinc-400">Sunset</p>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.weatherSnapshot.sunset}</p>
                    </div>
                  )}
                  {result.weatherSnapshot.goldenHourStart && (
                    <div className="col-span-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-900/20">
                      <p className="text-xs text-amber-500">Golden Hour</p>
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                        {result.weatherSnapshot.goldenHourStart} – {result.weatherSnapshot.goldenHourEnd}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Suggestions */}
            <section aria-label="Camera setting recommendations" className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Recommendations
              </h2>
              {result.suggestions.map((suggestion, i) => (
                <RecommendationCard
                  key={i}
                  suggestion={suggestion}
                  index={i}
                  shutterSpeedWarning={i === 0 ? (result.shutterSpeedWarning ?? null) : null}
                  cameraName={activeCamera ? `${activeCamera.brand} ${activeCamera.model}` : undefined}
                />
              ))}
            </section>

            {/* Footer meta */}
            <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
              Model: {result.modelUsed ?? '—'}
              {result.recommendationId && <> · ID: {result.recommendationId.slice(0, 8)}</>}
            </p>
          </div>
        )}

        {/* Spacer to prevent content going behind bottom nav */}
        <div className="h-16" aria-hidden="true" />
      </main>

      {showLensModal && (
        <LensPickerModal
          onSelect={async (lens) => {
            // activate the selected lens
            await fetch(`/api/lens-profiles/${lens.id}/activate`, { method: 'PATCH' })
            setActiveLens({ id: lens.id, name: lens.model })
            setShowLensModal(false)
          }}
          onClose={() => setShowLensModal(false)}
        />
      )}
    </div>
  )
}
