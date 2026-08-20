import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Reached for an unknown id and for a real but unpublished one alike — the page's query filters
 * isPublished, so a draft is a 404 rather than a preview (SPEC 3.2, 8).
 */
export default function ProductNotFound() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Product not found</h1>
      <p className="text-muted-foreground mt-2">
        It may have been removed, or it may not be published yet.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">Back to the catalog</Link>
      </Button>
    </section>
  )
}
