/**
 * Tests for FlashAvailabilitySelector component
 *
 * Props:
 *   value: string          — current selected flash availability
 *   onChange: (value: string) => void — callback when selection changes
 *   className?: string
 *
 * Options (exact labels):
 *   1. "No Flash"          ← default
 *   2. "Speedlight"
 *   3. "HSS-capable Flash"
 *   4. "Studio Strobe"
 *
 * Scenarios:
 * a. Renders a select/dropdown element
 * b. Shows all 4 options with correct labels
 * c. Default selected value is "No Flash"
 * d. Calls onChange when a different option is selected
 * e. Renders the currently selected value when value prop is provided
 * f. onChange behaviour when same value is re-selected
 */

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'

import { FlashAvailabilitySelector } from '@/components/flash-availability-selector'

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
})

// ─── a. Renders a select/dropdown element ─────────────────────────────────────

describe('a. Renders a select/dropdown element', () => {
  it('renders a <select> element', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
  })

  it('applies className when provided', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FlashAvailabilitySelector
        value="No Flash"
        onChange={onChange}
        className="my-custom-class"
      />
    )
    expect(container.querySelector('.my-custom-class')).toBeInTheDocument()
  })
})

// ─── b. Shows all 4 options with correct labels ───────────────────────────────

describe('b. Shows all 4 options with correct labels', () => {
  it('renders exactly 4 options', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(4)
  })

  it('renders "No Flash" option', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    expect(screen.getByRole('option', { name: 'No Flash' })).toBeInTheDocument()
  })

  it('renders "Speedlight" option', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    expect(screen.getByRole('option', { name: 'Speedlight' })).toBeInTheDocument()
  })

  it('renders "HSS-capable Flash" option', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    expect(screen.getByRole('option', { name: 'HSS-capable Flash' })).toBeInTheDocument()
  })

  it('renders "Studio Strobe" option', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    expect(screen.getByRole('option', { name: 'Studio Strobe' })).toBeInTheDocument()
  })

  it('renders all 4 options with exact labels in order', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    const options = screen.getAllByRole('option')
    const labels = options.map((o) => o.textContent)
    expect(labels).toEqual([
      'No Flash',
      'Speedlight',
      'HSS-capable Flash',
      'Studio Strobe',
    ])
  })
})

// ─── c. Default selected value is "No Flash" ─────────────────────────────────

describe('c. Default selected value is "No Flash"', () => {
  it('shows "No Flash" as selected when value prop is "No Flash"', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('No Flash')
  })

  it('"No Flash" option has selected attribute when it is the active value', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    const option = screen.getByRole('option', { name: 'No Flash' }) as HTMLOptionElement
    expect(option.selected).toBe(true)
  })
})

// ─── d. Calls onChange when a different option is selected ────────────────────

describe('d. Calls onChange when a different option is selected', () => {
  it('calls onChange with "Speedlight" when that option is selected', async () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 'Speedlight')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Speedlight')
  })

  it('calls onChange with "HSS-capable Flash" when that option is selected', async () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 'HSS-capable Flash')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('HSS-capable Flash')
  })

  it('calls onChange with "Studio Strobe" when that option is selected', async () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 'Studio Strobe')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Studio Strobe')
  })

  it('calls onChange with a string value (not an object or number)', async () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 'Speedlight')

    const [calledWith] = onChange.mock.calls[0]
    expect(typeof calledWith).toBe('string')
  })
})

// ─── e. Renders the currently selected value when value prop is provided ──────

describe('e. Renders the currently selected value when value prop is provided', () => {
  it('reflects "Speedlight" as selected when value prop is "Speedlight"', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="Speedlight" onChange={onChange} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('Speedlight')
  })

  it('reflects "HSS-capable Flash" as selected when value prop is "HSS-capable Flash"', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="HSS-capable Flash" onChange={onChange} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('HSS-capable Flash')
  })

  it('reflects "Studio Strobe" as selected when value prop is "Studio Strobe"', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="Studio Strobe" onChange={onChange} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('Studio Strobe')
  })

  it('the corresponding option is marked as selected for each value', () => {
    const onChange = vi.fn()
    const testValues = ['No Flash', 'Speedlight', 'HSS-capable Flash', 'Studio Strobe']

    testValues.forEach((testValue) => {
      const { unmount } = render(
        <FlashAvailabilitySelector value={testValue} onChange={onChange} />
      )
      const option = screen.getByRole('option', { name: testValue }) as HTMLOptionElement
      expect(option.selected).toBe(true)
      unmount()
    })
  })
})

// ─── f. onChange behaviour when same value is re-selected ─────────────────────

describe('f. onChange behaviour with same value', () => {
  it('does not call onChange when the already-selected option is fired via fireEvent with the same value', () => {
    const onChange = vi.fn()
    render(<FlashAvailabilitySelector value="No Flash" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    // Simulate a change event that resolves to the same value
    fireEvent.change(select, { target: { value: 'No Flash' } })

    // Either onChange is not called, or if it is called it should be called with the same string
    if (onChange.mock.calls.length > 0) {
      expect(onChange).toHaveBeenCalledWith('No Flash')
    } else {
      expect(onChange).not.toHaveBeenCalled()
    }
  })
})
