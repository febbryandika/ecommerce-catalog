'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, like, ne, not, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { products } from '@/db/schema'
import { AuthorizationError, requireRole } from '@/lib/auth'
import { sanitizeDescription } from '@/lib/sanitize'
import { nextAvailableSlug, slugify } from '@/lib/slug'
import {
  productSchema,
  updateProductSchema,
  type ProductInput,
  type UpdateProductInput,
} from '@/lib/validation'

type ActionResult = { ok: true } | { error: string }

// Not a form input, so it stays local rather than joining the shared schemas in
// validation.ts — but it is still parsed, because nothing reaches the DB unvalidated (SPEC 8).
const idSchema = z.string().min(1)

/**
 * requireRole throws so Route Handlers can answer 403, but a Server Action surfaces expected
 * failures as `{ error }`. Translating here keeps every action's happy path flat while leaving
 * genuine faults free to reach error.tsx. This — not proxy.ts — is the authorization boundary,
 * so all four actions call it independently (SPEC 3.1, 8).
 */
async function denyNonAdmin(): Promise<{ error: string } | null> {
  try {
    await requireRole('admin')
    return null
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: 'You do not have access to the catalog admin.' }
    }
    throw error
  }
}

/** Postgres unique_violation — the slug race that the pre-flight check cannot close. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

/**
 * products.slug is UNIQUE, so a duplicate name has to take a suffix. Reads the sibling slugs
 * first and lets the pure nextAvailableSlug pick; `excludeId` keeps an edit from colliding
 * with the row's own current slug.
 */
async function resolveSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || 'product'
  const siblings = await db
    .select({ slug: products.slug })
    .from(products)
    .where(
      and(
        or(eq(products.slug, base), like(products.slug, `${base}-%`)),
        excludeId ? ne(products.id, excludeId) : undefined,
      ),
    )

  return nextAvailableSlug(
    base,
    siblings.map((row) => row.slug),
  )
}

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  const denied = await denyNonAdmin()
  if (denied) return denied

  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return { error: 'Check the form for errors.' }
  const { name, description, price, stock, categoryId, imageUrl } = parsed.data

  try {
    await db.insert(products).values({
      name,
      slug: await resolveSlug(name),
      description: sanitizeDescription(description) || null,
      price,
      stock,
      categoryId,
      imageUrl,
    })
  } catch (error) {
    if (isUniqueViolation(error)) return { error: 'A product with that name already exists.' }
    throw error
  }

  revalidatePath('/admin/products')
  return { ok: true }
}

export async function updateProduct(input: UpdateProductInput): Promise<ActionResult> {
  const denied = await denyNonAdmin()
  if (denied) return denied

  const parsed = updateProductSchema.safeParse(input)
  if (!parsed.success) return { error: 'Check the form for errors.' }
  const { id, name, description, price, stock, categoryId, imageUrl } = parsed.data

  let updated
  try {
    updated = await db
      .update(products)
      .set({
        name,
        // Regenerated on rename: public routes key off the id (SPEC 6), so nothing breaks.
        slug: await resolveSlug(name, id),
        description: sanitizeDescription(description) || null,
        price,
        stock,
        categoryId,
        imageUrl,
      })
      .where(eq(products.id, id))
      .returning({ id: products.id })
  } catch (error) {
    if (isUniqueViolation(error)) return { error: 'A product with that name already exists.' }
    throw error
  }

  if (updated.length === 0) return { error: 'Product not found.' }

  revalidatePath('/admin/products')
  return { ok: true }
}

export async function deleteProduct(input: string): Promise<ActionResult> {
  const denied = await denyNonAdmin()
  if (denied) return denied

  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { error: 'Product not found.' }

  const deleted = await db
    .delete(products)
    .where(eq(products.id, parsed.data))
    .returning({ id: products.id })

  if (deleted.length === 0) return { error: 'Product not found.' }

  revalidatePath('/admin/products')
  return { ok: true }
}

export async function togglePublish(input: string): Promise<ActionResult> {
  const denied = await denyNonAdmin()
  if (denied) return denied

  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { error: 'Product not found.' }

  // Flipped in SQL rather than read-modify-write, so two admins cannot race each other.
  const updated = await db
    .update(products)
    .set({ isPublished: not(products.isPublished) })
    .where(eq(products.id, parsed.data))
    .returning({ id: products.id })

  if (updated.length === 0) return { error: 'Product not found.' }

  revalidatePath('/admin/products')
  return { ok: true }
}
