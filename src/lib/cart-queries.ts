import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { cartItems, products, wishlistItems } from '@/db/schema'

export type CartLineItem = {
  productId: string
  name: string
  price: number
  imageUrl: string | null
  stock: number
  quantity: number
}

export type WishlistItem = Omit<CartLineItem, 'quantity'>

/**
 * The read half of cart and wishlist, deliberately kept out of the Server Action files.
 *
 * A Server Action is a POST that also returns the current route's RSC payload, so using one as a
 * TanStack `queryFn` means every page issues a POST to itself on mount. If one of those is still
 * in flight when the user navigates, Next applies the *previous* route's payload on top of the
 * new page and its metadata comes back with it — which showed up as a duplicated
 * <meta name="description"> after any client-side navigation.
 *
 * These are plain functions instead, shared by the GET route handlers the client fetches and by
 * the /cart and /wishlist pages that server-render the first paint. Both callers pass a userId
 * they resolved from the session themselves — this module never reads one from a request (SPEC 8).
 */
export function selectCartLines(userId: string): Promise<CartLineItem[]> {
  return db
    .select({
      productId: cartItems.productId,
      name: products.name,
      price: products.price,
      imageUrl: products.imageUrl,
      stock: products.stock,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(and(eq(cartItems.userId, userId), eq(products.isPublished, true)))
    .orderBy(products.name)
}

export function selectWishlistItems(userId: string): Promise<WishlistItem[]> {
  return db
    .select({
      productId: wishlistItems.productId,
      name: products.name,
      price: products.price,
      imageUrl: products.imageUrl,
      stock: products.stock,
    })
    .from(wishlistItems)
    .innerJoin(products, eq(products.id, wishlistItems.productId))
    .where(and(eq(wishlistItems.userId, userId), eq(products.isPublished, true)))
    .orderBy(products.name)
}
