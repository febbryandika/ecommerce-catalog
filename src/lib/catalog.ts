/** SPEC 3.3: 24 per page, limit/offset. */
export const PAGE_SIZE = 24

/**
 * A `?q=` long enough to matter is never a real search — it is a 10 kB ILIKE pattern and a
 * 10 kB string interpolated into the empty-state copy. Capped rather than rejected: the URL is
 * the source of truth, so a bad one degrades, it does not 400.
 */
const MAX_QUERY_LENGTH = 100

export type CatalogParams = {
  /** Trimmed free-text search over the product name. '' when absent. */
  q: string
  /** Category *slug*, resolved through a join. null when unfiltered. */
  category: string | null
  /** 1-based page as requested. Clamped to >= 1 here, to totalPages by paginate(). */
  page: number
}

/** Same narrowing as login/page.tsx: a repeated key arrives as string[] and is discarded. */
function single(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

function toPage(value: string): number {
  const parsed = Number(value)
  // isSafeInteger, not isInteger: 9e99 is a finite float with no fractional part, so
  // isInteger accepts it and the offset it implies overflows Postgres' bigint. paginate()
  // would clamp it anyway, but a page number outside safe-integer range is not a page.
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1
}

/**
 * Reads the three catalog keys off Next's searchParams. Clamps, never rejects — every one of
 * these is user-editable in the address bar, and `?page=banana` has to render page 1 rather
 * than a 500. That is also why this is a plain function rather than a Zod schema: emulating
 * clamp-never-reject needs a .catch() on every field, and validation.ts already argues against
 * coercion for exactly this class of silent-fallback bug.
 */
export function parseCatalogParams(
  searchParams: Record<string, string | string[] | undefined>,
): CatalogParams {
  return {
    q: single(searchParams.q).trim().slice(0, MAX_QUERY_LENGTH),
    category: single(searchParams.category).trim() || null,
    page: toPage(single(searchParams.page)),
  }
}

/**
 * `%` and `_` are ILIKE wildcards and `\` is its default escape character, so an unescaped
 * search for "50%" matches the entire catalog. Drizzle binds the pattern as a parameter, so
 * this is a correctness fix rather than an injection one — the backslash reaches the pattern
 * matcher literally and Postgres' default ESCAPE '\' consumes it.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

/**
 * Turns a total row count and a requested page into a window. The requested page is clamped
 * *down* to the last real page rather than 404ing: `/?page=99` is a valid URL for a valid
 * resource, and a redirect would stop the URL being the source of truth. Clamping here means
 * everything downstream — the offset, "Page X of Y", the Prev/Next hrefs — is consistent by
 * construction, so the empty state only ever means "nothing matched".
 */
export function paginate(total: number, requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  return { page, totalPages, offset: (page - 1) * PAGE_SIZE }
}

/** Canonical catalog URL. Page 1 is `/`, never `/?page=1` — one URL per page of results. */
export function catalogHref({ q, category, page }: CatalogParams): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  if (page > 1) params.set('page', String(page))

  const query = params.toString()
  return query ? `/?${query}` : '/'
}
