/**
 * Tests for ExifLensDetectFlow component
 * - Renders upload button in idle state
 * - Shows "Detecting lens..." while uploading
 * - Shows matched lens confirmation when API returns a match
 * - Calls POST /api/lens-profiles and onLensConfirmed when user clicks Confirm
 * - Shows unmatched message when API returns matched: null
 * - Calls onSearchDatabase when user clicks "Search database" on unmatched
 * - Calls onEnterManually when user clicks "Enter manually" on unmatched
 * - Shows error when API fails
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'

import { ExifLensDetectFlow } from '../../components/exif-lens-detect-flow'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockMatchedLens = {
  id: 'l1',
  lensfunId: 'canon/ef85',
  manufacturer: 'Canon',
  model: 'EF 85mm f/1.4L IS USM',
  focalLengthMinMm: 85,
  focalLengthMaxMm: 85,
  maxAperture: 1.4,
  lensType: 'PRIME',
  popularityWeight: 95,
}

const defaultProps = {
  cameraProfileId: 'cam-001',
  onLensConfirmed: vi.fn(),
  onSearchDatabase: vi.fn(),
  onEnterManually: vi.fn(),
  onClose: vi.fn(),
}

const mockPhotoFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })

function makeResolvableFetch(response: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(response),
  })
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
  defaultProps.onLensConfirmed = vi.fn()
  defaultProps.onSearchDatabase = vi.fn()
  defaultProps.onEnterManually = vi.fn()
  defaultProps.onClose = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExifLensDetectFlow', () => {
  describe('a. Idle state', () => {
    it('renders upload button in idle state', () => {
      render(<ExifLensDetectFlow {...defaultProps} />)
      // Expect upload-related text to be visible
      expect(
        screen.getByText(/upload|photo/i)
      ).toBeInTheDocument()
    })
  })

  describe('b. Loading state', () => {
    it('shows "Detecting lens..." while uploading', async () => {
      // Mock fetch to hang (never resolves during this test)
      let resolveFetch!: (value: unknown) => void
      global.fetch = vi.fn().mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve
        })
      )

      render(<ExifLensDetectFlow {...defaultProps} />)

      const fileInput = screen.getByTestId('exif-upload-input')
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockPhotoFile] } })
      })

      expect(screen.getByText(/detecting lens/i)).toBeInTheDocument()

      // Cleanup: resolve the promise to avoid hanging
      resolveFetch({ ok: true, json: () => Promise.resolve({ matched: null, rawLensModelString: 'x' }) })
    })
  })

  describe('c. Matched state', () => {
    it('shows matched lens confirmation when API returns a match', async () => {
      global.fetch = makeResolvableFetch({
        matched: mockMatchedLens,
        confidence: 0.95,
        rawLensModelString: 'Canon EF 85mm f/1.4L IS USM',
      })

      render(<ExifLensDetectFlow {...defaultProps} />)

      const fileInput = screen.getByTestId('exif-upload-input')
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockPhotoFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/detected:/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/canon|ef 85mm/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })
  })

  describe('d. Confirm action', () => {
    it('calls POST /api/lens-profiles with source=exif and calls onLensConfirmed', async () => {
      const savedLensProfile = {
        id: 'lp-1',
        lensfunId: 'canon/ef85',
        source: 'exif',
        cameraProfileId: 'cam-001',
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            matched: mockMatchedLens,
            confidence: 0.95,
            rawLensModelString: 'Canon EF 85mm f/1.4L IS USM',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(savedLensProfile),
        })

      render(<ExifLensDetectFlow {...defaultProps} />)

      const fileInput = screen.getByTestId('exif-upload-input')
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockPhotoFile] } })
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
      })

      await waitFor(() => {
        expect(defaultProps.onLensConfirmed).toHaveBeenCalledWith(savedLensProfile)
      })

      // Verify POST /api/lens-profiles was called with correct body
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      const lensProfileCall = calls[1]
      expect(lensProfileCall[0]).toBe('/api/lens-profiles')
      const body = JSON.parse(lensProfileCall[1].body)
      expect(body.source).toBe('exif')
      expect(body.lensfunId).toBe('canon/ef85')
    })
  })

  describe('e. Unmatched state', () => {
    it('shows unmatched message when API returns matched: null', async () => {
      global.fetch = makeResolvableFetch({
        matched: null,
        rawLensModelString: 'Sigma 85mm Art',
      })

      render(<ExifLensDetectFlow {...defaultProps} />)

      const fileInput = screen.getByTestId('exif-upload-input')
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockPhotoFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/could not identify/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/sigma 85mm art/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /search database/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /enter manually/i })).toBeInTheDocument()
    })
  })

  describe('f. Search database callback', () => {
    it('calls onSearchDatabase when user clicks "Search database" on unmatched', async () => {
      global.fetch = makeResolvableFetch({
        matched: null,
        rawLensModelString: 'Sigma 85mm Art',
      })

      render(<ExifLensDetectFlow {...defaultProps} />)

      const fileInput = screen.getByTestId('exif-upload-input')
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockPhotoFile] } })
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /search database/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /search database/i }))

      expect(defaultProps.onSearchDatabase).toHaveBeenCalledWith('Sigma 85mm Art')
    })
  })

  describe('g. Enter manually callback', () => {
    it('calls onEnterManually when user clicks "Enter manually" on unmatched', async () => {
      global.fetch = makeResolvableFetch({
        matched: null,
        rawLensModelString: 'Sigma 85mm Art',
      })

      render(<ExifLensDetectFlow {...defaultProps} />)

      const fileInput = screen.getByTestId('exif-upload-input')
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockPhotoFile] } })
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enter manually/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /enter manually/i }))

      expect(defaultProps.onEnterManually).toHaveBeenCalled()
    })
  })

  describe('h. Error state', () => {
    it('shows error message when API call fails', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      render(<ExifLensDetectFlow {...defaultProps} />)

      const fileInput = screen.getByTestId('exif-upload-input')
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockPhotoFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/failed|error/i)).toBeInTheDocument()
      })
    })

    it('shows error when HTTP error response is returned from detect-exif', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 })

      render(<ExifLensDetectFlow {...defaultProps} />)

      const fileInput = screen.getByTestId('exif-upload-input')
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockPhotoFile] } })
      })

      await waitFor(() => {
        expect(screen.getByText(/failed|error/i)).toBeInTheDocument()
      })
    })

    it('shows error when confirm fetch returns HTTP error', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            matched: mockMatchedLens,
            confidence: 0.95,
            rawLensModelString: 'Canon EF 85mm f/1.4L IS USM',
          }),
        })
        .mockResolvedValueOnce({ ok: false, status: 500 })

      render(<ExifLensDetectFlow {...defaultProps} />)

      const fileInput = screen.getByTestId('exif-upload-input')
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockPhotoFile] } })
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
      })

      await waitFor(() => {
        expect(screen.getByText(/failed|error/i)).toBeInTheDocument()
      })
    })
  })

  describe('i. Edit button in matched state', () => {
    it('calls onSearchDatabase with lens model when Edit is clicked', async () => {
      global.fetch = makeResolvableFetch({
        matched: mockMatchedLens,
        confidence: 0.95,
        rawLensModelString: 'Canon EF 85mm f/1.4L IS USM',
      })

      render(<ExifLensDetectFlow {...defaultProps} />)

      const fileInput = screen.getByTestId('exif-upload-input')
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockPhotoFile] } })
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /edit/i }))

      expect(defaultProps.onSearchDatabase).toHaveBeenCalledWith('EF 85mm f/1.4L IS USM')
    })
  })
})
