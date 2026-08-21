import { describe, expect, it } from 'vitest'
import { cartCount, cartSubtotal, clampQuantity } from '@/lib/cart'

describe('cartSubtotal', () => {
  it('is 0 for an empty cart', () => {
    expect(cartSubtotal([])).toBe(0)
  })

  it('multiplies each line by its quantity', () => {
    expect(cartSubtotal([{ price: 42800, quantity: 2 }])).toBe(85600)
  })

  it('sums across lines', () => {
    expect(
      cartSubtotal([
        { price: 42800, quantity: 2 },
        { price: 148000, quantity: 1 },
      ]),
    ).toBe(233600)
  })
})

describe('cartCount', () => {
  it('counts units rather than lines', () => {
    expect(cartCount([{ quantity: 2 }, { quantity: 3 }])).toBe(5)
  })

  it('is 0 for an empty cart', () => {
    expect(cartCount([])).toBe(0)
  })
})

describe('clampQuantity', () => {
  it('leaves a quantity within stock alone', () => {
    expect(clampQuantity(2, 5)).toBe(2)
  })

  it('clamps down to the available stock', () => {
    // halo-sleep-ring is seeded with stock 2, which is what the e2e clamp test leans on.
    expect(clampQuantity(5, 2)).toBe(2)
  })

  it('collapses to 0 when the product is out of stock', () => {
    expect(clampQuantity(3, 0)).toBe(0)
  })

  it('never returns a negative quantity', () => {
    expect(clampQuantity(-4, 10)).toBe(0)
  })
})
