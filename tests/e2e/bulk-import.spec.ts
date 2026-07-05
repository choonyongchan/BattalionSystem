import { test, expect } from '@playwright/test'

const HINTS_ROW = '(Optional e.g. 1234),(Compulsory e.g. REC PTE),(Compulsory),(Compulsory i.e. HQ 1 2 3 or 4)'
const csvFile = (rows: string) => ({
  name: 'import.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(`${HINTS_ROW}\n4D,RANK,NAME,PLATOON\n${rows}`),
})

test.describe('Bulk Import workflow', () => {
  test.beforeEach(async ({ page }) => {
    const password = process.env.TEST_SUPABASE_PASSWORD
    const hasRealCreds = !!password && password !== 'YOUR_TEST_PASSWORD'
    test.skip(!hasRealCreds, 'TEST_SUPABASE_PASSWORD not configured in .env.test')

    await page.goto('/test/')
    await page.getByPlaceholder('Password').fill(password!)
    await page.keyboard.press('Enter')
    await expect(page.getByText('Nominal Roll').first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Nominal Roll' }).click()
    await page.getByRole('button', { name: /bulk import/i }).click()
    await expect(page.getByText('Download Template')).toBeVisible()
  })

  test('imports a valid CSV and the new soldier appears in the roll', async ({ page }) => {
    await page.getByTestId('csv-upload').setInputFiles(csvFile(',PTE,E2E_BULK_IMPORT,3'))

    await expect(page.getByText('E2E_BULK_IMPORT')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /import 1 soldier/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15000 })
    const row = page.locator('tr', { hasText: 'E2E_BULK_IMPORT' })
    await expect(row).toBeVisible()

    // Clean up via the UI so this test doesn't leak state into the rest of the shared e2e DB
    await row.locator('button[title="Remove"]').click()
    await row.getByTitle('Confirm delete').click()
    await expect(row).toHaveCount(0, { timeout: 10000 })
  })

  test('a malformed CSV row shows a validation error and blocks import', async ({ page }) => {
    await page.getByTestId('csv-upload').setInputFiles(csvFile(',BRANK,E2E_BAD_RANK,9'))

    await expect(page.getByText(/errors? found/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /^import \d/i })).toHaveCount(0)
  })
})
