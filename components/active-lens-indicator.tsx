'use client'

import React from 'react'

interface ActiveLensIndicatorProps {
  activeLensName: string | null
  onLensClick: () => void
}

export function ActiveLensIndicator({ activeLensName, onLensClick }: ActiveLensIndicatorProps) {
  if (activeLensName) {
    return (
      <button
        type="button"
        onClick={onLensClick}
        className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        {activeLensName}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 dark:border-yellow-700/50 dark:bg-yellow-900/20">
      <span className="text-xs text-yellow-700 dark:text-yellow-400">
        Set your lens for better recommendations
      </span>
      <button
        type="button"
        onClick={onLensClick}
        className="shrink-0 rounded border border-yellow-400 bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 hover:bg-yellow-200 dark:border-yellow-600 dark:bg-yellow-800/30 dark:text-yellow-300 dark:hover:bg-yellow-800/50"
      >
        Add Lens
      </button>
    </div>
  )
}
