import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AdminProductNotFound() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Product not found</h1>
      <p className="text-muted-foreground mt-2">
        It may have been deleted, or the link may be wrong.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/admin/products">Back to the catalog</Link>
      </Button>
    </section>
  )
}
