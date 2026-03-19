'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { SessionListItem } from '@/lib/session-logger'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryClientProps {
  sessions: SessionListItem[]
  total: number
  page: number
  limit: number
}

// ─── Star rating display ──────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <span className="text-sm text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  )
}

// ─── Settings summary ─────────────────────────────────────────────────────────

function SettingsSummary({ settings }: { settings: unknown }) {
  if (!settings || typeof settings !== 'object') {
    return <span className="text-xs text-muted-foreground">No settings recorded</span>
  }
  const s = settings as Record<string, unknown>
  const parts: string[] = []
  if (s.iso) parts.push(`ISO ${s.iso}`)
  if (s.aperture) parts.push(`f/${s.aperture}`)
  if (s.shutter) parts.push(String(s.shutter))
  if (parts.length === 0) {
    return <span className="text-xs text-muted-foreground">No settings recorded</span>
  }
  return <span className="text-xs text-foreground font-mono">{parts.join(' · ')}</span>
}

// ─── Session row ──────────────────────────────────────────────────────────────

function SessionRow({
  session,
  onClick,
}: {
  session: SessionListItem
  onClick: () => void
}) {
  const db = session.cameraProfile.cameraDatabase
  const cameraName = db
    ? `${db.brand} ${db.model}`
    : `${session.cameraProfile.brand} ${session.cameraProfile.model}`

  const dateStr = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(session.startedAt))

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border bg-card p-4 shadow-sm hover:border-muted-foreground/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`View session at ${session.locationName ?? 'unknown location'} on ${dateStr}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Location + date */}
          <p className="font-semibold truncate text-foreground">
            {session.locationName ?? 'Unknown location'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>

          {/* Camera name */}
          <p className="text-xs text-muted-foreground mt-1">{cameraName}</p>

          {/* Settings used */}
          <div className="mt-1.5">
            <SettingsSummary settings={session.actualSettings} />
          </div>
        </div>

        {/* Rating + scene type */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StarRating rating={session.userRating} />
          {session.sceneType && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
              {session.sceneType}
            </span>
          )}
          {!session.endedAt && (
            <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 text-xs font-medium">
              Active
            </span>
          )}
        </div>
      </div>

      {/* Notes preview */}
      {session.notes && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2 border-t pt-2">
          {session.notes}
        </p>
      )}
    </button>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  limit,
  total,
}: {
  page: number
  limit: number
  total: number
}) {
  const router = useRouter()
  const totalPages = Math.ceil(total / limit)

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-6">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => router.push(`/history?page=${page - 1}&limit=${limit}`)}
      >
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => router.push(`/history?page=${page + 1}&limit=${limit}`)}
      >
        Next
      </Button>
    </div>
  )
}

// ─── Export button (exported so page.tsx can render it server-side) ───────────

export function HistoryExportButtonClient() {
  const handleExport = async (format: 'csv' | 'json') => {
    const url = `/api/sessions/export?format=${format}`
    const a = document.createElement('a')
    a.href = url
    a.download = format === 'csv' ? 'camtune-sessions.csv' : 'camtune-sessions.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
        Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
        Export JSON
      </Button>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export function HistoryClient({ sessions, total, page, limit }: HistoryClientProps) {
  const router = useRouter()

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">
        No sessions found.
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-3">
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            onClick={() => router.push(`/history/${session.id}`)}
          />
        ))}
      </div>

      <Pagination page={page} limit={limit} total={total} />
    </div>
  )
}
