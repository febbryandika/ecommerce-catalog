import DOMPurify from 'isomorphic-dompurify'

/**
 * Everything TipTap's StarterKit can emit here, and nothing else. The editor is configured with
 * headings limited to h2/h3 (description-editor.tsx) because the product page owns the h1, so
 * this list stays in step with that rather than allowing the full h1–h6 range.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'u',
  'code',
  'pre',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'a',
]

/**
 * The last thing a description passes through before the database (SPEC 8). It runs in the
 * Server Actions rather than in the editor because the client is not the boundary — a crafted
 * POST straight at createProduct never touches TipTap at all.
 *
 * href survives because StarterKit autolinks pasted URLs; DOMPurify drops the attribute
 * outright when the scheme is not one it considers safe, so javascript: cannot get through.
 * No class, no style, no event handlers — this HTML is rendered on a public page.
 */
export function sanitizeDescription(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ['href'] })
}

/** Block boundaries become a space; inline tags do not, because `a<strong>b</strong>` reads "ab". */
const BLOCK_BOUNDARY = /<\/(?:p|h2|h3|li|blockquote|pre|div)>|<br\s*\/?>/gi

/** Search engines truncate past roughly this, mid-word, so do it here on a word boundary. */
const META_DESCRIPTION_MAX = 160

/**
 * Stored description HTML to plain text for <meta name="description"> (SPEC 3.2). Not a
 * security boundary — sanitizeDescription already ran on save — it is a formatter, and it
 * reuses DOMPurify rather than a regex because only a real parse decodes &amp; and &nbsp;.
 *
 * RETURN_DOM + textContent rather than the string overload: sanitize() serialises back to
 * HTML, so the string form hands back "Home &amp;amp; Kitchen" and React then escapes the
 * ampersand a second time. The seed descriptions contain both entities, so this is the
 * difference between a correct meta tag and a visibly broken one.
 */
export function toMetaDescription(html: string): string {
  const node = DOMPurify.sanitize(html.replace(BLOCK_BOUNDARY, ' '), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_DOM: true,
  })
  const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()

  if (text.length <= META_DESCRIPTION_MAX) {
    return text
  }

  const cut = text.slice(0, META_DESCRIPTION_MAX - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`
}
