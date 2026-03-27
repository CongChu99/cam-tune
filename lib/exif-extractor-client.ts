/**
 * Extracts EXIF metadata from image buffers.
 * Pure, testable utility — no DB dependencies.
 */
import exifr from 'exifr'

export class ExifExtractorClient {
  /**
   * Extracts the LensModel field from image EXIF data.
   * @param imageBuffer  Raw image data as Buffer or Uint8Array
   * @returns LensModel string if found, null otherwise
   */
  async extractLensModel(imageBuffer: Buffer | Uint8Array): Promise<string | null> {
    try {
      const exif = await exifr.parse(imageBuffer, { pick: ['LensModel'] })
      if (!exif || typeof exif.LensModel !== 'string') return null
      const trimmed = exif.LensModel.trim()
      return trimmed || null
    } catch {
      return null
    }
  }
}
