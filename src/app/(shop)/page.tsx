import Link from 'next/link'
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm'
import { ProductCard } from '@/components/product-card'
import { ProductFilters } from '@/components/product-filters'
import { Button } from '@/components/ui/button'
import { db } from '@/db'
import { categories, products } from '@/db/schema'
import {
  catalogHref,
  escapeLikePattern,
  paginate,
  parseCatalogParams,
  PAGE_SIZE,
} from '@/lib/catalog'

export const metadata = { title: 'Catalog' }

/**
 * The public grid (SPEC 3.3). Reading searchParams makes this dynamically rendered, which is
 * what the URL-as-source-of-truth contract requires — it is still server-rendered, just not
 * prerendered, and nothing about SEO depends on it being static.
 *
 * No `revalidate` here on purpose: the detail pages are the ISR surface (SPEC 3.2), and a
 * cached grid would hide a just-published product behind a 60 second window.
 */
export default async function CatalogPage({ searchParams }: PageProps<'/'>) {
  const requested = parseCatalogParams(await searchParams)

  // leftJoin rather than innerJoin, in both queries: with no category filter an innerJoin
  // would silently drop every product whose category_id is NULL, and `categories.slug = $1` in
  // the WHERE excludes those rows anyway when the filter *is* on (NULL = 'x' is NULL, not
  // true). So one join is correct in both modes. schema.ts declares no relations(), so
  // db.query with `with:` is unavailable regardless.
  const where = and(
    eq(products.isPublished, true),
    requested.q ? ilike(products.name, `%${escapeLikePattern(requested.q)}%`) : undefined,
    requested.category ? eq(categories.slug, requested.category) : undefined,
  )

  // The filter options and the total are independent, so they overlap. The total has to land
  // before the rows query can pick an offset, which is the one serial hop on this page — worth
  // it, because it is what lets paginate() clamp an out-of-range ?page= instead of rendering an
  // empty grid under a "Page 99 of 2" heading.
  const [categoryOptions, [totalRow]] = await Promise.all([
    db
      .select({ name: categories.name, slug: categories.slug })
      .from(categories)
      .orderBy(asc(categories.name)),
    // count(*) is exact over this join: category_id references the categories primary key, so
    // the join is many-to-one and cannot multiply a product into several rows.
    db
      .select({ value: count() })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(where),
  ])

  const total = totalRow?.value ?? 0
  const { page, totalPages, offset } = paginate(total, requested.page)

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      imageUrl: products.imageUrl,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(where)
    // products.id is the primary key, so it makes the order total. Without a unique tiebreaker
    // two rows sharing a created_at can swap between pages, and LIMIT/OFFSET then shows one
    // twice and skips the other. SPEC lists no sort options; newest first is the only order.
    .orderBy(desc(products.createdAt), desc(products.id))
    .limit(PAGE_SIZE)
    .offset(offset)

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Catalog</h1>
      <p className="text-muted-foreground mt-2">
        {total === 0
          ? 'Nothing matches those filters.'
          : `${total} product${total === 1 ? '' : 's'} available.`}
      </p>

      <ProductFilters categories={categoryOptions} />

      {rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-muted-foreground">
            No published product matches that search or category.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/">Clear filters</Link>
          </Button>
        </div>
      ) : (
        // Named because SiteHeader renders a <ul> too, and an unlabelled list would make
        // getByRole('listitem') match the nav items as well.
        <ul
          aria-label="Products"
          className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          {rows.map((row) => (
            <li key={row.id}>
              <ProductCard {...row} />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4">
          {page > 1 ? (
            <Button asChild variant="outline">
              <Link href={catalogHref({ ...requested, page: page - 1 })} rel="prev">
                Previous
              </Link>
            </Button>
          ) : null}
          <p className="text-muted-foreground text-sm tabular-nums">
            Page {page} of {totalPages}
          </p>
          {page < totalPages ? (
            <Button asChild variant="outline">
              <Link href={catalogHref({ ...requested, page: page + 1 })} rel="next">
                Next
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </section>
  )
}
