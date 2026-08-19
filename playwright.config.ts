import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Playwright does not read .env, but the upload suite needs DATABASE_URL to promote its own
// account to admin and R2_BUCKET to decide whether the live-R2 test can run. loadEnvFile is
// built into Node, and the guard matters because it throws when the file is absent (CI).
if (existsSync('.env')) process.loadEnvFile('.env')

const baseURL = 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
