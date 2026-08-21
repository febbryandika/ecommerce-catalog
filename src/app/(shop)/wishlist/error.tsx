'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function WishlistError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter()

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground mt-2">
        Your wishlist could not be loaded. Nothing has been lost — it is stored against your
        account, so try again.
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
