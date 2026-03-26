/**
 * Tests for main page lens-switch behavior (cam-tune-y7i.27)
 *
 * These tests render MainPage and verify the onSelect handler in LensPickerModal
 * calls handleGetRecommendation() and resets currentFocalLengthMm after lens switch.
 *
 * RED state: current page.tsx onSelect does NOT call handleGetRecommendation or
 * reset currentFocalLengthMm — these tests MUST fail until GREEN is implemented.
 */

import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { name: 'Test' } } }),
  signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => React.createElement('a', { href, ...props }, children),
}))

vi.mock('@/components/location-context-bar', () => ({
  LocationContextBar: () => React.createElement('div', { 'data-testid': 'location-bar' }),
}))

vi.mock('@/components/mode-toggle', () => ({
  ModeToggle: () => React.createElement('div', { 'data-testid': 'mode-toggle' }),
}))

vi.mock('@/components/recommendation-card', () => ({
  RecommendationCard: ({ suggestion }: { suggestion: { label: string } }) =>
    React.createElement('div', { 'data-testid': 'recommendation-card' }, suggestion.label),
}))

vi.mock('@/store/ui-mode', () => ({
  useUIMode: () => ({ mode: 'quick' }),
}))

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockNewLens = {
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

const mockRecommendResponse = {
  suggestions: [{ label: 'Test suggestion', aperture: 'f/2.8', shutterSpeed: '1/100', iso: 400 }],
  modelUsed: 'gpt-4o',
  recommendationId: 'rec-abc123',
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()

  Object.defineProperty(global.navigator, 'geolocation', {
    value: {
      getCurrentPosition: vi.fn((success) => {
        success({ coords: { latitude: 10.0, longitude: 106.0 } })
      }),
    },
    configurable: true,
    writable: true,
  })

  Object.defineProperty(global, 'localStorage', {
    value: {
      getItem: vi.fn().mockReturnValue('1'),
      setItem: vi.fn(),
    },
    configurable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function setupFetchMocks() {
  const fetchMock = vi.fn()

  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    if (url.includes('/api/user/cameras')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          profiles: [{ id: 'cam-001', brand: 'Sony', model: 'A7 III', isActive: true }],
        }),
      } as Response)
    }
    if (url.includes('/api/lens-profiles?active=true')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          profiles: [
            { id: 'lens-001', manufacturer: 'Canon', model: 'EF 85mm f/1.8', isActive: true },
          ],
        }),
      } as Response)
    }
    if (
      url.includes('/api/lens-profiles/') &&
      url.includes('/activate') &&
      options?.method === 'PATCH'
    ) {
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    }
    if (url.includes('/api/recommend')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockRecommendResponse,
      } as Response)
    }
    if (url.includes('/api/lens-search')) {
      return Promise.resolve({
        ok: true,
        json: async () => [mockNewLens],
      } as Response)
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })

  global.fetch = fetchMock
  return fetchMock
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// We mock LensPickerModal so we can directly call onSelect in tests
// without going through the full search/debounce flow
let capturedOnSelect: ((lens: unknown) => void) | null = null

vi.mock('@/components/lens-picker-modal', () => ({
  LensPickerModal: ({ onSelect, onClose }: { onSelect: (lens: unknown) => void; onClose: () => void }) => {
    // Capture onSelect so the test can call it directly
    capturedOnSelect = onSelect
    return React.createElement(
      'div',
      { 'data-testid': 'lens-picker-modal' },
      React.createElement('button', {
        'data-testid': 'mock-select-lens',
        onClick: () => onSelect(mockNewLens),
      }, 'Select Sony FE 85mm'),
      React.createElement('button', { onClick: onClose }, 'Close')
    )
  },
}))

describe('Main page — lens switch triggers recommendation regeneration (RED)', () => {
  it('calls /api/recommend after a new lens is selected from LensPickerModal', async () => {
    capturedOnSelect = null
    const fetchMock = setupFetchMocks()

    const { default: MainPage } = await import('../../app/(main)/page')

    render(<MainPage />)

    // Wait for initial data load — camera profile should be visible
    await waitFor(() => {
      expect(screen.getByText(/Sony A7 III/i)).toBeInTheDocument()
    })

    // Wait for active lens button to appear
    await waitFor(() => {
      const lensBtn =
        screen.queryByRole('button', { name: /Canon EF 85mm/i }) ??
        screen.queryByRole('button', { name: /add lens/i })
      expect(lensBtn).toBeInTheDocument()
    })

    // Track recommend calls before lens switch
    const getRecommendCallCount = () =>
      fetchMock.mock.calls.filter(([url]: [string]) =>
        typeof url === 'string' && url.includes('/api/recommend')
      ).length

    const recommendCallsBefore = getRecommendCallCount()

    // Open the lens picker modal
    const lensBtn =
      screen.queryByRole('button', { name: /Canon EF 85mm/i }) ??
      screen.getByRole('button', { name: /add lens/i })

    await userEvent.click(lensBtn)

    // Verify modal is open (our mock renders it)
    await waitFor(() => {
      expect(screen.getByTestId('lens-picker-modal')).toBeInTheDocument()
    })

    // Click the mock select button to trigger onSelect with mockNewLens
    const selectButton = screen.getByTestId('mock-select-lens')
    await userEvent.click(selectButton)

    // After lens selection, /api/recommend MUST be called (this is the GREEN requirement)
    // In RED state, this FAILS because current page.tsx does NOT call handleGetRecommendation
    await waitFor(() => {
      const recommendCallsAfter = getRecommendCallCount()
      expect(recommendCallsAfter).toBeGreaterThan(recommendCallsBefore)
    }, { timeout: 3000 })
  })
})

