import { expect, test, type Page } from '@playwright/test'
import { productIdBySlug } from './shop'

/**
 * Seed facts this file leans on (scripts/seed.ts): 30 published products plus one draft, 24 per
 * page so exactly two pages, Wearables has 5, "Lumen" matches 3, "Kotori" matches 2 of which
 * only 1 is published.
 *
 * Page-1 and category counts are safe under fullyParallel: they are bounded by PAGE_SIZE or by
 * a category no other spec writes to. The *total* published count is not safe any more —
 * admin.spec.ts publishes a product to prove SPEC flow 4 reaches the public grid, so anything
 * asserting "exactly 30 published" would race it. See the note on the pagination test.
 *
 * Nothing here logs in — proxy.ts guards /admin only, and the catalog is public.
 */
const DRAFT_SLUG = 'kotori-16-creator-laptop'

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
  // Deliberately not an exact count: admin.spec.ts publishes a product for the duration of one
  // test, which would make this 7. What matters here is that page 2 exists, is not empty, and
  // is the last one — a newly published product sorts newest-first onto page 1, so the content
  // assertions below are unaffected either way.
  await expect(grid(page).getByRole('listitem')).not.toHaveCount(0)
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

  // Everything below is about what a *crawler* receives, so it is asserted against the
  // server-rendered document rather than the one the client-side navigation left behind.
  //
  // That distinction is load-bearing, not tidiness. After a client-side navigation Next can
  // leave the root layout's default description in the head alongside this page's, and on CI it
  // stays that way — the assertion saw two nodes for the full 5 s retry window, on all three
  // attempts. It is harmless for SEO, because a crawler issues its own GET and never navigates
  // client-side, but it makes an assertion against the live head non-deterministic. A reload
  // renders the document the way a crawler would fetch it, where layout and page metadata are
  // merged server-side into one tag and there is no previous route left to linger.
  await page.reload()

  // Exactly one description tag is itself part of the contract — two would split the signal —
  // and none of the assertions below would have caught a duplicate.
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
