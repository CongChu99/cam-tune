/**
 * Tests for LensExifUnmatched model in Prisma schema.
 * Verifies the model exists with required fields: rawLensModelString, userId, createdAt.
 */
import type { Prisma } from '../lib/generated/prisma'

describe('LensExifUnmatched model — schema spec 003', () => {
  it('accepts rawLensModelString as required String', () => {
    const input: Prisma.LensExifUnmatchedCreateInput = {
      rawLensModelString: 'Canon EF 85mm f/1.4L IS USM',
      user: { connect: { id: 'test-user-id' } },
    }
    expect(input.rawLensModelString).toBe('Canon EF 85mm f/1.4L IS USM')
  })

  it('accepts user relation', () => {
    const input: Prisma.LensExifUnmatchedCreateInput = {
      rawLensModelString: 'Unknown Lens 50mm',
      user: { connect: { id: 'test-user-id' } },
    }
    expect(input.user).toBeDefined()
  })

  it('createdAt defaults automatically (not required in create input)', () => {
    const input: Prisma.LensExifUnmatchedCreateInput = {
      rawLensModelString: 'Tamron 28-75mm f/2.8',
      user: { connect: { id: 'test-user-id' } },
    }
    // createdAt should not be required
    expect(input.createdAt).toBeUndefined()
  })
})
