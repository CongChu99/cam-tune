'use client'

/**
 * SettingsCard — displays a community settings card with like/save/report/apply actions.
 */

import { useState } from 'react'
import { Heart, Bookmark, Flag, Zap, MapPin, Camera, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface SettingsCardData {
  id: string
  userId: string
  cameraModel: string
  locationName: string
  caption: string | null
  photoUrl: string | null
  settings: {
    iso: number
    aperture: number
    shutter: string
    whiteBalance: string
    meteringMode: string
  }
  likesCount: number
  savesCount: number
  createdAt: string | Date
  user: { id: string; email: string }
  distanceMetres?: number
  likedByUser?: boolean
  savedByUser?: boolean
}

interface SettingsCardProps {
  card: SettingsCardData
  currentUserId?: string
  onLike?: (cardId: string) => Promise<{ liked: boolean; likesCount: number }>
  onSave?: (cardId: string) => Promise<{ saved: boolean; savesCount: number }>
  onReport?: (cardId: string, reason: string) => Promise<void>
  onApply?: (cardId: string) => Promise<void>
  className?: string
}

const REPORT_REASONS = [
  'Inappropriate content',
  'Incorrect settings',
  'Spam',
  'Other',
]

export function SettingsCard({
  card,
  currentUserId,
  onLike,
  onSave,
  onReport,
  onApply,
  className,
}: SettingsCardProps) {
  const [liked, setLiked] = useState(card.likedByUser ?? false)
  const [likesCount, setLikesCount] = useState(card.likesCount)
  const [saved, setSaved] = useState(card.savedByUser ?? false)
  const [savesCount, setSavesCount] = useState(card.savesCount)
  const [likeLoading, setLikeLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [applyLoading, setApplyLoading] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [applyDone, setApplyDone] = useState(false)

  const isOwner = currentUserId === card.userId

  const handleLike = async () => {
    if (!onLike || likeLoading) return
    setLikeLoading(true)
    try {
      const result = await onLike(card.id)
      setLiked(result.liked)
      setLikesCount(result.likesCount)
    } finally {
      setLikeLoading(false)
    }
  }

  const handleSave = async () => {
    if (!onSave || saveLoading) return
    setSaveLoading(true)
    try {
      const result = await onSave(card.id)
      setSaved(result.saved)
      setSavesCount(result.savesCount)
    } finally {
      setSaveLoading(false)
    }
  }

  const handleApply = async () => {
    if (!onApply || applyLoading) return
    setApplyLoading(true)
    try {
      await onApply(card.id)
      setApplyDone(true)
      setTimeout(() => setApplyDone(false), 2000)
    } finally {
      setApplyLoading(false)
    }
  }

  const handleReport = async () => {
    if (!onReport || reportLoading) return
    setReportLoading(true)
    try {
      await onReport(card.id, reportReason)
      setReportDone(true)
      setTimeout(() => {
        setReportOpen(false)
        setReportDone(false)
      }, 1500)
    } finally {
      setReportLoading(false)
    }
  }

  const formattedDate = new Date(card.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const userLabel = card.user.email.split('@')[0]

  return (
    <div
      className={cn(
        'relative rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900',
        className
      )}
    >
      {/* ── Header ── */}
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
              <Camera className="size-3.5 shrink-0 text-zinc-400" aria-hidden />
              <span className="truncate">{card.cameraModel}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{card.locationName}</span>
              {card.distanceMetres != null && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                  {card.distanceMetres < 1000
                    ? `${Math.round(card.distanceMetres)}m`
                    : `${(card.distanceMetres / 1000).toFixed(1)}km`}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-400 shrink-0">
            <Clock className="size-3" aria-hidden />
            <span>{formattedDate}</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">by {userLabel}</p>
      </div>

      {/* ── Caption + Settings ── */}
      <div className="px-4 pb-3">
        {card.caption && (
          <p className="mb-2 text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">
            {card.caption}
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs">
          <div>
            <span className="text-zinc-400">ISO</span>
            <span className="ml-1 font-semibold text-zinc-800 dark:text-zinc-200">
              {card.settings.iso}
            </span>
          </div>
          <div>
            <span className="text-zinc-400">f/</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {card.settings.aperture}
            </span>
          </div>
          <div>
            <span className="text-zinc-400">Shutter</span>
            <span className="ml-1 font-semibold text-zinc-800 dark:text-zinc-200">
              {card.settings.shutter}
            </span>
          </div>
          <div>
            <span className="text-zinc-400">WB</span>
            <span className="ml-1 font-semibold text-zinc-800 dark:text-zinc-200">
              {card.settings.whiteBalance}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-zinc-400">Metering</span>
            <span className="ml-1 font-semibold text-zinc-800 dark:text-zinc-200">
              {card.settings.meteringMode}
            </span>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-1">
          {/* Like */}
          {onLike && (
            <button
              onClick={handleLike}
              disabled={likeLoading}
              aria-pressed={liked}
              aria-label={liked ? 'Unlike' : 'Like'}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                liked
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400'
              )}
            >
              <Heart className={cn('size-3.5', liked && 'fill-current')} aria-hidden />
              <span>{likesCount}</span>
            </button>
          )}

          {/* Save */}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saveLoading}
              aria-pressed={saved}
              aria-label={saved ? 'Unsave' : 'Save'}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                saved
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400'
              )}
            >
              <Bookmark className={cn('size-3.5', saved && 'fill-current')} aria-hidden />
              <span>{savesCount}</span>
            </button>
          )}

          {/* Report */}
          {onReport && !isOwner && (
            <button
              onClick={() => setReportOpen(true)}
              aria-label="Report card"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              <Flag className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        {/* Apply */}
        {onApply && (
          <Button
            size="sm"
            variant={applyDone ? 'secondary' : 'default'}
            onClick={handleApply}
            disabled={applyLoading || applyDone}
            className="text-xs h-7"
          >
            <Zap className="size-3 mr-1" aria-hidden />
            {applyDone ? 'Applied!' : applyLoading ? 'Applying…' : 'Apply'}
          </Button>
        )}
      </div>

      {/* ── Report modal (inline, no Dialog dependency) ── */}
      {reportOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setReportOpen(false) }}
        >
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="report-dialog-title" className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Report this card
            </h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Select a reason for reporting this settings card.
            </p>
            <div className="mb-4 space-y-2">
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer text-sm text-zinc-800 dark:text-zinc-200">
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reportReason === r}
                    onChange={() => setReportReason(r)}
                    className="accent-blue-600"
                  />
                  {r}
                </label>
              ))}
            </div>
            {reportDone ? (
              <p className="text-sm text-green-600 dark:text-green-400">Reported. Thank you.</p>
            ) : (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setReportOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleReport} disabled={reportLoading}>
                  {reportLoading ? 'Reporting…' : 'Submit report'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
