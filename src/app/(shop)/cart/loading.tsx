import { Skeleton } from '@/components/ui/skeleton'

/**
 * Paints while requireUser() checks the session and the lines are read. A signed-out visitor is
 * redirected from the page itself, so this fallback is on screen first either way.
 */
export default function CartLoading() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <p role="status" className="sr-only">
        Loading your cart…
      </p>

      <div aria-hidden="true">
        <Skeleton className="h-9 w-24" />

        <ul className="mt-8 divide-y">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className="flex items-center gap-4 py-4">
              <Skeleton className="size-16 rounded-md" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-2 h-4 w-20" />
              </div>
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-4 w-24" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
