'use client'

import { isServer, QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * A client boundary around the tree so the root layout stays a Server Component. Rendering a
 * client component from a server layout does not make the layout dynamic — only reading
 * cookies()/headers() would, which is why AuthNav reads the session client-side and why the
 * product pages keep `revalidate = 60` (SPEC 3.2).
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // The cart is only ever changed by this tab's own mutations, which invalidate it
      // directly, so refetching on every window focus is noise.
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  })
}

let browserQueryClient: QueryClient | undefined

/**
 * TanStack's documented App Router shape, and the reason matters in both directions. On the
 * server a fresh client per request is mandatory — a shared one would leak one user's cart into
 * another's response, the same hazard src/store/filters.ts documents. In the browser the client
 * must instead be a singleton that survives re-renders, so an in-flight suspend cannot drop the
 * cache on the floor and remount the tree underneath it.
 */
function getQueryClient() {
  if (isServer) return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
}
