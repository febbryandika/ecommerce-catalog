import { selectWishlistItems } from '@/lib/cart-queries'
import { WishlistGrid } from '@/components/wishlist-grid'
import { requireUser } from '@/lib/auth'

export const metadata = { title: 'Wishlist' }

/** Same shape as /cart: session-gated, server-fetched once, then owned by the client cache. */
export default async function WishlistPage() {
  const session = await requireUser('/wishlist')
  const items = await selectWishlistItems(session.user.id)

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Wishlist</h1>
      <WishlistGrid initialItems={items} />
    </section>
  )
}
