import { describe, expect, it } from 'vitest'
import { imageObjectKey } from '@/lib/r2'

// This suite runs with no R2 credentials, which is the point: it passes only because the
// S3 client in r2.ts is built on first use rather than at module load.
describe('imageObjectKey', () => {
  it('derives the extension from the mime type, not the uploaded filename', () => {
    expect(imageObjectKey('image/jpeg')).toMatch(/^products\/[a-z0-9]+\.jpg$/)
    expect(imageObjectKey('image/png')).toMatch(/^products\/[a-z0-9]+\.png$/)
    expect(imageObjectKey('image/webp')).toMatch(/^products\/[a-z0-9]+\.webp$/)
  })

  it('generates a distinct key every call', () => {
    const keys = new Set(Array.from({ length: 100 }, () => imageObjectKey('image/png')))
    expect(keys.size).toBe(100)
  })
})
