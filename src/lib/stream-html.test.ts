import { describe, expect, it } from 'vitest'
import { escapeHtml, toParagraphs } from '@/lib/stream-html'

describe('escapeHtml', () => {
  it('escapes the three characters that can open a tag or an entity', () => {
    expect(escapeHtml('a < b > c & d')).toBe('a &lt; b &gt; c &amp; d')
  })

  it('escapes the ampersand first so an entity is not double-escaped into nonsense', () => {
    // Replacing '<' before '&' would turn "<" into "&lt;" and then into "&amp;lt;".
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('leaves text with nothing to escape alone', () => {
    expect(escapeHtml('Forty millimetre drivers.')).toBe('Forty millimetre drivers.')
  })
})

describe('toParagraphs', () => {
  it('splits on blank lines into paragraphs', () => {
    expect(toParagraphs('First block.\n\nSecond block.')).toBe(
      '<p>First block.</p><p>Second block.</p>',
    )
  })

  it('treats three or more newlines as one break', () => {
    expect(toParagraphs('First.\n\n\n\nSecond.')).toBe('<p>First.</p><p>Second.</p>')
  })

  it('keeps a single newline inside one paragraph', () => {
    // Only a blank line is a paragraph break — a wrapped line is not.
    expect(toParagraphs('First line.\nStill the same paragraph.')).toBe(
      '<p>First line.\nStill the same paragraph.</p>',
    )
  })

  it('drops blocks that are empty or only whitespace', () => {
    expect(toParagraphs('First.\n\n   \n\nSecond.')).toBe('<p>First.</p><p>Second.</p>')
    expect(toParagraphs('')).toBe('')
    expect(toParagraphs('\n\n\n')).toBe('')
  })

  it('trims each block', () => {
    expect(toParagraphs('  First.  \n\n  Second.  ')).toBe('<p>First.</p><p>Second.</p>')
  })

  it('escapes markup in the stream rather than letting it become tags', () => {
    // The regression this exists for: a stray '<' mid-sentence would otherwise open a tag when
    // TipTap parses the string as HTML.
    expect(toParagraphs('Under 5 < 10 for most rooms.')).toBe(
      '<p>Under 5 &lt; 10 for most rooms.</p>',
    )
    expect(toParagraphs('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    )
  })
})
