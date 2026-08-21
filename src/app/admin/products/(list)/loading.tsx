import { Skeleton } from '@/components/ui/skeleton'

/**
 * Covers both the admin layout's requireRole('admin') session check and the catalog read that
 * follows it, so it is the first thing an admin sees on every visit to the list.
 *
 * In a (list) route group for the same reason the catalog fallback is in (catalog): at
 * admin/products/ this Suspense boundary would also wrap [id], whose page calls notFound(), and
 * streaming commits the 200 before that runs. Nothing crawls the admin, but a 404 that answers
 * 200 is still wrong, and the two directories should fail the same way rather than differently.
 */
export default function AdminProductsLoading() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <p role="status" className="sr-only">
        Loading the catalog…
      </p>

      <div aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Skeleton className="h-9 w-44" />
            <Skeleton className="mt-3 h-5 w-56" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>

        <div className="mt-8 grid gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="size-10 rounded-md" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
