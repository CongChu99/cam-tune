/**
 * Tests for combined OIS+IBIS stops calculation with 8-stop cap.
 */
import { getCombinedStabilizationStops } from '../lib/ibis-check'

describe('getCombinedStabilizationStops', () => {
  it('combines IBIS + OIS stops', () => {
    const result = getCombinedStabilizationStops(5.5, 5)
    expect(result).toBe(8) // 10.5 capped at 8
  })

  it('caps at 8 when total exceeds 8', () => {
    const result = getCombinedStabilizationStops(5, 5)
    expect(result).toBe(8)
  })

  it('returns sum when total <= 8', () => {
    const result = getCombinedStabilizationStops(3, 4)
    expect(result).toBe(7)
  })

  it('returns ibisStops when no OIS', () => {
    const result = getCombinedStabilizationStops(5.5, 0)
    expect(result).toBe(5.5)
  })

  it('returns OIS when no IBIS', () => {
    const result = getCombinedStabilizationStops(0, 4)
    expect(result).toBe(4)
  })

  it('returns 0 when neither IBIS nor OIS', () => {
    const result = getCombinedStabilizationStops(0, 0)
    expect(result).toBe(0)
  })

  it('handles undefined OIS as 0', () => {
    const result = getCombinedStabilizationStops(5.5)
    expect(result).toBe(5.5)
  })
})
