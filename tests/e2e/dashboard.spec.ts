import { test, expect } from '@playwright/test'

test.describe('Duty Dashboard workflow', () => {
  test.beforeEach(async ({ page }) => {
    const password = process.env.TEST_SUPABASE_PASSWORD
    const hasRealCreds = !!password && password !== 'YOUR_TEST_PASSWORD'
    test.skip(!hasRealCreds, 'TEST_SUPABASE_PASSWORD not configured in .env.test')

    await page.goto('/test/') // Dashboard is the default tab
    await page.getByPlaceholder('Password').fill(password!)
    await page.keyboard.press('Enter')
    await expect(page.getByText('Duty Breakdown')).toBeVisible({ timeout: 15000 })
  })

  test('breakdown shows the seeded CDO duty holder with 1 point', async ({ page }) => {
    const breakdown = page.getByText('Duty Breakdown').locator('xpath=following::table[1]')
    const row = breakdown.locator('tr', { hasText: 'LEE JUN WEI' })
    await expect(row).toBeVisible({ timeout: 10000 })
    await expect(row.locator('td').last()).toHaveText('1')
  })

  test('CDO filter pill narrows the list to CDO-eligible soldiers only', async ({ page }) => {
    await page.getByRole('button', { name: 'CDO', exact: true }).click()

    await expect(page.locator('tr', { hasText: 'LEE JUN WEI' })).toBeVisible({ timeout: 10000 })
    // WONG KAH MENG (1SG) is not CDO-eligible (Officers only)
    await expect(page.locator('tr', { hasText: 'WONG KAH MENG' })).toHaveCount(0)
  })
})
