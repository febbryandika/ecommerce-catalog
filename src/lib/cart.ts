/**
 * Pure cart arithmetic, kept out of the components so it is testable without a DOM — vitest
 * runs `environment: 'node'` and every existing unit test is a pure function.
 */

export type CartLine = {
  productId: string
  name: string
  price: number
  quantity: number
}

/**
 * Whole yen, so a plain sum is exact — there is no minor unit to round and `price` is an
 * `integer` column (SPEC 3.2). This would need care in a currency with cents; it does not here.
 */
export function cartSubtotal(lines: Pick<CartLine, 'price' | 'quantity'>[]): number {
  return lines.reduce((total, line) => total + line.price * line.quantity, 0)
}

/** Total units, not line count — what the header badge shows. */
export function cartCount(lines: Pick<CartLine, 'quantity'>[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0)
}

/**
 * Mirrors the `LEAST(..., stock)` the Server Action applies in SQL. The database is the
 * authority — stock can change between render and write — but the optimistic update has to
 * predict the same number, otherwise the row visibly jumps when the refetch lands.
 *
 * Floors at 0 rather than 1: a clamp against stock 0 has no valid quantity, and the caller
 * treats 0 as "remove the line".
 */
export function clampQuantity(quantity: number, stock: number): number {
  return Math.max(0, Math.min(quantity, stock))
}
