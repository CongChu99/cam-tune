/**
 * Community page — /community
 *
 * Displays a feed of public camera settings cards shared by the community.
 * Users can search by location (500m radius) and camera model, and
 * like / save / report / apply settings cards.
 *
 * Server component: reads session for currentUserId, then renders the
 * CommunityFeed client island.
 */

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { CommunityFeed } from '@/components/community-feed'
import { Users } from 'lucide-react'

export const metadata = {
  title: 'Community Settings Cards — CamTune',
  description: 'Discover and share camera settings from photographers around the world',
}

export default async function CommunityPage() {
  const session = await getServerSession(authOptions)
  const currentUserId = session?.user?.id ?? undefined

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="size-5 text-blue-600" aria-hidden />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Community</h1>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Discover camera settings shared by photographers near you and around the world.
        </p>
        {!currentUserId && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Sign in to like, save, and apply community settings to your session.
          </p>
        )}
      </div>

      {/* ── Feed ── */}
      <CommunityFeed currentUserId={currentUserId} />
    </main>
  )
}
