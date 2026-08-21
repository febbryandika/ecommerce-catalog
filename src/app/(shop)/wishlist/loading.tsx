import { Skeleton } from '@/components/ui/skeleton'

/** Same shape as the cart fallback: session-gated, then a grid of saved products. */
export default function WishlistLoading() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <p role="status" className="sr-only">
        Loading your wishlist…
      </p>

      <div aria-hidden="true">
        <Skeleton className="h-9 w-36" />

        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="rounded-xl border">
              <Skeleton className="aspect-square w-full rounded-b-none" />
              <div className="p-6">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="mt-4 h-5 w-24" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
