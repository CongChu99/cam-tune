/**
 * Tests for RecommendationCard inline warnings:
 * - Aperture clamp note (amber text below aperture value)
 * - Flash sync warning (inline next to shutter speed)
 * - Diffraction warning (amber warning box on card)
 * - IBIS estimated focal length soft prompt
 * - Learning Mode only: stabilization cap note, dual-native ISO hint
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

// ─── Aperture clamp note ──────────────────────────────────────────────────────

describe('Aperture clamp note', () => {
  it('shows amber clamp note text below aperture when apertureClampNote is provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        apertureClampNote="f/1.4 requested but your lens maximum is f/4"
      />
    )
    expect(
      screen.getByText('f/1.4 requested but your lens maximum is f/4')
    ).toBeInTheDocument()
  })

  it('does NOT show clamp note when apertureClampNote is null', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        apertureClampNote={null}
      />
    )
    expect(
      screen.queryByText(/requested but your lens maximum/)
    ).not.toBeInTheDocument()
  })

  it('does NOT show clamp note when apertureClampNote is not provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
      />
    )
    expect(
      screen.queryByText(/requested but your lens maximum/)
    ).not.toBeInTheDocument()
  })

  it('clamp note element has amber styling', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        apertureClampNote="f/1.4 requested but your lens maximum is f/4"
      />
    )
    const noteEl = screen.getByText('f/1.4 requested but your lens maximum is f/4')
    expect(noteEl.className).toMatch(/amber/)
  })
})

// ─── Flash sync warning ───────────────────────────────────────────────────────

describe('Flash sync warning', () => {
  it('shows flash sync warning inline when flashSyncWarning is provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        flashSyncWarning="1/500s exceeds flash sync speed (~1/200s). Lower shutter to 1/200s or use an HSS-capable flash."
      />
    )
    expect(
      screen.getByText(/1\/500s exceeds flash sync speed/)
    ).toBeInTheDocument()
  })

  it('does NOT show flash sync warning when flashSyncWarning is null', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        flashSyncWarning={null}
      />
    )
    expect(
      screen.queryByText(/exceeds flash sync speed/)
    ).not.toBeInTheDocument()
  })

  it('does NOT show flash sync warning when prop is not provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
      />
    )
    expect(
      screen.queryByText(/exceeds flash sync speed/)
    ).not.toBeInTheDocument()
  })

  it('flash sync warning appears near the shutter speed row (inline)', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        flashSyncWarning="1/500s exceeds flash sync speed (~1/200s). Lower shutter to 1/200s or use an HSS-capable flash."
      />
    )
    // Both shutter value and flash warning should be present in the document
    expect(screen.getByText('1/500s')).toBeInTheDocument()
    expect(screen.getByText(/1\/500s exceeds flash sync speed/)).toBeInTheDocument()
  })
})

// ─── Diffraction warning ──────────────────────────────────────────────────────

describe('Diffraction warning', () => {
  const diffractionText =
    'f/16 may produce diffraction softness for A2+ print on your APS-C sensor. Consider f/8–f/11 for maximum sharpness at this output size.'

  it('shows diffraction warning box when diffractionWarning is provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        diffractionWarning={diffractionText}
      />
    )
    expect(screen.getByText(diffractionText)).toBeInTheDocument()
  })

  it('does NOT show diffraction warning when diffractionWarning is null', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        diffractionWarning={null}
      />
    )
    expect(screen.queryByText(/diffraction softness/)).not.toBeInTheDocument()
  })

  it('does NOT show diffraction warning when prop is not provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
      />
    )
    expect(screen.queryByText(/diffraction softness/)).not.toBeInTheDocument()
  })

  it('diffraction warning box has amber styling', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        diffractionWarning={diffractionText}
      />
    )
    const warningEl = screen.getByText(diffractionText)
    // The warning or its container should have amber styling
    const container = warningEl.closest('[class*="amber"]') ?? warningEl
    expect(container.className).toMatch(/amber/)
  })
})

// ─── IBIS estimated focal length soft prompt ──────────────────────────────────

describe('IBIS estimated focal length soft prompt', () => {
  const ibisPrompt =
    'Using estimated 135mm — set your zoom position for a more accurate handheld limit'

  it('shows IBIS estimated focal length soft prompt when provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        ibisEstimatedFocalLengthPrompt={ibisPrompt}
      />
    )
    expect(screen.getByText(ibisPrompt)).toBeInTheDocument()
  })

  it('does NOT show IBIS soft prompt when ibisEstimatedFocalLengthPrompt is null', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        ibisEstimatedFocalLengthPrompt={null}
      />
    )
    expect(screen.queryByText(/Using estimated/)).not.toBeInTheDocument()
  })

  it('does NOT show IBIS soft prompt when prop is not provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
      />
    )
    expect(screen.queryByText(/Using estimated/)).not.toBeInTheDocument()
  })

  it('IBIS soft prompt is less prominent than warning (does not use alert/warning role)', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        ibisEstimatedFocalLengthPrompt={ibisPrompt}
      />
    )
    const promptEl = screen.getByText(ibisPrompt)
    // Soft prompt should NOT have role="alert"
    expect(promptEl.closest('[role="alert"]')).toBeNull()
  })
})

// ─── Learning Mode only: stabilization cap note ───────────────────────────────

describe('Stabilization cap note (Learning Mode only)', () => {
  const stabilizationCapText =
    'Combined IS is capped at 8 stops — the maximum achievable with current hardware'

  it('shows stabilization cap note in Learning Mode when stabilizationCapNote is provided', () => {
    setMode('learning')
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        stabilizationCapNote={stabilizationCapText}
      />
    )
    expect(screen.getByText(stabilizationCapText)).toBeInTheDocument()
  })

  it('does NOT show stabilization cap note in Quick Mode', () => {
    setMode('quick')
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        stabilizationCapNote={stabilizationCapText}
      />
    )
    expect(screen.queryByText(stabilizationCapText)).not.toBeInTheDocument()
  })

  it('does NOT show stabilization cap note when stabilizationCapNote is null', () => {
    setMode('learning')
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        stabilizationCapNote={null}
      />
    )
    expect(screen.queryByText(/Combined IS is capped/)).not.toBeInTheDocument()
  })

  it('does NOT show stabilization cap note when prop is not provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
      />
    )
    expect(screen.queryByText(/Combined IS is capped/)).not.toBeInTheDocument()
  })
})

// ─── Learning Mode only: dual-native ISO hint ─────────────────────────────────

describe('Dual-native ISO hint (Learning Mode only)', () => {
  const dualIsoText =
    "ISO 3200 uses your camera's native gain stage — cleaner shadow detail than ISO 1600 on this sensor"

  it('shows dual-native ISO hint in Learning Mode when dualNativeIsoHint is provided', () => {
    setMode('learning')
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        dualNativeIsoHint={dualIsoText}
      />
    )
    expect(screen.getByText(dualIsoText)).toBeInTheDocument()
  })

  it('does NOT show dual-native ISO hint in Quick Mode', () => {
    setMode('quick')
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        dualNativeIsoHint={dualIsoText}
      />
    )
    expect(screen.queryByText(dualIsoText)).not.toBeInTheDocument()
  })

  it('does NOT show dual-native ISO hint when dualNativeIsoHint is null', () => {
    setMode('learning')
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        dualNativeIsoHint={null}
      />
    )
    expect(
      screen.queryByText(/native gain stage/)
    ).not.toBeInTheDocument()
  })

  it('does NOT show dual-native ISO hint when prop is not provided', () => {
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
      />
    )
    expect(screen.queryByText(/native gain stage/)).not.toBeInTheDocument()
  })
})

// ─── Multiple warnings coexist ────────────────────────────────────────────────

describe('Multiple warnings can coexist on the same card', () => {
  it('renders all warnings simultaneously when all props are provided', () => {
    setMode('learning')
    render(
      <RecommendationCard
        suggestion={baseSuggestion}
        index={0}
        apertureClampNote="f/1.4 requested but your lens maximum is f/4"
        flashSyncWarning="1/500s exceeds flash sync speed (~1/200s). Lower shutter to 1/200s or use an HSS-capable flash."
        diffractionWarning="f/16 may produce diffraction softness for A2+ print on your APS-C sensor. Consider f/8–f/11 for maximum sharpness at this output size."
        ibisEstimatedFocalLengthPrompt="Using estimated 135mm — set your zoom position for a more accurate handheld limit"
        stabilizationCapNote="Combined IS is capped at 8 stops — the maximum achievable with current hardware"
        dualNativeIsoHint="ISO 3200 uses your camera's native gain stage — cleaner shadow detail than ISO 1600 on this sensor"
      />
    )

    expect(screen.getByText(/requested but your lens maximum/)).toBeInTheDocument()
    expect(screen.getByText(/exceeds flash sync speed/)).toBeInTheDocument()
    expect(screen.getByText(/diffraction softness/)).toBeInTheDocument()
    expect(screen.getByText(/Using estimated 135mm/)).toBeInTheDocument()
    expect(screen.getByText(/Combined IS is capped/)).toBeInTheDocument()
    expect(screen.getByText(/native gain stage/)).toBeInTheDocument()
  })
})
