'use client'

/**
 * ModeToggle — Header button that switches between Learning and Quick modes.
 *
 * - Shows current mode with icon: 📚 Learning | ⚡ Quick
 * - Persists mode to localStorage via Zustand store
 * - Switches mode in ≤1s on click (state update is synchronous)
 */

import { useUIMode } from '@/store/ui-mode'
import { cn } from '@/lib/utils'

interface ModeToggleProps {
  className?: string
}

export function ModeToggle({ className }: ModeToggleProps) {
  const { mode, toggleMode } = useUIMode()

  const isLearning = mode === 'learning'

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={`Switch to ${isLearning ? 'Quick' : 'Learning'} Mode`}
      title={`Switch to ${isLearning ? 'Quick' : 'Learning'} Mode`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isLearning
          ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
          : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50',
        className
      )}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {isLearning ? '📚' : '⚡'}
      </span>
      <span>{isLearning ? 'Learning' : 'Quick'}</span>
    </button>
  )
}
