import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatJpy } from '@/lib/format'

type Props = {
  id: string
  name: string
  price: number
  imageUrl: string | null
}

/**
 * One cell of the public grid. Deliberately still a Server Component — the grid is the SEO
 * surface this whole stack was chosen for (SPEC 1), so nothing here fetches or hydrates.
 *
 * The title's link stretches over the whole card via the after: pseudo-element, so the card is
 * one link with one accessible name rather than an image link and a title link pointing at the
 * same place. Phase 9's wishlist toggle and add-to-cart button belong in a CardFooter below
 * CardContent, and will need `relative z-10` to sit above that overlay.
 *
 * Routes by id, not slug: updateProduct regenerates the slug on rename, and public links key
 * off the id so nothing breaks (src/actions/products.ts).
 */
export function ProductCard({ id, name, price, imageUrl }: Props) {
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
    </Card>
  )
}
