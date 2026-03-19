/**
 * History page — /history
 *
 * Server component. Fetches paginated sessions and renders them via
 * HistoryClient (client island for interactivity) and HistoryExportButtonClient.
 */

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getUserSessions } from '@/lib/session-logger'
import { HistoryClient, HistoryExportButtonClient } from './HistoryClient'

export const metadata = {
  title: 'Shoot History — CamTune',
  description: 'View and export your past shoot sessions',
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const { page: pageParam, limit: limitParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(limitParam ?? '20', 10) || 20))

  const { sessions, total } = await getUserSessions(session.user.id, page, limit)

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Shoot History</h1>
        <HistoryExportButtonClient />
      </div>
      <p className="text-muted-foreground mb-8">
        {total === 0
          ? 'No sessions yet. Start your first shoot session to see history here.'
          : `${total} session${total === 1 ? '' : 's'} recorded.`}
      </p>

      <HistoryClient sessions={sessions} total={total} page={page} limit={limit} />
    </main>
  )
}
