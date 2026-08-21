'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { products, wishlistItems } from '@/db/schema'
import { getSession } from '@/lib/auth'
import { productIdSchema } from '@/lib/validation'

/** Same reasoning as cart.ts: the userId comes from the session, never from the caller. */
async function currentUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.user.id ?? null
}

/**
 * Delete-or-insert against uq_wishlist_item. Returns which way it went so the caller can announce
 * "Saved" or "Removed" — a bare { ok: true } would leave the toast guessing.
 *
 * The delete runs first and its result decides: that is one round trip in the common case and
 * needs no pre-flight SELECT, matching how products.ts detects a miss with .returning().
 */
export async function toggleWishlist(
  input: unknown,
): Promise<{ ok: true; saved: boolean } | { error: string }> {
  const userId = await currentUserId()
  if (!userId) return { error: 'Log in to save products.' }

  const parsed = productIdSchema.safeParse(input)
  if (!parsed.success) return { error: 'Product not found.' }
  const { productId } = parsed.data

  const removed = await db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)))
    .returning({ id: wishlistItems.id })

  if (removed.length > 0) {
    revalidatePath('/wishlist')
    return { ok: true, saved: false }
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.isPublished, true)))

  if (!product) return { error: 'Product not found.' }

  await db.insert(wishlistItems).values({ userId, productId })

  revalidatePath('/wishlist')
  return { ok: true, saved: true }
}
