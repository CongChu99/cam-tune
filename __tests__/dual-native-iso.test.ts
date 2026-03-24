/**
 * Tests for buildDualNativeIsoHint() — dual native ISO prompt injection.
 */
import { buildDualNativeIsoHint } from '../lib/dual-native-iso'
import type { DualNativeIsoResult } from '../lib/dual-native-iso'

describe('buildDualNativeIsoHint', () => {
  it('returns hint when camera has dual native ISO with valid values', () => {
    const result = buildDualNativeIsoHint({
      dualNativeIso: true,
      dualNativeIsoValues: '640,12800',
    })
    expect(result.hint).toBeDefined()
    expect(result.hint).toContain('dual native ISO')
    expect(result.hint).toContain('640')
    expect(result.hint).toContain('12800')
    expect(result.dualNativeIsoApplied).toBe(true)
  })

  it('returns null when dualNativeIso is false', () => {
    const result = buildDualNativeIsoHint({
      dualNativeIso: false,
      dualNativeIsoValues: null,
    })
    expect(result.hint).toBeNull()
    expect(result.dualNativeIsoApplied).toBe(false)
  })

  it('returns null when dualNativeIsoValues is null', () => {
    const result = buildDualNativeIsoHint({
      dualNativeIso: true,
      dualNativeIsoValues: null,
    })
    expect(result.hint).toBeNull()
    expect(result.dualNativeIsoApplied).toBe(false)
  })

  it('returns null when dualNativeIsoValues is empty', () => {
    const result = buildDualNativeIsoHint({
      dualNativeIso: true,
      dualNativeIsoValues: '',
    })
    expect(result.hint).toBeNull()
    expect(result.dualNativeIsoApplied).toBe(false)
  })

  it('returns null when dualNativeIsoValues has only one value', () => {
    const result = buildDualNativeIsoHint({
      dualNativeIso: true,
      dualNativeIsoValues: '800',
    })
    expect(result.hint).toBeNull()
    expect(result.dualNativeIsoApplied).toBe(false)
  })

  it('handles three native ISO values', () => {
    const result = buildDualNativeIsoHint({
      dualNativeIso: true,
      dualNativeIsoValues: '100,800,12800',
    })
    expect(result.hint).toBeDefined()
    expect(result.hint).toContain('100')
    expect(result.hint).toContain('800')
    expect(result.hint).toContain('12800')
    expect(result.dualNativeIsoApplied).toBe(true)
  })
})
