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
