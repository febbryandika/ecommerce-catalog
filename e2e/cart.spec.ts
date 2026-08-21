import { expect, test } from '@playwright/test'
import {
  cartList,
  cartTrigger,
  IN_STOCK,
  jpy,
  logIn,
  LOW_STOCK,
  OUT_OF_STOCK,
  productIdBySlug,
  settled,
  signUpAsCustomer,
} from './shop'

/**
 * Signing up runs Better Auth's scrypt at N=16384, which is deliberately slow and CPU-bound, and
 * every test here mints its own account. Under local default parallelism several of those land on
 * one dev server at once and the default 30 s is not enough headroom. CI runs workers: 1.
 */
test.describe.configure({ timeout: 60_000 })

/**
 * Quantity changes are driven from /cart rather than from inside the sheet: Radix marks the rest
 * of the page aria-hidden while the sheet is open, so the header badge — the clearest proof the
 * cache updated — is deliberately unreachable there. The sheet gets its own test below.
 */
test('add to cart, change the quantity, then remove the line', async ({ page }) => {
  await signUpAsCustomer(page)
  const id = await productIdBySlug(IN_STOCK.slug)

  await page.goto(`/products/${id}`)
  await page.getByRole('button', { name: `Add to cart — ${IN_STOCK.name}` }).click()

  // The badge is part of the trigger's accessible name, so it doubles as the assertion that the
  // optimistic cache update reached the header.
  await expect(cartTrigger(page)).toHaveAccessibleName('Open cart, 1 item')
  await settled(page, `${IN_STOCK.name} added to your cart.`)

  await page.goto('/cart')
  const line = cartList(page).getByRole('listitem').filter({ hasText: IN_STOCK.name })
  await expect(line).toContainText(jpy(IN_STOCK.price))

  await line.getByRole('button', { name: `Increase quantity of ${IN_STOCK.name}` }).click()
  await expect(cartTrigger(page)).toHaveAccessibleName('Open cart, 2 items')
  await expect(line).toContainText(jpy(IN_STOCK.price * 2))

  await line.getByRole('button', { name: `Decrease quantity of ${IN_STOCK.name}` }).click()
  await expect(cartTrigger(page)).toHaveAccessibleName('Open cart, 1 item')

  await line.getByRole('button', { name: `Remove ${IN_STOCK.name} from your cart` }).click()
  await expect(page.getByText('Your cart is empty.')).toBeVisible()
  await expect(cartTrigger(page)).toHaveAccessibleName('Open cart, empty')
})

test('the cart sheet lists the line, shows a subtotal and closes on Escape', async ({ page }) => {
  await signUpAsCustomer(page)
  const id = await productIdBySlug(IN_STOCK.slug)

  await page.goto(`/products/${id}`)
  await page.getByRole('button', { name: `Add to cart — ${IN_STOCK.name}` }).click()
  await settled(page, `${IN_STOCK.name} added to your cart.`)

  await cartTrigger(page).click()
  const sheet = page.getByRole('dialog', { name: 'Your cart' })
  await expect(sheet).toBeVisible()
  await expect(
    cartList(page).getByRole('listitem').filter({ hasText: IN_STOCK.name }),
  ).toBeVisible()
  await expect(sheet).toContainText(jpy(IN_STOCK.price))

  // SPEC 12: checkout is project #29 and must not appear anywhere in this project.
  await expect(sheet.getByRole('button', { name: /checkout/i })).toHaveCount(0)
  await expect(sheet.getByRole('link', { name: /checkout/i })).toHaveCount(0)

  // SPEC 3.7 says to verify Radix's focus handling rather than assume it.
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(cartTrigger(page)).toBeFocused()
})

test('the cart survives a reload and is shown on /cart', async ({ page }) => {
  await signUpAsCustomer(page)
  const id = await productIdBySlug(IN_STOCK.slug)

  await page.goto(`/products/${id}`)
  await page.getByRole('button', { name: `Add to cart — ${IN_STOCK.name}` }).click()
  await settled(page, `${IN_STOCK.name} added to your cart.`)

  // Persisted in Postgres, not in the client cache, so a fresh load has to find it again.
  await page.goto('/cart')
  await expect(page.getByRole('heading', { level: 1, name: 'Cart' })).toBeVisible()
  await expect(
    cartList(page).getByRole('listitem').filter({ hasText: IN_STOCK.name }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /checkout/i })).toHaveCount(0)
})

