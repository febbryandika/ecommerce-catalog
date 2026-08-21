'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { cartItems, products } from '@/db/schema'
import { getSession } from '@/lib/auth'
import { cartItemSchema, productIdSchema } from '@/lib/validation'

type ActionResult = { ok: true } | { error: string }

/**
 * getSession rather than requireUser: requireUser *redirects*, which is the right failure for a
 * page but wrong inside an action — a redirect from a mutation is a navigation, not something
 * the caller can render. Expected failures come back as `{ error }` (SPEC 3.7), the same shape
 * denyNonAdmin produces in products.ts.
 *
 * The id is read from the session on every call and never accepted as an argument, which is what
 * makes "scoped by the session userId, never by a client-supplied id" (SPEC 8) structural rather
 * than a convention someone has to remember.
 */
async function currentUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.user.id ?? null
}

const SIGNED_OUT = 'Log in to use your cart.'

export async function addToCart(input: unknown): Promise<ActionResult> {
  const userId = await currentUserId()
  if (!userId) return { error: SIGNED_OUT }

  const parsed = cartItemSchema.safeParse(input)
  if (!parsed.success) return { error: 'That is not a valid quantity.' }
  const { productId, quantity } = parsed.data

  const [product] = await db
    .select({ stock: products.stock })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.isPublished, true)))

  if (!product) return { error: 'Product not found.' }
  if (product.stock === 0) return { error: 'This product is out of stock.' }

  // LEAST in SQL, not in the client: stock can change between the button rendering and this
  // write, and a read-modify-write would let two tabs race past the cap (CLAUDE.md invariants).
  await db
    .insert(cartItems)
    .values({ userId, productId, quantity: Math.min(quantity, product.stock) })
    .onConflictDoUpdate({
      target: [cartItems.userId, cartItems.productId],
      set: { quantity: sql`LEAST(${cartItems.quantity} + ${quantity}, ${product.stock})` },
    })

  revalidatePath('/cart')
  return { ok: true }
}

/**
 * Sets an absolute quantity, where addToCart increments — the +/- controls know the number they
 * want, and sending a delta would compound if a click were retried.
 */
export async function updateQuantity(input: unknown): Promise<ActionResult> {
  const userId = await currentUserId()
  if (!userId) return { error: SIGNED_OUT }

  const parsed = cartItemSchema.safeParse(input)
  if (!parsed.success) return { error: 'That is not a valid quantity.' }
  const { productId, quantity } = parsed.data

  const [product] = await db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, productId))

  if (!product) return { error: 'Product not found.' }

  // The ::int casts are load-bearing. Both operands are bound parameters, so without them
  // Postgres has no column to infer a type from and LEAST($1, $2) fails outright. addToCart
  // gets away without them only because cartItems.quantity types that expression for it.
  const updated = await db
    .update(cartItems)
    .set({ quantity: sql`LEAST(${quantity}::int, ${product.stock}::int)` })
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .returning({ id: cartItems.id })

  if (updated.length === 0) return { error: 'That item is no longer in your cart.' }

  revalidatePath('/cart')
  return { ok: true }
}

export async function removeFromCart(input: unknown): Promise<ActionResult> {
  const userId = await currentUserId()
  if (!userId) return { error: SIGNED_OUT }

  const parsed = productIdSchema.safeParse(input)
  if (!parsed.success) return { error: 'Product not found.' }

  // Scoped by both columns, so a forged productId can only ever delete the caller's own row.
  const deleted = await db
    .delete(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, parsed.data.productId)))
    .returning({ id: cartItems.id })

  if (deleted.length === 0) return { error: 'That item is no longer in your cart.' }

  revalidatePath('/cart')
  return { ok: true }
}
