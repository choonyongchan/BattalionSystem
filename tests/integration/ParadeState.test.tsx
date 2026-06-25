import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ParadeState from '@/components/ParadeState'
import { supabase } from '@/lib/supabase'
import { truncateTestDb, seedTestDb } from '../fixtures/db'
import { FIXTURE_DATE } from '../fixtures/exceptions'

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_SUPABASE_EMAIL!,
    password: process.env.TEST_SUPABASE_PASSWORD!,
  })
  if (error) throw new Error(`Test setup sign-in failed: ${error.message}`)
  await truncateTestDb()
  await seedTestDb()
}, 30000)

afterAll(async () => {
  await supabase.auth.signOut()
})

// ParadeState defaults the date picker to today â€” we need to set it to FIXTURE_DATE
// so the fixture exceptions/duties are visible
async function renderParadeStateOnFixtureDate() {
  render(<ParadeState company="test" companyLabel="Test" />)
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
  // Change date to the fixture date so fixture exceptions/duties are active
  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
  fireEvent.change(dateInput, { target: { value: FIXTURE_DATE } })
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
}

describe('ParadeState', () => {
  it('shows fixture exceptions in the Exceptions tab', async () => {
    await renderParadeStateOnFixtureDate()

    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))

    await waitFor(() => {
      expect(screen.getByText('TEST_SOLDIER_ONE')).toBeInTheDocument()
      expect(screen.getByText('Off/Leave')).toBeInTheDocument()
    })
  })

  it('filters exceptions by soldier name using the search bar', async () => {
    await renderParadeStateOnFixtureDate()

    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))
    const searchInput = await screen.findByPlaceholderText('Search by soldier name')

    await userEvent.type(searchInput, 'test_soldier_one')

    await waitFor(() => {
      expect(screen.getByText('TEST_SOLDIER_ONE')).toBeInTheDocument()
      expect(screen.queryByText('No exceptions for this date.')).not.toBeInTheDocument()
    })
  })

  it('shows fixture duty in the Duties tab', async () => {
    await renderParadeStateOnFixtureDate()

    await userEvent.click(screen.getByRole('button', { name: 'Duties' }))

    await waitFor(() => {
      expect(screen.getByText('CDO')).toBeInTheDocument()
      expect(screen.getByText('TEST_SOLDIER_TWO')).toBeInTheDocument()
    })
  })

  it('generates report with correct present count when soldier has exception', async () => {
    await renderParadeStateOnFixtureDate()

    await userEvent.click(screen.getByRole('button', { name: 'Generate Parade State' }))

    await waitFor(() => {
      // 3 soldiers total, 1 exception (TEST_SOLDIER_ONE) â†’ present = 2
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea.value).toContain('TOTAL STRENGTH : 3')
      expect(textarea.value).toContain('PRESENT        : 2')
      expect(textarea.value).toContain('ABSENT         : 1')
    })
  })

  it('includes CDO duty in generated report', async () => {
    await renderParadeStateOnFixtureDate()

    await userEvent.click(screen.getByRole('button', { name: 'Generate Parade State' }))

    await waitFor(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea.value).toContain('CDO: TEST_SOLDIER_TWO')
    })
  })
})
