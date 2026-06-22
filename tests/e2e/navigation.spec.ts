import { test, expect } from '@playwright/test'

test.describe('Homepage navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows the Battalion System heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Battalion System' })).toBeVisible()
  })

  test('Stallion card is a link that navigates to /stallion', async ({ page }) => {
    const stallionLink = page.getByRole('link', { name: 'Stallion' })
    await expect(stallionLink).toBeVisible()
    await stallionLink.click()
    await expect(page).toHaveURL('/stallion/')
  })

  test('Hercules card is a link', async ({ page }) => {
    const herculesLink = page.getByRole('link', { name: 'Hercules' })
    await expect(herculesLink).toBeVisible()
  })

  test('Archer card shows Coming Soon modal when clicked', async ({ page }) => {
    await page.getByRole('button', { name: 'Archer' }).click()
    await expect(page.getByText('Coming Soon')).toBeVisible()
  })

  test('Braves card shows Coming Soon modal when clicked', async ({ page }) => {
    await page.getByRole('button', { name: 'Braves' }).click()
    await expect(page.getByText('Coming Soon')).toBeVisible()
  })
})