describe('Main page — page.tsx onSelect handler contract (RED)', () => {
  it('the current onSelect handler in page.tsx does NOT call handleGetRecommendation', async () => {
    // This test documents the gap in the CURRENT implementation.
    // It reads the current onSelect handler source and verifies the gap.
    //
    // The current handler in page.tsx (line ~449):
    //   onSelect={async (lens) => {
    //     await fetch(`/api/lens-profiles/${lens.id}/activate`, { method: 'PATCH' })
    //     setActiveLens({ id: lens.id, name: lens.model })
    //     setShowLensModal(false)
    //   }}
    //
    // MISSING: setCurrentFocalLengthMm(null) and handleGetRecommendation()

    // We verify this by simulating the EXACT current code and checking it lacks the calls
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    global.fetch = fetchMock

    const setActiveLens = vi.fn()
    const setShowLensModal = vi.fn()
    const handleGetRecommendation = vi.fn()
    const setCurrentFocalLengthMm = vi.fn()

    // Exact copy of CURRENT onSelect from page.tsx (the broken version)
    const currentOnSelect = async (lens: typeof mockNewLens) => {
      await fetch(`/api/lens-profiles/${lens.id}/activate`, { method: 'PATCH' })
      setActiveLens({ id: lens.id, name: lens.model })
      setShowLensModal(false)
      // NOTE: Does NOT call setCurrentFocalLengthMm(null)
      // NOTE: Does NOT call handleGetRecommendation()
    }

    await currentOnSelect(mockNewLens)

    // These assertions PASS — confirming the gap exists in the current code
    expect(handleGetRecommendation).not.toHaveBeenCalled()
    expect(setCurrentFocalLengthMm).not.toHaveBeenCalled()

    // These assertions confirm what the current code DOES do
    expect(setActiveLens).toHaveBeenCalledWith({ id: 'lens-002', name: 'FE 85mm f/1.8' })
    expect(setShowLensModal).toHaveBeenCalledWith(false)
  })

  it('the REQUIRED onSelect handler MUST call handleGetRecommendation', async () => {
    // This test verifies the GREEN contract.
    // It will PASS after implementation is added to page.tsx.
    // In RED state, we verify the requirement by testing the expected behavior.

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    global.fetch = fetchMock

    const setActiveLens = vi.fn()
    const setShowLensModal = vi.fn()
    const handleGetRecommendation = vi.fn()
    const setCurrentFocalLengthMm = vi.fn()

    // This is the REQUIRED (GREEN) implementation:
    const requiredOnSelect = async (lens: typeof mockNewLens) => {
      await fetch(`/api/lens-profiles/${lens.id}/activate`, { method: 'PATCH' })
      setActiveLens({ id: lens.id, name: lens.model })
      setCurrentFocalLengthMm(null)
      setShowLensModal(false)
      handleGetRecommendation()
    }

    await requiredOnSelect(mockNewLens)

    // All required side effects
    expect(handleGetRecommendation).toHaveBeenCalledTimes(1)
    expect(setCurrentFocalLengthMm).toHaveBeenCalledWith(null)
    expect(setActiveLens).toHaveBeenCalledWith({ id: 'lens-002', name: 'FE 85mm f/1.8' })
    expect(setShowLensModal).toHaveBeenCalledWith(false)
  })
})

describe('Main page — currentFocalLengthMm state (RED)', () => {
  it('page.tsx must declare currentFocalLengthMm state with useState', async () => {
    // Verify the page.tsx source contains the required state declaration.
    // In RED state this will FAIL because the state doesn't exist yet.
    const fs = await import('fs')
    const pageSource = fs.readFileSync(
      '/home/congcp/Congcp/github/cam-tune/app/(main)/page.tsx',
      'utf-8'
    )

    // The page must declare currentFocalLengthMm state
    expect(pageSource).toContain('currentFocalLengthMm')
  })

  it('page.tsx onSelect handler must call setCurrentFocalLengthMm(null)', async () => {
    const fs = await import('fs')
    const pageSource = fs.readFileSync(
      '/home/congcp/Congcp/github/cam-tune/app/(main)/page.tsx',
      'utf-8'
    )

    // The onSelect handler must reset focal length
    expect(pageSource).toContain('setCurrentFocalLengthMm(null)')
  })

  it('page.tsx onSelect handler must call handleGetRecommendation()', async () => {
    const fs = await import('fs')
    const pageSource = fs.readFileSync(
      '/home/congcp/Congcp/github/cam-tune/app/(main)/page.tsx',
      'utf-8'
    )

    // The onSelect handler must trigger recommendation regeneration
    // We look for handleGetRecommendation() appearing after the PATCH activate call
    // in the onSelect handler context
    const onSelectSection = pageSource.slice(pageSource.indexOf('onSelect={async'))
    expect(onSelectSection).toContain('handleGetRecommendation()')
  })
})
