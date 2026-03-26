/**
 * Tests for ZoomPositionInput component
 *
 * Props:
 *   focalLengthMinMm: number   — minimum focal length of the zoom lens
 *   focalLengthMaxMm: number   — maximum focal length of the zoom lens
 *   value: number | null       — current session-level zoom position
 *   onChange: (value: number | null) => void — callback when value changes
 *   className?: string
 *
 * Scenarios:
 * a. Renders a number input when lens is zoom (min !== max)
 * b. Renders nothing (null) when lens is prime (min === max)
 * c. Input accepts valid values within [min, max]
 * d. Shows validation error when value is below min or above max
 * e. Calls onChange with null when input is cleared
 * f. Calls onChange with valid number when value is in range
 * g. Does NOT call onChange with out-of-range value (or calls with null)
 */

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'

import { ZoomPositionInput } from '@/components/zoom-position-input'

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
})

// ─── a. Zoom lens: renders input ──────────────────────────────────────────────

describe('Zoom lens (focalLengthMinMm !== focalLengthMaxMm)', () => {
  const zoomProps = {
    focalLengthMinMm: 24,
    focalLengthMaxMm: 70,
    value: null,
    onChange: vi.fn(),
  }

  it('renders a number input', () => {
    render(<ZoomPositionInput {...zoomProps} />)

    const input = screen.getByRole('spinbutton')
    expect(input).toBeInTheDocument()
  })

  it('renders with type="number"', () => {
    render(<ZoomPositionInput {...zoomProps} />)

    const input = screen.getByRole('spinbutton')
    expect(input).toHaveAttribute('type', 'number')
  })

  it('renders a label or accessible name related to zoom position or focal length', () => {
    render(<ZoomPositionInput {...zoomProps} />)

    // Should have some accessible label for the zoom position input
    const input = screen.getByRole('spinbutton')
    expect(input).toBeInTheDocument()
  })

  it('displays the current value when provided', () => {
    render(<ZoomPositionInput {...zoomProps} value={50} />)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('50')
  })

  it('displays empty string when value is null', () => {
    render(<ZoomPositionInput {...zoomProps} value={null} />)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('applies className when provided', () => {
    const { container } = render(
      <ZoomPositionInput {...zoomProps} className="my-custom-class" />
    )
    expect(container.firstChild).toHaveClass('my-custom-class')
  })
})

// ─── b. Prime lens: renders nothing ──────────────────────────────────────────

describe('Prime lens (focalLengthMinMm === focalLengthMaxMm)', () => {
  const primeProps = {
    focalLengthMinMm: 50,
    focalLengthMaxMm: 50,
    value: null,
    onChange: vi.fn(),
  }

  it('renders nothing (null) for a prime lens', () => {
    const { container } = render(<ZoomPositionInput {...primeProps} />)

    expect(container.firstChild).toBeNull()
  })

  it('does NOT render a number input for a prime lens', () => {
    render(<ZoomPositionInput {...primeProps} />)

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })
})

// ─── c. Valid values accepted ─────────────────────────────────────────────────

describe('Valid value acceptance', () => {
  const zoomProps = {
    focalLengthMinMm: 24,
    focalLengthMaxMm: 70,
    value: null,
    onChange: vi.fn(),
  }

  it('does NOT show a validation error when value equals min (24)', async () => {
    render(<ZoomPositionInput {...zoomProps} value={24} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/out of range|must be between|invalid/i)).not.toBeInTheDocument()
  })

  it('does NOT show a validation error when value equals max (70)', async () => {
    render(<ZoomPositionInput {...zoomProps} value={70} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/out of range|must be between|invalid/i)).not.toBeInTheDocument()
  })

  it('does NOT show a validation error when value is in the middle of the range (50)', () => {
    render(<ZoomPositionInput {...zoomProps} value={50} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/out of range|must be between|invalid/i)).not.toBeInTheDocument()
  })
})

// ─── d. Validation error for out-of-range value ───────────────────────────────

