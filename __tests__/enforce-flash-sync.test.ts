/**
 * Tests for enforceFlashSync() — flash sync speed validator.
 */
import { enforceFlashSync } from '../lib/enforce-flash-sync'
import type { FlashAvailability, FlashSyncResult } from '../lib/enforce-flash-sync'

describe('enforceFlashSync', () => {
  const baseSuggestion = { shutter: '1/500' }

  it('warns when speedlight used and shutter exceeds sync speed', () => {
    const result = enforceFlashSync(baseSuggestion, { maxFlashSyncSpeed: 250 }, 'speedlight')
    expect(result.flashSyncWarning).toBeDefined()
    expect(result.flashSyncWarning).toContain('1/250')
    expect(result.flashSyncWarning).toContain('1/500')
  })

  it('warns when studio_strobe used and shutter exceeds sync speed', () => {
    const result = enforceFlashSync(baseSuggestion, { maxFlashSyncSpeed: 200 }, 'studio_strobe')
    expect(result.flashSyncWarning).toBeDefined()
    expect(result.flashSyncWarning).toContain('1/200')
  })

  it('does not warn when shutter is within sync speed', () => {
    const result = enforceFlashSync({ shutter: '1/125' }, { maxFlashSyncSpeed: 250 }, 'speedlight')
    expect(result.flashSyncWarning).toBeNull()
  })

  it('does not warn when shutter equals sync speed', () => {
    const result = enforceFlashSync({ shutter: '1/250' }, { maxFlashSyncSpeed: 250 }, 'speedlight')
    expect(result.flashSyncWarning).toBeNull()
  })

  it('does not warn when hss_capable', () => {
    const result = enforceFlashSync(baseSuggestion, { maxFlashSyncSpeed: 250 }, 'hss_capable')
    expect(result.flashSyncWarning).toBeNull()
  })

  it('does not warn when flash is none', () => {
    const result = enforceFlashSync(baseSuggestion, { maxFlashSyncSpeed: 250 }, 'none')
    expect(result.flashSyncWarning).toBeNull()
  })

  it('uses fallback 1/200s when maxFlashSyncSpeed is null', () => {
    const result = enforceFlashSync({ shutter: '1/500' }, { maxFlashSyncSpeed: null }, 'speedlight')
    expect(result.flashSyncWarning).toBeDefined()
    expect(result.flashSyncWarning).toContain('1/200')
  })

  it('uses fallback 1/200s when camera has no maxFlashSyncSpeed', () => {
    const result = enforceFlashSync({ shutter: '1/100' }, { maxFlashSyncSpeed: null }, 'speedlight')
    expect(result.flashSyncWarning).toBeNull()
  })
})
