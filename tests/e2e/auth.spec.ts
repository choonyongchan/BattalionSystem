import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  test('shows login form when visiting /test unauthenticated', async ({ page }) => {
    await page.goto('/test/')
    await expect(page.getByText('Welcome, Test Commander')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
  })

  test('logs in with correct credentials and shows company content', async ({ page }) => {
    const password = process.env.TEST_SUPABASE_PASSWORD
    const hasRealCreds = !!password && password !== 'YOUR_TEST_PASSWORD'
    test.skip(!hasRealCreds, 'TEST_SUPABASE_PASSWORD not configured in .env.test')

    await page.goto('/test/')
    await page.getByPlaceholder('Password').fill(password || '')
    await page.keyboard.press('Enter')

    await expect(page.getByText('Nominal Roll')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Parade State')).toBeVisible()
  })

  test('after login, logout shows login form again', async ({ page }) => {
    const password = process.env.TEST_SUPABASE_PASSWORD
    const hasRealCreds = !!password && password !== 'YOUR_TEST_PASSWORD'
    test.skip(!hasRealCreds, 'TEST_SUPABASE_PASSWORD not configured in .env.test')

    // Log in first
    await page.goto('/test/')
    await page.getByPlaceholder('Password').fill(password || '')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Nominal Roll')).toBeVisible({ timeout: 15000 })

    // Log out — button text is "Sign Out" (CompanyContent.tsx:47)
    await page.getByRole('button', { name: 'Sign Out' }).click()

    await expect(page.getByText('Welcome, Test Commander')).toBeVisible({ timeout: 10000 })
  })
})
