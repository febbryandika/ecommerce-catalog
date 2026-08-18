export default async function AdminProductFormPage({ params }: PageProps<'/admin/products/[id]'>) {
  const { id } = await params

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Admin · Product {id}</h1>
      <p className="text-muted-foreground mt-2">
        Create/edit form with image upload and the AI description sidebar.
      </p>
    </section>
  )
}
