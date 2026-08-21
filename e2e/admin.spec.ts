import { expect, test, type Page } from '@playwright/test'
import { signUpAsAdmin } from './admin'
import { allowedImageOrigin } from './image-host'

/**
 * SPEC 9 flow 4, as one journey: create → upload image → generate description → publish →
 * appears in the public grid. Every link existed in isolation before this file, but the two
 * that matter most did not exist at all — nothing ever clicked Publish, and nothing ever
 * checked that a published product reaches the catalog.
 *
 * Cold-compiles the admin form and the editor chunk, and CI runs one worker.
 */
test.describe.configure({ timeout: 90_000 })

// A real 1x1 PNG, inline so the suite carries no binary fixture — same buffer upload.spec.ts uses.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const GENERATED = 'Built for the hours after everyone else has gone home.'

/**
 * R2 and Anthropic are the only two things faked here; the database is real, and so is every
 * Server Action the journey runs through.
 *
 * Mocking them at the network boundary is what lets this flow actually run in CI. CI sets
 * neither R2_* nor ANTHROPIC_API_KEY on purpose, so the real-upload and real-stream tests skip
 * there — which would have left flow 4 unproven in the only place it is enforced. The live
 * paths keep their own opt-in tests in upload.spec.ts and describe.spec.ts.
 */
async function mockExternalServices(page: Page) {
  // Answers on the one host this environment is allowed to render — see e2e/image-host.ts.
  // productSchema requires an absolute https URL, so a path will not do, and next/image throws
  // on a host that is not in remotePatterns rather than just failing to load the picture.
  await page.route('**/api/upload', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: `${allowedImageOrigin()}/mock-product.png` }),
    })
  })

  await page.route('**/api/ai/describe', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: GENERATED,
    })
  })
}

function row(page: Page, name: string) {
  return page.getByRole('row').filter({ hasText: name })
}

test('an admin creates, illustrates, describes and publishes a product into the catalog', async ({
  page,
}) => {
  await signUpAsAdmin(page)
  await mockExternalServices(page)

  // Unique per run so the scoped search below can only match this product, and so nothing
  // collides with a parallel worker.
  const name = `Journey Product ${crypto.randomUUID().slice(0, 8)}`

  // 1. Create
  await page.goto('/admin/products/new')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Price').fill('24800')
  await page.getByLabel('Stock').fill('7')

  // 2. Upload an image — asserted through the preview's alt text, never the rewritten src.
  await page
    .getByLabel('Image')
    .setInputFiles({ name: 'swatch.png', mimeType: 'image/png', buffer: PNG_1PX })
  await expect(page.getByRole('img', { name })).toBeVisible()

  // 3. Generate a description, straight into the editor
  await page.getByLabel('Specs').fill('- 40 mm drivers\n- 60 h battery')
  await page.getByRole('button', { name: 'Generate description' }).click()

  const editor = page.getByRole('textbox', { name: 'Description' })
  await expect(editor).toContainText(GENERATED)

  await page.getByRole('button', { name: 'Create product' }).click()
  await expect(page).toHaveURL('/admin/products')

  // Saved as a draft: createProduct never publishes, which is the invariant catalog.spec.ts
  // leans on for everything except the total count.
  await expect(row(page, name)).toContainText('Draft')

  // 4. Publish
  await page.getByRole('button', { name: `Publish ${name}` }).click()
  await expect(row(page, name)).toContainText('Published')

  // 5. It reaches the public grid. Scoped to this product's own name rather than the bare grid,
  // so the assertion is exact without depending on the catalog's total count.
  await page.goto(`/?q=${encodeURIComponent(name)}`)
  const grid = page.getByRole('list', { name: 'Products' })
  await expect(grid.getByRole('listitem')).toHaveCount(1)
  await expect(page.getByRole('link', { name })).toBeVisible()

  // The description written by the generator survived the save and renders on the detail page.
  await page.getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByText(GENERATED)).toBeVisible()

  // Put the catalog back to exactly what the seed wrote. Without this the published count drifts
  // upward every run, and catalog.spec.ts's page-1 count would eventually be wrong too.
  await page.goto('/admin/products')
  await page.getByRole('button', { name: `Unpublish ${name}` }).click()
  await expect(row(page, name)).toContainText('Draft')
})

test('an admin deletes a product and it leaves the catalog', async ({ page }) => {
  await signUpAsAdmin(page)

  const name = `Delete Test ${crypto.randomUUID().slice(0, 8)}`
  await page.goto('/admin/products/new')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Price').fill('9800')
  await page.getByLabel('Stock').fill('3')
  await page.getByRole('button', { name: 'Create product' }).click()
  await expect(page).toHaveURL('/admin/products')
  await expect(row(page, name)).toBeVisible()

  // Delete is behind a confirmation dialog — the destructive path SPEC 3.7 asks to guard, and
  // the one admin control with no coverage before this.
  await page.getByRole('button', { name: `Delete ${name}` }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText(`Delete ${name}?`)
  await dialog.getByRole('button', { name: 'Delete' }).click()

  await expect(row(page, name)).toHaveCount(0)
})
