import sanitizeHtml from 'sanitize-html'

/**
 * A parser-based sanitiser rather than DOMPurify, which needs a DOM and so dragged jsdom in
 * through isomorphic-dompurify. `jsdom` is on Next's default `serverExternalPackages` list, so
 * Turbopack leaves it as a runtime `require()` instead of bundling it — and jsdom's tree now
 * reaches the ESM-only `@exodus/bytes` through both html-encoding-sniffer and whatwg-url.
 * Vercel's serverless runtime runs Node with `require(esm)` disabled, so that require throws
 * ERR_REQUIRE_ESM and every page importing this file 500s in production while working locally.
 *
 * sanitize-html is not on that list, so it is bundled and its own ESM dependencies are resolved
 * at build time. Reproduce the production failure locally with:
 *   node --no-experimental-require-module -e "require('jsdom')"
 */

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
 * href survives because StarterKit autolinks pasted URLs; sanitize-html drops the attribute
 * outright when the scheme is not on `allowedSchemes`, so javascript: cannot get through.
 * No class, no style, no event handlers — this HTML is rendered on a public page.
 *
 * `script`/`style` contents go with the tag rather than being flattened into text: that is
 * sanitize-html's `nonTextTags` default, and it is why `<script>alert(1)</script>` leaves
 * nothing behind instead of leaving `alert(1)` as visible prose.
 */
export function sanitizeDescription(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  })
}

/** Block boundaries become a space; inline tags do not, because `a<strong>b</strong>` reads "ab". */
const BLOCK_BOUNDARY = /<\/(?:p|h2|h3|li|blockquote|pre|div)>|<br\s*\/?>/gi

/** Search engines truncate past roughly this, mid-word, so do it here on a word boundary. */
const META_DESCRIPTION_MAX = 160

/**
 * The five entities sanitize-html's text escaper emits. Stripping tags decodes the input's
 * entities and then re-escapes them on the way out, so "Home &amp; Kitchen" would arrive as
 * "Home &amp;amp; Kitchen" and React would escape the ampersand a second time. One pass over
 * this table undoes exactly that final escape and nothing more — a single global replace never
 * rescans what it substituted, so "&amp;amp;" correctly yields "&amp;".
 */
const ESCAPED = new Map([
  ['&amp;', '&'],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
])

/**
 * Stored description HTML to plain text for <meta name="description"> (SPEC 3.2). Not a
 * security boundary — sanitizeDescription already ran on save — it is a formatter, and it runs
 * the real parser rather than a tag regex because only a parse turns &nbsp; into a space.
 */
export function toMetaDescription(html: string): string {
  const stripped = sanitizeHtml(html.replace(BLOCK_BOUNDARY, ' '), {
    allowedTags: [],
    allowedAttributes: {},
  })
  const text = stripped
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ESCAPED.get(entity) ?? entity)
    // \s covers the U+00A0 that &nbsp; decodes to, so it collapses with ordinary runs.
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= META_DESCRIPTION_MAX) {
    return text
  }

  const cut = text.slice(0, META_DESCRIPTION_MAX - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`
}
