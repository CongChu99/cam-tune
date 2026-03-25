/**
 * Tests for ManualLensEntryForm component
 * - Renders focal length input for prime mode
 * - Renders min/max focal length inputs when zoom mode selected
 * - Shows IS stops input only when IS is toggled on
 * - Validates: shows error when focal length empty on submit
 * - Validates: shows error when maxAperture empty on submit
 * - Validates: zoom — shows error when min >= max focal length
 * - Submit success: calls fetch POST /api/lens-profiles with correct body (source: 'manual')
 * - Submit success: calls onSuccess with returned lensProfile
 * - Cancel button calls onCancel
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'

import { ManualLensEntryForm } from '../../components/manual-lens-entry-form'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockLensProfile = {
  id: 'lens-profile-123',
  cameraProfileId: 'camera-profile-abc',
  focalLengthMm: 50,
  maxAperture: 1.8,
  minAperture: 1.8,
  isStabilized: false,
  stabilizationStops: null,
  focalLengthMinMm: null,
  focalLengthMaxMm: null,
  isVariableAperture: false,
  maxApertureTele: null,
  lensType: null,
  lensfunId: null,
  source: 'manual',
}

const defaultProps = {
  cameraProfileId: 'camera-profile-abc',
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Rendering: Prime mode (default) ─────────────────────────────────────────

describe('Prime mode (default)', () => {
  it('renders a single focal length input in prime mode', () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    // Should show a single focal length field (not min/max)
    const focalLengthInput = screen.getByLabelText(/focal length/i)
    expect(focalLengthInput).toBeInTheDocument()
  })

  it('does NOT render min/max focal length inputs in prime mode', () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    expect(screen.queryByLabelText(/min.*focal/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/max.*focal/i)).not.toBeInTheDocument()
  })

  it('renders maxAperture input', () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    const apertureInput = screen.getByLabelText(/max aperture/i)
    expect(apertureInput).toBeInTheDocument()
  })

  it('renders IS (Image Stabilization) toggle', () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    const isToggle = screen.getByRole('checkbox', { name: /image stabilization|optical.*is|IS/i })
    expect(isToggle).toBeInTheDocument()
  })
})

// ─── Rendering: Zoom mode ─────────────────────────────────────────────────────

describe('Zoom mode', () => {
  it('renders min and max focal length inputs when zoom mode is selected', async () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    // Find and click the zoom toggle button
    const zoomButton = screen.getByRole('button', { name: /zoom/i })
    await userEvent.click(zoomButton)

    expect(screen.getByLabelText(/min.*focal|focal.*min/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max.*focal|focal.*max/i)).toBeInTheDocument()
  })

  it('does NOT render single focal length input when zoom mode is selected', async () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    const zoomButton = screen.getByRole('button', { name: /zoom/i })
    await userEvent.click(zoomButton)

    // The single focal length input should be gone
    // (Only the min/max inputs should exist now)
    const allFocalInputs = screen.queryAllByLabelText(/^focal length$/i)
    expect(allFocalInputs).toHaveLength(0)
  })
})

// ─── IS stops field visibility ────────────────────────────────────────────────

describe('IS stops field', () => {
  it('does NOT show IS stops input when IS is toggled off (default)', () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    expect(screen.queryByLabelText(/stabilization stops|IS stops/i)).not.toBeInTheDocument()
  })

  it('shows IS stops input only when IS is toggled on', async () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    const isToggle = screen.getByRole('checkbox', { name: /image stabilization|optical.*is|IS/i })
    await userEvent.click(isToggle)

    expect(screen.getByLabelText(/stabilization stops|IS stops/i)).toBeInTheDocument()
  })

  it('hides IS stops input again when IS is toggled back off', async () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    const isToggle = screen.getByRole('checkbox', { name: /image stabilization|optical.*is|IS/i })
    await userEvent.click(isToggle) // turn on
    await userEvent.click(isToggle) // turn off

    expect(screen.queryByLabelText(/stabilization stops|IS stops/i)).not.toBeInTheDocument()
  })
})

// ─── Validation: focal length required ───────────────────────────────────────

describe('Validation: focal length required (prime)', () => {
  it('shows error message when focal length is empty on submit', async () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    // Fill in maxAperture but leave focal length empty
    const apertureInput = screen.getByLabelText(/max aperture/i)
    await userEvent.type(apertureInput, '1.8')

    const submitButton = screen.getByRole('button', { name: /save|submit/i })
    await userEvent.click(submitButton)

    expect(screen.getByText(/focal length.*required|required.*focal length/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows error when focal length is 0 (prime)', async () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    const focalLengthInput = screen.getByLabelText(/focal length/i)
    await userEvent.type(focalLengthInput, '0')

    const apertureInput = screen.getByLabelText(/max aperture/i)
    await userEvent.type(apertureInput, '1.8')

    const submitButton = screen.getByRole('button', { name: /save|submit/i })
    await userEvent.click(submitButton)

    expect(screen.getByText(/focal length.*required|required.*focal length|must be greater/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ─── Validation: maxAperture required ────────────────────────────────────────

describe('Validation: maxAperture required', () => {
  it('shows error message when maxAperture is empty on submit', async () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    // Fill in focal length but leave maxAperture empty
    const focalLengthInput = screen.getByLabelText(/focal length/i)
    await userEvent.type(focalLengthInput, '50')

    const submitButton = screen.getByRole('button', { name: /save|submit/i })
    await userEvent.click(submitButton)

    expect(screen.getByText(/aperture.*required|required.*aperture/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows error when maxAperture is 0', async () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    const focalLengthInput = screen.getByLabelText(/focal length/i)
    await userEvent.type(focalLengthInput, '50')

    const apertureInput = screen.getByLabelText(/max aperture/i)
    await userEvent.type(apertureInput, '0')

    const submitButton = screen.getByRole('button', { name: /save|submit/i })
    await userEvent.click(submitButton)

    expect(screen.getByText(/aperture.*required|required.*aperture|must be greater/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ─── Validation: zoom min >= max focal length ─────────────────────────────────

describe('Validation: zoom focal length range', () => {
  it('shows error when min focal length equals max focal length in zoom mode', async () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    const zoomButton = screen.getByRole('button', { name: /zoom/i })
    await userEvent.click(zoomButton)

    const minFocalInput = screen.getByLabelText(/min.*focal|focal.*min/i)
    const maxFocalInput = screen.getByLabelText(/max.*focal|focal.*max/i)
    await userEvent.type(minFocalInput, '50')
    await userEvent.type(maxFocalInput, '50')

    const apertureInput = screen.getByLabelText(/max aperture/i)
    await userEvent.type(apertureInput, '4')

    const submitButton = screen.getByRole('button', { name: /save|submit/i })
    await userEvent.click(submitButton)

    expect(screen.getByText(/max.*greater.*min|min.*less.*max|focal.*range/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows error when min focal length is greater than max focal length in zoom mode', async () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    const zoomButton = screen.getByRole('button', { name: /zoom/i })
    await userEvent.click(zoomButton)

    const minFocalInput = screen.getByLabelText(/min.*focal|focal.*min/i)
    const maxFocalInput = screen.getByLabelText(/max.*focal|focal.*max/i)
    await userEvent.type(minFocalInput, '200')
    await userEvent.type(maxFocalInput, '50')

    const apertureInput = screen.getByLabelText(/max aperture/i)
    await userEvent.type(apertureInput, '4')

    const submitButton = screen.getByRole('button', { name: /save|submit/i })
    await userEvent.click(submitButton)

    expect(screen.getByText(/max.*greater.*min|min.*less.*max|focal.*range/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ─── Submit success ───────────────────────────────────────────────────────────

describe('Submit success (prime lens)', () => {
  it('calls fetch POST /api/lens-profiles with correct body including source: manual', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lensProfile: mockLensProfile }),
    } as Response)

    render(<ManualLensEntryForm {...defaultProps} />)

    const focalLengthInput = screen.getByLabelText(/focal length/i)
    await userEvent.type(focalLengthInput, '50')

    const apertureInput = screen.getByLabelText(/max aperture/i)
    await userEvent.type(apertureInput, '1.8')

    const submitButton = screen.getByRole('button', { name: /save|submit/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/lens-profiles',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"source":"manual"'),
        })
      )
    })

    // Verify body includes cameraProfileId
    const fetchCall = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]!.body as string)
    expect(body.cameraProfileId).toBe('camera-profile-abc')
    expect(body.focalLengthMm).toBe(50)
    expect(body.maxAperture).toBe(1.8)
    expect(body.minAperture).toBe(1.8)
    expect(body.source).toBe('manual')
  })

  it('calls onSuccess with returned lensProfile after successful submit', async () => {
    const onSuccess = vi.fn()

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lensProfile: mockLensProfile }),
    } as Response)

    render(
      <ManualLensEntryForm
        cameraProfileId="camera-profile-abc"
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />
    )

    const focalLengthInput = screen.getByLabelText(/focal length/i)
    await userEvent.type(focalLengthInput, '50')

    const apertureInput = screen.getByLabelText(/max aperture/i)
    await userEvent.type(apertureInput, '1.8')

    const submitButton = screen.getByRole('button', { name: /save|submit/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockLensProfile)
    })
  })

  it('sends isStabilized and stabilizationStops when IS is enabled', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lensProfile: { ...mockLensProfile, isStabilized: true, stabilizationStops: 5 } }),
    } as Response)

    render(<ManualLensEntryForm {...defaultProps} />)

    const focalLengthInput = screen.getByLabelText(/focal length/i)
    await userEvent.type(focalLengthInput, '50')

    const apertureInput = screen.getByLabelText(/max aperture/i)
    await userEvent.type(apertureInput, '1.8')

    const isToggle = screen.getByRole('checkbox', { name: /image stabilization|optical.*is|IS/i })
    await userEvent.click(isToggle)

    const isStopsInput = screen.getByLabelText(/stabilization stops|IS stops/i)
    await userEvent.type(isStopsInput, '5')

    const submitButton = screen.getByRole('button', { name: /save|submit/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const fetchCall = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]!.body as string)
    expect(body.isStabilized).toBe(true)
    expect(body.stabilizationStops).toBe(5)
  })
})

describe('Submit success (zoom lens)', () => {
  it('sends focalLengthMinMm and focalLengthMaxMm for zoom lens', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lensProfile: { ...mockLensProfile, focalLengthMinMm: 24, focalLengthMaxMm: 70, focalLengthMm: 24 } }),
    } as Response)

    render(<ManualLensEntryForm {...defaultProps} />)

    const zoomButton = screen.getByRole('button', { name: /zoom/i })
    await userEvent.click(zoomButton)

    const minFocalInput = screen.getByLabelText(/min.*focal|focal.*min/i)
    const maxFocalInput = screen.getByLabelText(/max.*focal|focal.*max/i)
    await userEvent.type(minFocalInput, '24')
    await userEvent.type(maxFocalInput, '70')

    const apertureInput = screen.getByLabelText(/max aperture/i)
    await userEvent.type(apertureInput, '2.8')

    const submitButton = screen.getByRole('button', { name: /save|submit/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const fetchCall = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(fetchCall[1]!.body as string)
    expect(body.focalLengthMinMm).toBe(24)
    expect(body.focalLengthMaxMm).toBe(70)
    expect(body.source).toBe('manual')
  })
})

// ─── Cancel ───────────────────────────────────────────────────────────────────

describe('Cancel button', () => {
  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn()

    render(
      <ManualLensEntryForm
        cameraProfileId="camera-profile-abc"
        onSuccess={vi.fn()}
        onCancel={onCancel}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await userEvent.click(cancelButton)

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does NOT call fetch when cancel is clicked', async () => {
    render(<ManualLensEntryForm {...defaultProps} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await userEvent.click(cancelButton)

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
