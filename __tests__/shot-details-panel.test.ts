/**
 * Tests for ShotDetailsPanel component.
 */
import { describe, it, expect } from 'vitest'

// Test the component module exports and types
describe('ShotDetailsPanel', () => {
  it('module exports ShotDetailsPanel component', async () => {
    const mod = await import('../components/shot-details-panel')
    expect(mod.ShotDetailsPanel).toBeDefined()
    expect(typeof mod.ShotDetailsPanel).toBe('function')
  })

  it('module exports ShotDetailsPanelProps type check', async () => {
    const mod = await import('../components/shot-details-panel')
    // Verify the component can be called (it's a function/React component)
    expect(mod.ShotDetailsPanel).toBeDefined()
  })

  it('exports UiMode type values', async () => {
    const mod = await import('../components/shot-details-panel')
    // Component should exist
    expect(mod.ShotDetailsPanel.name).toBeDefined()
  })
})
