'use client'

import { Heart, Loader2 } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import type { WishlistItem } from '@/lib/cart-queries'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { loginIntentHref } from '@/lib/validation'
import { useIsWishlisted, useToggleWishlist } from '@/lib/wishlist-client'

/**
 * A client island deliberately, even on pages that are otherwise fully server-rendered: reading
 * "is this saved" on the server would need cookies() and would opt /products/[id] out of its
 * `revalidate = 60` ISR (SPEC 3.2). Same reasoning as AuthNav.
 *
 * Signed out the click routes to login and is replayed afterwards, so it is never silently
 * dropped (SPEC 3.5). It stays a button rather than becoming an anchor: an extra link carrying
 * the product name inside every card collides with the stretched title link.
 */
export function WishlistToggle({ product }: { product: WishlistItem }) {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const { data: saved } = useIsWishlisted(product.productId)
  const toggle = useToggleWishlist()
  const pathname = usePathname()
  const router = useRouter()

  // The heart sits on top of ProductCard's stretched title link, which covers the whole card.
  const className = 'relative z-10'

  if (sessionPending) {
    return <div className="size-9" aria-hidden="true" />
  }

  if (!session) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className}
        onClick={() => router.push(loginIntentHref(pathname, 'wish', product.productId))}
      >
        <Heart />
        <span className="sr-only">Save {product.name} to your wishlist</span>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-pressed={saved ?? false}
      disabled={toggle.isPending}
      aria-busy={toggle.isPending}
      onClick={() => toggle.mutate(product)}
    >
      {toggle.isPending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Heart className={cn(saved && 'fill-current')} />
      )}
      <span className="sr-only">
        {saved
          ? `Remove ${product.name} from your wishlist`
          : `Save ${product.name} to your wishlist`}
      </span>
    </Button>
  )
}
