export default async function ProductDetailPage({ params }: PageProps<'/products/[id]'>) {
  const { id } = await params

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Product {id}</h1>
      <p className="text-muted-foreground mt-2">
        Server-rendered detail page with generateMetadata and ISR.
      </p>
    </section>
  )
}
