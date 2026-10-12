import { test, expect } from '@playwright/test'
import { resetTestDb } from '@/tests/fixtures/db'

// Smoke tests for the tabs without their own spec, on the seeded dummy data
test.describe('Workspace tabs', () => {
  test.beforeEach(async ({ page }) => {
    const password = process.env.TEST_SUPABASE_PASSWORD
    test.skip(!password || password === 'YOUR_TEST_PASSWORD', 'TEST_SUPABASE_PASSWORD not configured in .env.test')
    await resetTestDb()
    await page.clock.setFixedTime(new Date('2026-01-15T08:00:00')) // the fixture date

    await page.goto('/test/')
    await page.getByPlaceholder('Password').fill(password!)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('tab', { name: 'Nominal Roll' })).toBeVisible({ timeout: 15000 })
  })

  test('RSI lists the day\'s report sick in the generated message', async ({ page }) => {
    await page.getByRole('tab', { name: 'RSI' }).click()
    await expect(page.getByText('TAN RONG XIAN').first()).toBeVisible({ timeout: 10000 })
  })

  test('Off/Leave shows seeded balances, most senior first', async ({ page }) => {
    await page.getByRole('tab', { name: 'Off/Leave' }).click()
    const names = page.locator('tbody tr td:nth-child(2)')
    await expect(page.getByText('TAN WEI LIANG')).toBeVisible({ timeout: 10000 })
    await expect(names.first()).toContainText('TAN WEI LIANG')
  })

  test('Conducts: create a conduct and see the fall-outs from exceptions', async ({ page }) => {
    await page.getByRole('tab', { name: 'Conducts' }).click()
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByPlaceholder('Conduct name (e.g. IPPT1)').fill('ROUTE MARCH')
    await page.getByLabel('Date', { exact: true }).fill('2026-01-15')
    await page.getByRole('button', { name: 'Create conduct' }).click()
    await expect(page.getByText('ROUTE MARCH').first()).toBeVisible({ timeout: 10000 })
    // CHONG KAH WAI is on Att C that day, so he falls out automatically
    await expect(page.getByText(/CHONG KAH WAI/).first()).toBeVisible()
  })
})
