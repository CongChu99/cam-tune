import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { matchExif } from '@/lib/lens-database-service'
import { ExifExtractorClient } from '@/lib/exif-extractor-client'

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/webp',
  'image/heic',
  'image/heif',
])

/**
 * POST /api/lens-detect-exif
 * Accept multipart/form-data with `image` field.
 * Extracts LensModel from EXIF and runs fuzzy match against lens database.
 *
 * Returns:
 *   200 { matched: LensfunLens, confidence, rawLensModelString } — if matched
 *   200 { matched: null, rawLensModelString }                    — if no match
 *   400 { error: 'No image provided' }                          — if no file
 *   400 { error: 'File too large' }                             — if > 20 MB
 *   400 { error: 'Unsupported file type' }                      — if not an image
 *   400 { error: 'No LensModel found in EXIF' }                 — if no LensModel
 *   401 { error: 'Unauthorized' }                               — if not authenticated
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.has(imageFile.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const extractor = new ExifExtractorClient()
    const rawLensModelString = await extractor.extractLensModel(buffer)

    if (!rawLensModelString) {
      return NextResponse.json({ error: 'No LensModel found in EXIF' }, { status: 400 })
    }

    const matchResult = await matchExif(rawLensModelString, session.user.id)

    if (matchResult) {
      return NextResponse.json({
        matched: matchResult.lens,
        confidence: matchResult.confidence,
        rawLensModelString,
      })
    }

    return NextResponse.json({
      matched: null,
      rawLensModelString,
    })
  } catch (error) {
    console.error('[POST /api/lens-detect-exif] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
