'use client'

import { usePathname, useRouter } from 'next/navigation'
import type { CartLineItem } from '@/lib/cart-queries'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { useAddToCart } from '@/lib/cart-client'
import { loginIntentHref } from '@/lib/validation'

type Product = Pick<CartLineItem, 'productId' | 'name' | 'price' | 'imageUrl' | 'stock'>

/**
 * Signed out this still renders a button, and the click routes to /login?next=…&add=…: SPEC 3.4
 * is explicit that the click is never silently dropped and that the intent is replayed after
 * login. The intent lives in the URL and nowhere else — there is no guest cart table.
 *
 * A button rather than a Link on purpose. An anchor here would put a second and third link
 * carrying the product's name inside every card, which collides with the stretched title link
 * that makes the card one link — and would have the grid prefetch /login once per card.
 */
export function AddToCartButton({
  product,
  className,
  size,
}: {
  product: Product
  className?: string
  size?: 'sm' | 'default'
}) {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const add = useAddToCart()
  const pathname = usePathname()
  const router = useRouter()

  const outOfStock = product.stock === 0
  const label = outOfStock ? 'Out of stock' : 'Add to cart'

  if (sessionPending) {
    return (
      <Button size={size} className={className} disabled>
        {label}
      </Button>
    )
  }

  if (!session) {
    return (
      <Button
        type="button"
        size={size}
        className={className}
        disabled={outOfStock}
        onClick={() => router.push(loginIntentHref(pathname, 'add', product.productId))}
      >
        {label}
        <span className="sr-only"> — {product.name}</span>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size={size}
      className={className}
      // isPending covers the double-submit case the +/- controls also guard against: a second
      // click before the write settles would add a second unit.
      disabled={outOfStock || add.isPending}
      onClick={() => add.mutate({ product, quantity: 1 })}
    >
      {label}
      <span className="sr-only"> — {product.name}</span>
    </Button>
  )
}
