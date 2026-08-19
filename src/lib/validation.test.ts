import { describe, expect, it } from 'vitest'
import { productSchema, safeNextPath, signupSchema, updateProductSchema } from '@/lib/validation'

describe('safeNextPath', () => {
  it('keeps a same-origin path', () => {
    expect(safeNextPath('/admin/products')).toBe('/admin/products')
  })

  it('rejects a protocol-relative URL', () => {
    expect(safeNextPath('//evil.com')).toBe('/')
  })

  it('rejects an absolute URL', () => {
    expect(safeNextPath('https://evil.com')).toBe('/')
  })

  it('rejects a javascript: payload', () => {
    expect(safeNextPath('javascript:alert(1)')).toBe('/')
  })

  it('falls back to the catalog when absent', () => {
    expect(safeNextPath(undefined)).toBe('/')
    expect(safeNextPath('')).toBe('/')
  })
})

describe('signupSchema', () => {
  it('rejects a password shorter than 8 characters', () => {
    const result = signupSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'short',
    })
    expect(result.success).toBe(false)
  })

  it('strips a client-supplied role', () => {
    const result = signupSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'correct horse battery',
      role: 'admin',
    })
    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty('role')
  })
})

describe('productSchema', () => {
  const valid = {
    name: 'Wireless Keyboard',
    description: 'A keyboard.',
    price: 12800,
    stock: 5,
    categoryId: null,
    imageUrl: null,
  }

  it('accepts a whole-yen price with no category', () => {
    const result = productSchema.safeParse(valid)
    expect(result.success).toBe(true)
    expect(result.data?.categoryId).toBeNull()
  })

  it('rejects a fractional price', () => {
    // JPY has no minor unit and the column is `integer` (SPEC 3.2).
    expect(productSchema.safeParse({ ...valid, price: 1280.5 }).success).toBe(false)
  })

  it('rejects a negative price', () => {
    expect(productSchema.safeParse({ ...valid, price: -1 }).success).toBe(false)
  })

  it('rejects a blank price rather than reading it as zero', () => {
    // The regression this guards: z.coerce.number() would turn '' into 0 and publish a free
    // product. Both shapes an empty number input can produce must fail.
    expect(productSchema.safeParse({ ...valid, price: '' }).success).toBe(false)
    expect(productSchema.safeParse({ ...valid, price: undefined }).success).toBe(false)
    expect(productSchema.safeParse({ ...valid, price: Number.NaN }).success).toBe(false)
  })

  it('rejects a price above the int4 ceiling', () => {
    expect(productSchema.safeParse({ ...valid, price: 2_147_483_648 }).success).toBe(false)
  })

  it('rejects negative and fractional stock', () => {
    expect(productSchema.safeParse({ ...valid, stock: -1 }).success).toBe(false)
    expect(productSchema.safeParse({ ...valid, stock: 1.5 }).success).toBe(false)
  })

  it('trims the name and rejects one that is only whitespace', () => {
    const trimmed = productSchema.safeParse({ ...valid, name: '  Desk Lamp  ' })
    expect(trimmed.data?.name).toBe('Desk Lamp')
    expect(productSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false)
  })

  it('accepts a category id', () => {
    const result = productSchema.safeParse({ ...valid, categoryId: 'cat_123' })
    expect(result.data?.categoryId).toBe('cat_123')
  })
})

describe('updateProductSchema', () => {
  const valid = {
    id: 'prod_123',
    name: 'Wireless Keyboard',
    description: '',
    price: 12800,
    stock: 5,
    categoryId: null,
    imageUrl: null,
  }

  it('accepts the product fields plus an id', () => {
    expect(updateProductSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a missing id', () => {
    const { name, description, price, stock, categoryId } = valid
    expect(
      updateProductSchema.safeParse({ name, description, price, stock, categoryId }).success,
    ).toBe(false)
  })
})
