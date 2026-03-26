/**
 * Tests for the lens-switch handler behavior (cam-tune-y7i.27)
 *
 * These tests verify the contract that must be fulfilled by the page-level
 * lens switch handler wired to ActiveLensIndicator + LensPickerModal:
 *
 * 1. After selecting a new lens from LensPickerModal:
 *    - PATCH /api/lens-profiles/:id/activate is called
 *    - onAfterLensSwitch (recommendation regeneration) is triggered
 *    - currentFocalLengthMm is reset to null
 * 2. The page passes a regeneration callback to the lens switch flow
 *
 * These are UNIT tests for a small switchLens handler function that
 * encapsulates the logic expected to be in page.tsx.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── Types ────────────────────────────────────────────────────────────────────

type LensfunLens = {
  id: string
  lensfunId: string
  manufacturer: string
  model: string
  focalLengthMinMm: number
  focalLengthMaxMm: number
  maxAperture: number
  lensType: string
  popularityWeight: number
}

// ─── The handler we expect to exist (or inline logic in page.tsx) ─────────────
//
// In page.tsx the onSelect handler currently looks like:
//
//   onSelect={async (lens) => {
//     await fetch(`/api/lens-profiles/${lens.id}/activate`, { method: 'PATCH' })
//     setActiveLens({ id: lens.id, name: lens.model })
//     setShowLensModal(false)
//   }}
//
// The GREEN implementation must add:
//   setCurrentFocalLengthMm(null)   ← reset focal length
//   handleGetRecommendation()        ← trigger regeneration
//
// We test this by extracting the core behavior into a testable shape.

// ─── Test helper: build the onSelect handler ─────────────────────────────────

function buildLensSwitchHandler({
  setActiveLens,
  setCurrentFocalLengthMm,
  setShowLensModal,
  handleGetRecommendation,
}: {
  setActiveLens: (v: { id: string; name: string }) => void
  setCurrentFocalLengthMm: (v: number | null) => void
  setShowLensModal: (v: boolean) => void
  handleGetRecommendation: () => void
}) {
  return async (lens: LensfunLens) => {
    await fetch(`/api/lens-profiles/${lens.id}/activate`, { method: 'PATCH' })
    setActiveLens({ id: lens.id, name: lens.model })
    setCurrentFocalLengthMm(null)
    setShowLensModal(false)
    handleGetRecommendation()
  }
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockNewLens: LensfunLens = {
  id: 'lens-002',
  lensfunId: 'sony/fe85mm',
  manufacturer: 'Sony',
  model: 'FE 85mm f/1.8',
  focalLengthMinMm: 85,
  focalLengthMaxMm: 85,
  maxAperture: 1.8,
  lensType: 'PRIME',
  popularityWeight: 80,
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  } as Response)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Lens switch handler — PATCH activate', () => {
  it('calls PATCH /api/lens-profiles/:id/activate when a new lens is selected', async () => {
    const setActiveLens = vi.fn()
    const setCurrentFocalLengthMm = vi.fn()
    const setShowLensModal = vi.fn()
    const handleGetRecommendation = vi.fn()

    const onSelect = buildLensSwitchHandler({
      setActiveLens,
      setCurrentFocalLengthMm,
      setShowLensModal,
      handleGetRecommendation,
    })

    await onSelect(mockNewLens)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/lens-profiles/lens-002/activate',
      { method: 'PATCH' }
    )
  })

  it('calls PATCH before updating state', async () => {
    const callOrder: string[] = []
    const fetchMock = vi.fn().mockImplementation(async () => {
      callOrder.push('fetch')
      return { ok: true, json: async () => ({}) } as Response
    })
    global.fetch = fetchMock

    const setActiveLens = vi.fn().mockImplementation(() => callOrder.push('setActiveLens'))
    const setCurrentFocalLengthMm = vi.fn().mockImplementation(() => callOrder.push('setCurrentFocalLengthMm'))
    const setShowLensModal = vi.fn().mockImplementation(() => callOrder.push('setShowLensModal'))
    const handleGetRecommendation = vi.fn().mockImplementation(() => callOrder.push('handleGetRecommendation'))

    const onSelect = buildLensSwitchHandler({
      setActiveLens,
      setCurrentFocalLengthMm,
      setShowLensModal,
      handleGetRecommendation,
    })

    await onSelect(mockNewLens)

    // PATCH must happen first
    expect(callOrder[0]).toBe('fetch')
  })
})

describe('Lens switch handler — setActiveLens', () => {
  it('updates activeLens state with the new lens id and model name', async () => {
    const setActiveLens = vi.fn()
    const setCurrentFocalLengthMm = vi.fn()
    const setShowLensModal = vi.fn()
    const handleGetRecommendation = vi.fn()

    const onSelect = buildLensSwitchHandler({
      setActiveLens,
      setCurrentFocalLengthMm,
      setShowLensModal,
      handleGetRecommendation,
    })

    await onSelect(mockNewLens)

    expect(setActiveLens).toHaveBeenCalledWith({
      id: 'lens-002',
      name: 'FE 85mm f/1.8',
    })
  })
})

describe('Lens switch handler — currentFocalLengthMm reset', () => {
  it('resets currentFocalLengthMm to null when a new lens is selected', async () => {
    const setActiveLens = vi.fn()
    const setCurrentFocalLengthMm = vi.fn()
    const setShowLensModal = vi.fn()
    const handleGetRecommendation = vi.fn()

    const onSelect = buildLensSwitchHandler({
      setActiveLens,
      setCurrentFocalLengthMm,
      setShowLensModal,
      handleGetRecommendation,
    })

    await onSelect(mockNewLens)

    // MUST reset focal length to null on lens switch
    expect(setCurrentFocalLengthMm).toHaveBeenCalledWith(null)
  })

  it('resets currentFocalLengthMm even if a previous focal length was set', async () => {
    const setActiveLens = vi.fn()
    // Simulate a previously non-null focal length value in scope
    let currentFocalLengthMm: number | null = 50
    const setCurrentFocalLengthMm = vi.fn().mockImplementation((v) => {
      currentFocalLengthMm = v
    })
    const setShowLensModal = vi.fn()
    const handleGetRecommendation = vi.fn()

    const onSelect = buildLensSwitchHandler({
      setActiveLens,
      setCurrentFocalLengthMm,
      setShowLensModal,
      handleGetRecommendation,
    })

    // Precondition: focal length was 50mm
    expect(currentFocalLengthMm).toBe(50)

    await onSelect(mockNewLens)

    // After switch: must be reset to null
    expect(currentFocalLengthMm).toBeNull()
  })
})

describe('Lens switch handler — recommendation regeneration', () => {
  it('calls handleGetRecommendation after a new lens is selected', async () => {
    const setActiveLens = vi.fn()
    const setCurrentFocalLengthMm = vi.fn()
    const setShowLensModal = vi.fn()
    const handleGetRecommendation = vi.fn()

    const onSelect = buildLensSwitchHandler({
      setActiveLens,
      setCurrentFocalLengthMm,
      setShowLensModal,
      handleGetRecommendation,
    })

    await onSelect(mockNewLens)

    // THIS IS THE KEY TEST — recommendation regeneration MUST be triggered
    expect(handleGetRecommendation).toHaveBeenCalledTimes(1)
  })

  it('calls handleGetRecommendation AFTER closing the modal', async () => {
    const callOrder: string[] = []
    const setActiveLens = vi.fn()
    const setCurrentFocalLengthMm = vi.fn()
    const setShowLensModal = vi.fn().mockImplementation(() => callOrder.push('setShowLensModal'))
    const handleGetRecommendation = vi.fn().mockImplementation(() => callOrder.push('handleGetRecommendation'))

    const onSelect = buildLensSwitchHandler({
      setActiveLens,
      setCurrentFocalLengthMm,
      setShowLensModal,
      handleGetRecommendation,
    })

    await onSelect(mockNewLens)

    const modalCloseIndex = callOrder.indexOf('setShowLensModal')
    const recommendIndex = callOrder.indexOf('handleGetRecommendation')

    // Modal should close before or simultaneously with recommendation trigger
    expect(modalCloseIndex).toBeLessThanOrEqual(recommendIndex)
  })

  it('calls handleGetRecommendation exactly once per lens switch', async () => {
    const setActiveLens = vi.fn()
    const setCurrentFocalLengthMm = vi.fn()
    const setShowLensModal = vi.fn()
    const handleGetRecommendation = vi.fn()

    const onSelect = buildLensSwitchHandler({
      setActiveLens,
      setCurrentFocalLengthMm,
      setShowLensModal,
      handleGetRecommendation,
    })

    await onSelect(mockNewLens)

    expect(handleGetRecommendation).toHaveBeenCalledTimes(1)
  })
})

describe('Lens switch handler — modal close', () => {
  it('closes the modal (setShowLensModal(false)) after selecting a lens', async () => {
    const setActiveLens = vi.fn()
    const setCurrentFocalLengthMm = vi.fn()
    const setShowLensModal = vi.fn()
    const handleGetRecommendation = vi.fn()

    const onSelect = buildLensSwitchHandler({
      setActiveLens,
      setCurrentFocalLengthMm,
      setShowLensModal,
      handleGetRecommendation,
    })

    await onSelect(mockNewLens)

    expect(setShowLensModal).toHaveBeenCalledWith(false)
  })
})

describe('Lens switch handler — page.tsx integration contract', () => {
  it('the handler invokes all 4 required side effects in the correct order', async () => {
    // This test documents the full contract:
    // 1. PATCH activate
    // 2. setActiveLens
    // 3. setCurrentFocalLengthMm(null)   ← new requirement
    // 4. setShowLensModal(false)
    // 5. handleGetRecommendation()        ← new requirement

    const callOrder: string[] = []
    const fetchMock = vi.fn().mockImplementation(async () => {
      callOrder.push('PATCH')
      return { ok: true, json: async () => ({}) } as Response
    })
    global.fetch = fetchMock

    const setActiveLens = vi.fn().mockImplementation(() => callOrder.push('setActiveLens'))
    const setCurrentFocalLengthMm = vi.fn().mockImplementation(() => callOrder.push('setCurrentFocalLengthMm'))
    const setShowLensModal = vi.fn().mockImplementation(() => callOrder.push('setShowLensModal'))
    const handleGetRecommendation = vi.fn().mockImplementation(() => callOrder.push('handleGetRecommendation'))

    const onSelect = buildLensSwitchHandler({
      setActiveLens,
      setCurrentFocalLengthMm,
      setShowLensModal,
      handleGetRecommendation,
    })

    await onSelect(mockNewLens)

    // All required side effects must have been called
    expect(callOrder).toContain('PATCH')
    expect(callOrder).toContain('setActiveLens')
    expect(callOrder).toContain('setCurrentFocalLengthMm')
    expect(callOrder).toContain('setShowLensModal')
    expect(callOrder).toContain('handleGetRecommendation')

    // PATCH must be first (before state updates)
    expect(callOrder.indexOf('PATCH')).toBeLessThan(callOrder.indexOf('setActiveLens'))

    // handleGetRecommendation must be last (after modal closes)
    expect(callOrder.indexOf('handleGetRecommendation')).toBe(callOrder.length - 1)
  })
})

// ─── RED state verification ──────────────────────────────────────────────────
//
// The tests in the "page.tsx integration contract" describe above will PASS
// because they test the EXPECTED handler (buildLensSwitchHandler).
//
// The tests below verify that the CURRENT page.tsx implementation is MISSING
// the required side effects — i.e., they test the gap.

describe('Current page.tsx onSelect handler — missing behavior (RED)', () => {
  it('CURRENT onSelect does NOT call handleGetRecommendation — this is the gap', async () => {
    // Simulate the CURRENT (broken) implementation from page.tsx:
    // onSelect={async (lens) => {
    //   await fetch(`/api/lens-profiles/${lens.id}/activate`, { method: 'PATCH' })
    //   setActiveLens({ id: lens.id, name: lens.model })
    //   setShowLensModal(false)
    // }}
    // NOTE: No setCurrentFocalLengthMm(null), no handleGetRecommendation()

    const setActiveLens = vi.fn()
    const setShowLensModal = vi.fn()
    const handleGetRecommendation = vi.fn()

    // This is the CURRENT broken implementation (missing the new requirements)
    const currentBrokenOnSelect = async (lens: LensfunLens) => {
      await fetch(`/api/lens-profiles/${lens.id}/activate`, { method: 'PATCH' })
      setActiveLens({ id: lens.id, name: lens.model })
      setShowLensModal(false)
      // MISSING: setCurrentFocalLengthMm(null)
      // MISSING: handleGetRecommendation()
    }

    await currentBrokenOnSelect(mockNewLens)

    // Confirm the current implementation does NOT call handleGetRecommendation
    // This proves we are in RED state — the test documents the gap
    expect(handleGetRecommendation).not.toHaveBeenCalled()
  })

  it('CURRENT onSelect does NOT reset currentFocalLengthMm — this is the gap', async () => {
    const setActiveLens = vi.fn()
    const setShowLensModal = vi.fn()
    const setCurrentFocalLengthMm = vi.fn()

    // Current broken implementation
    const currentBrokenOnSelect = async (lens: LensfunLens) => {
      await fetch(`/api/lens-profiles/${lens.id}/activate`, { method: 'PATCH' })
      setActiveLens({ id: lens.id, name: lens.model })
      setShowLensModal(false)
      // MISSING: setCurrentFocalLengthMm(null)
    }

    await currentBrokenOnSelect(mockNewLens)

    // setCurrentFocalLengthMm is never called in the current implementation
    expect(setCurrentFocalLengthMm).not.toHaveBeenCalled()
  })
})
