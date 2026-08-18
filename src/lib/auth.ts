import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/db'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      // `input: false` is the security control: the client cannot set its own role at
      // signup, and admins are promoted manually in the database (SPEC 3.1, 7).
      role: { type: 'string', required: false, defaultValue: 'customer', input: false },
    },
  },
})

export type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

/** Thrown when a session exists but lacks the required role. */
export class AuthorizationError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

/** The current session, or null. For callers that want to return `{ error }` themselves. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

/**
 * Requires a signed-in user, redirecting to /login otherwise. `redirect()` is valid in
 * both Server Components and Server Actions, so this is the helper page-level code wants.
 */
export async function requireUser(next?: string) {
  const session = await getSession()
  if (!session) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : '/login')
  }
  return session
}

/**
 * Requires a specific role, throwing AuthorizationError otherwise. Route Handlers catch
 * this to answer 403; pages let it reach error.tsx. This — not proxy.ts — is the
 * authorization boundary (SPEC 8), so every admin action must call it.
 */
export async function requireRole(role: string) {
  const session = await getSession()
  if (session?.user.role !== role) {
    throw new AuthorizationError()
  }
  return session
}
