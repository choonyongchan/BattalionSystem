import { test, expect } from '@playwright/test'

test.describe('Site navigation', () => {
  test('the root is the Hercules landing page with the commander sign-in', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Hercules Company' })).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('the old /hercules/ path redirects to the root', async ({ page }) => {
    await page.goto('/hercules/')
    await expect(page).toHaveURL('/')
  })

  test('the old standalone dashboard opens the Duty Dashboard tab', async ({ page }) => {
    await page.goto('/hercules/dashboard/')
    await expect(page).toHaveURL('/?tab=dashboard')
  })

  for (const company of ['Stallion', 'Archer'] as const) {
    test(`${company} is switched off and says so`, async ({ page }) => {
      await page.goto(`/${company.toLowerCase()}/`)
      await expect(page.getByRole('heading', { name: `${company} Company` })).toBeVisible()
      await expect(page.getByText('Not available yet.')).toBeVisible()
    })
  }

  test('?tab= opens that tab after sign-in, and switching tabs updates the URL', async ({ page }) => {
    const password = process.env.TEST_SUPABASE_PASSWORD
    test.skip(!password || password === 'YOUR_TEST_PASSWORD', 'TEST_SUPABASE_PASSWORD not configured in .env.test')

    await page.goto('/test/?tab=report-sick')
    await page.getByPlaceholder('Password').fill(password!)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('tab', { name: 'Report Sick' })).toHaveAttribute('aria-selected', 'true', { timeout: 15000 })

    await page.getByRole('tab', { name: 'Conducts' }).click()
    await expect(page).toHaveURL(/tab=conducts/)

    // Arrow keys move between tabs (WAI-ARIA tabs pattern)
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  })
})
