import { expect, test } from '@playwright/test'

// There is no test database and no teardown, and the suite runs fully parallel, so every
// test mints its own account rather than sharing a fixture.
function newAccount() {
  const id = crypto.randomUUID().slice(0, 8)
  return { name: 'Test User', email: `test-${id}@example.com`, password: 'correct-horse-8' }
}

const mainNav = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Main' })

test('signup, logout and login survive a reload', async ({ page }) => {
  const { name, email, password } = newAccount()

  await page.goto('/signup')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()

  // Signing up establishes a session, so the header flips to the signed-in controls.
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(mainNav(page).getByRole('link', { name: 'Log in' })).toBeVisible()

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
})

test('a client cannot assign itself a role at signup', async ({ request }) => {
  const { name, email, password } = newAccount()

  // The attack: smuggle role: 'admin' into the signup payload. `input: false` on the field
  // must make the server ignore it. This test fails loudly if that flag is ever dropped.
  const signup = await request.post('/api/auth/sign-up/email', {
    data: { name, email, password, role: 'admin' },
  })
  expect(signup.ok()).toBeTruthy()

  const session = await request.get('/api/auth/get-session')
  const body = await session.json()
  expect(body.user.email).toBe(email)
  expect(body.user.role).toBe('customer')
})

test('an anonymous visitor to /admin is sent to login with a next param', async ({ page }) => {
  await page.goto('/admin/products')

  await expect(page).toHaveURL('/login?next=%2Fadmin%2Fproducts')
  await expect(page.getByRole('heading', { level: 1, name: 'Log in' })).toBeVisible()
})

test('a signed-in customer is redirected away from /admin', async ({ page }) => {
  const { name, email, password } = newAccount()

  await page.goto('/signup')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

  // proxy.ts sees a session cookie and waves this through — the admin layout's requireRole is
  // what actually turns a customer away (SPEC 3.1, 8).
  await page.goto('/admin/products')

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Catalog' })).toBeVisible()
})
