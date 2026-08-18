import { describe, expect, it } from 'vitest'
import { nextAvailableSlug, slugify } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases and hyphenates a plain name', () => {
    expect(slugify('Wireless Keyboard')).toBe('wireless-keyboard')
  })

  it('collapses punctuation and repeated separators into one hyphen', () => {
    expect(slugify('Sony WH-1000XM5  —  Noise Cancelling!')).toBe(
      'sony-wh-1000xm5-noise-cancelling',
    )
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  ¡Hola!  ')).toBe('hola')
  })

  it('folds diacritics into their base letters', () => {
    // NFKD splits the accent off as a combining mark; without stripping it first, 'naïve'
    // would slug to 'nai-ve'.
    expect(slugify('Café Latte')).toBe('cafe-latte')
    expect(slugify('naïve')).toBe('naive')
  })

  it('returns an empty string when there is nothing latin to slug', () => {
    expect(slugify('コーヒーメーカー')).toBe('')
    expect(slugify('   ')).toBe('')
  })
})

describe('nextAvailableSlug', () => {
  it('keeps the base when it is free', () => {
    expect(nextAvailableSlug('desk-lamp', ['chair', 'sofa'])).toBe('desk-lamp')
  })

  it('appends -2 on the first collision', () => {
    expect(nextAvailableSlug('desk-lamp', ['desk-lamp'])).toBe('desk-lamp-2')
  })

  it('skips suffixes that are already taken', () => {
    expect(nextAvailableSlug('desk-lamp', ['desk-lamp', 'desk-lamp-2', 'desk-lamp-3'])).toBe(
      'desk-lamp-4',
    )
  })

  it('fills a gap left by a deleted product', () => {
    expect(nextAvailableSlug('desk-lamp', ['desk-lamp', 'desk-lamp-3'])).toBe('desk-lamp-2')
  })
})
