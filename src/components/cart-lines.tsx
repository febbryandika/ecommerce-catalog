'use client'

import { Loader2, Minus, Plus, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useCart, useRemoveFromCart, useUpdateQuantity } from '@/lib/cart-client'
import { formatJpy } from '@/lib/format'

/**
 * One list of cart lines, rendered by both CartSheet and /cart. They read the same ['cart']
 * query, so a change made in the sheet is already applied when the full page is opened — two
 * copies of this markup would also mean two chances to drift.
 */
export function CartLines({ emptyAction }: { emptyAction?: React.ReactNode }) {
  const { data: lines, isPending } = useCart()
  const updateQuantity = useUpdateQuantity()
  const removeFromCart = useRemoveFromCart()

  if (isPending) {
    return <p className="text-muted-foreground text-sm">Loading your cart…</p>
  }

  if (!lines || lines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground text-sm">Your cart is empty.</p>
        {emptyAction ?? (
          <Button asChild variant="outline" className="mt-4">
            <Link href="/">Browse the catalog</Link>
          </Button>
        )}
      </div>
    )
  }

  // One pending flag for the whole list rather than per row: the mutations share the ['cart']
  // cache, so letting a second row be clicked mid-write is the same double-submit hazard.
  const pending = updateQuantity.isPending || removeFromCart.isPending

  // Every row is disabled during a write, but only one is actually changing, so the spinner is
  // placed on that row alone. The in-flight mutation's own variables say which (SPEC 3.7).
  const busyProductId = updateQuantity.isPending
    ? updateQuantity.variables?.line.productId
    : removeFromCart.isPending
      ? removeFromCart.variables?.line.productId
      : undefined

  return (
    <ul aria-label="Cart items" className="divide-y">
      {lines.map((line) => (
        <li key={line.productId} className="flex items-center gap-4 py-4">
          {line.imageUrl ? (
            <Image
              src={line.imageUrl}
              alt={line.name}
              width={64}
              height={64}
              className="size-16 rounded-md object-cover"
            />
          ) : (
            <div className="bg-muted size-16 shrink-0 rounded-md" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1">
            <Link href={`/products/${line.productId}`} className="text-sm hover:underline">
              {line.name}
            </Link>
            <p className="text-muted-foreground mt-1 text-sm tabular-nums">
              {formatJpy(line.price)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={pending || line.quantity <= 1}
              onClick={() => updateQuantity.mutate({ line, quantity: line.quantity - 1 })}
            >
              <Minus />
              <span className="sr-only">Decrease quantity of {line.name}</span>
            </Button>

            {busyProductId === line.productId ? (
              <span className="flex w-8 justify-center">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="sr-only">Updating {line.name}…</span>
              </span>
            ) : (
              // The prefix is an sr-only child rather than an aria-label on the span: a bare
              // <span> maps to the `generic` role, which does not permit a name, so the label
              // would be discarded and the quantity announced as a naked number.
              <span className="w-8 text-center text-sm tabular-nums">
                <span className="sr-only">Quantity of {line.name}: </span>
                {line.quantity}
              </span>
            )}

            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={pending || line.quantity >= line.stock}
              onClick={() => updateQuantity.mutate({ line, quantity: line.quantity + 1 })}
            >
              <Plus />
              <span className="sr-only">Increase quantity of {line.name}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              onClick={() => removeFromCart.mutate({ line })}
            >
              <Trash2 />
              <span className="sr-only">Remove {line.name} from your cart</span>
            </Button>
          </div>

          <p className="w-24 text-right text-sm tabular-nums">
            {formatJpy(line.price * line.quantity)}
          </p>
        </li>
      ))}
    </ul>
  )
}
