import { test, expect } from '@playwright/test'

// All tests require real credentials — skip gracefully if not configured
test.describe('Parade State workflow', () => {
  test.beforeEach(async ({ page }) => {
    const password = process.env.TEST_SUPABASE_PASSWORD
    const hasRealCreds = !!password && password !== 'YOUR_TEST_PASSWORD'
    test.skip(!hasRealCreds, 'TEST_SUPABASE_PASSWORD not configured in .env.test')

    // Parade State is always generated for "today" regardless of the duty date
    // selected in the UI, so pin the browser clock to the fixture date (2026-01-15).
    await page.clock.setFixedTime(new Date('2026-01-15T08:00:00'))

    await page.goto('/test/')
    await page.getByPlaceholder('Password').fill(password!)
    await page.keyboard.press('Enter')
    await expect(page.getByText('Nominal Roll')).toBeVisible({ timeout: 15000 })
  })

  test('navigates to Parade State tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Parade State' }).click()
    await expect(page.getByRole('button', { name: 'Exceptions' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Duties' })).toBeVisible()
  })

  test('Exceptions tab shows fixture exception (TAN WEI LIANG on Off/Leave)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parade State' }).click()
    await page.getByRole('button', { name: 'Duties' }).click() // date input lives under Duties; Config is the default section
    await page.locator('input[type="date"]').fill('2026-01-15')

    await page.getByRole('button', { name: 'Exceptions' }).click()

    await expect(page.getByText('TAN WEI LIANG')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Off/Leave')).toBeVisible()
  })

  test('generated parade state has correct strength numbers (13 total, 9 present, 4 absent)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parade State' }).click()
    await page.getByRole('button', { name: 'Duties' }).click() // date input lives under Duties; Config is the default section
    await page.locator('input[type="date"]').fill('2026-01-15')

    await page.getByRole('button', { name: 'First Parade' }).click()

    const output = page.locator('textarea')
    await expect(output).toContainText('TOTAL STRENGTH : 13', { timeout: 10000 })
    await expect(output).toContainText('PRESENT        : 9')
    await expect(output).toContainText('ABSENT         : 4')
  })

  test('generated report includes exception details', async ({ page }) => {
    await page.getByRole('button', { name: 'Parade State' }).click()
    await page.getByRole('button', { name: 'Duties' }).click() // date input lives under Duties; Config is the default section
    await page.locator('input[type="date"]').fill('2026-01-15')

    await page.getByRole('button', { name: 'First Parade' }).click()

    const output = page.locator('textarea')
    await expect(output).toContainText('OFF/LEAVE:', { timeout: 10000 })
    await expect(output).toContainText('TAN WEI LIANG')
  })

  test('generated report includes duty assignments', async ({ page }) => {
    await page.getByRole('button', { name: 'Parade State' }).click()
    await page.getByRole('button', { name: 'Duties' }).click() // date input lives under Duties; Config is the default section
    await page.locator('input[type="date"]').fill('2026-01-15')

    await page.getByRole('button', { name: 'First Parade' }).click()

    const output = page.locator('textarea')
    await expect(output).toContainText('CDO: LTA LEE JUN WEI', { timeout: 10000 })
  })

  test('Status exception (non-absence) does not increase absent count', async ({ page }) => {
    // GOH RONG HAO has Status / counts_as_absence: false → still 9 present, 4 absent
    await page.getByRole('button', { name: 'Parade State' }).click()
    await page.getByRole('button', { name: 'Duties' }).click() // date input lives under Duties; Config is the default section
    await page.locator('input[type="date"]').fill('2026-01-15')

    await page.getByRole('button', { name: 'First Parade' }).click()

    const output = page.locator('textarea')
    await expect(output).toContainText('PRESENT        : 9', { timeout: 10000 })
    await expect(output).toContainText('ABSENT         : 4')
  })

  test('editing an existing exception saves successfully (regression: "time" column must exist)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parade State' }).click()
    await page.getByRole('button', { name: 'Duties' }).click() // date input lives under Duties; Config is the default section
    await page.locator('input[type="date"]').fill('2026-01-15')
    await page.getByRole('button', { name: 'Exceptions' }).click()

    const row = page.locator('tr', { hasText: 'TAN WEI LIANG' })
    await row.getByTitle('Edit').click()

    const reasonInput = page.locator('input[value="Annual Leave"]')
    await reasonInput.fill('Medical Leave')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Medical Leave')).toBeVisible({ timeout: 10000 })
  })

  test('Add Exception button is disabled until Soldier is picked; MA can be saved with Medical Center/Reason/Date blank', async ({ page }) => {
    await page.getByRole('button', { name: 'Parade State' }).click()
    await page.getByRole('button', { name: 'Duties' }).click() // date input lives under Duties; Config is the default section
    await page.locator('input[type="date"]').fill('2026-01-15')
    await page.getByRole('button', { name: 'Exceptions' }).click()
    await page.getByRole('button', { name: '+ Exception' }).click()

    const addBtn = page.getByRole('button', { name: 'Add Exception' })
    await expect(addBtn).toBeDisabled()

    await page.getByPlaceholder('Search soldier...').fill('HO KAI')
    await page.getByText('HO KAI XIANG').first().click()
    await page.getByRole('button', { name: 'MA' }).click()

    // Soldier + Scope are the only compulsory fields — Medical Center, Reason,
    // and Date are all left blank here, and the button should still be enabled.
    await expect(addBtn).toBeEnabled()
    await addBtn.click()
    await expect(page.getByText('HO KAI XIANG')).toBeVisible({ timeout: 10000 })
  })

  test('switching the duty date does not change the generated parade state (always uses today)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parade State' }).click()
    await page.getByRole('button', { name: 'Duties' }).click() // date input lives under Duties; Config is the default section
    // Navigate away to a date with no fixture exceptions — the report must still
    // reflect today (2026-01-15, per the mocked clock), not this selected date.
    await page.locator('input[type="date"]').fill('2026-01-01')

    await page.getByRole('button', { name: 'First Parade' }).click()

    const output = page.locator('textarea')
    await expect(output).toContainText('TOTAL STRENGTH : 13', { timeout: 10000 })
    await expect(output).toContainText('PRESENT        : 9')
    await expect(output).toContainText('ABSENT         : 4')
  })
})
