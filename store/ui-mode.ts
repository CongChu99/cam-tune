/**
 * UI Mode Store — Zustand with localStorage persistence.
 *
 * Two modes:
 *  - 'learning' — explanations visible inline per setting (default for first-time users)
 *  - 'quick'    — compact results-only layout; tap a setting to see explanation in bottom sheet
 *
 * Persisted to localStorage key: 'camtune-ui-mode'
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UIMode = 'learning' | 'quick'

export interface UIModeStore {
  mode: UIMode
  setMode: (mode: UIMode) => void
  toggleMode: () => void
}

export const useUIMode = create<UIModeStore>()(
  persist(
    (set, get) => ({
      mode: 'learning',

      setMode: (mode: UIMode) => set({ mode }),

      toggleMode: () =>
        set({ mode: get().mode === 'learning' ? 'quick' : 'learning' }),
    }),
    {
      name: 'camtune-ui-mode',
    }
  )
)
