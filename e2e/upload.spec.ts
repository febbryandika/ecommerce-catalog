import { expect, test } from '@playwright/test'
import { signUpAsAdmin } from './admin'

// A real 1x1 PNG, inline so the suite carries no binary fixture. Real rather than random bytes
// so the preview actually decodes when it renders.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

test('an anonymous upload is refused', async ({ request }) => {
  // /api/upload is outside proxy.ts's /admin/:path* matcher, so requireRole inside the handler
  // is the only thing standing here (SPEC 3.1, 8).
  const response = await request.post('/api/upload', {
    multipart: { file: { name: 'a.png', mimeType: 'image/png', buffer: PNG_1PX } },
  })

  expect(response.status()).toBe(403)
})

test('a signed-in customer cannot upload', async ({ page }) => {
  const id = crypto.randomUUID().slice(0, 8)
  await page.goto('/signup')
  await page.getByLabel('Name').fill('Test User')
  await page.getByLabel('Email').fill(`test-${id}@example.com`)
  await page.getByLabel('Password').fill('correct-horse-8')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

  const response = await page.request.post('/api/upload', {
    multipart: { file: { name: 'a.png', mimeType: 'image/png', buffer: PNG_1PX } },
  })

  expect(response.status()).toBe(403)
})

// The next two go through `request` rather than the dropzone on purpose: the client-side
// pre-check would reject them before any POST happened, and the point is that the server
// rejects on its own, independently of the input's accept attribute.
test('the upload route rejects a type the accept attribute would have blocked', async ({
  page,
}) => {
  await signUpAsAdmin(page)

  const response = await page.request.post('/api/upload', {
    multipart: { file: { name: 'a.gif', mimeType: 'image/gif', buffer: PNG_1PX } },
  })

  expect(response.status()).toBe(400)
  expect((await response.json()).error).toMatch(/JPEG, PNG or WebP/)
})

test('the upload route rejects a file over the size cap', async ({ page }) => {
  await signUpAsAdmin(page)

  const response = await page.request.post('/api/upload', {
    multipart: {
      file: {
        name: 'big.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(MAX_IMAGE_BYTES + 1),
      },
    },
  })

  expect(response.status()).toBe(400)
  expect((await response.json()).error).toMatch(/5 MB/)
})

test('an admin uploads a product image and it survives the save', async ({ page }) => {
  test.skip(!process.env.R2_BUCKET, 'R2 is not configured in this environment.')

  await signUpAsAdmin(page)
  const name = `Upload Test ${crypto.randomUUID().slice(0, 8)}`

  await page.goto('/admin/products/new')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Price').fill('12800')
  await page.getByLabel('Stock').fill('5')
  await page
    .getByLabel('Image')
    .setInputFiles({ name: 'swatch.png', mimeType: 'image/png', buffer: PNG_1PX })

  // The preview carries the product name as its alt text (SPEC 3.7), so role + accessible name
  // is the assertion — never the rewritten next/image src.
  await expect(page.getByRole('img', { name })).toBeVisible()

  await page.getByRole('button', { name: 'Create product' }).click()
  await expect(page).toHaveURL('/admin/products')

  // Persisted, not merely held in form state: this thumbnail is rendered from the database.
  await expect(page.getByRole('img', { name })).toBeVisible()

  await page.getByRole('link', { name: `Edit ${name}` }).click()
  await expect(page.getByRole('img', { name })).toBeVisible()
})
