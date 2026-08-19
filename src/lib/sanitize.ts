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
