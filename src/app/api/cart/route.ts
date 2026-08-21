import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { selectCartLines } from '@/lib/cart-queries'

/**
 * A GET, which is the whole point: the client polls this through TanStack Query, and a Server
 * Action would make that a POST that re-renders the current route (see src/lib/cart-queries.ts).
 * Mutations stay Server Actions — this is a read.
 *
 * An empty cart is the correct answer for a signed-out visitor, not a 401: the UI already shows
 * the logged-out affordance from the session it reads client-side, and a 401 would only give
 * TanStack something to retry.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json([])

  const lines = await selectCartLines(session.user.id)
  // Private and uncacheable: this is one user's cart, and it sits behind a shared CDN.
  return NextResponse.json(lines, { headers: { 'Cache-Control': 'private, no-store' } })
}
