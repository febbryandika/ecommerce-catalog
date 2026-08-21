import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import { MOCK_IMAGE_ORIGIN } from './e2e/image-host'

// Playwright does not read .env, but the upload suite needs DATABASE_URL to promote its own
// account to admin and R2_BUCKET to decide whether the live-R2 test can run. loadEnvFile is
// built into Node, and the guard matters because it throws when the file is absent (CI).
if (existsSync('.env')) process.loadEnvFile('.env')

/**
 * The suite runs against its own database, never the one `pnpm dev` uses. It is emptied and
 * re-seeded before every run (e2e/global-setup.ts), which is what makes the starting state
 * identical each time — and doing that to the dev database would delete anything created by
 * hand while developing.
 *
 * TEST_DATABASE_URL wins when set (CI sets it). Otherwise the name is derived by suffixing the
 * dev database, so an existing clone needs no .env edit to get the isolation. Deriving is also
 * fail-safe: the suffixed name can never collide with the database it was derived from.
 *
 * Assigning DATABASE_URL rather than threading a second name through the suite means the
 * webServer below, the Server Actions it runs, and every pg.Client in e2e/ agree without a
 * second variable to keep in sync.
 */
function deriveTestDatabaseUrl(devUrl: string): string | undefined {
  const url = new URL(devUrl)
  const name = url.pathname.replace(/^\//, '')
  if (!name) return undefined
  url.pathname = `/${name}_test`
  return url.toString()
}

/**
 * Deriving into TEST_DATABASE_URL rather than straight into DATABASE_URL is what makes this
 * idempotent, and it has to be: Playwright evaluates this file once in the main process and
 * again in every worker, and each worker inherits the environment the main process already
 * rewrote. Deriving from DATABASE_URL each time appended the suffix twice and every test that
 * opens its own pg.Client failed on `..._test_test does not exist`.
 */
if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
  const derived = deriveTestDatabaseUrl(process.env.DATABASE_URL)
  if (derived) process.env.TEST_DATABASE_URL = derived
}
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}

/**
 * A port of its own, not 3000. Another project's dev server on 3000 plus
 * `reuseExistingServer` means Playwright silently adopts the wrong app and every test fails
 * against it — that happened on this machine, and "check lsof before debugging" is a worse
 * answer than not colliding in the first place.
 */
const port = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // list for the terminal; html so the failure artifact CI uploads is not empty. Without the
  // html reporter nothing writes playwright-report/, which is why a CI failure used to leave
  // no trace to open.
  reporter: [['list'], ['html', { open: 'never' }]],
  /**
   * Web-first assertions retry until this budget is spent, so this is a ceiling, not a sleep —
   * a passing assertion still returns the moment it is true.
   *
   * 5 s (the default) is not enough against `next dev`, which compiles each route on first hit:
   * the first navigation to /admin/products or the first scrypt login in a run routinely spends
   * longer than that, so a cold run failed where a warm one passed. That difference between the
   * first and second run of the day is the repeatability problem this phase exists to remove.
   */
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  globalSetup: './e2e/global-setup.ts',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Better Auth builds its callback URLs from this, and the root layout uses it for
      // metadataBase — both have to agree with the port the server is actually on.
      BETTER_AUTH_URL: baseURL,
      // Lets next/image render the mocked upload's host where no real bucket is configured
      // (CI). A real R2_PUBLIC_URL still wins, so the live upload test is unaffected.
      R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || MOCK_IMAGE_ORIGIN,
    },
  },
})
