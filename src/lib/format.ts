const jpy = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' })

/** Formats a whole-yen amount. JPY has no minor unit — pass an integer, never a float. */
export function formatJpy(price: number): string {
  return jpy.format(price)
}
