import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { ProductForm } from '@/components/product-form'
import { db } from '@/db'
import { categories, products } from '@/db/schema'

export const metadata = { title: 'Product' }

// SPEC 2 lists a single [id] segment for both halves of the form, so 'new' is the create
// sentinel. Product ids are cuid2, so nothing real can ever be the literal string 'new'.
const CREATE = 'new'

export default async function AdminProductFormPage({ params }: PageProps<'/admin/products/[id]'>) {
  const { id } = await params

  const categoryOptions = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.name))

  if (id === CREATE) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">New product</h1>
        <p className="text-muted-foreground mt-2">
          Saved as a draft — publish it from the catalog list when it is ready.
        </p>
        <ProductForm product={null} categories={categoryOptions} />
      </section>
    )
  }

  const [row] = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      stock: products.stock,
      categoryId: products.categoryId,
    })
    .from(products)
    .where(eq(products.id, id))

  if (!row) {
    notFound()
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Edit {row.name}</h1>
      <p className="text-muted-foreground mt-2">
        Renaming a product regenerates its slug. Public links use the id, so nothing breaks.
      </p>
      <ProductForm
        product={{ ...row, description: row.description ?? '' }}
        categories={categoryOptions}
      />
    </section>
  )
}
