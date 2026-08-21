import Image from 'next/image'
import Link from 'next/link'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { WishlistToggle } from '@/components/wishlist-toggle'
import { formatJpy } from '@/lib/format'

type Props = {
  id: string
  name: string
  price: number
  imageUrl: string | null
  stock: number
}

/**
 * One cell of the public grid. Deliberately still a Server Component — the grid is the SEO
 * surface this whole stack was chosen for (SPEC 1), so nothing here fetches or hydrates.
 *
 * The title's link stretches over the whole card via the after: pseudo-element, so the card is
 * one link with one accessible name rather than an image link and a title link pointing at the
 * same place. The CardFooter controls carry `relative z-10` to sit above that overlay — without
 * it the stretched link swallows their clicks.
 *
 * The footer's two children are client islands. The card itself stays a Server Component: per-user
 * state (saved? in the cart?) arrives from TanStack Query in the browser, never from a server read,
 * because a cookies() call here would opt the SEO surface into dynamic rendering.
 *
 * Routes by id, not slug: updateProduct regenerates the slug on rename, and public links key
 * off the id so nothing breaks (src/actions/products.ts).
 */
export function ProductCard({ id, name, price, imageUrl, stock }: Props) {
  return (
    <Card className="relative h-full pt-0">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          width={600}
          height={600}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="aspect-square w-full object-cover"
        />
      ) : (
        // Every seeded product has image_url NULL (seed/images/ ships no files) and
        // next.config.ts leaves remotePatterns empty when R2 is unconfigured, so this is the
        // branch that actually renders in CI and in a fresh checkout — not a rare fallback.
        // Decorative, so it is hidden rather than given empty alt text.
        <div className="bg-muted aspect-square w-full" aria-hidden="true" />
      )}

      <CardHeader>
        <CardTitle>
          <Link href={`/products/${id}`} className="after:absolute after:inset-0 hover:underline">
            {name}
          </Link>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <p className="tabular-nums">{formatJpy(price)}</p>
      </CardContent>

      <CardFooter className="relative z-10 justify-between gap-2">
        <AddToCartButton size="sm" product={{ productId: id, name, price, imageUrl, stock }} />
        <WishlistToggle product={{ productId: id, name, price, imageUrl, stock }} />
      </CardFooter>
    </Card>
  )
}
