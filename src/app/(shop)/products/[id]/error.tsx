'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

/**
 * A missing or unpublished product is not an error — the page calls notFound() and not-found.tsx
 * renders instead. This boundary is only for a failed read.
 */
export default function ProductDetailError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter()

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground mt-2">
        This product could not be loaded. Try again, or head back to the catalog.
      </p>
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
