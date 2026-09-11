import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OffLeaveTracking from '@/components/off-leave/OffLeaveTracking'
import { supabase } from '@/lib/supabase'
import { truncateTestDb, seedTestDb } from '../../fixtures/db'

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

async function renderLoaded() {
  render(<OffLeaveTracking company="test" />)
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
}

// The name may also be in the table, so click the match inside the dropdown list
async function pickSoldier(query: string, name: string) {
  await userEvent.type(screen.getByPlaceholderText('Search soldier...'), query)
  const option = await waitFor(() => {
    const el = screen.getAllByText(name).find((e) => e.closest('li'))
    if (!el) throw new Error(`No dropdown option for ${name}`)
    return el
  }, { timeout: 5000 })
  await userEvent.click(option)
}

const rowOf = (name: string) => screen.getByText(name).closest('tr')!

async function fetchRecord(name: string) {
  const { data } = await supabase.from('Test_OffLeave').select('*').eq('name', name)
  return data
}

describe('OffLeaveTracking', () => {
  it('lists fixture records sorted by rank, senior first', async () => {
    await renderLoaded()

    const names = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[1].textContent)
    expect(names).toEqual(['TAN WEI LIANG', 'NG BOON SENG', 'GOH RONG HAO'])
    expect(within(rowOf('NG BOON SENG')).getByText('1.5')).toBeInTheDocument()
  })

  it('filters the list by search', async () => {
    await renderLoaded()

    await userEvent.type(screen.getByPlaceholderText('Search by rank, name, 4D...'), '3SG')

    expect(screen.getByText('NG BOON SENG')).toBeInTheDocument()
    expect(screen.queryByText('TAN WEI LIANG')).not.toBeInTheDocument()
    expect(screen.queryByText('GOH RONG HAO')).not.toBeInTheDocument()
  })

  it('adds to an existing Off balance', async () => {
    await renderLoaded()

    await userEvent.click(screen.getByRole('button', { name: '+ Off/Leave' }))
    await pickSoldier('NG BOON', 'NG BOON SENG')
    await userEvent.type(screen.getByPlaceholderText('e.g. 1 or 0.5'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Add Off/Leave' }))

    await waitFor(() => {
      expect(within(rowOf('NG BOON SENG')).getByText('2.5')).toBeInTheDocument()
    }, { timeout: 10000 })

    const data = await fetchRecord('NG BOON SENG')
    expect(data).toHaveLength(1)
    expect(data![0]).toMatchObject({ off: 2.5, leave: 0 })
  })

  it('creates a Leave record for a soldier without one', async () => {
    await renderLoaded()

    await userEvent.click(screen.getByRole('button', { name: '+ Off/Leave' }))
    await pickSoldier('LIM ZHEN', 'LIM ZHEN HAO')
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }))
    await userEvent.type(screen.getByPlaceholderText('e.g. 1 or 0.5'), '0.5')
    await userEvent.click(screen.getByRole('button', { name: 'Add Off/Leave' }))

    await waitFor(() => {
      expect(within(rowOf('LIM ZHEN HAO')).getByText('0.5')).toBeInTheDocument()
    }, { timeout: 10000 })

    const data = await fetchRecord('LIM ZHEN HAO')
    expect(data).toHaveLength(1)
    expect(data![0]).toMatchObject({ off: 0, leave: 0.5 })
  })

  it('edits a balance inline', async () => {
    await renderLoaded()

    await userEvent.click(within(rowOf('TAN WEI LIANG')).getByTitle('Edit'))
    const leaveInput = screen.getByLabelText('Leave')
    await userEvent.clear(leaveInput)
    await userEvent.type(leaveInput, '3')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(within(rowOf('TAN WEI LIANG')).getByText('3')).toBeInTheDocument()
    }, { timeout: 10000 })

    const data = await fetchRecord('TAN WEI LIANG')
    expect(data![0]).toMatchObject({ off: 2, leave: 3 })
  })

  it('deletes a record from the list and DB', async () => {
    await renderLoaded()

    await userEvent.click(within(rowOf('GOH RONG HAO')).getByTitle('Remove'))
    await userEvent.click(await screen.findByTitle('Confirm delete', {}, { timeout: 3000 }))

    await waitFor(() => {
      expect(screen.queryByText('GOH RONG HAO')).not.toBeInTheDocument()
    }, { timeout: 10000 })

    expect(await fetchRecord('GOH RONG HAO')).toHaveLength(0)
  })
})
