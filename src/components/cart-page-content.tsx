'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CartLineItem } from '@/lib/cart-queries'
import { CartLines } from '@/components/cart-lines'
import { cartSubtotal } from '@/lib/cart'
import { cartKey, useCart } from '@/lib/cart-client'
import { formatJpy } from '@/lib/format'

/**
 * Seeds the ['cart'] cache with what the server already rendered, so the page does not flash a
 * loading state on the way to the same data. useState makes it a one-time write on mount:
 * setQueryData during render would fire on every render and stamp on newer values.
 *
 * No checkout button here on purpose — checkout, payment and orders are project #29 (SPEC 12).
 */
export function CartPageContent({ initialLines }: { initialLines: CartLineItem[] }) {
  const queryClient = useQueryClient()
  useState(() => {
    if (queryClient.getQueryData(cartKey) === undefined) {
      queryClient.setQueryData(cartKey, initialLines)
    }
  })

  const { data: lines } = useCart()
  const subtotal = cartSubtotal(lines ?? initialLines)

  return (
    <>
      <div className="mt-8">
        <CartLines />
      </div>

      <div className="mt-8 flex items-center justify-between border-t pt-6">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="text-xl tabular-nums">{formatJpy(subtotal)}</span>
      </div>
    </>
  )
}
