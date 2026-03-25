import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { search } from '@/lib/lens-database-service'

/**
 * GET /api/lens-search?q=<query>
 * Search the Lensfun lens database. Returns matching LensfunLens[].
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q) {
    return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 })
  }

  let decodedQuery: string
  try {
    decodedQuery = decodeURIComponent(q)
  } catch {
    return NextResponse.json({ error: 'Invalid q parameter encoding' }, { status: 400 })
  }

  try {
    const lenses = await search(decodedQuery)
    return NextResponse.json(lenses)
  } catch (error) {
    console.error('[GET /api/lens-search] Error:', error)
    return NextResponse.json({ error: 'Failed to search lenses' }, { status: 500 })
  }
}
