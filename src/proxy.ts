import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Routing convenience only, never the authorization boundary: getSessionCookie is a
 * cookie-presence check with no database round trip, so it is forgeable. Admin pages and
 * actions re-check with requireRole('admin') (SPEC 3.1, 8).
 *
 * Next 16 renamed middleware.ts to proxy.ts. Proxy runs on the Node.js runtime and throws
 * if `runtime` appears in its config, so do not add one.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = { matcher: '/admin/:path*' }
