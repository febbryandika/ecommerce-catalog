'use client'

import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import type { WishlistItem } from '@/lib/cart-queries'
import { ProductCard } from '@/components/product-card'
import { Button } from '@/components/ui/button'
import { useWishlist, wishlistKey } from '@/lib/wishlist-client'

/**
 * Reads the same ['wishlist'] query the hearts everywhere else write to, which is what makes
 * un-hearting a product here remove its card immediately instead of waiting for a refresh.
 *
 * ProductCard has no server-only imports, so rendering it from this client component simply
 * bundles it for the browser — it stays a Server Component on the grid, where that matters.
 */
export function WishlistGrid({ initialItems }: { initialItems: WishlistItem[] }) {
  const queryClient = useQueryClient()
  useState(() => {
    if (queryClient.getQueryData(wishlistKey) === undefined) {
      queryClient.setQueryData(wishlistKey, initialItems)
    }
  })

  const { data: items } = useWishlist()
  const list = items ?? initialItems

  if (list.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">You have not saved anything yet.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/">Browse the catalog</Link>
        </Button>
      </div>
    )
  }

  return (
    <ul
      aria-label="Saved products"
      className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {list.map((item) => (
        <li key={item.productId}>
          <ProductCard {...item} id={item.productId} />
        </li>
      ))}
    </ul>
  )
}
