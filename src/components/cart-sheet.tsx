'use client'

import { ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { CartLines } from '@/components/cart-lines'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cartCount, cartSubtotal } from '@/lib/cart'
import { useCart } from '@/lib/cart-client'
import { formatJpy } from '@/lib/format'
import { authClient } from '@/lib/auth-client'

/**
 * The header's cart control. Open state is local component state rather than Zustand: nothing
 * outside this subtree needs to read or set it, so a store would be a second source of truth for
 * no gain (src/store/filters.ts makes the same argument about filter values).
 *
 * Radix's Dialog gives the sheet its focus trap, Esc-to-close and focus return to the trigger.
 * SPEC 3.7 says to verify that rather than assume it: e2e/cart.spec.ts covers Esc-closes and
 * focus-returns-to-trigger, and e2e/keyboard.spec.ts covers the trap itself in both directions.
 *
 * There is deliberately no checkout button: checkout, payment and orders are project #29
 * (SPEC 12).
 */
export function CartSheet() {
  const [open, setOpen] = useState(false)
  const { data: session } = authClient.useSession()
  const { data: lines } = useCart()

  const count = cartCount(lines ?? [])
  const subtotal = cartSubtotal(lines ?? [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative">
          <ShoppingCart />
          {/* The badge is decorative: the count is already in the sr-only label below, and
              leaving it exposed prepends a bare number to the button's accessible name. */}
          {count > 0 ? (
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] tabular-nums"
            >
              {count}
            </span>
          ) : null}
          <span className="sr-only">
            {count > 0 ? `Open cart, ${count} item${count === 1 ? '' : 's'}` : 'Open cart, empty'}
          </span>
        </Button>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>
            {session
              ? 'Quantities are capped at the stock we have on hand.'
              : 'Log in to build a cart.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <CartLines
            emptyAction={
              <SheetClose asChild>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/">Browse the catalog</Link>
                </Button>
              </SheetClose>
            }
          />
        </div>

        <SheetFooter>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatJpy(subtotal)}</span>
          </div>
          <SheetClose asChild>
            <Button variant="outline" asChild>
              <Link href="/cart">View full cart</Link>
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
