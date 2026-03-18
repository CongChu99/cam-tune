'use client'

/**
 * Main recommendation page (app/(main)/page.tsx)
 *
 * - Camera feed capture via getUserMedia → canvas → base64 JPEG
 * - "Get Recommendation" button triggers POST /api/recommend
 * - Displays 3 RecommendationCards (with shutterSpeedWarning from top suggestion)
 * - Shows LocationContextBar (Task 5)
 * - Loading + error states
 * - First-time tooltip: "You're in Learning Mode — switch to Quick for faster workflow"
 * - Active camera name in header
 * - ModeToggle always visible in header
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocationContextBar } from '@/components/location-context-bar'
import { ModeToggle } from '@/components/mode-toggle'
import { RecommendationCard, type Suggestion } from '@/components/recommendation-card'
import { useUIMode } from '@/store/ui-mode'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CameraProfile {
  id: string
  brand: string
  model: string
  isActive: boolean
}

interface RecommendResponse {
  suggestions: Suggestion[]
  shutterSpeedWarning?: string
  sceneAnalysis?: {
    sceneType: string
    estimatedEV: number
    subjectMotion: string
    depthIntent: string
  }
  modelUsed?: string
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
  const { mode } = useUIMode()

  // ── Camera feed ──────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // ── Active camera profile ────────────────────────────────────────────────
  const [activeCamera, setActiveCamera] = useState<CameraProfile | null>(null)

  // ── Geolocation for the recommend call ──────────────────────────────────
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  // ── Recommendation state ─────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RecommendResponse | null>(null)

  // ── First-time tooltip ───────────────────────────────────────────────────
  const [showTooltip, setShowTooltip] = useState(false)

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

  // Fetch active camera profile
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

  // ─── Camera feed ──────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
        videoRef.current.play()
      }
    } catch {
      setCameraError('Camera access denied or unavailable.')
    }
  }, [])

  useEffect(() => {
    startCamera()
    return () => {
      // Cleanup stream on unmount
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Attach stream to video element once both are available
  useEffect(() => {
    if (stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream
      videoRef.current.play()
    }
  }, [stream])

  /** Capture a frame from the video feed and return base64 JPEG (no prefix) */
  function captureFrame(): string | null {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    // Strip the data URL prefix to get raw base64
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    return dataUrl.replace(/^data:image\/jpeg;base64,/, '')
  }

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

    const sceneFrame = captureFrame()
    if (!sceneFrame) {
      setError('Unable to capture camera frame. Please allow camera access.')
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
          sceneFrame,
          lat: coords.lat,
          lng: coords.lng,
        }),
        signal: AbortSignal.timeout(30_000),
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

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-base font-bold leading-tight text-zinc-900 dark:text-zinc-100">
              CamTune
            </h1>
            {activeCamera && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {activeCamera.brand} {activeCamera.model}
              </span>
            )}
          </div>

          {/* Mode toggle — always visible */}
          <ModeToggle />
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

        {/* Camera feed */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black dark:border-zinc-700">
          {cameraError ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-zinc-400">
              <Camera className="size-10 opacity-40" aria-hidden="true" />
              <p className="text-sm">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs text-white hover:bg-zinc-600"
              >
                Retry camera
              </button>
            </div>
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-48 w-full object-cover sm:h-56"
              aria-label="Live camera feed"
            />
          )}
          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        </div>

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
          <section aria-label="Camera setting recommendations" className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              Recommendations
            </h2>
            {result.suggestions.map((suggestion, i) => (
              <RecommendationCard
                key={i}
                suggestion={suggestion}
                index={i}
                shutterSpeedWarning={i === 0 ? (result.shutterSpeedWarning ?? null) : null}
                cameraName={
                  activeCamera
                    ? `${activeCamera.brand} ${activeCamera.model}`
                    : undefined
                }
              />
            ))}
          </section>
        )}
      </main>
    </div>
  )
}
