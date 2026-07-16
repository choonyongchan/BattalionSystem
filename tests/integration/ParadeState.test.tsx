import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

function renderParadeState() {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <ParadeState company="test" companyLabel="Test" />
    </QueryClientProvider>,
  )
}

// Render ParadeState and land on the Duties tab with FIXTURE_DATE selected.
async function renderOnFixtureDate() {
  renderParadeState()
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
  await setParadeDate(FIXTURE_DATE)
}

describe('ParadeState', () => {
  // ── Exceptions tab ───────────────────────────────────────────────────────────

  it('shows fixture exceptions in the Exceptions tab', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))

    await waitFor(() => {
      // Name cell renders "RANK NAME" combined (e.g. "CPT TAN WEI LIANG")
      expect(screen.getByText(/TAN WEI LIANG/)).toBeInTheDocument()
      expect(screen.getByText('Off/Leave')).toBeInTheDocument()
    })
  })

  it('filters exceptions by soldier name using the search bar', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))

    const searchInput = await screen.findByPlaceholderText('Search by name, scope, reason, 4D...')
    await userEvent.type(searchInput, 'TAN WEI')

    await waitFor(() => {
      expect(screen.getByText(/TAN WEI LIANG/)).toBeInTheDocument()
    })
  })

  // ── Duties tab ────────────────────────────────────────────────────────────────

  it('shows fixture duty in the Duties tab', async () => {
    await renderOnFixtureDate()
    // Already on Duties tab after renderOnFixtureDate
    // Duty name is rendered with rank prefix via displayName: "LTA LEE JUN WEI"
    // Note: "CDO" and the assignee's name also appear in the week-overview grid
    // above the table, so multiple matches are expected here.

    await waitFor(() => {
      expect(screen.getAllByText('CDO').length).toBeGreaterThan(0)
      expect(screen.getAllByText(/LEE JUN WEI/).length).toBeGreaterThan(0)
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

    // GOH RONG HAO should still appear in exceptions list (report textarea also contains this text)
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))
    await waitFor(() => {
      expect(screen.getByRole('cell', { name: /GOH RONG HAO/ })).toBeInTheDocument()
    })
  })

  // ── Absent? checkbox ──────────────────────────────────────────────────────────

  it('Absent? checkbox defaults per scope in the add-exception form', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))
    await userEvent.click(screen.getByRole('button', { name: '+ Exception' }))

    const checkbox = screen.getByRole('checkbox', { name: 'Absent?' }) as HTMLInputElement
    expect(checkbox.checked).toBe(true) // scope defaults to Off/Leave

    await userEvent.click(screen.getByRole('button', { name: 'Status' }))
    expect(checkbox.checked).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'MA' }))
    expect(checkbox.checked).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Others' }))
    expect(checkbox.checked).toBe(false)
  })

  it('manually toggling Absent? is preserved across scope changes', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))
    await userEvent.click(screen.getByRole('button', { name: '+ Exception' }))

    const checkbox = screen.getByRole('checkbox', { name: 'Absent?' }) as HTMLInputElement
    expect(checkbox.checked).toBe(true) // Off/Leave default

    await userEvent.click(checkbox) // manually uncheck
    expect(checkbox.checked).toBe(false)

    // Att C would normally default to true — manual toggle should stick
    await userEvent.click(screen.getByRole('button', { name: 'Att C' }))
    expect(checkbox.checked).toBe(false)
  })

  it('the checkbox in a read-only exception row is disabled', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))

    const row = (await screen.findByText(/TAN WEI LIANG/)).closest('tr')!
    const checkbox = within(row).getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    expect(checkbox).toBeDisabled()
  })

  it('adding an exception with Absent? unchecked does not reduce present count', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))
    await userEvent.click(screen.getByRole('button', { name: '+ Exception' }))

    const soldierInput = screen.getByPlaceholderText('Search soldier...')
    await userEvent.type(soldierInput, 'NG BOON')
    await userEvent.click(await screen.findByText('NG BOON SENG', {}, { timeout: 5000 }))

    // Off/Leave defaults Absent? to checked — uncheck it
    await userEvent.click(screen.getByRole('checkbox', { name: 'Absent?' }))
    await userEvent.type(screen.getByPlaceholderText('e.g. Annual Leave, Off'), 'Off')
    // Add form's date fields default to today (not FIXTURE_DATE) — set them explicitly so the
    // new exception is active on the date this test is viewing.
    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: FIXTURE_DATE } })
    fireEvent.change(dateInputs[1], { target: { value: FIXTURE_DATE } })
    await userEvent.click(screen.getByRole('button', { name: 'Add Exception' }))

    await waitFor(() => {
      expect(screen.getByText(/NG BOON SENG/)).toBeInTheDocument()
    }, { timeout: 10000 })

    await userEvent.click(screen.getByRole('button', { name: 'First Parade' }))
    await waitFor(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement
      expect(textarea.value).toContain('PRESENT        : 9')
      expect(textarea.value).toContain('ABSENT         : 4')
    }, { timeout: 5000 })
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
      expect(screen.getByText(/CHEN MING ZHI/)).toBeInTheDocument()
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

    const row = (await screen.findByText(/TAN WEI LIANG/)).closest('tr')!
    await userEvent.click(within(row).getByTitle('Edit'))

    const reasonInput = screen.getByDisplayValue('Annual Leave')
    await userEvent.clear(reasonInput)
    await userEvent.type(reasonInput, 'Medical Leave')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Medical Leave')).toBeInTheDocument()
    }, { timeout: 10000 })
  })

  it('Add Exception button stays disabled until a soldier is picked, then MA can be saved with Medical Center/Reason/Date left blank', async () => {
    await renderOnFixtureDate()
    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))
    await userEvent.click(screen.getByRole('button', { name: '+ Exception' }))

    const addButton = screen.getByRole('button', { name: 'Add Exception' })
    expect(addButton).toBeDisabled()

    const soldierInput = screen.getByPlaceholderText('Search soldier...')
    await userEvent.type(soldierInput, 'HO KAI')
    await userEvent.click(await screen.findByText('HO KAI XIANG', {}, { timeout: 5000 }))

    await userEvent.click(screen.getByRole('button', { name: 'MA' }))

    // Soldier + Scope are the only compulsory fields — Medical Center, Reason,
    // and Date are all left blank here.
    await waitFor(() => expect(addButton).not.toBeDisabled())
    await userEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText(/HO KAI XIANG/)).toBeInTheDocument()
    }, { timeout: 10000 })
  })

  it('date change updates the parade report absent count correctly', async () => {
    // ponytail: 30s — renderOnFixtureDate + setParadeDate both hit real Supabase
    // On 2026-01-17: only CHONG KAH WAI (ends 17th) counts as absence;
    // CHEN MING ZHI (Jun 26) expired
    await renderOnFixtureDate()

    await userEvent.click(screen.getByRole('button', { name: 'Exceptions' }))

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
