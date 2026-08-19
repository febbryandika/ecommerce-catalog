import { expect, type Page } from '@playwright/test'
import { Client } from 'pg'

/** Same shape as auth.spec.ts: the suite is fully parallel with no teardown, so every test
 *  mints its own account rather than sharing a fixture. */
export function newAccount() {
  const id = crypto.randomUUID().slice(0, 8)
  return { name: 'Test Admin', email: `admin-${id}@example.com`, password: 'correct-horse-8' }
}

/**
 * Better Auth declares `role` as input: false, so there is no request that can create an admin
 * — the only way is the manual promotion the README documents (SPEC 3.1, 7). No session cookie
 * cache is configured, so getSession re-reads the user row and one reload picks up the change.
 */
export async function signUpAsAdmin(page: Page) {
  const account = newAccount()

  await page.goto('/signup')
  await page.getByLabel('Name').fill(account.name)
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — playwright.config.ts should have loaded .env')
  }

  const client = new Client({ connectionString })
  try {
    await client.connect()
    await client.query('UPDATE "user" SET role = $1 WHERE email = $2', ['admin', account.email])
  } finally {
    await client.end()
  }

  await page.reload()
  return account
}
