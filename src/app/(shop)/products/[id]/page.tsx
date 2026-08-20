import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { and, eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { db } from '@/db'
import { categories, products } from '@/db/schema'
import { formatJpy } from '@/lib/format'
import { toMetaDescription } from '@/lib/sanitize'

/**
 * SPEC 3.2. Valid because next.config.ts does not enable cacheComponents — Next 16 removes this
 * export when it is on, which would silently drop ISR. Nothing in this tree reads cookies() or
 * headers(): AuthNav is a client component precisely so the header cannot opt the page into
 * dynamic rendering.
 */
export const revalidate = 60

/**
 * cache() rather than querying twice: generateMetadata and the page both need the row. It is
 * request-scoped memoisation and is orthogonal to the ISR window above.
 *
 * isPublished lives in the WHERE rather than being checked after the read, so an unpublished id
 * is indistinguishable from a nonexistent one — no oracle, and one 404 path for both (SPEC 8).
 */
const getPublishedProduct = cache(async (id: string) => {
  const [row] = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      stock: products.stock,
      imageUrl: products.imageUrl,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.id, id), eq(products.isPublished, true)))

  return row ?? null
})

export async function generateMetadata({ params }: PageProps<'/products/[id]'>): Promise<Metadata> {
  const { id } = await params
  const product = await getPublishedProduct(id)

  // A 404 still renders a <head>; give it its own title rather than inheriting the catalog's.
  if (!product) {
    return { title: 'Product not found' }
  }

  const description = product.description ? toMetaDescription(product.description) : undefined

  return {
    title: product.name,
    description,
    openGraph: {
      // 'product' is not in Next's OpenGraphType union and fails typecheck.
      type: 'website',
      title: product.name,
      description,
      url: `/products/${product.id}`,
      // Omitted rather than faked when there is no image: metadataBase in the root layout
      // resolves the relative url above, but inventing a placeholder asset is not in scope.
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.name }] : undefined,
    },
  }
}

export default async function ProductDetailPage({ params }: PageProps<'/products/[id]'>) {
  const { id } = await params
  const product = await getPublishedProduct(id)

  if (!product) {
    notFound()
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="grid gap-10 md:grid-cols-2">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={800}
            height={800}
            className="aspect-square w-full rounded-xl border object-cover"
          />
        ) : (
          <div className="bg-muted aspect-square w-full rounded-xl border" aria-hidden="true" />
        )}

        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-muted-foreground mt-2">{product.categoryName ?? 'Uncategorised'}</p>
          <p className="mt-6 text-2xl tabular-nums">{formatJpy(product.price)}</p>
          <Badge variant={product.stock > 0 ? 'default' : 'secondary'} className="mt-4">
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </Badge>

          {product.description ? (
            // Already sanitised on save, inside the Server Actions (src/lib/sanitize.ts) — this
            // is the first consumer of that guarantee, so it renders rather than re-sanitises.
            // The allowlist stops at h2/h3 because the h1 above is the page's.
            <div
              className="prose prose-neutral mt-8 max-w-none"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          ) : null}
        </div>
      </div>

      <Button asChild variant="outline" className="mt-10">
        <Link href="/">Back to the catalog</Link>
      </Button>
    </section>
  )
}
