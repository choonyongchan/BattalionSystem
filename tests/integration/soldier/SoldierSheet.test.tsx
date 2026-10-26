import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NominalRoll from '@/frontend/components/nominal-roll/NominalRoll'
import { supabase } from '@/backend/data/client'
import { truncateTestDb, seedTestDb } from '@/tests/fixtures/db'

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

function renderRoll() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><NominalRoll company="test" /></QueryClientProvider>)
}

async function openSheet(name: string) {
  renderRoll()
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
  await userEvent.click(screen.getByRole('button', { name }))
  return screen.getByRole('dialog')
}

describe('SoldierSheet', () => {
  it('lists the soldier\'s active exception when opened from the roll', async () => {
    // Fixture: CHONG KAH WAI has an Att C "Fever" 13–17 Jan 2026 (past relative to today)
    const sheet = await openSheet('GOH RONG HAO')
    expect(within(sheet).getByText(/PTE GOH RONG HAO/)).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('radio', { name: /History/ }))
    expect(within(sheet).getByText('Excuse RMJ')).toBeInTheDocument()
  })

  it('adds an MC linked by soldier_id with its type, then revokes it', async () => {
    const sheet = await openSheet('LEE JUN WEI')
    await userEvent.click(within(sheet).getByRole('button', { name: '+ Add exception' }))
    await userEvent.type(within(sheet).getByPlaceholderText(/Reason/), 'SHEET TEST FEVER')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(within(screen.getByRole('dialog')).getByText('SHEET TEST FEVER')).toBeInTheDocument(), { timeout: 10000 })

    const { data: soldier } = await supabase.from('NominalRoll').select('id').eq('company', 'test').eq('name', 'LEE JUN WEI').single()
    const { data: rows } = await supabase.from('Exceptions').select('*').eq('company', 'test').eq('reason', 'SHEET TEST FEVER')
    expect(rows).toHaveLength(1)
    expect(rows![0]).toMatchObject({ soldier_id: soldier!.id, scope: 'Att C', type: 'MC', revoked_at: null })

    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revoke' }))
    await waitFor(async () => {
      const { data } = await supabase.from('Exceptions').select('revoked_at').eq('company', 'test').eq('reason', 'SHEET TEST FEVER').single()
      expect(data!.revoked_at).not.toBeNull()
    }, { timeout: 10000 })

    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('radio', { name: /History/ }))
    // The DB write lands before the sheet's reload does — wait for the UI to catch up
    expect(await within(dialog).findByText('Revoked', {}, { timeout: 10000 })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Restore' })).toBeInTheDocument()
  })

  it('renaming a soldier on the roll keeps his exceptions attached', async () => {
    renderRoll()
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
    const row = screen.getByRole('button', { name: 'GOH RONG HAO' }).closest('tr')!
    await userEvent.click(within(row).getByTitle('Edit'))
    const nameInput = within(row).getByDisplayValue('GOH RONG HAO')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'GOH RONG HAO RENAMED{Enter}')

    await waitFor(() => expect(screen.getByRole('button', { name: 'GOH RONG HAO RENAMED' })).toBeInTheDocument(), { timeout: 10000 })
    const { data } = await supabase.from('Exceptions').select('name').eq('company', 'test').eq('reason', 'Excuse RMJ')
    expect(data!.map((r) => r.name)).toEqual(['GOH RONG HAO RENAMED'])
  })
})
