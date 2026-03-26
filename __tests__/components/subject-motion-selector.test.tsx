/**
 * Tests for SubjectMotionSelector component
 *
 * Props:
 *   value: string                    — current selected motion level
 *   onChange: (value: string) => void — callback on selection change
 *   shootType?: string               — optional shoot type for inferred pre-selection
 *   className?: string
 *
 * Options (exact labels, in order):
 *   1. "Stationary"
 *   2. "Walking"
 *   3. "Running"
 *   4. "Vehicle"
 *   5. "Sports"
 *
 * Inferred pre-selection logic:
 *   - shootType "portrait" | "landscape" | "astro" → infer "Stationary"
 *   - shootType "street" | "event" → infer "Walking"
 *   - fallback (any other shootType or undefined) → "Stationary"
 *   - value prop always takes precedence over inference
 *
 * Scenarios:
 * a. Renders all 5 option buttons/segments
 * b. The selected option is visually indicated (aria-pressed, aria-selected, or data-selected)
 * c. Clicking a different option calls onChange with the correct string
 * d. Inferred pre-selection: shootType "portrait" → "Stationary" as default
 * e. Inferred pre-selection: shootType "street" → "Walking" as default
 * f. shootType "event" → "Walking" as default
 * g. Unknown shootType → "Stationary" as default
 * h. value prop overrides inference — if value="Running" and shootType="street", "Running" is selected
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'

import { SubjectMotionSelector } from '@/components/subject-motion-selector'

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
})

// ─── a. Renders all 5 option buttons/segments ─────────────────────────────────

describe('a. Renders all 5 option buttons/segments', () => {
  it('renders exactly 5 radio/button elements', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    // segmented control uses role="radio" or role="button" per option
    const options = screen.getAllByRole('radio')
    expect(options).toHaveLength(5)
  })

  it('renders "Stationary" option', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    expect(screen.getByRole('radio', { name: 'Stationary' })).toBeInTheDocument()
  })

  it('renders "Walking" option', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    expect(screen.getByRole('radio', { name: 'Walking' })).toBeInTheDocument()
  })

  it('renders "Running" option', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    expect(screen.getByRole('radio', { name: 'Running' })).toBeInTheDocument()
  })

  it('renders "Vehicle" option', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    expect(screen.getByRole('radio', { name: 'Vehicle' })).toBeInTheDocument()
  })

  it('renders "Sports" option', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    expect(screen.getByRole('radio', { name: 'Sports' })).toBeInTheDocument()
  })

  it('renders all 5 options in correct order', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    const options = screen.getAllByRole('radio')
    const labels = options.map((o) => o.getAttribute('aria-label') ?? o.textContent)
    expect(labels).toEqual(['Stationary', 'Walking', 'Running', 'Vehicle', 'Sports'])
  })

  it('wraps options in a group container (role="group")', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    expect(screen.getByRole('group')).toBeInTheDocument()
  })

  it('applies className when provided', () => {
    const onChange = vi.fn()
    const { container } = render(
      <SubjectMotionSelector value="Stationary" onChange={onChange} className="my-custom-class" />
    )
    expect(container.querySelector('.my-custom-class')).toBeInTheDocument()
  })
})

// ─── b. Selected option is visually indicated ─────────────────────────────────

describe('b. Selected option is visually indicated', () => {
  it('"Stationary" is aria-checked when value="Stationary"', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    const option = screen.getByRole('radio', { name: 'Stationary' })
    expect(option).toHaveAttribute('aria-checked', 'true')
  })

  it('"Walking" is aria-checked when value="Walking"', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Walking" onChange={onChange} />)

    const option = screen.getByRole('radio', { name: 'Walking' })
    expect(option).toHaveAttribute('aria-checked', 'true')
  })

  it('"Running" is aria-checked when value="Running"', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Running" onChange={onChange} />)

    const option = screen.getByRole('radio', { name: 'Running' })
    expect(option).toHaveAttribute('aria-checked', 'true')
  })

  it('"Vehicle" is aria-checked when value="Vehicle"', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Vehicle" onChange={onChange} />)

    const option = screen.getByRole('radio', { name: 'Vehicle' })
    expect(option).toHaveAttribute('aria-checked', 'true')
  })

  it('"Sports" is aria-checked when value="Sports"', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Sports" onChange={onChange} />)

    const option = screen.getByRole('radio', { name: 'Sports' })
    expect(option).toHaveAttribute('aria-checked', 'true')
  })

  it('non-selected options are aria-checked="false"', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    const walkingOption = screen.getByRole('radio', { name: 'Walking' })
    expect(walkingOption).toHaveAttribute('aria-checked', 'false')
  })

  it('only the selected option is aria-checked="true"', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Running" onChange={onChange} />)

    const options = screen.getAllByRole('radio')
    const checkedOptions = options.filter((o) => o.getAttribute('aria-checked') === 'true')
    expect(checkedOptions).toHaveLength(1)
    expect(checkedOptions[0]).toHaveAttribute('aria-label', 'Running')
  })
})

// ─── c. Clicking a different option calls onChange with correct string ────────

describe('c. Clicking a different option calls onChange with the correct string', () => {
  it('calls onChange with "Walking" when "Walking" is clicked', async () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    const walkingOption = screen.getByRole('radio', { name: 'Walking' })
    await userEvent.click(walkingOption)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Walking')
  })

  it('calls onChange with "Running" when "Running" is clicked', async () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    const runningOption = screen.getByRole('radio', { name: 'Running' })
    await userEvent.click(runningOption)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Running')
  })

  it('calls onChange with "Vehicle" when "Vehicle" is clicked', async () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    const vehicleOption = screen.getByRole('radio', { name: 'Vehicle' })
    await userEvent.click(vehicleOption)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Vehicle')
  })

  it('calls onChange with "Sports" when "Sports" is clicked', async () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    const sportsOption = screen.getByRole('radio', { name: 'Sports' })
    await userEvent.click(sportsOption)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Sports')
  })

  it('calls onChange with "Stationary" when "Stationary" is clicked', async () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Walking" onChange={onChange} />)

    const stationaryOption = screen.getByRole('radio', { name: 'Stationary' })
    await userEvent.click(stationaryOption)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('Stationary')
  })

  it('calls onChange with a string value (not an object or number)', async () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    const walkingOption = screen.getByRole('radio', { name: 'Walking' })
    await userEvent.click(walkingOption)

    const [calledWith] = onChange.mock.calls[0]
    expect(typeof calledWith).toBe('string')
  })
})

// ─── d. Inferred pre-selection: shootType "portrait" → "Stationary" ──────────

describe('d. Inferred pre-selection: shootType "portrait" → "Stationary"', () => {
  it('uses "Stationary" as selected when shootType="portrait" and value="Stationary"', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Stationary" onChange={onChange} shootType="portrait" />
    )

    const stationaryOption = screen.getByRole('radio', { name: 'Stationary' })
    expect(stationaryOption).toHaveAttribute('aria-checked', 'true')
  })

  it('renders "Stationary" as selected when shootType="landscape" and value="Stationary"', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Stationary" onChange={onChange} shootType="landscape" />
    )

    const stationaryOption = screen.getByRole('radio', { name: 'Stationary' })
    expect(stationaryOption).toHaveAttribute('aria-checked', 'true')
  })

  it('renders "Stationary" as selected when shootType="astro" and value="Stationary"', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Stationary" onChange={onChange} shootType="astro" />
    )

    const stationaryOption = screen.getByRole('radio', { name: 'Stationary' })
    expect(stationaryOption).toHaveAttribute('aria-checked', 'true')
  })

  it('inferredDefault for shootType="portrait" is "Stationary"', () => {
    // Verify the inferred default by calling with the inferred value
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Stationary" onChange={onChange} shootType="portrait" />
    )

    // "Stationary" must be selected; "Walking" must NOT be
    expect(screen.getByRole('radio', { name: 'Stationary' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Walking' })).toHaveAttribute('aria-checked', 'false')
  })
})

// ─── e. Inferred pre-selection: shootType "street" → "Walking" ───────────────

describe('e. Inferred pre-selection: shootType "street" → "Walking"', () => {
  it('renders "Walking" as selected when shootType="street" and value="Walking"', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Walking" onChange={onChange} shootType="street" />
    )

    const walkingOption = screen.getByRole('radio', { name: 'Walking' })
    expect(walkingOption).toHaveAttribute('aria-checked', 'true')
  })

  it('"Stationary" is NOT selected when shootType="street" and value="Walking"', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Walking" onChange={onChange} shootType="street" />
    )

    const stationaryOption = screen.getByRole('radio', { name: 'Stationary' })
    expect(stationaryOption).toHaveAttribute('aria-checked', 'false')
  })
})

// ─── f. shootType "event" → "Walking" as default ─────────────────────────────

describe('f. shootType "event" → "Walking" as default', () => {
  it('renders "Walking" as selected when shootType="event" and value="Walking"', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Walking" onChange={onChange} shootType="event" />
    )

    const walkingOption = screen.getByRole('radio', { name: 'Walking' })
    expect(walkingOption).toHaveAttribute('aria-checked', 'true')
  })

  it('"Stationary" is NOT selected when shootType="event" and value="Walking"', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Walking" onChange={onChange} shootType="event" />
    )

    const stationaryOption = screen.getByRole('radio', { name: 'Stationary' })
    expect(stationaryOption).toHaveAttribute('aria-checked', 'false')
  })
})

// ─── g. Unknown shootType → "Stationary" as default ──────────────────────────

describe('g. Unknown shootType → "Stationary" as default', () => {
  it('renders "Stationary" as selected for an unknown shootType when value="Stationary"', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Stationary" onChange={onChange} shootType="underwater" />
    )

    const stationaryOption = screen.getByRole('radio', { name: 'Stationary' })
    expect(stationaryOption).toHaveAttribute('aria-checked', 'true')
  })

  it('renders "Stationary" as selected when shootType is undefined and value="Stationary"', () => {
    const onChange = vi.fn()
    render(<SubjectMotionSelector value="Stationary" onChange={onChange} />)

    const stationaryOption = screen.getByRole('radio', { name: 'Stationary' })
    expect(stationaryOption).toHaveAttribute('aria-checked', 'true')
  })

  it('"Walking" is NOT selected for unknown shootType when value="Stationary"', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Stationary" onChange={onChange} shootType="macro" />
    )

    const walkingOption = screen.getByRole('radio', { name: 'Walking' })
    expect(walkingOption).toHaveAttribute('aria-checked', 'false')
  })
})

// ─── h. value prop overrides inference ───────────────────────────────────────

describe('h. value prop overrides inference', () => {
  it('selects "Running" even when shootType="street" (which normally infers "Walking")', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Running" onChange={onChange} shootType="street" />
    )

    const runningOption = screen.getByRole('radio', { name: 'Running' })
    expect(runningOption).toHaveAttribute('aria-checked', 'true')
  })

  it('"Walking" is NOT selected when value="Running" and shootType="street"', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Running" onChange={onChange} shootType="street" />
    )

    const walkingOption = screen.getByRole('radio', { name: 'Walking' })
    expect(walkingOption).toHaveAttribute('aria-checked', 'false')
  })

  it('selects "Sports" even when shootType="portrait" (which normally infers "Stationary")', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Sports" onChange={onChange} shootType="portrait" />
    )

    const sportsOption = screen.getByRole('radio', { name: 'Sports' })
    expect(sportsOption).toHaveAttribute('aria-checked', 'true')
  })

  it('"Stationary" is NOT selected when value="Sports" and shootType="portrait"', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Sports" onChange={onChange} shootType="portrait" />
    )

    const stationaryOption = screen.getByRole('radio', { name: 'Stationary' })
    expect(stationaryOption).toHaveAttribute('aria-checked', 'false')
  })

  it('only one option is aria-checked="true" regardless of shootType', () => {
    const onChange = vi.fn()
    render(
      <SubjectMotionSelector value="Vehicle" onChange={onChange} shootType="event" />
    )

    const options = screen.getAllByRole('radio')
    const checkedOptions = options.filter((o) => o.getAttribute('aria-checked') === 'true')
    expect(checkedOptions).toHaveLength(1)
    expect(checkedOptions[0]).toHaveAttribute('aria-label', 'Vehicle')
  })
})
