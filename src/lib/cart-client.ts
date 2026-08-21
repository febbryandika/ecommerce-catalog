'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { addToCart, removeFromCart, updateQuantity } from '@/actions/cart'
import { ActionError, actionErrorMessage } from '@/lib/action-error'
import { clampQuantity } from '@/lib/cart'
import type { CartLineItem } from '@/lib/cart-queries'
import { useAnnouncer } from '@/store/announcer'

export const cartKey = ['cart'] as const

async function fetchCart(): Promise<CartLineItem[]> {
  const response = await fetch('/api/cart')
  if (!response.ok) throw new Error('Could not load your cart.')
  return response.json()
}

export function useCart() {
  return useQuery({ queryKey: cartKey, queryFn: fetchCart })
}

/**
 * Server Actions resolve to `{ error }` for expected failures rather than throwing (SPEC 3.7).
 * TanStack only runs onError — and therefore only rolls back — for a *rejected* mutationFn, so
 * the error shape has to be turned back into a throw here. Forgetting this is the failure mode
 * where the optimistic value silently sticks after a failed write.
 */
async function run<T extends { ok: true } | { error: string }>(result: Promise<T>) {
  const settled = await result
  if ('error' in settled) throw new ActionError(settled.error)
  return settled
}

type Product = Pick<CartLineItem, 'productId' | 'name' | 'price' | 'imageUrl' | 'stock'>

/**
 * The three cart writes share one optimistic pipeline: cancel any in-flight refetch (otherwise a
 * response that left before the click can land after it and undo the patch), snapshot, patch,
 * roll the snapshot back on failure, and refetch once settled so the server stays the authority
 * on the clamped quantity.
 */
function useCartMutation<V>(
  mutationFn: (vars: V) => Promise<unknown>,
  patch: (lines: CartLineItem[], vars: V) => CartLineItem[],
  message: (vars: V) => string,
) {
  const queryClient = useQueryClient()
  const announce = useAnnouncer((state) => state.announce)

  return useMutation({
    mutationFn,
    onMutate: async (vars: V) => {
      await queryClient.cancelQueries({ queryKey: cartKey })
      const previous = queryClient.getQueryData<CartLineItem[]>(cartKey) ?? []
      queryClient.setQueryData<CartLineItem[]>(cartKey, patch(previous, vars))
      return { previous }
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData<CartLineItem[]>(cartKey, context?.previous ?? [])
      toast.error(actionErrorMessage(error, 'Could not update your cart. Try again.'))
    },
    onSuccess: (_data, vars) => {
      const text = message(vars)
      toast.success(text)
      announce(text)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: cartKey }),
  })
}

export function useAddToCart() {
  return useCartMutation<{ product: Product; quantity: number }>(
    ({ product, quantity }) => run(addToCart({ productId: product.productId, quantity })),
    (lines, { product, quantity }) => {
      const existing = lines.find((line) => line.productId === product.productId)
      if (!existing) {
        return [...lines, { ...product, quantity: clampQuantity(quantity, product.stock) }]
      }
      return lines.map((line) =>
        line.productId === product.productId
          ? { ...line, quantity: clampQuantity(line.quantity + quantity, line.stock) }
          : line,
      )
    },
    ({ product }) => `${product.name} added to your cart.`,
  )
}

export function useUpdateQuantity() {
  return useCartMutation<{ line: CartLineItem; quantity: number }>(
    ({ line, quantity }) => run(updateQuantity({ productId: line.productId, quantity })),
    (lines, { line, quantity }) =>
      lines.map((current) =>
        current.productId === line.productId
          ? { ...current, quantity: clampQuantity(quantity, current.stock) }
          : current,
      ),
    ({ line, quantity }) => `${line.name} quantity set to ${clampQuantity(quantity, line.stock)}.`,
  )
}

export function useRemoveFromCart() {
  return useCartMutation<{ line: CartLineItem }>(
    ({ line }) => run(removeFromCart({ productId: line.productId })),
    (lines, { line }) => lines.filter((current) => current.productId !== line.productId),
    ({ line }) => `${line.name} removed from your cart.`,
  )
}
