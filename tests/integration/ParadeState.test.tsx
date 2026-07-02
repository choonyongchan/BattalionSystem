import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
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

// Navigate to the Duties tab (which has the date picker) and change the date.
// Returns to caller on the Duties tab.
async function setParadeDate(date: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Duties' }))
  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
  fireEvent.change(dateInput, { target: { value: date } })
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
}

// Render ParadeState and land on the Duties tab with FIXTURE_DATE selected.
async function renderOnFixtureDate() {
  render(<ParadeState company="test" companyLabel="Test" />)
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
  await setParadeDate(FIXTURE_DATE)
}

describe('ParadeState', () => {
  // ── Exceptions tab ───────────────────────────────────────────────────────────

  it('shows fixture exceptions in the Exceptions tab', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))

    await waitFor(() => {
      expect(screen.getByText('TAN WEI LIANG')).toBeInTheDocument()
      expect(screen.getByText('Off/Leave')).toBeInTheDocument()
    })
  })

  it('filters exceptions by soldier name using the search bar', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))

    const searchInput = await screen.findByPlaceholderText('Search by name, scope, reason...')
    await userEvent.type(searchInput, 'TAN WEI')

    await waitFor(() => {
      expect(screen.getByText('TAN WEI LIANG')).toBeInTheDocument()
    })
  })

  // ── Duties tab ────────────────────────────────────────────────────────────────

  it('shows fixture duty in the Duties tab', async () => {
    await renderOnFixtureDate()
    // Already on Duties tab after renderOnFixtureDate
    // Duty name is rendered with rank prefix via displayName: "LTA LEE JUN WEI"

    await waitFor(() => {
      expect(screen.getByText('CDO')).toBeInTheDocument()
      expect(screen.getByText(/LEE JUN WEI/)).toBeInTheDocument()
    }, { timeout: 10000 })
  })

  // ── Report generation — strength counts ──────────────────────────────────────

  it('generates report with correct strength: 13 total, 9 present, 4 absent', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'First Parade' }))

    await waitFor(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea.value).toContain('TOTAL STRENGTH : 13')
      expect(textarea.value).toContain('PRESENT        : 9')
      expect(textarea.value).toContain('ABSENT         : 4')
    }, { timeout: 5000 })
  })

  it('Status exception (counts_as_absence=false) does not reduce present count', async () => {
    // GOH RONG HAO has Status, counts_as_absence: false — still 9 present, 4 absent
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'First Parade' }))

    await waitFor(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea.value).toContain('PRESENT        : 9')
      expect(textarea.value).toContain('ABSENT         : 4')
    }, { timeout: 5000 })

    // GOH RONG HAO should still appear in exceptions list
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))
    await waitFor(() => {
      expect(screen.getByText('GOH RONG HAO')).toBeInTheDocument()
    })
  })

  it('includes CDO duty assignment in generated report', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'First Parade' }))

    await waitFor(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea.value).toContain('CDO: LTA LEE JUN WEI')
    }, { timeout: 5000 })
  })

  // ── Exception CRUD workflow ───────────────────────────────────────────────────

  it('adds an exception for a soldier and present count decreases by 1', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))

    // Open the add-exception form
    await userEvent.click(screen.getByRole('button', { name: '+ Exception' }))

    // Select soldier via SearchDropdown: type → click suggestion
    const soldierInput = screen.getByPlaceholderText('Search soldier...')
    await userEvent.type(soldierInput, 'CHEN')
    const suggestion = await screen.findByText('CHEN MING ZHI', {}, { timeout: 5000 })
    await userEvent.click(suggestion)

    // Fill reason (scope defaults to Off/Leave)
    const reasonInput = screen.getByPlaceholderText('e.g. Annual Leave, Off')
    await userEvent.type(reasonInput, 'Annual Leave')

    // Submit
    await userEvent.click(screen.getByRole('button', { name: 'Add Exception' }))

    // CHEN MING ZHI should now appear in exceptions list
    await waitFor(() => {
      expect(screen.getByText('CHEN MING ZHI')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Generate report — present drops from 9 to 8
    await userEvent.click(screen.getByRole('button', { name: 'First Parade' }))
    await waitFor(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea.value).toContain('PRESENT        : 8')
      expect(textarea.value).toContain('ABSENT         : 5')
    }, { timeout: 5000 })
  })

  it('edits an existing exception successfully (regression: "time" column must exist on _Exceptions)', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))

    const row = (await screen.findByText('TAN WEI LIANG')).closest('tr')!
    await userEvent.click(within(row).getByTitle('Edit'))

    const reasonInput = screen.getByDisplayValue('Annual Leave')
    await userEvent.clear(reasonInput)
    await userEvent.type(reasonInput, 'Medical Leave')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Medical Leave')).toBeInTheDocument()
    }, { timeout: 10000 })
  })

  it('MA add form shows red-border validation on Medical Center instead of a silently-disabled button', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))
    await userEvent.click(screen.getByRole('button', { name: '+ Exception' }))

    const soldierInput = screen.getByPlaceholderText('Search soldier...')
    await userEvent.type(soldierInput, 'HO KAI')
    await userEvent.click(await screen.findByText('HO KAI XIANG', {}, { timeout: 5000 }))

    await userEvent.click(screen.getByRole('button', { name: 'MA' }))
    await userEvent.type(screen.getByPlaceholderText('e.g. Skin Appt, IMH Appt'), 'Follow up')
    // Add form's date defaults to today (not FIXTURE_DATE) — set it explicitly so the
    // new exception is active on the date this test is viewing.
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: FIXTURE_DATE } })

    // Submit with Medical Center left blank
    await userEvent.click(screen.getByRole('button', { name: 'Add Exception' }))

    const medCenterInput = screen.getByPlaceholderText('e.g. CGH, NUH, Raffles')
    await waitFor(() => expect(medCenterInput.className).toContain('border-red-500'))
    expect(screen.queryByText('HO KAI XIANG')).not.toBeInTheDocument()

    // Fill it in and resubmit — should now succeed
    await userEvent.type(medCenterInput, 'CGH')
    await userEvent.click(screen.getByRole('button', { name: 'Add Exception' }))

    await waitFor(() => {
      expect(screen.getByText('HO KAI XIANG')).toBeInTheDocument()
    }, { timeout: 10000 })
  })

  it('date change updates the parade report absent count correctly', async () => {
    // ponytail: 30s — renderOnFixtureDate + setParadeDate both hit real Supabase
    // On 2026-01-17 with date-filtered mode ("Show all" toggles to date-filtered):
    // Only CHONG KAH WAI (ends 17th) counts as absence; CHEN MING ZHI (Jun 26) expired
    await renderOnFixtureDate()

    // Toggle to date-filtered mode (the Exceptions tab has "Show all" button)
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }))

    // Change date to 2026-01-17 (setParadeDate navigates to Duties tab internally)
    await setParadeDate('2026-01-17')
    await userEvent.click(screen.getByRole('button', { name: 'First Parade' }))
    await waitFor(() => {
      const ta = document.querySelector('textarea') as HTMLTextAreaElement
      expect(ta.value).toContain('ABSENT         : 1')
      expect(ta.value).toContain('PRESENT        : 12')
    }, { timeout: 10000 })
  }, 30000)
})
