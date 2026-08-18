import Link from 'next/link'
import { AuthNav } from '@/components/auth-nav'

const navItems = [
  { href: '/', label: 'Catalog' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/cart', label: 'Cart' },
] as const

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Catalog
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-4 text-sm">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
            <AuthNav />
          </ul>
        </nav>
      </div>
    </header>
  )
}
