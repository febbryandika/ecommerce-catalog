'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

/**
 * Covers the grid and any shop route without a closer boundary. Expected failures never reach
 * here — the Server Actions return `{ error }` for those (SPEC 3.7) — so anything that does is a
 * genuine fault, most often the database being unreachable.
 */
export default function CatalogError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter()

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground mt-2">
        The catalog could not be loaded. Try again — if it keeps failing, the database may be
        unreachable.
      </p>
      {/* reset() on its own re-renders the same failed payload, because the data these boundaries
          wrap is read on the server. router.refresh() is what actually re-runs the query. */}
      <Button
        className="mt-6"
        onClick={() => {
          router.refresh()
          reset()
        }}
      >
        Try again
      </Button>
    </section>
  )
}