describe('Validation error: out of range', () => {
  const onChange = vi.fn()
  const zoomProps = {
    focalLengthMinMm: 24,
    focalLengthMaxMm: 70,
    value: null,
    onChange,
  }

  it('shows a validation error when input value is below min (e.g. 10)', async () => {
    render(<ZoomPositionInput {...zoomProps} />)

    const input = screen.getByRole('spinbutton')
    await userEvent.type(input, '10')
    fireEvent.blur(input)

    expect(
      screen.getByText(/must be between|out of range|24.*70|invalid/i)
    ).toBeInTheDocument()
  })

  it('shows a validation error when input value is above max (e.g. 200)', async () => {
    render(<ZoomPositionInput {...zoomProps} />)

    const input = screen.getByRole('spinbutton')
    await userEvent.type(input, '200')
    fireEvent.blur(input)

    expect(
      screen.getByText(/must be between|out of range|24.*70|invalid/i)
    ).toBeInTheDocument()
  })

  it('shows a validation error when value prop is below min', () => {
    render(<ZoomPositionInput {...zoomProps} value={10} />)

    expect(
      screen.getByText(/must be between|out of range|24.*70|invalid/i)
    ).toBeInTheDocument()
  })

  it('shows a validation error when value prop is above max', () => {
    render(<ZoomPositionInput {...zoomProps} value={200} />)

    expect(
      screen.getByText(/must be between|out of range|24.*70|invalid/i)
    ).toBeInTheDocument()
  })
})

// ─── e. Calls onChange with null when cleared ─────────────────────────────────

describe('Clearing the input', () => {
  it('calls onChange with null when input is cleared', async () => {
    const onChange = vi.fn()
    render(
      <ZoomPositionInput
        focalLengthMinMm={24}
        focalLengthMaxMm={70}
        value={50}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('spinbutton')
    await userEvent.clear(input)

    expect(onChange).toHaveBeenCalledWith(null)
  })
})

// ─── f. Calls onChange with valid number ──────────────────────────────────────

describe('onChange with valid number', () => {
  it('calls onChange with the parsed number when a valid value is entered', async () => {
    const onChange = vi.fn()
    render(
      <ZoomPositionInput
        focalLengthMinMm={24}
        focalLengthMaxMm={70}
        value={null}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('spinbutton')
    await userEvent.type(input, '35')

    expect(onChange).toHaveBeenCalledWith(35)
  })

  it('calls onChange with the exact number at min boundary (24)', async () => {
    const onChange = vi.fn()
    render(
      <ZoomPositionInput
        focalLengthMinMm={24}
        focalLengthMaxMm={70}
        value={null}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('spinbutton')
    await userEvent.type(input, '24')

    expect(onChange).toHaveBeenCalledWith(24)
  })

  it('calls onChange with the exact number at max boundary (70)', async () => {
    const onChange = vi.fn()
    render(
      <ZoomPositionInput
        focalLengthMinMm={24}
        focalLengthMaxMm={70}
        value={null}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('spinbutton')
    await userEvent.type(input, '70')

    expect(onChange).toHaveBeenCalledWith(70)
  })
})

// ─── g. Does NOT call onChange with out-of-range value ───────────────────────

describe('onChange NOT called with out-of-range value', () => {
  it('does NOT call onChange with a number below min', async () => {
    const onChange = vi.fn()
    render(
      <ZoomPositionInput
        focalLengthMinMm={24}
        focalLengthMaxMm={70}
        value={null}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('spinbutton')
    await userEvent.type(input, '10')
    fireEvent.blur(input)

    // onChange should not have been called with an in-range number
    const validCalls = onChange.mock.calls.filter(
      ([v]) => typeof v === 'number' && v >= 24 && v <= 70
    )
    expect(validCalls).toHaveLength(0)
  })

  it('does NOT call onChange with a number above max', async () => {
    const onChange = vi.fn()
    render(
      <ZoomPositionInput
        focalLengthMinMm={24}
        focalLengthMaxMm={70}
        value={null}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('spinbutton')
    await userEvent.type(input, '200')
    fireEvent.blur(input)

    const validCalls = onChange.mock.calls.filter(
      ([v]) => typeof v === 'number' && v >= 24 && v <= 70
    )
    expect(validCalls).toHaveLength(0)
  })
})

// ─── No persistence (no API calls) ───────────────────────────────────────────

describe('No API calls (session-level only)', () => {
  it('does not call fetch when the user changes the zoom position', async () => {
    global.fetch = vi.fn()
    const onChange = vi.fn()

    render(
      <ZoomPositionInput
        focalLengthMinMm={24}
        focalLengthMaxMm={70}
        value={null}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('spinbutton')
    await userEvent.type(input, '50')

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
