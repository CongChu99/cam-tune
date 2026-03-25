/**
 * Tests for LensPickerModal component
 * - Renders search input and scrollable list container
 * - Typing in search input debounces fetch call to /api/lens-search (mock timers for 300ms)
 * - Shows loading state while fetching
 * - Shows "No lenses found" when fetch returns empty array
 * - Shows lens results list when fetch returns results
 * - Clicking a lens result triggers onSelect(lens) callback
 * - Does NOT call fetch until debounce delay (300ms)
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'

import { LensPickerModal } from '../../components/lens-picker-modal'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockLensfunLens1 = {
  id: 'lensfun-lens-001',
  lensfunId: 'canon/ef85mm_f1.8',
  manufacturer: 'Canon',
  model: 'Canon EF 85mm f/1.8 USM',
  focalLengthMinMm: 85,
  focalLengthMaxMm: 85,
  maxAperture: 1.8,
  lensType: 'PRIME',
  popularityWeight: 90,
}

const mockLensfunLens2 = {
  id: 'lensfun-lens-002',
  lensfunId: 'nikon/af-s85mm_f1.8g',
  manufacturer: 'Nikon',
  model: 'Nikon AF-S Nikkor 85mm f/1.8G',
  focalLengthMinMm: 85,
  focalLengthMaxMm: 85,
  maxAperture: 1.8,
  lensType: 'PRIME',
  popularityWeight: 85,
}

const mockLensfunLens3 = {
  id: 'lensfun-lens-003',
  lensfunId: 'sony/fe85mm_f1.8',
  manufacturer: 'Sony',
  model: 'Sony FE 85mm f/1.8',
  focalLengthMinMm: 85,
  focalLengthMaxMm: 85,
  maxAperture: 1.8,
  lensType: 'PRIME',
  popularityWeight: 80,
}

const defaultProps = {
  onSelect: vi.fn(),
  onClose: vi.fn(),
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('Rendering', () => {
  it('renders a search input field', () => {
    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    expect(searchInput).toBeInTheDocument()
  })

  it('renders a scrollable results list container', () => {
    render(<LensPickerModal {...defaultProps} />)

    // Should render a list or results container
    const listContainer = screen.getByRole('list')
    expect(listContainer).toBeInTheDocument()
  })

  it('renders with empty results list on mount', () => {
    render(<LensPickerModal {...defaultProps} />)

    const listItems = screen.queryAllByRole('listitem')
    expect(listItems).toHaveLength(0)
  })
})

// ─── Debounced search ─────────────────────────────────────────────────────────

describe('Debounced search behavior', () => {
  it('does NOT call fetch immediately when user starts typing', async () => {
    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    // Immediately after typing, fetch should NOT have been called
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does NOT call fetch before 300ms debounce delay', async () => {
    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    // Advance time to just before debounce fires
    act(() => {
      vi.advanceTimersByTime(299)
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls fetch to /api/lens-search after 300ms debounce delay', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockLensfunLens1, mockLensfunLens2],
    } as Response)

    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    // Advance time to exactly the debounce threshold
    act(() => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/lens-search'),
        expect.anything()
      )
    })
  })

  it('includes the query parameter in the fetch URL', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=85mm'),
        expect.anything()
      )
    })
  })

  it('debounces multiple rapid keystrokes — only fires one fetch call', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)

    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })

    // Simulate rapid typing
    fireEvent.change(searchInput, { target: { value: '8' } })
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.change(searchInput, { target: { value: '85' } })
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.change(searchInput, { target: { value: '85m' } })
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    // Only now advance past the debounce threshold
    act(() => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    // The final call should use the final value
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('q=85mm'),
      expect.anything()
    )
  })
})

// ─── Loading state ────────────────────────────────────────────────────────────

describe('Loading state', () => {
  it('shows a loading indicator while fetching results', async () => {
    // Delay the response to observe loading state
    let resolvePromise: (value: unknown) => void
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    vi.mocked(global.fetch).mockReturnValueOnce(
      pendingPromise as Promise<Response>
    )

    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    // After debounce fires but before response resolves, loading should be shown
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    // Cleanup: resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => [],
    })
  })
})

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('Empty state', () => {
  it('shows "No lenses found" when fetch returns empty array', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(screen.getByText(/no lenses found/i)).toBeInTheDocument()
    })
  })

  it('does NOT show "No lenses found" before any search is performed', () => {
    render(<LensPickerModal {...defaultProps} />)

    expect(screen.queryByText(/no lenses found/i)).not.toBeInTheDocument()
  })
})

// ─── Results list ─────────────────────────────────────────────────────────────

describe('Results list', () => {
  it('shows lens results when fetch returns matching lenses', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockLensfunLens1, mockLensfunLens2, mockLensfunLens3],
    } as Response)

    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(screen.getByText(/Canon EF 85mm f\/1\.8 USM/i)).toBeInTheDocument()
      expect(screen.getByText(/Nikon AF-S Nikkor 85mm f\/1\.8G/i)).toBeInTheDocument()
      expect(screen.getByText(/Sony FE 85mm f\/1\.8/i)).toBeInTheDocument()
    })
  })

  it('renders each result as a list item', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockLensfunLens1, mockLensfunLens2],
    } as Response)

    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      const listItems = screen.getAllByRole('listitem')
      expect(listItems).toHaveLength(2)
    })
  })

  it('replaces results on subsequent searches', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockLensfunLens1],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockLensfunLens2, mockLensfunLens3],
      } as Response)

    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })

    // First search
    fireEvent.change(searchInput, { target: { value: '85mm' } })
    act(() => { vi.advanceTimersByTime(300) })

    await waitFor(() => {
      expect(screen.getByText(/Canon EF 85mm f\/1\.8 USM/i)).toBeInTheDocument()
    })

    // Second search
    fireEvent.change(searchInput, { target: { value: 'Nikon' } })
    act(() => { vi.advanceTimersByTime(300) })

    await waitFor(() => {
      expect(screen.queryByText(/Canon EF 85mm f\/1\.8 USM/i)).not.toBeInTheDocument()
      expect(screen.getByText(/Nikon AF-S Nikkor 85mm f\/1\.8G/i)).toBeInTheDocument()
    })
  })
})

// ─── onSelect callback ────────────────────────────────────────────────────────

describe('onSelect callback', () => {
  it('calls onSelect with the lens when a result is clicked', async () => {
    const onSelect = vi.fn()

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockLensfunLens1, mockLensfunLens2],
    } as Response)

    render(<LensPickerModal {...defaultProps} onSelect={onSelect} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(screen.getByText(/Canon EF 85mm f\/1\.8 USM/i)).toBeInTheDocument()
    })

    const canonLensItem = screen.getByText(/Canon EF 85mm f\/1\.8 USM/i)
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(canonLensItem)

    expect(onSelect).toHaveBeenCalledWith(mockLensfunLens1)
  })

  it('calls onSelect exactly once when a result is clicked', async () => {
    const onSelect = vi.fn()

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockLensfunLens1],
    } as Response)

    render(<LensPickerModal {...defaultProps} onSelect={onSelect} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(screen.getByText(/Canon EF 85mm f\/1\.8 USM/i)).toBeInTheDocument()
    })

    const lensItem = screen.getByText(/Canon EF 85mm f\/1\.8 USM/i)
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(lensItem)

    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

// ─── onClose callback ─────────────────────────────────────────────────────────

describe('onClose callback', () => {
  it('renders a close/cancel button', () => {
    render(<LensPickerModal {...defaultProps} />)

    const closeButton = screen.getByRole('button', { name: /close|cancel/i })
    expect(closeButton).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()

    render(<LensPickerModal {...defaultProps} onClose={onClose} />)

    const closeButton = screen.getByRole('button', { name: /close|cancel/i })
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ─── Fetch error handling ─────────────────────────────────────────────────────

describe('Fetch error handling', () => {
  it('clears loading state when fetch rejects, and does not crash', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })
    fireEvent.change(searchInput, { target: { value: '85mm' } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    // Loading spinner should appear while request is in-flight, then disappear after rejection
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    // Component should still be rendered (no crash)
    expect(screen.getByRole('textbox', { name: /search|lens/i })).toBeInTheDocument()
  })
})

// ─── No fetch on empty query ──────────────────────────────────────────────────

describe('Empty query handling', () => {
  it('does NOT call fetch when input is cleared (empty string)', async () => {
    render(<LensPickerModal {...defaultProps} />)

    const searchInput = screen.getByRole('textbox', { name: /search|lens/i })

    // Type something then clear it
    fireEvent.change(searchInput, { target: { value: '85mm' } })
    fireEvent.change(searchInput, { target: { value: '' } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
