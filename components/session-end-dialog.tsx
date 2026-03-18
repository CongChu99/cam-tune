'use client'

/**
 * SessionEndDialog — shown after receiving an AI recommendation.
 *
 * Features:
 *  - Pre-fills ISO / aperture / shutter from the AI recommended settings
 *  - User can confirm ("used as suggested") or manually adjust
 *  - Optional 1–5 star rating
 *  - Optional free-text notes
 *  - Auto-dismisses after 30 seconds if the user takes no action (no rating saved)
 *  - Calls POST /api/sessions/[id]/end on submit
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AISuggestion {
  iso: number
  aperture: number
  shutter: string
  whiteBalance?: string
  meteringMode?: string
}

export interface SessionEndDialogProps {
  sessionId: string
  /** Top AI recommendation to pre-fill */
  aiSuggestion: AISuggestion | null
  /** Called when the dialog is closed (submitted or auto-dismissed) */
  onClose: (saved: boolean) => void
}

const AUTO_DISMISS_SECONDS = 30

// ─── Star picker ──────────────────────────────────────────────────────────────

function StarPicker({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Rate this session">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(value === star ? null : star)}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          aria-pressed={value !== null && value >= star}
          className={[
            'text-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
            value !== null && value >= star
              ? 'text-amber-500'
              : 'text-muted-foreground hover:text-amber-400',
          ].join(' ')}
        >
          {value !== null && value >= star ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export function SessionEndDialog({
  sessionId,
  aiSuggestion,
  onClose,
}: SessionEndDialogProps) {
  // Pre-fill from AI suggestion
  const [iso, setIso] = useState<string>(
    aiSuggestion ? String(aiSuggestion.iso) : ''
  )
  const [aperture, setAperture] = useState<string>(
    aiSuggestion ? String(aiSuggestion.aperture) : ''
  )
  const [shutter, setShutter] = useState<string>(
    aiSuggestion?.shutter ?? ''
  )

  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-dismiss countdown
  const [secondsLeft, setSecondsLeft] = useState(AUTO_DISMISS_SECONDS)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    onClose(false)
  }, [onClose])

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          handleDismiss()
          return 0
        }
        return s - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [handleDismiss])

  // Reset timer whenever the user interacts
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSecondsLeft(AUTO_DISMISS_SECONDS)
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          handleDismiss()
          return 0
        }
        return s - 1
      })
    }, 1000)
  }, [handleDismiss])

  const handleUsedAsSuggested = useCallback(() => {
    if (aiSuggestion) {
      setIso(String(aiSuggestion.iso))
      setAperture(String(aiSuggestion.aperture))
      setShutter(aiSuggestion.shutter)
    }
    resetTimer()
  }, [aiSuggestion, resetTimer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (timerRef.current) clearInterval(timerRef.current)

    const isoNum = parseInt(iso, 10)
    const apertureNum = parseFloat(aperture)

    if (!isoNum || isNaN(isoNum) || isoNum < 50) {
      setError('Please enter a valid ISO value (minimum 50).')
      return
    }
    if (!apertureNum || isNaN(apertureNum) || apertureNum < 0.7) {
      setError('Please enter a valid aperture (e.g. 2.8).')
      return
    }
    if (!shutter.trim()) {
      setError('Please enter a shutter speed (e.g. 1/250).')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualSettings: {
            iso: isoNum,
            aperture: apertureNum,
            shutter: shutter.trim(),
          },
          userRating: rating ?? undefined,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save session')
      }

      onClose(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setIsSubmitting(false)
      resetTimer()
    }
  }

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-end-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss()
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-background border shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={resetTimer}
        onMouseMove={resetTimer}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 id="session-end-title" className="text-lg font-semibold">
            End Session
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Confirm the settings you used. Auto-dismisses in{' '}
          <span className="font-mono">{secondsLeft}s</span>.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Settings fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="se-iso"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                ISO
              </label>
              <input
                id="se-iso"
                type="number"
                min={50}
                max={2000000}
                value={iso}
                onChange={(e) => { setIso(e.target.value); resetTimer() }}
                placeholder="e.g. 400"
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label
                htmlFor="se-aperture"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Aperture
              </label>
              <input
                id="se-aperture"
                type="number"
                min={0.7}
                max={64}
                step={0.1}
                value={aperture}
                onChange={(e) => { setAperture(e.target.value); resetTimer() }}
                placeholder="e.g. 2.8"
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label
                htmlFor="se-shutter"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Shutter
              </label>
              <input
                id="se-shutter"
                type="text"
                value={shutter}
                onChange={(e) => { setShutter(e.target.value); resetTimer() }}
                placeholder="e.g. 1/250"
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* "Used as suggested" shortcut */}
          {aiSuggestion && (
            <button
              type="button"
              onClick={handleUsedAsSuggested}
              className="text-xs text-primary hover:underline text-left w-fit"
            >
              Use AI suggestion (ISO {aiSuggestion.iso}, f/{aiSuggestion.aperture},{' '}
              {aiSuggestion.shutter})
            </button>
          )}

          {/* Rating */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Rating <span className="font-normal">(optional)</span>
            </p>
            <StarPicker value={rating} onChange={(v) => { setRating(v); resetTimer() }} />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="se-notes"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              Notes <span className="font-normal">(optional)</span>
            </label>
            <textarea
              id="se-notes"
              rows={2}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); resetTimer() }}
              placeholder="What worked? What would you change?"
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={handleDismiss}>
              Skip
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Session'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
