import { expect, test } from '@playwright/test'
import { IN_STOCK, logIn, productIdBySlug, settled, signUpAsCustomer } from './shop'

/**
 * Signing up runs Better Auth's scrypt at N=16384, which is deliberately slow and CPU-bound, and
 * every test here mints its own account. Under local default parallelism several of those land on
 * one dev server at once and the default 30 s is not enough headroom. CI runs workers: 1.
 */
test.describe.configure({ timeout: 60_000 })

test('the wishlist toggle persists across a reload', async ({ page }) => {
  await signUpAsCustomer(page)
  const id = await productIdBySlug(IN_STOCK.slug)

  await page.goto(`/products/${id}`)
  const save = page.getByRole('button', { name: `Save ${IN_STOCK.name} to your wishlist` })
  await save.click()

  // The optimistic update flips the accessible name immediately...
  const remove = page.getByRole('button', { name: `Remove ${IN_STOCK.name} from your wishlist` })
  await expect(remove).toBeVisible()

  // ...but only the toast proves the row reached Postgres. Reloading before it would abort the
  // in-flight Server Action and this test would be testing the optimistic value twice.
  await settled(page, `${IN_STOCK.name} saved to your wishlist.`)

  await page.reload()
  await expect(
    page.getByRole('button', { name: `Remove ${IN_STOCK.name} from your wishlist` }),
  ).toBeVisible()

  await page.goto('/wishlist')
  await expect(
    page
      .getByRole('list', { name: 'Saved products' })
      .getByRole('listitem')
      .filter({ hasText: IN_STOCK.name }),
  ).toBeVisible()
})

test('un-saving removes the product from the wishlist page', async ({ page }) => {
  await signUpAsCustomer(page)
  const id = await productIdBySlug(IN_STOCK.slug)

  await page.goto(`/products/${id}`)
  await page.getByRole('button', { name: `Save ${IN_STOCK.name} to your wishlist` }).click()
  await settled(page, `${IN_STOCK.name} saved to your wishlist.`)

  await page.goto('/wishlist')
  await page.getByRole('button', { name: `Remove ${IN_STOCK.name} from your wishlist` }).click()

  // Same ['wishlist'] query backs the hearts and this grid, so the card goes immediately.
  await expect(page.getByText('You have not saved anything yet.')).toBeVisible()
})

test('an empty wishlist offers a way back to the catalog', async ({ page }) => {
  await signUpAsCustomer(page)

  await page.goto('/wishlist')
  await expect(page.getByText('You have not saved anything yet.')).toBeVisible()
  await page.getByRole('link', { name: 'Browse the catalog' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Catalog' })).toBeVisible()
})

test('a signed-out wishlist click is replayed after logging in', async ({ page }) => {
  const account = await signUpAsCustomer(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }),
  ).toBeVisible()

  const id = await productIdBySlug(IN_STOCK.slug)
  await page.goto(`/products/${id}`)

  await page.getByRole('button', { name: `Save ${IN_STOCK.name} to your wishlist` }).click()
  await expect(page).toHaveURL(`/login?next=%2Fproducts%2F${id}&wish=${id}`)

  await logIn(page, account.email, account.password)

  await expect(page).toHaveURL(`/products/${id}`)
  await expect(
    page.getByRole('button', { name: `Remove ${IN_STOCK.name} from your wishlist` }),
  ).toBeVisible()
})

test('an anonymous visitor to /wishlist is sent to login with a next param', async ({ page }) => {
  // /wishlist is not in proxy.ts's matcher — requireUser() inside the page is what turns the
  // visitor away, which is the authorization boundary doing the work (SPEC 8).
  await page.goto('/wishlist')
  await expect(page).toHaveURL('/login?next=%2Fwishlist')
})
