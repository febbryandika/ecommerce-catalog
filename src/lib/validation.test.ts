import { describe, expect, it } from 'vitest'
import {
  describeSchema,
  loginIntentHref,
  MAX_IMAGE_BYTES,
  productImageSchema,
  productSchema,
  safeNextPath,
  signupSchema,
  updateProductSchema,
} from '@/lib/validation'

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

  it('accepts an https image url', () => {
    const url = 'https://pub-abc.r2.dev/products/xyz.jpg'
    expect(productSchema.safeParse({ ...valid, imageUrl: url }).data?.imageUrl).toBe(url)
  })

  // The regression this guards: imageUrl is rendered into an <img src>, and z.url() alone
  // accepts javascript: because the WHATWG parser does.
  it('rejects an image url that is not https', () => {
    expect(productSchema.safeParse({ ...valid, imageUrl: 'javascript:alert(1)' }).success).toBe(
      false,
    )
    expect(productSchema.safeParse({ ...valid, imageUrl: 'http://x.test/a.jpg' }).success).toBe(
      false,
    )
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
    const { name, description, price, stock, categoryId, imageUrl } = valid
    expect(
      updateProductSchema.safeParse({ name, description, price, stock, categoryId, imageUrl })
        .success,
    ).toBe(false)
  })
})

describe('productImageSchema', () => {
  const file = (type: string, bytes = 8) => new File([new Uint8Array(bytes)], 'photo', { type })

  it('accepts every type the dropzone offers', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(productImageSchema.safeParse(file(type)).success).toBe(true)
    }
  })

  it('rejects a type the accept attribute would have blocked', () => {
    expect(productImageSchema.safeParse(file('image/gif')).success).toBe(false)
  })

  // Not just "another unsupported type": an SVG is a script-bearing document, and these are
  // served from a public bucket.
  it('rejects an svg', () => {
    expect(productImageSchema.safeParse(file('image/svg+xml')).success).toBe(false)
  })

  it('accepts a file exactly at the size cap', () => {
    expect(productImageSchema.safeParse(file('image/png', MAX_IMAGE_BYTES)).success).toBe(true)
  })

  it('rejects a file one byte over the size cap', () => {
    expect(productImageSchema.safeParse(file('image/png', MAX_IMAGE_BYTES + 1)).success).toBe(false)
  })

  it('rejects input that is not a file at all', () => {
    expect(productImageSchema.safeParse('https://x.test/a.jpg').success).toBe(false)
    expect(productImageSchema.safeParse(null).success).toBe(false)
  })
})

describe('describeSchema', () => {
  it('rejects whitespace-only specs, which would otherwise reach the model as an empty prompt', () => {
    const result = describeSchema.safeParse({ name: 'Aurora Headphones', specs: '   \n  ' })

    expect(result.success).toBe(false)
  })

  it('rejects a blank product name', () => {
    expect(describeSchema.safeParse({ name: '', specs: '- 40 mm drivers' }).success).toBe(false)
  })

  it('trims what it passes on, so the prompt never carries the textarea padding', () => {
    const result = describeSchema.safeParse({
      name: '  Aurora Headphones  ',
      specs: '- 40 mm drivers\n',
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ name: 'Aurora Headphones', specs: '- 40 mm drivers' })
  })
})

describe('loginIntentHref', () => {
  it('carries the add intent alongside the return path', () => {
    expect(loginIntentHref('/products/abc', 'add', 'abc')).toBe(
      '/login?next=%2Fproducts%2Fabc&add=abc',
    )
  })

  it('carries the wish intent', () => {
    expect(loginIntentHref('/products/abc', 'wish', 'abc')).toBe(
      '/login?next=%2Fproducts%2Fabc&wish=abc',
    )
  })

  it('sanitises the return path through safeNextPath', () => {
    // An off-site next would otherwise turn the login page into an open redirect.
    expect(loginIntentHref('//evil.example.com', 'add', 'abc')).toBe('/login?next=%2F&add=abc')
  })

  it('encodes a return path that already has a query string', () => {
    expect(loginIntentHref('/?q=lens', 'add', 'abc')).toBe('/login?next=%2F%3Fq%3Dlens&add=abc')
  })
})
