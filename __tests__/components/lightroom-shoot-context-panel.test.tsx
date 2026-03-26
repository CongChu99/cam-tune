/**
 * Tests for LightroomShootContextPanel component
 *
 * Props:
 *   outputMedium?: string | null
 *   shadowPriority?: string | null
 *   focalLengthMm?: number | null
 *   maxAperture?: number | null
 *   className?: string
 *
 * Scenarios:
 * a. Returns null when all props are null/undefined
 * b. Renders "Shoot Context" heading when any field is present
 * c. Shows "Shot for: {outputMedium}" when outputMedium is provided
 * d. Shows "Shadow priority: {shadowPriority}" when present
 * e. Shows "Lens: {focalLengthMm}mm f/{maxAperture}" when both present
 * f. Omits null fields (e.g. if outputMedium=null but others present, "Shot for:" line absent)
 * g. Works with partial data (only some fields provided)
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import React from 'react'

import { LightroomShootContextPanel } from '@/components/lightroom-shoot-context-panel'

// ─── a. Returns null when all props are null/undefined ────────────────────────

describe('a. Returns null when all props are null/undefined', () => {
  it('renders nothing when no props are provided', () => {
    const { container } = render(<LightroomShootContextPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all props are explicitly null', () => {
    const { container } = render(
      <LightroomShootContextPanel
        outputMedium={null}
        shadowPriority={null}
        focalLengthMm={null}
        maxAperture={null}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all props are undefined', () => {
    const { container } = render(
      <LightroomShootContextPanel
        outputMedium={undefined}
        shadowPriority={undefined}
        focalLengthMm={undefined}
        maxAperture={undefined}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})

// ─── b. Renders "Shoot Context" heading when any field is present ─────────────

describe('b. Renders "Shoot Context" heading when any field is present', () => {
  it('renders the "Shoot Context" heading when outputMedium is provided', () => {
    render(<LightroomShootContextPanel outputMedium="Web (1080p)" />)
    expect(screen.getByText('Shoot Context')).toBeInTheDocument()
  })

  it('renders the "Shoot Context" heading when shadowPriority is provided', () => {
    render(<LightroomShootContextPanel shadowPriority="highlights" />)
    expect(screen.getByText('Shoot Context')).toBeInTheDocument()
  })

  it('renders the "Shoot Context" heading when focalLengthMm is provided', () => {
    render(<LightroomShootContextPanel focalLengthMm={85} />)
    expect(screen.getByText('Shoot Context')).toBeInTheDocument()
  })

  it('renders the "Shoot Context" heading when maxAperture is provided', () => {
    render(<LightroomShootContextPanel maxAperture={1.4} />)
    expect(screen.getByText('Shoot Context')).toBeInTheDocument()
  })

  it('does NOT render a "Shoot Context" heading when all props are null', () => {
    render(
      <LightroomShootContextPanel
        outputMedium={null}
        shadowPriority={null}
        focalLengthMm={null}
        maxAperture={null}
      />
    )
    expect(screen.queryByText('Shoot Context')).not.toBeInTheDocument()
  })
})

// ─── c. Shows "Shot for: {outputMedium}" when outputMedium is provided ────────

describe('c. Shows "Shot for: {outputMedium}" when outputMedium is provided', () => {
  it('shows "Shot for: Web (1080p)" when outputMedium is "Web (1080p)"', () => {
    render(<LightroomShootContextPanel outputMedium="Web (1080p)" />)
    expect(screen.getByText(/Shot for:/)).toBeInTheDocument()
    expect(screen.getByText(/Web \(1080p\)/)).toBeInTheDocument()
  })

  it('shows "Shot for: Print A4" when outputMedium is "Print A4"', () => {
    render(<LightroomShootContextPanel outputMedium="Print A4" />)
    expect(screen.getByText(/Shot for:.*Print A4/)).toBeInTheDocument()
  })

  it('does NOT show "Shot for:" when outputMedium is null', () => {
    render(<LightroomShootContextPanel outputMedium={null} shadowPriority="highlights" />)
    expect(screen.queryByText(/Shot for:/)).not.toBeInTheDocument()
  })

  it('does NOT show "Shot for:" when outputMedium is undefined', () => {
    render(<LightroomShootContextPanel shadowPriority="highlights" />)
    expect(screen.queryByText(/Shot for:/)).not.toBeInTheDocument()
  })
})

// ─── d. Shows "Shadow priority: {shadowPriority}" when present ───────────────

describe('d. Shows "Shadow priority: {shadowPriority}" when present', () => {
  it('shows "Shadow priority: highlights" when shadowPriority is "highlights"', () => {
    render(<LightroomShootContextPanel shadowPriority="highlights" />)
    expect(screen.getByText(/Shadow priority:.*highlights/)).toBeInTheDocument()
  })

  it('shows "Shadow priority: low" when shadowPriority is "low"', () => {
    render(<LightroomShootContextPanel shadowPriority="low" />)
    expect(screen.getByText(/Shadow priority:.*low/)).toBeInTheDocument()
  })

  it('does NOT show "Shadow priority:" when shadowPriority is null', () => {
    render(<LightroomShootContextPanel shadowPriority={null} outputMedium="Web (1080p)" />)
    expect(screen.queryByText(/Shadow priority:/)).not.toBeInTheDocument()
  })

  it('does NOT show "Shadow priority:" when shadowPriority is undefined', () => {
    render(<LightroomShootContextPanel outputMedium="Web (1080p)" />)
    expect(screen.queryByText(/Shadow priority:/)).not.toBeInTheDocument()
  })
})

// ─── e. Shows "Lens: {focalLengthMm}mm f/{maxAperture}" when both present ─────

describe('e. Shows "Lens: {focalLengthMm}mm f/{maxAperture}" when both present', () => {
  it('shows "Lens: 85mm f/1.4" when focalLengthMm=85 and maxAperture=1.4', () => {
    render(<LightroomShootContextPanel focalLengthMm={85} maxAperture={1.4} />)
    expect(screen.getByText(/Lens:.*85mm.*f\/1\.4/)).toBeInTheDocument()
  })

  it('shows "Lens: 50mm f/1.8" when focalLengthMm=50 and maxAperture=1.8', () => {
    render(<LightroomShootContextPanel focalLengthMm={50} maxAperture={1.8} />)
    expect(screen.getByText(/Lens:.*50mm.*f\/1\.8/)).toBeInTheDocument()
  })

  it('shows "Lens: 200mm f/4" when focalLengthMm=200 and maxAperture=4', () => {
    render(<LightroomShootContextPanel focalLengthMm={200} maxAperture={4} />)
    expect(screen.getByText(/Lens:.*200mm.*f\/4/)).toBeInTheDocument()
  })

  it('shows only "Lens: 85mm" when only focalLengthMm is present', () => {
    render(<LightroomShootContextPanel focalLengthMm={85} maxAperture={null} />)
    expect(screen.getByText(/Lens:.*85mm/)).toBeInTheDocument()
    expect(screen.queryByText(/f\//)).not.toBeInTheDocument()
  })

  it('shows only "Lens: f/1.4" when only maxAperture is present', () => {
    render(<LightroomShootContextPanel focalLengthMm={null} maxAperture={1.4} />)
    expect(screen.getByText(/Lens:.*f\/1\.4/)).toBeInTheDocument()
    expect(screen.queryByText(/\d+mm/)).not.toBeInTheDocument()
  })

  it('does NOT show "Lens:" when both focalLengthMm and maxAperture are null', () => {
    render(
      <LightroomShootContextPanel
        focalLengthMm={null}
        maxAperture={null}
        outputMedium="Web (1080p)"
      />
    )
    expect(screen.queryByText(/Lens:/)).not.toBeInTheDocument()
  })
})

// ─── f. Omits null fields ─────────────────────────────────────────────────────

describe('f. Omits null fields', () => {
  it('omits "Shot for:" line when outputMedium is null but other fields are present', () => {
    render(
      <LightroomShootContextPanel
        outputMedium={null}
        shadowPriority="highlights"
        focalLengthMm={85}
        maxAperture={1.4}
      />
    )
    expect(screen.queryByText(/Shot for:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Shadow priority:/)).toBeInTheDocument()
    expect(screen.getByText(/Lens:/)).toBeInTheDocument()
  })

  it('omits "Shadow priority:" line when shadowPriority is null but other fields are present', () => {
    render(
      <LightroomShootContextPanel
        outputMedium="Web (1080p)"
        shadowPriority={null}
        focalLengthMm={85}
        maxAperture={1.4}
      />
    )
    expect(screen.getByText(/Shot for:/)).toBeInTheDocument()
    expect(screen.queryByText(/Shadow priority:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Lens:/)).toBeInTheDocument()
  })

  it('omits "Lens:" line when both focalLengthMm and maxAperture are null', () => {
    render(
      <LightroomShootContextPanel
        outputMedium="Web (1080p)"
        shadowPriority="highlights"
        focalLengthMm={null}
        maxAperture={null}
      />
    )
    expect(screen.getByText(/Shot for:/)).toBeInTheDocument()
    expect(screen.getByText(/Shadow priority:/)).toBeInTheDocument()
    expect(screen.queryByText(/Lens:/)).not.toBeInTheDocument()
  })

  it('still renders the section when only one field is null (others present)', () => {
    render(
      <LightroomShootContextPanel
        outputMedium={null}
        shadowPriority="highlights"
        focalLengthMm={null}
        maxAperture={null}
      />
    )
    expect(screen.getByText('Shoot Context')).toBeInTheDocument()
    expect(screen.queryByText(/Shot for:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Shadow priority:/)).toBeInTheDocument()
  })
})

// ─── g. Works with partial data (only some fields provided) ───────────────────

describe('g. Works with partial data (only some fields provided)', () => {
  it('renders correctly with only outputMedium provided', () => {
    render(<LightroomShootContextPanel outputMedium="Commercial" />)
    expect(screen.getByText('Shoot Context')).toBeInTheDocument()
    expect(screen.getByText(/Shot for:.*Commercial/)).toBeInTheDocument()
    expect(screen.queryByText(/Shadow priority:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Lens:/)).not.toBeInTheDocument()
  })

  it('renders correctly with only shadowPriority provided', () => {
    render(<LightroomShootContextPanel shadowPriority="low" />)
    expect(screen.getByText('Shoot Context')).toBeInTheDocument()
    expect(screen.queryByText(/Shot for:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Shadow priority:.*low/)).toBeInTheDocument()
    expect(screen.queryByText(/Lens:/)).not.toBeInTheDocument()
  })

  it('renders correctly with only focalLengthMm provided', () => {
    render(<LightroomShootContextPanel focalLengthMm={35} />)
    expect(screen.getByText('Shoot Context')).toBeInTheDocument()
    expect(screen.queryByText(/Shot for:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Shadow priority:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Lens:.*35mm/)).toBeInTheDocument()
  })

  it('renders correctly with only maxAperture provided', () => {
    render(<LightroomShootContextPanel maxAperture={2.8} />)
    expect(screen.getByText('Shoot Context')).toBeInTheDocument()
    expect(screen.queryByText(/Shot for:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Shadow priority:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Lens:.*f\/2\.8/)).toBeInTheDocument()
  })

  it('renders correctly with all four fields provided', () => {
    render(
      <LightroomShootContextPanel
        outputMedium="Print A4"
        shadowPriority="highlights"
        focalLengthMm={50}
        maxAperture={1.8}
      />
    )
    expect(screen.getByText('Shoot Context')).toBeInTheDocument()
    expect(screen.getByText(/Shot for:.*Print A4/)).toBeInTheDocument()
    expect(screen.getByText(/Shadow priority:.*highlights/)).toBeInTheDocument()
    expect(screen.getByText(/Lens:.*50mm.*f\/1\.8/)).toBeInTheDocument()
  })

  it('applies className when provided alongside field data', () => {
    const { container } = render(
      <LightroomShootContextPanel outputMedium="Web (4K)" className="custom-section" />
    )
    expect(container.querySelector('.custom-section')).toBeInTheDocument()
  })
})
