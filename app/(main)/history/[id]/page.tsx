/**
 * Session detail page — /history/[id]
 *
 * Displays full detail for a single shoot session: location, camera,
 * weather snapshot, AI recommendation, actual settings used, rating, notes.
 */

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getSessionById } from '@/lib/session-logger'
import Link from 'next/link'

export const metadata = {
  title: 'Session Detail — CamTune',
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground">Not rated</span>
  return (
    <span className="text-amber-500 text-lg" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  )
}

function SettingsTable({ settings, label }: { settings: unknown; label: string }) {
  if (!settings || typeof settings !== 'object') {
    return (
      <div>
        <h3 className="font-medium mb-1">{label}</h3>
        <p className="text-sm text-muted-foreground">None recorded</p>
      </div>
    )
  }
  const s = settings as Record<string, unknown>
  const rows = [
    { key: 'ISO', value: s.iso },
    { key: 'Aperture', value: s.aperture ? `f/${s.aperture}` : null },
    { key: 'Shutter', value: s.shutter },
    { key: 'White Balance', value: s.whiteBalance },
    { key: 'Metering', value: s.meteringMode },
  ].filter((r) => r.value != null)

  if (rows.length === 0) {
    return (
      <div>
        <h3 className="font-medium mb-1">{label}</h3>
        <p className="text-sm text-muted-foreground">None recorded</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="font-medium mb-2">{label}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {rows.map((r) => (
          <>
            <dt key={`dt-${r.key}`} className="text-muted-foreground">{r.key}</dt>
            <dd key={`dd-${r.key}`} className="font-mono font-medium">{String(r.value)}</dd>
          </>
        ))}
      </dl>
    </div>
  )
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const { id } = await params
  const detail = await getSessionById(id, session.user.id)

  if (!detail) {
    notFound()
  }

  const db = detail.cameraProfile.cameraDatabase
  const cameraName = db
    ? `${db.brand} ${db.model}`
    : `${detail.cameraProfile.brand} ${detail.cameraProfile.model}`

  const dateStr = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(detail.startedAt))

  const aiRec = detail.aiRecommendation as Record<string, unknown> | null
  const topSuggestion =
    aiRec &&
    Array.isArray((aiRec as Record<string, unknown>).suggestions)
      ? ((aiRec as Record<string, unknown>).suggestions as unknown[])[0]
      : null

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      {/* Back link */}
      <Link
        href="/history"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        ← Back to History
      </Link>

      <h1 className="text-2xl font-bold mb-1">
        {detail.locationName ?? 'Unknown location'}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">{dateStr}</p>

      <div className="grid gap-6">
        {/* Camera */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Camera</h2>
          <p className="font-semibold">{cameraName}</p>
          {detail.sceneType && (
            <p className="text-sm text-muted-foreground mt-1 capitalize">
              Scene: {detail.sceneType}
            </p>
          )}
        </section>

        {/* Settings */}
        <section className="rounded-xl border bg-card p-4 grid gap-4 sm:grid-cols-2">
          <SettingsTable settings={detail.actualSettings} label="Settings Used" />
          <SettingsTable settings={topSuggestion} label="AI Recommendation" />
        </section>

        {/* Rating + notes */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
            Your Feedback
          </h2>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-muted-foreground">Rating:</span>
            <StarRating rating={detail.userRating} />
          </div>
          {detail.notes ? (
            <p className="text-sm">{detail.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes added.</p>
          )}
        </section>

        {/* Session metadata */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Session Info
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Started</dt>
            <dd>{new Date(detail.startedAt).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Ended</dt>
            <dd>{detail.endedAt ? new Date(detail.endedAt).toLocaleString() : '—'}</dd>
            <dt className="text-muted-foreground">Coordinates</dt>
            <dd className="font-mono text-xs">{detail.lat.toFixed(4)}, {detail.lng.toFixed(4)}</dd>
          </dl>
        </section>
      </div>

      <div className="mt-8">
        <Link
          href="/history"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted px-2.5 h-8 text-sm font-medium transition-colors"
        >
          Back to History
        </Link>
      </div>
    </main>
  )
}
