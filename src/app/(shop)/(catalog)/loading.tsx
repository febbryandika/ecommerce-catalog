import { Skeleton } from '@/components/ui/skeleton'

/**
 * Fallback for the catalog grid. The grid reads searchParams, so it is dynamic and this paints on
 * every search, filter and page change — not just the first load.
 *
 * It lives in a (catalog) route group, and that is load-bearing — do not hoist it to (shop). A
 * loading.tsx is a Suspense boundary, and a Suspense boundary makes every route beneath it
 * stream, which flushes the HTTP status before the page body runs. /products/[id] calls
 * notFound() after its query, so under a (shop)-level boundary an unknown id answers 200 with
 * not-found.tsx painted into it — a soft 404. SEO is the reason this project is server-rendered
 * (SPEC 1), so the status wins and the boundary is scoped to the grid alone.
 * e2e/catalog.spec.ts asserts the 404 status and will catch a regression here.
 *
 * Eight cards rather than the 24 a full page holds: a fallback only has to cover the fold, and
 * rendering the whole page of placeholders costs more than it communicates.
 */
export default function CatalogLoading() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      {/* One spoken message for the whole screen. The skeletons below are hidden rather than
          left for a screen reader to walk through as two dozen unlabelled boxes. */}
      <p role="status" className="sr-only">
        Loading the catalog…
      </p>

      <div aria-hidden="true">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-4 h-5 w-56" />

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_14rem]">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index} className="rounded-xl border">
              <Skeleton className="aspect-square w-full rounded-b-none" />
              <div className="p-6">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="mt-4 h-5 w-24" />
                <div className="mt-6 flex items-center justify-between gap-2">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="size-8 rounded-md" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
