import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shared by /login and /signup — both read searchParams, so both are dynamic, and both render the
 * same AuthForm under the same heading. One fallback in the route group rather than two identical
 * copies in the leaves.
 */
export default function AuthLoading() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <p role="status" className="sr-only">
        Loading…
      </p>

      <div aria-hidden="true">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-3 h-5 w-64" />

        <div className="mt-8 grid max-w-sm gap-6">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="grid gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
    </section>
  )
}
