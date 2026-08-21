'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

/**
 * Reads the session on the client on purpose. Making SiteHeader an async Server Component
 * that reads cookies would opt the whole tree into dynamic rendering and defeat the
 * `revalidate = 60` ISR the product pages need (SPEC 3.2).
 */
export function AuthNav() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [signingOut, startSignOut] = useTransition()
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return null
  }

  if (!session) {
    return (
      <>
        <li>
          <Link href="/login" className="hover:underline">
            Log in
          </Link>
        </li>
        <li>
          <Link href="/signup" className="hover:underline">
            Sign up
          </Link>
        </li>
      </>
    )
  }

  return (
    <>
      <li className="text-muted-foreground">{session.user.email}</li>
      <li>
        <Button
          variant="outline"
          size="sm"
          // Without the guard a second click fires signOut again while the first is still in
          // flight — the same double-submit hazard the cart controls disable for (SPEC 3.7).
          disabled={signingOut}
          aria-busy={signingOut}
          onClick={() =>
            startSignOut(async () => {
              await authClient.signOut()
              // The cart and wishlist caches belong to the session that just ended.
              queryClient.clear()
              router.refresh()
            })
          }
        >
          {signingOut ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Sign out
        </Button>
      </li>
    </>
  )
}
