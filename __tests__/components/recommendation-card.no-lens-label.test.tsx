/**
 * Tests for RecommendationCard "no lens profile" amber label:
 * - Amber label "Estimated — lens profile missing" when hasActiveLens={false}
 * - Confidence score note "Accuracy improves with your lens profile" when hasActiveLens={false}
 * - Neither text rendered when hasActiveLens={true}
 */
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('@/store/ui-mode', () => ({
  useUIMode: vi.fn(() => ({ mode: 'learning' })),
}))

vi.mock('@/components/explanation-panel', () => ({
  InlineExplanationPanel: () => null,
  ExplanationSheet: () => null,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}))

vi.mock('lucide-react', () => ({
  AlertTriangle: ({ className, 'aria-hidden': ariaHidden }: { className?: string; 'aria-hidden'?: string }) => (
    <svg className={className} aria-hidden={ariaHidden} data-testid="alert-triangle" />
  ),
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

import { RecommendationCard } from '../../components/recommendation-card'
import { useUIMode } from '@/store/ui-mode'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const baseSuggestion = {
  iso: 400,
  aperture: 4.0,
  shutter: '1/500',
  whiteBalance: 'Auto',
  meteringMode: 'Evaluative',
  confidence: 85,
  primaryDriver: 'Balanced exposure',
}

function setMode(mode: 'learning' | 'quick') {
  vi.mocked(useUIMode).mockReturnValue({
    mode,
    setMode: vi.fn(),
    toggleMode: vi.fn(),
  })
}

beforeEach(() => {
  setMode('learning')
})

// ─── No lens profile: amber label ─────────────────────────────────────────────

describe('No lens profile amber label', () => {
  it('renders "Estimated — lens profile missing" when hasActiveLens={false}', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        hasActiveLens={false}
      />
    )
    expect(
      screen.getByText('Estimated — lens profile missing')
    ).toBeInTheDocument()
  })

  it('does NOT render amber label when hasActiveLens={true}', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        hasActiveLens={true}
      />
    )
    expect(
      screen.queryByText('Estimated — lens profile missing')
    ).not.toBeInTheDocument()
  })

  it('does NOT render amber label when hasActiveLens is not provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
      />
    )
    expect(
      screen.queryByText('Estimated — lens profile missing')
    ).not.toBeInTheDocument()
  })

  it('amber label element has amber styling', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        hasActiveLens={false}
      />
    )
    const labelEl = screen.getByText('Estimated — lens profile missing')
    const container = labelEl.closest('[class*="amber"]') ?? labelEl
    expect(container.className).toMatch(/amber/)
  })
})

// ─── No lens profile: confidence score note ───────────────────────────────────

describe('No lens profile confidence score note', () => {
  it('renders "Accuracy improves with your lens profile" when hasActiveLens={false}', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        hasActiveLens={false}
      />
    )
    expect(
      screen.getByText('Accuracy improves with your lens profile')
    ).toBeInTheDocument()
  })

  it('does NOT render note text when hasActiveLens={true}', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        hasActiveLens={true}
      />
    )
    expect(
      screen.queryByText('Accuracy improves with your lens profile')
    ).not.toBeInTheDocument()
  })

  it('does NOT render note text when hasActiveLens is not provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
      />
    )
    expect(
      screen.queryByText('Accuracy improves with your lens profile')
    ).not.toBeInTheDocument()
  })
})

// ─── No lens label coexists with other warnings ───────────────────────────────

describe('No lens label coexists with other warnings', () => {
  it('renders no-lens label alongside other warnings when hasActiveLens={false}', () => {
    setMode('learning')
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        hasActiveLens={false}
        apertureClampNote="f/1.4 requested but your lens maximum is f/4"
        diffractionWarning="f/16 may produce diffraction softness for A2+ print on your APS-C sensor. Consider f/8–f/11 for maximum sharpness at this output size."
      />
    )
    expect(screen.getByText('Estimated — lens profile missing')).toBeInTheDocument()
    expect(screen.getByText('Accuracy improves with your lens profile')).toBeInTheDocument()
    expect(screen.getByText(/requested but your lens maximum/)).toBeInTheDocument()
    expect(screen.getByText(/diffraction softness/)).toBeInTheDocument()
  })
})
