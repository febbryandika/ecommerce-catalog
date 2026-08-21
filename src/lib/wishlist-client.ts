'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toggleWishlist } from '@/actions/wishlist'
import { ActionError, actionErrorMessage } from '@/lib/action-error'
import type { WishlistItem } from '@/lib/cart-queries'
import { useAnnouncer } from '@/store/announcer'

export const wishlistKey = ['wishlist'] as const

async function fetchWishlist(): Promise<WishlistItem[]> {
  const response = await fetch('/api/wishlist')
  if (!response.ok) throw new Error('Could not load your wishlist.')
  return response.json()
}

export function useWishlist() {
  return useQuery({ queryKey: wishlistKey, queryFn: fetchWishlist })
}

/** Membership for one heart, derived from the single list query rather than a lookup per card. */
export function useIsWishlisted(productId: string) {
  return useQuery({
    queryKey: wishlistKey,
    queryFn: fetchWishlist,
    select: (items) => items.some((item) => item.productId === productId),
  })
}

/**
 * The optimistic toggle SPEC 3.5 asks for by name. The patch is derived from the cache rather
 * than from a `saved` flag passed in, so two fast clicks cannot desynchronise: each onMutate
 * reads whatever the previous one already wrote.
 */
export function useToggleWishlist() {
  const queryClient = useQueryClient()
  const announce = useAnnouncer((state) => state.announce)

  return useMutation({
    mutationFn: async (product: WishlistItem) => {
      const result = await toggleWishlist({ productId: product.productId })
      if ('error' in result) throw new ActionError(result.error)
      return result
    },
    onMutate: async (product: WishlistItem) => {
      await queryClient.cancelQueries({ queryKey: wishlistKey })
      const previous = queryClient.getQueryData<WishlistItem[]>(wishlistKey) ?? []
      const saved = previous.some((item) => item.productId === product.productId)

      queryClient.setQueryData<WishlistItem[]>(
        wishlistKey,
        saved
          ? previous.filter((item) => item.productId !== product.productId)
          : [...previous, product],
      )
      return { previous }
    },
    onError: (error, _product, context) => {
      queryClient.setQueryData<WishlistItem[]>(wishlistKey, context?.previous ?? [])
      toast.error(actionErrorMessage(error, 'Could not update your wishlist. Try again.'))
    },
    onSuccess: (result, product) => {
      const text = result.saved
        ? `${product.name} saved to your wishlist.`
        : `${product.name} removed from your wishlist.`
      toast.success(text)
      announce(text)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: wishlistKey }),
  })
}
