import Image from 'next/image'
import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { ProductRowActions } from '@/components/product-row-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { db } from '@/db'
import { categories, products } from '@/db/schema'
import { formatJpy } from '@/lib/format'

export const metadata = { title: 'Products' }

export default async function AdminProductsPage() {
  // An explicit leftJoin rather than db.query(...{ with: category }): schema.ts defines no
  // relations() for products/categories, so the relational API cannot resolve one.
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      imageUrl: products.imageUrl,
      price: products.price,
      stock: products.stock,
      isPublished: products.isPublished,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(desc(products.createdAt))

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-2">
            {rows.length === 0
              ? 'Nothing in the catalog yet.'
              : `${rows.length} product${rows.length === 1 ? '' : 's'} in the catalog.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">New product</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-muted-foreground">
            Products you create show up here, as drafts until you publish them.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/admin/products/new">Add your first product</Link>
          </Button>
        </div>
      ) : (
        <Table className="mt-8">
          <TableCaption>Every product in the catalog, newest first.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="sr-only">Image</span>
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.imageUrl ? (
                    <Image
                      src={row.imageUrl}
                      alt={row.name}
                      width={40}
                      height={40}
                      className="size-10 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="bg-muted size-10 rounded-md border" aria-hidden="true" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.categoryName ?? 'Uncategorised'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatJpy(row.price)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.stock}</TableCell>
                <TableCell>
                  <Badge variant={row.isPublished ? 'default' : 'secondary'}>
                    {row.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <ProductRowActions id={row.id} name={row.name} isPublished={row.isPublished} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
