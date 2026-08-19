/**
 * Lowercase ASCII slug: strips diacritics, replaces every other run of characters with a
 * single hyphen, and trims the strays. Returns '' when the name holds no Latin alphanumerics
 * — a fully Japanese product name does exactly that — so callers supply their own fallback
 * rather than getting a surprise empty slug into a NOT NULL column.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * First free slug in the `base`, `base-2`, `base-3` … sequence. `products.slug` is UNIQUE
 * (SPEC 4), so two products sharing a name have to land on different suffixes. Pure on
 * purpose: the caller supplies the taken set from the database, which keeps this unit
 * testable without one.
 */
export function nextAvailableSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) {
    return base
  }

  let suffix = 2
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1
  }
  return `${base}-${suffix}`
}
