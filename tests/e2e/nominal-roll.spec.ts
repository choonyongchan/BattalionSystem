import { test, expect } from '@playwright/test'

test.describe('Nominal Roll workflow', () => {
  test.beforeEach(async ({ page }) => {
    const password = process.env.TEST_SUPABASE_PASSWORD
    const hasRealCreds = !!password && password !== 'YOUR_TEST_PASSWORD'
    test.skip(!hasRealCreds, 'TEST_SUPABASE_PASSWORD not configured in .env.test')

    await page.goto('/test/')
    await page.getByPlaceholder('Password').fill(password!)
    await page.keyboard.press('Enter')
    await expect(page.getByText('Nominal Roll').first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Nominal Roll' }).click()
    await expect(page.getByText('TAN WEI LIANG')).toBeVisible({ timeout: 10000 })
  })

  test('adds a soldier and then removes them via the 2-step confirm', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add' }).click()
    await page.getByPlaceholder('TAN AH KOW').fill('E2E_ROLL_TEST')
    await page.getByRole('combobox').selectOption('3')
    await page.getByRole('button', { name: 'Add Soldier' }).click()

    const row = page.locator('tr', { hasText: 'E2E_ROLL_TEST' })
    await expect(row).toBeVisible({ timeout: 10000 })

    await row.locator('button[title="Remove"]').click()
    await row.getByTitle('Confirm delete').click()
    await expect(row).toHaveCount(0, { timeout: 10000 })
  })
})
