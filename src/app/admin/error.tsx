'use client'

import { Button } from '@/components/ui/button'

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground mt-2">
        The catalog admin could not be loaded. Try again — if it keeps failing, the database may be
        unreachable.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </section>
  )
}
