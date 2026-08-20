import { describe, expect, it } from 'vitest'
import { sanitizeDescription, toMetaDescription } from '@/lib/sanitize'

// The stored HTML is written by an admin but rendered on a public product page, so the
// interesting cases are the ones where the admin account is the attacker — or where a pasted
// fragment smuggles markup past the editor (SPEC 8).
describe('sanitizeDescription', () => {
  it('keeps the markup StarterKit actually produces', () => {
    const html =
      '<p>The Aurora is built for the hours after everyone else has gone home.</p>' +
      '<p>Battery life runs to <strong>60 hours</strong>, <em>adaptive</em> cancelling on.</p>'

    expect(sanitizeDescription(html)).toBe(html)
  })

  it('keeps headings and lists', () => {
    const html = '<h2>In the box</h2><ul><li>Cable</li><li>Case</li></ul>'

    expect(sanitizeDescription(html)).toBe(html)
  })

  it('removes a script tag and its contents', () => {
    const clean = sanitizeDescription('<p>Hi</p><script>fetch("/api/steal")</script>')

    expect(clean).toBe('<p>Hi</p>')
  })

  it('strips an inline event handler along with the tag that carried it', () => {
    const clean = sanitizeDescription('<img src="x" onerror="alert(1)">')

    expect(clean).not.toContain('onerror')
    expect(clean).not.toContain('<img')
  })

  it('drops a javascript: href but keeps the link text', () => {
    const clean = sanitizeDescription('<a href="javascript:alert(1)">Read more</a>')

    expect(clean).not.toContain('javascript:')
    expect(clean).toContain('Read more')
  })

  it('keeps an ordinary link', () => {
    expect(sanitizeDescription('<a href="https://example.com">Docs</a>')).toBe(
      '<a href="https://example.com">Docs</a>',
    )
  })

  it('drops presentation attributes that would let a description restyle the page', () => {
    const clean = sanitizeDescription('<p style="position:fixed;inset:0" class="z-50">Hi</p>')

    expect(clean).toBe('<p>Hi</p>')
  })

  it('leaves an empty string empty, so the action still stores NULL', () => {
    expect(sanitizeDescription('')).toBe('')
  })
})

describe('toMetaDescription', () => {
  it('strips the markup', () => {
    expect(toMetaDescription('<p>Hi</p>')).toBe('Hi')
  })

  it('separates block elements with a space', () => {
    expect(toMetaDescription('<p>a</p><p>b</p>')).toBe('a b')
    expect(toMetaDescription('<ul><li>a</li><li>b</li></ul>')).toBe('a b')
    expect(toMetaDescription('a<br>b')).toBe('a b')
  })

  it('does not separate inline elements', () => {
    expect(toMetaDescription('a<strong>b</strong>')).toBe('ab')
  })

  // The regression the string-returning DOMPurify overload would cause: sanitize() serialises
  // back to HTML, so entities come back escaped and React escapes them again.
  it('decodes entities rather than re-escaping them', () => {
    expect(toMetaDescription('<p>Home &amp; Kitchen</p>')).toBe('Home & Kitchen')
    expect(toMetaDescription('<p>3.5&nbsp;mm jack</p>')).toBe('3.5 mm jack')
  })

  it('collapses whitespace runs and trims', () => {
    expect(toMetaDescription('<p>  a   \n  b  </p>')).toBe('a b')
  })

  it('leaves a description at the limit intact', () => {
    const text = 'x'.repeat(160)
    expect(toMetaDescription(`<p>${text}</p>`)).toBe(text)
  })

  it('truncates a longer one on a word boundary', () => {
    const result = toMetaDescription(`<p>${'word '.repeat(60)}</p>`)

    expect(result.length).toBeLessThanOrEqual(160)
    expect(result.endsWith('…')).toBe(true)
    expect(result).not.toMatch(/wor…$/)
  })

  it('returns an empty string for an empty description', () => {
    expect(toMetaDescription('')).toBe('')
  })
})
