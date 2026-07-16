import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NominalRoll from '@/components/nominal-roll/NominalRoll'
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

describe('NominalRoll', () => {
  it('renders fixture soldiers after load', async () => {
    render(<NominalRoll company="test" />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    }, { timeout: 10000 })

    expect(screen.getByText('TAN WEI LIANG')).toBeInTheDocument()
    expect(screen.getByText('LEE JUN WEI')).toBeInTheDocument()
    expect(screen.getByText('CHEN MING ZHI')).toBeInTheDocument()
  })

  it('adds a new soldier using default PTE rank and shows them in the list', async () => {
    render(<NominalRoll company="test" />)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })

    await userEvent.click(screen.getByRole('button', { name: '+ Add' }))

    // Leave rank at its default (form initialises to 'PTE')
    await userEvent.type(screen.getByPlaceholderText('TAN AH KOW'), 'NEW_RECRUIT_TEST')
    await userEvent.selectOptions(screen.getByRole('combobox'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Add Soldier' }))

    await waitFor(() => {
      expect(screen.getByText('NEW_RECRUIT_TEST')).toBeInTheDocument()
    }, { timeout: 10000 })

    const { data } = await supabase
      .from('Test_NominalRoll')
      .select('*')
      .eq('name', 'NEW_RECRUIT_TEST')
    expect(data).toHaveLength(1)
    expect(data![0].rank).toBe('PTE')
  })

  it('deletes a soldier and removes them from list and DB', async () => {
    render(<NominalRoll company="test" />)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })

    // Delete ONG JUN SHENG (REC in Pl 4 â€” the only REC in the fixture)
    // Delete requires 2 clicks: Remove â†’ Confirm delete
    const row = screen.getByText('ONG JUN SHENG').closest('tr')!
    await userEvent.click(row.querySelector('button[title="Remove"]') as HTMLElement)
    // After first click, the row enters confirming state; click the "Yes" (Confirm delete) button
    const confirmBtn = await screen.findByTitle('Confirm delete', {}, { timeout: 3000 })
    await userEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.queryByText('ONG JUN SHENG')).not.toBeInTheDocument()
    }, { timeout: 10000 })

    const { data } = await supabase
      .from('Test_NominalRoll')
      .select('*')
      .eq('name', 'ONG JUN SHENG')
    expect(data).toHaveLength(0)
  })
})
