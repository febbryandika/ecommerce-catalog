import { describe, expect, it } from 'vitest'
import { safeNextPath, signupSchema } from '@/lib/validation'

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
