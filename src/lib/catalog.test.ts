import { describe, expect, it } from 'vitest'
import {
  catalogHref,
  escapeLikePattern,
  paginate,
  parseCatalogParams,
  PAGE_SIZE,
} from '@/lib/catalog'

describe('parseCatalogParams', () => {
  it('defaults every key when nothing is in the URL', () => {
    expect(parseCatalogParams({})).toEqual({ q: '', category: null, page: 1 })
  })

  it('trims the search term', () => {
    expect(parseCatalogParams({ q: '  lumen  ' }).q).toBe('lumen')
  })

  it('discards a repeated key, which arrives as an array', () => {
    expect(parseCatalogParams({ q: ['a', 'b'], category: ['audio'] })).toEqual({
      q: '',
      category: null,
      page: 1,
    })
  })

  it('treats an empty category as unfiltered', () => {
    expect(parseCatalogParams({ category: '   ' }).category).toBeNull()
  })

  it('caps an overlong search term', () => {
    expect(parseCatalogParams({ q: 'x'.repeat(500) }).q).toHaveLength(100)
  })

  // Every one of these is typeable in the address bar, so each must render page 1 rather
  // than a 500 or a negative offset.
  it.each([
    ['2', 2],
    ['abc', 1],
    ['', 1],
    ['0', 1],
    ['-3', 1],
    ['2.5', 1],
    ['9e99', 1],
  ])('reads ?page=%s as %i', (value, expected) => {
    expect(parseCatalogParams({ page: value }).page).toBe(expected)
  })
})

describe('escapeLikePattern', () => {
  // The regression: an unescaped % is an ILIKE wildcard, so searching "50%" matched the
  // entire catalog instead of nothing.
  it('escapes the percent wildcard', () => {
    expect(escapeLikePattern('50%')).toBe('50\\%')
  })

  it('escapes the underscore wildcard', () => {
    expect(escapeLikePattern('a_b')).toBe('a\\_b')
  })

  it('escapes the escape character itself', () => {
    expect(escapeLikePattern('\\')).toBe('\\\\')
  })

  it('leaves ordinary text alone', () => {
    expect(escapeLikePattern('Lumen 35mm')).toBe('Lumen 35mm')
  })
})

describe('paginate', () => {
  it('reports one page when nothing matched', () => {
    expect(paginate(0, 1)).toEqual({ page: 1, totalPages: 1, offset: 0 })
  })

  it('splits the seeded catalog into two pages', () => {
    expect(paginate(30, 1)).toEqual({ page: 1, totalPages: 2, offset: 0 })
    expect(paginate(30, 2)).toEqual({ page: 2, totalPages: 2, offset: PAGE_SIZE })
  })

  it('does not spill an exactly-full page into a second one', () => {
    expect(paginate(PAGE_SIZE, 1)).toEqual({ page: 1, totalPages: 1, offset: 0 })
  })

  // ?page=99 is a valid URL for a valid resource, so it shows the last page rather than an
  // empty grid captioned "Page 99 of 2".
  it('clamps a page past the end down to the last real one', () => {
    expect(paginate(30, 99)).toEqual({ page: 2, totalPages: 2, offset: PAGE_SIZE })
  })
})

describe('catalogHref', () => {
  it('omits page 1 so the first page has one canonical URL', () => {
    expect(catalogHref({ q: '', category: null, page: 1 })).toBe('/')
  })

  it('carries the filters across a page change', () => {
    expect(catalogHref({ q: 'lumen', category: 'cameras', page: 2 })).toBe(
      '/?q=lumen&category=cameras&page=2',
    )
  })

  it('omits the fields that are not set', () => {
    expect(catalogHref({ q: '', category: 'audio', page: 3 })).toBe('/?category=audio&page=3')
  })
})
