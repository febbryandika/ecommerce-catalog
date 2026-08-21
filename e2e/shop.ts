import { expect, type Page } from '@playwright/test'
import { Client } from 'pg'

/**
 * Shared setup for the cart and wishlist specs. Same shape as e2e/admin.ts: the suite is fully
 * parallel with no teardown and no test database, so every test mints its own account and its
 * cart and wishlist rows cannot collide with another worker's.
 */
export function newAccount() {
  const id = crypto.randomUUID().slice(0, 8)
  return { name: 'Test Shopper', email: `shopper-${id}@example.com`, password: 'correct-horse-8' }
}

/** Signs up through the UI and waits for the header to flip, which is the session barrier. */
export async function signUpAsCustomer(page: Page) {
  const account = newAccount()

  await page.goto('/signup')
  await page.getByLabel('Name').fill(account.name)
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  // Better Auth hashes with scrypt at N=16384, which is deliberately slow and blocks the dev
  // server's event loop. Under parallel workers several signups queue behind each other, so this
  // barrier needs more headroom than the 5 s default.
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 30_000 })

  return account
}

/**
 * Logs in and waits for the session to actually exist, rather than for the click to land.
 *
 * The barrier matters for the same reason it does in signUpAsCustomer: scrypt at N=16384 blocks
 * the dev server's event loop, so the next assertion would otherwise start racing a login that
 * has not finished. Waiting on the header flipping is a wait on state — the header only renders
 * Sign out once AuthNav has a session — not a duration.
 */
export async function logIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 30_000 })
}

/**
 * Public links key off the id, not the slug (src/components/product-card.tsx), so a test that
 * wants a specific seeded product has to resolve it. Reading the id directly also keeps these
 * specs off the debounced search box, whose pending write can cancel a navigation (CLAUDE.md).
 */
export async function productIdBySlug(slug: string): Promise<string> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — playwright.config.ts should have loaded .env')
  }

  const client = new Client({ connectionString })
  try {
    await client.connect()
    const { rows } = await client.query<{ id: string }>('SELECT id FROM products WHERE slug = $1', [
      slug,
    ])
    const id = rows[0]?.id
    if (!id) throw new Error(`No product seeded with slug ${slug} — run pnpm db:seed`)
    return id
  } finally {
    await client.end()
  }
}

/**
 * Seeded facts these specs depend on (scripts/seed.ts). Prices are here because a line's total
 * is the honest way to assert a quantity: the number itself is a bare <span> with no role, and
 * the repo has no data-testid to reach for.
 *
 * The yen sign is U+FFE5 FULLWIDTH YEN, not U+00A5 — same as src/lib/format.test.ts.
 */
export const IN_STOCK = {
  slug: 'lumen-24-70mm-zoom-lens',
  name: 'Lumen 24-70mm Zoom Lens',
  price: 148_000,
}
export const LOW_STOCK = {
  slug: 'halo-sleep-ring',
  name: 'Halo Sleep Ring',
  price: 54_800,
  stock: 2,
}
export const OUT_OF_STOCK = {
  slug: 'hoshi-open-back-headphones',
  name: 'Hoshi Open-Back Headphones',
}

export function jpy(amount: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
}

export const cartTrigger = (page: Page) => page.getByRole('button', { name: /^Open cart/ })
export const cartList = (page: Page) => page.getByRole('list', { name: 'Cart items' })

/**
 * Waits for a write to be *confirmed* by the server, not merely applied optimistically.
 *
 * The toast fires from the mutation's onSuccess, so it is the first moment the row is known to
 * be in Postgres. Any test that reloads or navigates to check persistence has to wait for this
 * first — asserting the optimistic value and then reloading aborts the in-flight action, which
 * is a race the test would lose intermittently.
 *
 * .first() because the same sentence is also written into the aria-live region (SPEC 3.7), so
 * two nodes legitimately carry this text.
 */
export async function settled(page: Page, message: string) {
  await expect(page.getByText(message).first()).toBeVisible()
}

/** The aria-live region SPEC 3.7 requires cart and wishlist changes to announce through. */
export const liveRegion = (page: Page) => page.getByRole('status')
