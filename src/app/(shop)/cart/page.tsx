import { selectCartLines } from '@/lib/cart-queries'
import { CartPageContent } from '@/components/cart-page-content'
import { requireUser } from '@/lib/auth'

export const metadata = { title: 'Cart' }

/**
 * Requires a session, so this route is dynamic by definition — requireUser redirects to
 * /login?next=/cart rather than rendering an empty shell. That is the helper's redirecting
 * failure mode being the right one for a page, where an action would want `{ error }`.
 *
 * The rows are fetched here and handed to the client as initialData so the page paints with
 * content instead of a spinner; the same ['cart'] query then owns every later change.
 */
export default async function CartPage() {
  const session = await requireUser('/cart')
  const lines = await selectCartLines(session.user.id)

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Cart</h1>
      <CartPageContent initialLines={lines} />
    </section>
  )
}
