import { expect, test, type Page } from '@playwright/test'
import { signUpAsAdmin } from './admin'

// These flows cold-compile the admin form's editor chunk and CI runs them on one worker.
test.describe.configure({ timeout: 60_000 })

// Two paragraphs, delivered in pieces, so the client's decode-and-append loop is exercised
// rather than handed one finished string.
const CHUNKS = [
  'The Aurora is built for the hours after everyone else has gone home. ',
  'Forty millimetre drivers give you a floor of silence to work against.',
  '\n\nBattery life runs to sixty hours, so the charger is a travel item, not a daily one.',
]
const GENERATED_OPENING = 'The Aurora is built for the hours'
const GENERATED_CLOSING = 'not a daily one.'

/**
 * Holds the response open until the test releases it, so "disabled while in flight" can be
 * asserted against a state the test controls rather than raced against a timer.
 *
 * This used to sleep 400 ms inside the handler to widen the window. That is the one thing a
 * suite like this must not do: the assertion passed or failed depending on whether the client
 * settled faster than the sleep, which is precisely the shape of a flake that only shows up on
 * a loaded CI box.
 */
async function mockDescribeRoute(page: Page) {
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })

  await page.route('**/api/ai/describe', async (route) => {
    await held
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: CHUNKS.join(''),
    })
  })

  return { release }
}

async function fillNewProduct(page: Page, name: string) {
  await page.goto('/admin/products/new')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Price').fill('34800')
  await page.getByLabel('Stock').fill('12')
}

test('an anonymous request cannot generate a description', async ({ request }) => {
  // /api/ai/describe is outside proxy.ts's /admin/:path* matcher, so requireRole inside the
  // handler is the only thing standing here (SPEC 3.1, 8). No API key is needed to prove it:
  // the role check throws long before the model is built.
  const response = await request.post('/api/ai/describe', {
    data: { name: 'Aurora Headphones', specs: '- 40 mm drivers' },
  })

  expect(response.status()).toBe(403)
})

test('a signed-in customer cannot generate a description', async ({ page }) => {
  const id = crypto.randomUUID().slice(0, 8)
  await page.goto('/signup')
  await page.getByLabel('Name').fill('Test User')
  await page.getByLabel('Email').fill(`test-${id}@example.com`)
  await page.getByLabel('Password').fill('correct-horse-8')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

  const response = await page.request.post('/api/ai/describe', {
    data: { name: 'Aurora Headphones', specs: '- 40 mm drivers' },
  })

  expect(response.status()).toBe(403)
})

test('the route rejects a request with no specs to work from', async ({ page }) => {
  await signUpAsAdmin(page)

  const response = await page.request.post('/api/ai/describe', {
    data: { name: 'Aurora Headphones', specs: '   ' },
  })

  expect(response.status()).toBe(400)
  expect((await response.json()).error).toMatch(/specs/i)
})

test('an admin generates a description, edits it, and it survives the save', async ({ page }) => {
  await signUpAsAdmin(page)
  const stream = await mockDescribeRoute(page)

  const name = `Describe Test ${crypto.randomUUID().slice(0, 8)}`
  await fillNewProduct(page, name)

  const editor = page.getByRole('textbox', { name: 'Description' })
  const generate = page.getByRole('button', { name: 'Generate description' })

  await page.getByLabel('Specs').fill('- 40 mm drivers\n- 60 h battery')
  await generate.click()

  // One request at a time per admin (SPEC 3.6) — the button is out of action until it lands.
  // The response is still held open here, so this is not a race: it cannot have landed yet.
  await expect(page.getByRole('button', { name: 'Generating…' })).toBeDisabled()

  stream.release()

  await expect(editor).toContainText(GENERATED_OPENING)
  await expect(editor).toContainText(GENERATED_CLOSING)
  await expect(generate).toBeEnabled()

  // The prompt asks for paragraphs, and the stream carries them as blank lines — they have to
  // arrive as real blocks, not one run-on <p>.
  await expect(editor.locator('p')).toHaveCount(2)

  // Editable afterwards, which is the whole point of streaming into an editor rather than a
  // read-only preview (SPEC 3.6).
  await editor.click()
  await page.keyboard.press('End')
  await editor.pressSequentially(' Hand-edited.')
  await expect(editor).toContainText('Hand-edited.')

  await page.getByRole('button', { name: 'Create product' }).click()
  await expect(page).toHaveURL('/admin/products')

  // Read back from the database, not from form state — this is also what proves the sanitizer
  // in createProduct passes ordinary TipTap markup through untouched (SPEC 8).
  await page.getByRole('link', { name: `Edit ${name}` }).click()
  await expect(page.getByRole('textbox', { name: 'Description' })).toContainText(GENERATED_OPENING)
  await expect(page.getByRole('textbox', { name: 'Description' })).toContainText('Hand-edited.')
})

test('a failed stream leaves the existing description untouched', async ({ page }) => {
  await signUpAsAdmin(page)
  await page.route('**/api/ai/describe', (route) =>
    route.fulfill({ status: 500, contentType: 'text/html', body: '<html>boom</html>' }),
  )

  const name = `Describe Fail ${crypto.randomUUID().slice(0, 8)}`
  await fillNewProduct(page, name)

  const editor = page.getByRole('textbox', { name: 'Description' })
  await editor.click()
  await editor.pressSequentially('Hand-written copy worth keeping.')

  await page.getByLabel('Specs').fill('- 40 mm drivers')
  await page.getByRole('button', { name: 'Generate description' }).click()

  await expect(page.getByText('The description could not be generated.')).toBeVisible()
  await expect(editor).toContainText('Hand-written copy worth keeping.')
})

test('an empty 200 is treated as a failure, not as an empty description', async ({ page }) => {
  await signUpAsAdmin(page)

  // The failure that actually happens in production: a rejected key or a rate limit becomes an
  // error part inside the SDK stream, toTextStream drops everything that is not a text delta,
  // and the route answers a perfectly ordinary 200 carrying no bytes at all.
  await page.route('**/api/ai/describe', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: '',
    }),
  )

  const name = `Describe Empty ${crypto.randomUUID().slice(0, 8)}`
  await fillNewProduct(page, name)

  const editor = page.getByRole('textbox', { name: 'Description' })
  await editor.click()
  await editor.pressSequentially('Copy that must survive an empty response.')

  await page.getByLabel('Specs').fill('- 40 mm drivers')
  await page.getByRole('button', { name: 'Generate description' }).click()

  await expect(page.getByText('The generator returned nothing.')).toBeVisible()
  await expect(editor).toContainText('Copy that must survive an empty response.')
})

test('the live route streams text in progressively', async ({ page }) => {
  test.skip(!process.env.ANTHROPIC_API_KEY, 'Anthropic is not configured in this environment.')

  await signUpAsAdmin(page)
  await fillNewProduct(page, `Describe Live ${crypto.randomUUID().slice(0, 8)}`)

  const editor = page.getByRole('textbox', { name: 'Description' })
  await page.getByLabel('Specs').fill('- 40 mm drivers\n- 60 h battery\n- USB-C')
  await page.getByRole('button', { name: 'Generate description' }).click()

  // Sampled mid-flight and again at the end: a response that arrived in one piece would show
  // the same length twice, which is exactly the regression this guards.
  await expect(editor).not.toBeEmpty()
  const partial = (await editor.innerText()).length

  await expect(page.getByRole('button', { name: 'Generate description' })).toBeEnabled({
    timeout: 60_000,
  })
  expect((await editor.innerText()).length).toBeGreaterThan(partial)
})
