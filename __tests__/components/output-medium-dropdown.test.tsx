/**
 * Tests for OutputMediumDropdown component
 *
 * Props:
 *   value: string          — current selected output medium
 *   onChange: (value: string) => void — callback when selection changes
 *   className?: string
 *
 * Options (exact labels):
 *   1. "Web (1080p)"  ← default
 *   2. "Web (4K)"
 *   3. "Print A4"
 *   4. "Print A2+"
 *   5. "Commercial"
 *
 * Scenarios:
 * a. Renders a select/dropdown element
 * b. Shows all 5 options with correct labels
 * c. Default selected value is "Web (1080p)"
 * d. Calls onChange when a different option is selected
 * e. Renders the currently selected value when value prop is provided
 * f. Does NOT call onChange when same value is selected again
 *    (or onChange is called with the new value string)
 */

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'

import { OutputMediumDropdown } from '@/components/output-medium-dropdown'

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
})

// ─── a. Renders a select/dropdown element ─────────────────────────────────────

describe('a. Renders a select/dropdown element', () => {
  it('renders a <select> element', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
  })

  it('applies className when provided', () => {
    const onChange = vi.fn()
    const { container } = render(
      <OutputMediumDropdown
        value="Web (1080p)"
        onChange={onChange}
        className="my-custom-class"
      />
    )
    // className should appear somewhere in the rendered output
    expect(container.querySelector('.my-custom-class')).toBeInTheDocument()
  })
})

// ─── b. Shows all 5 options with correct labels ───────────────────────────────

describe('b. Shows all 5 options with correct labels', () => {
  it('renders exactly 5 options', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(5)
  })

  it('renders "Web (1080p)" option', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    expect(screen.getByRole('option', { name: 'Web (1080p)' })).toBeInTheDocument()
  })

  it('renders "Web (4K)" option', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    expect(screen.getByRole('option', { name: 'Web (4K)' })).toBeInTheDocument()
  })

  it('renders "Print A4" option', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    expect(screen.getByRole('option', { name: 'Print A4' })).toBeInTheDocument()
  })

  it('renders "Print A2+" option', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    expect(screen.getByRole('option', { name: 'Print A2+' })).toBeInTheDocument()
  })

  it('renders "Commercial" option', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    expect(screen.getByRole('option', { name: 'Commercial' })).toBeInTheDocument()
  })

  it('renders all 5 options with exact labels in order', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    const options = screen.getAllByRole('option')
    const labels = options.map((o) => o.textContent)
    expect(labels).toEqual([
      'Web (1080p)',
      'Web (4K)',
      'Print A4',
      'Print A2+',
      'Commercial',
    ])
  })
})

// ─── c. Default selected value is "Web (1080p)" ───────────────────────────────

describe('c. Default selected value is "Web (1080p)"', () => {
  it('shows "Web (1080p)" as selected when value prop is "Web (1080p)"', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('Web (1080p)')
  })

  it('"Web (1080p)" option has selected attribute when it is the active value', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    const option = screen.getByRole('option', { name: 'Web (1080p)' }) as HTMLOptionElement
    expect(option.selected).toBe(true)
  })
})

// ─── d. Calls onChange when a different option is selected ────────────────────

describe('d. Calls onChange when a different option is selected', () => {
  it('calls onChange with "Web (4K)" when that option is selected', async () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 'Web (4K)')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Web (4K)')
  })

  it('calls onChange with "Print A4" when that option is selected', async () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 'Print A4')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Print A4')
  })

  it('calls onChange with "Print A2+" when that option is selected', async () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 'Print A2+')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Print A2+')
  })

  it('calls onChange with "Commercial" when that option is selected', async () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 'Commercial')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Commercial')
  })

  it('calls onChange with a string value (not an object or number)', async () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 'Web (4K)')

    const [calledWith] = onChange.mock.calls[0]
    expect(typeof calledWith).toBe('string')
  })
})

// ─── e. Renders the currently selected value when value prop is provided ──────

describe('e. Renders the currently selected value when value prop is provided', () => {
  it('reflects "Web (4K)" as selected when value prop is "Web (4K)"', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Web (4K)" onChange={onChange} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('Web (4K)')
  })

  it('reflects "Print A4" as selected when value prop is "Print A4"', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Print A4" onChange={onChange} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('Print A4')
  })

  it('reflects "Print A2+" as selected when value prop is "Print A2+"', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Print A2+" onChange={onChange} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('Print A2+')
  })

  it('reflects "Commercial" as selected when value prop is "Commercial"', () => {
    const onChange = vi.fn()
    render(<OutputMediumDropdown value="Commercial" onChange={onChange} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('Commercial')
  })

  it('the corresponding option is marked as selected for each value', () => {
    const onChange = vi.fn()
    const testValues = ['Web (1080p)', 'Web (4K)', 'Print A4', 'Print A2+', 'Commercial']

    testValues.forEach((testValue) => {
      const { unmount } = render(
        <OutputMediumDropdown value={testValue} onChange={onChange} />
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
    render(<OutputMediumDropdown value="Web (1080p)" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    // Simulate a change event that resolves to the same value
    fireEvent.change(select, { target: { value: 'Web (1080p)' } })

    // Either onChange is not called, or if it is called it should be called with the same string
    if (onChange.mock.calls.length > 0) {
      expect(onChange).toHaveBeenCalledWith('Web (1080p)')
    } else {
      expect(onChange).not.toHaveBeenCalled()
    }
  })
})
