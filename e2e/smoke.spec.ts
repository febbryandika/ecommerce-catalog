import { expect, test } from '@playwright/test'

test('catalog page renders the app shell', async ({ page }) => {
  const response = await page.goto('/')

  expect(response?.status()).toBe(200)
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Catalog' })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toBeVisible()
})
