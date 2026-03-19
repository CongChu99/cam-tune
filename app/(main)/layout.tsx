'use client'

/**
 * Shared layout for all (main) routes.
 *
 * Renders the fixed bottom navigation so it appears on every sub-page
 * (/, /plan, /history, /settings, etc.) without duplication.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, CalendarClock, History, Settings, Users } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Camera', icon: Camera, ariaLabel: 'Camera' },
  { href: '/plan', label: 'Plans', icon: CalendarClock, ariaLabel: 'Shoot Plans' },
  { href: '/community', label: 'Community', icon: Users, ariaLabel: 'Community' },
  { href: '/history', label: 'History', icon: History, ariaLabel: 'Session History' },
  { href: '/settings', label: 'Settings', icon: Settings, ariaLabel: 'Settings' },
] as const

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      {children}

      {/* ── Fixed bottom navigation ── */}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-4 py-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon, ariaLabel }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={
                  isActive
                    ? 'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-blue-600 dark:text-blue-400'
                    : 'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }
                aria-label={isActive ? `${ariaLabel} — current page` : ariaLabel}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
