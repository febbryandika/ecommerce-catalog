import { describe, expect, it } from 'vitest'
import { formatJpy } from '@/lib/format'

// The currency symbol below is U+FFE5 FULLWIDTH YEN SIGN, not U+00A5.
describe('formatJpy', () => {
  it('formats whole yen with a thousands separator', () => {
    expect(formatJpy(12800)).toBe('￥12,800')
  })

  it('formats zero', () => {
    expect(formatJpy(0)).toBe('￥0')
  })

  it('rounds a stray fractional value to whole yen', () => {
    expect(formatJpy(1234.6)).toBe('￥1,235')
  })
})
