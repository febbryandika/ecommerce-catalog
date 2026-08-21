import { expect, test, type Locator, type Page } from '@playwright/test'
import { cartList, cartTrigger, IN_STOCK, productIdBySlug, settled, signUpAsCustomer } from './shop'

/**
 * Signing up runs Better Auth's scrypt at N=16384, which is deliberately slow and CPU-bound, and
 * every test here mints its own account. Under local default parallelism several of those land on
 * one dev server at once and the default 30 s is not enough headroom. CI runs workers: 1.
 */
test.describe.configure({ timeout: 60_000 })

/**
 * Tab-counting is brittle — the header alone changes width with the session state, and a control
 * that disables mid-flight drops focus to <body>. So walk until the target is reached rather than
 * hard-coding a number of presses, and fail loudly if it never is.
 *
 * `key` matters: the header sits above the page content, so reaching the cart button from a
 * product is a backwards walk. It is also the only direction that works while a toast is on
 * screen — see the note on the cart step below.
 */
async function focusWith(page: Page, target: Locator, key: 'Tab' | 'Shift+Tab', max = 60) {
  for (let index = 0; index < max; index += 1) {
    const focused = await target
      .evaluate((element) => element === document.activeElement)
      .catch(() => false)
    if (focused) return
    await page.keyboard.press(key)
  }

  throw new Error(`never reached ${target} after ${max} ${key} presses`)
}

/** Radix renders SheetContent with role="dialog"; closest() counts the container itself. */
function focusIsInsideDialog(page: Page) {
  return page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))
}

/**
 * SPEC 9.8 — the whole browse → product → cart flow with the keyboard alone. Deliberately no
 * .click() anywhere in this test: a mouse path passing does not prove a keyboard path does.
 */
test('the browse to product to cart flow completes with the keyboard alone', async ({ page }) => {
  await signUpAsCustomer(page)
  await page.goto('/')

  // Whichever product the grid happens to lead with, rather than a fixed slug — the seed orders
  // newest-first and this test has no reason to care which one that is.
  const firstProduct = page.getByRole('list', { name: 'Products' }).getByRole('listitem').first()
  const titleLink = firstProduct.getByRole('link').first()
  const name = (await titleLink.textContent())?.trim()
  expect(name).toBeTruthy()

  await focusWith(page, titleLink, 'Tab')
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/products\/[a-z0-9]+$/)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()

  // The card and the detail page both name this button with the product, which is what makes it
  // addressable by role + name rather than by position.
  const addToCart = page.getByRole('button', { name: `Add to cart — ${name}` })
  await focusWith(page, addToCart, 'Tab')
  await page.keyboard.press('Enter')

  // Wait for the server to confirm before opening the sheet: asserting an optimistic value and
  // then navigating aborts the in-flight action, which is the race shop.ts documents.
  await settled(page, `${name} added to your cart.`)

  // Backwards, because the header precedes the content — and because forwards does not work
  // while the success toast is up: sonner keeps focus inside the toast region, so Tab ping-pongs
  // between the last content link and the toast until it auto-dismisses. Recorded in the PR; it
  // is third-party behaviour and self-clearing, not something this pass changes.
  await focusWith(page, cartTrigger(page), 'Shift+Tab')
  await page.keyboard.press('Enter')

  await expect(page.getByRole('dialog', { name: 'Your cart' })).toBeVisible()
  await expect(cartList(page).getByRole('listitem').filter({ hasText: name! })).toBeVisible()
})

/**
 * SPEC 3.7 says to verify Radix's focus handling rather than assume it. cart.spec.ts already
 * covers Esc-closes and focus-returns-to-trigger; this covers the half that does not — that focus
 * cannot leave the sheet while it is open.
 */
test('the cart sheet traps focus while it is open', async ({ page }) => {
  await signUpAsCustomer(page)
  const id = await productIdBySlug(IN_STOCK.slug)

  await page.goto(`/products/${id}`)
  await page.getByRole('button', { name: `Add to cart — ${IN_STOCK.name}` }).click()
  await settled(page, `${IN_STOCK.name} added to your cart.`)

  // press() focuses first, so the sheet is opened from the keyboard rather than by a click.
  await cartTrigger(page).press('Enter')
  await expect(page.getByRole('dialog', { name: 'Your cart' })).toBeVisible()

  // Radix moves focus into the dialog on open. If this fails, nothing below is meaningful.
  expect(await focusIsInsideDialog(page)).toBe(true)

  // More presses than the sheet has focusable controls, so the cycle wraps several times over.
  for (let index = 0; index < 15; index += 1) {
    await page.keyboard.press('Tab')
    expect(await focusIsInsideDialog(page), `Tab #${index + 1} escaped the sheet`).toBe(true)
  }

  // And backwards out of the first control, which is the direction a trap is easiest to get wrong.
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press('Shift+Tab')
    expect(await focusIsInsideDialog(page), `Shift+Tab #${index + 1} escaped the sheet`).toBe(true)
  }
})
