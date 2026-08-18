import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

// No `role` key: the client has no say in it, and the server ignores it anyway because
// the field is declared `input: false` (SPEC 7).
export const signupSchema = loginSchema.extend({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'Name is too long.'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>

/**
 * One schema for both halves of the admin form — create and edit take the same fields, and
 * updateProductSchema only adds the id. Shared with the Server Action, which re-parses on the
 * server because a client-side resolver is a convenience, not a boundary (SPEC 8).
 *
 * price and stock are strict `z.int()` rather than `z.coerce.number()` on purpose: coercion
 * parses '' and null to 0, so a blank price field would silently save a 0 yen product.
 * The upper bounds are the Postgres int4 ceiling — the columns are `integer` (SPEC 3.2).
 */
const INT4_MAX = 2_147_483_647

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Enter a product name.').max(120, 'Name is too long.'),
  description: z.string().max(5000, 'Description is too long.'),
  price: z
    .int({ error: 'Enter a price in whole yen.' })
    .min(0, 'Price cannot be negative.')
    .max(INT4_MAX, 'Price is too large.'),
  stock: z
    .int({ error: 'Enter a stock count.' })
    .min(0, 'Stock cannot be negative.')
    .max(INT4_MAX, 'Stock is too large.'),
  categoryId: z.string().min(1, 'Choose a category.').nullable(),
})

export const updateProductSchema = productSchema.extend({
  id: z.string().min(1, 'Missing product id.'),
})

export type ProductInput = z.infer<typeof productSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>

/**
 * Constrains a `?next=` value to a path on this origin. Anything else — a protocol-relative
 * `//evil.com`, an absolute URL, a `javascript:` payload — collapses to '/', so the login
 * redirect cannot be turned into an open redirect.
 */
export function safeNextPath(next: string | undefined | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/'
  }
  return next
}
