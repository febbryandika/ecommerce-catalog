import { expect, test, type Page } from '@playwright/test'
import { Client } from 'pg'

/**
 * Seed facts this file leans on (scripts/seed.ts): 30 published products plus one draft, 24 per
 * page so exactly two pages, Wearables has 5, "Lumen" matches 3, "Kotori" matches 2 of which
 * only 1 is published.
 *
 * The exact counts are safe under fullyParallel even though other specs create products:
 * createProduct never sets isPublished, so everything they mint is a draft and cannot reach the
 * public grid. Nothing here logs in — proxy.ts guards /admin only, and the catalog is public.
 */
const DRAFT_SLUG = 'kotori-16-creator-laptop'

async function productIdBySlug(slug: string): Promise<string> {
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

/** SiteHeader renders a <ul> too, so the grid has to be addressed by its accessible name. */
function grid(page: Page) {
  return page.getByRole('list', { name: 'Products' })
}

test('search narrows the grid and never surfaces a draft', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Trail GPS Running Watch' })).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search' }).fill('Lumen')

  // The write is debounced, so the URL is the thing to wait on — toHaveURL retries.
  await expect(page).toHaveURL('/?q=Lumen')
  await expect(grid(page).getByRole('listitem')).toHaveCount(3)
  await expect(page.getByRole('link', { name: 'Lumen M2 Mirrorless Body' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Trail GPS Running Watch' })).toHaveCount(0)

  // Two products match "Kotori" but one is unpublished, so exactly one may render. This is the
  // isPublished invariant with something to prove it (SPEC 3.2, 8).
  await page.getByRole('searchbox', { name: 'Search' }).fill('Kotori')
  await expect(page).toHaveURL('/?q=Kotori')
  await expect(grid(page).getByRole('listitem')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Kotori 14 Ultrabook' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Kotori 16 Creator Laptop' })).toHaveCount(0)
})

test('a search with no matches offers a way back', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: 'Search' }).fill('zzzz')

  await expect(page).toHaveURL('/?q=zzzz')
  await expect(grid(page)).toHaveCount(0)
  await page.getByRole('link', { name: 'Clear filters' }).click()

  // The box has to follow a URL it did not write itself, or the next search starts from stale
  // text that is no longer filtering anything.
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
  await expect(grid(page).getByRole('listitem')).toHaveCount(24)
})

test('the category filter narrows the grid to that category', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('combobox', { name: 'Category' }).click()
  // Waiting for the listbox rather than clicking straight through: the option can otherwise be
  // clicked while the portal is still animating in.
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.getByRole('option', { name: 'Wearables' }).click()

  // The slug travels in the URL, not the display name.
  await expect(page).toHaveURL('/?category=wearables')
  await expect(grid(page).getByRole('listitem')).toHaveCount(5)
  await expect(page.getByRole('link', { name: 'Halo Sleep Ring' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Aurora Over-Ear Headphones' })).toHaveCount(0)
})

test('pagination walks the catalog and drops the link at each end', async ({ page }) => {
  await page.goto('/')
  await expect(grid(page).getByRole('listitem')).toHaveCount(24)

  const pagination = page.getByRole('navigation', { name: 'Pagination' })
  await expect(pagination).toContainText('Page 1 of 2')
  await expect(pagination.getByRole('link', { name: 'Previous' })).toHaveCount(0)

  await pagination.getByRole('link', { name: 'Next' }).click()

  await expect(page).toHaveURL('/?page=2')
  await expect(grid(page).getByRole('listitem')).toHaveCount(6)
  await expect(pagination).toContainText('Page 2 of 2')
  // created_at is staggered by the seed, so newest-first puts the oldest product last.
  await expect(page.getByRole('link', { name: 'Aurora Over-Ear Headphones' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Trail GPS Running Watch' })).toHaveCount(0)
  await expect(pagination.getByRole('link', { name: 'Next' })).toHaveCount(0)
})

test('a product detail page renders with its own title and OG tags', async ({ page }) => {
  // Reached through a search rather than from the bare grid: newest-first ordering puts this
  // product, the oldest one the seed writes, on page 2.
  await page.goto('/?q=Aurora')
  await page.getByRole('link', { name: 'Aurora Over-Ear Headphones' }).click()

  // Public links key off the id, not the slug (src/actions/products.ts).
  await expect(page).toHaveURL(/\/products\/[a-z0-9]+$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Aurora Over-Ear Headphones' }),
  ).toBeVisible()
  // U+FFE5 FULLWIDTH YEN SIGN, not U+00A5 — same as format.test.ts.
  await expect(page.getByText('￥34,800')).toBeVisible()

  // The head is rewritten as part of the client-side navigation, and for a moment it can carry
  // both the layout's default description and this page's — or neither. It always settles on
  // exactly one (measured: 1 of 16 navigations sampled mid-update, 0 of 16 after settling), but
  // Playwright raises a strict-mode violation the instant a locator matches two nodes and does
  // *not* retry that, so sampling mid-update fails outright. toHaveCount does retry, so this
  // waits for the finished head — and asserts the thing that actually matters for SEO, that
  // there is exactly one description, which the assertions below never checked.
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)

  // SEO is the stated reason this project is Stack A, so the head is the assertion that
  // matters. The '%s · E-commerce Catalog' template lives in the root layout.
  await expect(page).toHaveTitle('Aurora Over-Ear Headphones · E-commerce Catalog')
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Aurora Over-Ear Headphones',
  )
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')

  // Stripped from the stored TipTap HTML: the markup must not survive into the meta tag, and
  // entities must arrive decoded rather than escaped a second time.
  const description = page.locator('meta[name="description"]')
  await expect(description).toHaveAttribute('content', /^The Aurora is built for the hours/)
  await expect(description).not.toHaveAttribute('content', /<p>|&amp;/)

  // No og:image assertion on purpose: seed/images/ ships no files and CI has no R2_*, so every
  // product has image_url NULL and generateMetadata omits the field rather than inventing one.
})

test('an unknown or unpublished product id is a 404', async ({ page }) => {
  const unknown = await page.goto('/products/does-not-exist')
  expect(unknown?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'Product not found' })).toBeVisible()

  // The draft is reachable by id but must not render. The query filters isPublished rather than
  // checking it after the read, so a draft and a typo are indistinguishable.
  const draft = await page.goto(`/products/${await productIdBySlug(DRAFT_SLUG)}`)
  expect(draft?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'Product not found' })).toBeVisible()
  await expect(page.getByText('Kotori 16 Creator Laptop')).toHaveCount(0)
})

test('the filter panel toggles on a small viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')

  const toggle = page.getByRole('button', { name: 'Filters' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('searchbox', { name: 'Search' })).toBeHidden()

  await toggle.click()

  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('searchbox', { name: 'Search' })).toBeVisible()
})