test('quantity cannot be pushed past the available stock', async ({ page }) => {
  await signUpAsCustomer(page)
  const id = await productIdBySlug(LOW_STOCK.slug)

  await page.goto(`/products/${id}`)
  await page.getByRole('button', { name: `Add to cart — ${LOW_STOCK.name}` }).click()
  await settled(page, `${LOW_STOCK.name} added to your cart.`)

  await page.goto('/cart')
  const line = cartList(page).getByRole('listitem').filter({ hasText: LOW_STOCK.name })
  const increase = line.getByRole('button', { name: `Increase quantity of ${LOW_STOCK.name}` })

  await increase.click()
  await expect(cartTrigger(page)).toHaveAccessibleName(`Open cart, ${LOW_STOCK.stock} items`)
  await expect(line).toContainText(jpy(LOW_STOCK.price * LOW_STOCK.stock))

  // Halo Sleep Ring is seeded with stock 2, so the control is spent. The SQL LEAST() clamp is the
  // real guard; this is the UI refusing to send a write it already knows would be clamped.
  await expect(increase).toBeDisabled()
})

test('an out-of-stock product cannot be added', async ({ page }) => {
  await signUpAsCustomer(page)
  const id = await productIdBySlug(OUT_OF_STOCK.slug)

  await page.goto(`/products/${id}`)
  await expect(
    page.getByRole('button', { name: `Out of stock — ${OUT_OF_STOCK.name}` }),
  ).toBeDisabled()
  await expect(cartTrigger(page)).toHaveAccessibleName('Open cart, empty')
})

test('a signed-out add-to-cart is replayed once after logging in', async ({ page }) => {
  // Mint an account and sign out: the replay is a login-time behaviour, so the test needs
  // credentials that already exist.
  const account = await signUpAsCustomer(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }),
  ).toBeVisible()

  const id = await productIdBySlug(IN_STOCK.slug)
  await page.goto(`/products/${id}`)

  // Signed out the button routes to login instead of being disabled: SPEC 3.4 is explicit that
  // the click is never silently dropped.
  await page.getByRole('button', { name: `Add to cart — ${IN_STOCK.name}` }).click()
  await expect(page).toHaveURL(`/login?next=%2Fproducts%2F${id}&add=${id}`)

  await logIn(page, account.email, account.password)

  // Back on the product page with the item already in the cart (SPEC 3.4).
  await expect(page).toHaveURL(`/products/${id}`)
  await expect(cartTrigger(page)).toHaveAccessibleName('Open cart, 1 item')

  // Exactly once: the replay is bound to the login submit and the URL that carried the intent is
  // gone, so a reload cannot add a second unit.
  await page.reload()
  await expect(cartTrigger(page)).toHaveAccessibleName('Open cart, 1 item')
})

test('a failed write rolls the optimistic quantity back and says so', async ({ page }) => {
  await signUpAsCustomer(page)
  const id = await productIdBySlug(IN_STOCK.slug)

  await page.goto(`/products/${id}`)
  await page.getByRole('button', { name: `Add to cart — ${IN_STOCK.name}` }).click()
  await settled(page, `${IN_STOCK.name} added to your cart.`)

  await page.goto('/cart')
  const line = cartList(page).getByRole('listitem').filter({ hasText: IN_STOCK.name })

  // Break the next Server Action call. Failing the transport is the one way to exercise the
  // rollback deterministically — every in-app failure is an expected `{ error }`, which the
  // mutation re-throws through exactly this path.
  await page.route('**/cart', (route) =>
    route.request().method() === 'POST' ? route.abort('failed') : route.continue(),
  )

  await line.getByRole('button', { name: `Increase quantity of ${IN_STOCK.name}` }).click()

  // The optimistic 2 is reverted and the line total is the original single unit again.
  await expect(line).toContainText(jpy(IN_STOCK.price))
  await expect(line).not.toContainText(jpy(IN_STOCK.price * 2))
  await expect(cartTrigger(page)).toHaveAccessibleName('Open cart, 1 item')

  // A dropped request is not an expected `{ error }`, so the user gets the written fallback
  // rather than the browser's transport message.
  await expect(page.getByText('Could not update your cart. Try again.')).toBeVisible()
})
