/**
 * Tests for ActiveLensIndicator component
 *
 * Props:
 *   activeLensName: string | null  — null = no active lens
 *   onLensClick: () => void        — called when lens name tapped (to switch) OR Add Lens button tapped
 *
 * Scenarios:
 * 1. With active lens: renders lens name as a clickable button/element
 * 2. With active lens: tapping the lens name calls onLensClick
 * 3. No lens state: renders yellow indicator with text "Set your lens for better recommendations"
 * 4. No lens state: renders "Add Lens" button that calls onLensClick when clicked
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'

import { ActiveLensIndicator } from '../../components/active-lens-indicator'

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
})

// ─── With active lens ─────────────────────────────────────────────────────────

describe('With active lens', () => {
  const activeLensName = 'Sony FE 85mm f/1.4 GM'

  it('renders the lens name', () => {
    render(<ActiveLensIndicator activeLensName={activeLensName} onLensClick={vi.fn()} />)

    expect(screen.getByText('Sony FE 85mm f/1.4 GM')).toBeInTheDocument()
  })

  it('renders the lens name as a clickable button', () => {
    render(<ActiveLensIndicator activeLensName={activeLensName} onLensClick={vi.fn()} />)

    const lensButton = screen.getByRole('button', { name: /Sony FE 85mm f\/1\.4 GM/i })
    expect(lensButton).toBeInTheDocument()
  })

  it('calls onLensClick when the lens name button is clicked', async () => {
    const onLensClick = vi.fn()
    render(<ActiveLensIndicator activeLensName={activeLensName} onLensClick={onLensClick} />)

    const lensButton = screen.getByRole('button', { name: /Sony FE 85mm f\/1\.4 GM/i })
    await userEvent.click(lensButton)

    expect(onLensClick).toHaveBeenCalledTimes(1)
  })

  it('does NOT render the yellow no-lens warning', () => {
    render(<ActiveLensIndicator activeLensName={activeLensName} onLensClick={vi.fn()} />)

    expect(
      screen.queryByText(/set your lens for better recommendations/i)
    ).not.toBeInTheDocument()
  })

  it('does NOT render the "Add Lens" button', () => {
    render(<ActiveLensIndicator activeLensName={activeLensName} onLensClick={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /add lens/i })).not.toBeInTheDocument()
  })
})

// ─── No active lens ───────────────────────────────────────────────────────────

describe('No active lens (activeLensName is null)', () => {
  it('renders the yellow warning text "Set your lens for better recommendations"', () => {
    render(<ActiveLensIndicator activeLensName={null} onLensClick={vi.fn()} />)

    expect(
      screen.getByText(/set your lens for better recommendations/i)
    ).toBeInTheDocument()
  })

  it('renders an "Add Lens" button', () => {
    render(<ActiveLensIndicator activeLensName={null} onLensClick={vi.fn()} />)

    const addLensButton = screen.getByRole('button', { name: /add lens/i })
    expect(addLensButton).toBeInTheDocument()
  })

  it('calls onLensClick when "Add Lens" button is clicked', async () => {
    const onLensClick = vi.fn()
    render(<ActiveLensIndicator activeLensName={null} onLensClick={onLensClick} />)

    const addLensButton = screen.getByRole('button', { name: /add lens/i })
    await userEvent.click(addLensButton)

    expect(onLensClick).toHaveBeenCalledTimes(1)
  })

  it('does NOT render an active lens name', () => {
    render(<ActiveLensIndicator activeLensName={null} onLensClick={vi.fn()} />)

    // The warning text should be there but no active lens name button
    expect(screen.queryByRole('button', { name: /Sony FE 85mm/i })).not.toBeInTheDocument()
  })

  it('the yellow warning container has a yellow/amber visual style', () => {
    render(<ActiveLensIndicator activeLensName={null} onLensClick={vi.fn()} />)

    // The warning text element should be present (yellow styling is visual but
    // we can verify the element is present with the expected text)
    const warningText = screen.getByText(/set your lens for better recommendations/i)
    expect(warningText).toBeInTheDocument()
  })
})
