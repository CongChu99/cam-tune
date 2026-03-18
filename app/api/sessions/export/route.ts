/**
 * GET /api/sessions/export — Export all sessions as CSV or JSON
 *
 * Query params:
 *   ?format=csv|json  (default: csv)
 *
 * CSV response:  Content-Type: text/csv
 * JSON response: Content-Type: application/json
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exportSessions } from '@/lib/session-logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const formatParam = request.nextUrl.searchParams.get('format') ?? 'csv'
  const format: 'csv' | 'json' = formatParam === 'json' ? 'json' : 'csv'

  try {
    const data = await exportSessions(userId, format)

    if (format === 'json') {
      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="camtune-sessions.json"',
        },
      })
    }

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="camtune-sessions.csv"',
      },
    })
  } catch (err) {
    console.error('[GET /api/sessions/export]', err)
    return NextResponse.json({ error: 'Failed to export sessions' }, { status: 500 })
  }
}
