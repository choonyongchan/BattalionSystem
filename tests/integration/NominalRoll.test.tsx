import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NominalRoll from '@/components/NominalRoll'
import { getSupabaseClient } from '@/lib/supabase'
import { truncateTestDb, seedTestDb } from '../fixtures/db'

beforeAll(async () => {
  // Sign in via the same singleton client the component will use
  const supabase = getSupabaseClient('stallion')
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_SUPABASE_EMAIL!,
    password: process.env.TEST_SUPABASE_PASSWORD!,
  })
  if (error) throw new Error(`Test setup sign-in failed: ${error.message}`)

  await truncateTestDb()
  await seedTestDb()
}, 30000)

afterAll(async () => {
  await getSupabaseClient('stallion').auth.signOut()
})

describe('NominalRoll', () => {
  it('renders fixture soldiers after load', async () => {
    render(<NominalRoll company="stallion" />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    }, { timeout: 10000 })

    expect(screen.getByText('TEST_SOLDIER_ONE')).toBeInTheDocument()
    expect(screen.getByText('TEST_SOLDIER_TWO')).toBeInTheDocument()
    expect(screen.getByText('TEST_OFFICER_ONE')).toBeInTheDocument()
  })

  it('adds a new soldier and shows them in the list', async () => {
    render(<NominalRoll company="stallion" />)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })

    // Open the add form
    await userEvent.click(screen.getByRole('button', { name: '+ Add' }))

    // Fill in rank (type into the RankSearch input)
    const rankInput = screen.getByPlaceholderText('e.g. CPL, 3SG, LTA')
    await userEvent.clear(rankInput)
    await userEvent.type(rankInput, 'SGT')

    // Fill in name
    await userEvent.type(screen.getByPlaceholderText('TAN AH KOW'), 'TEST_NEW_SOLDIER')

    // Select platoon
    await userEvent.selectOptions(screen.getByRole('combobox'), '3')

    // Submit
    await userEvent.click(screen.getByRole('button', { name: 'Add Soldier' }))

    await waitFor(() => {
      expect(screen.getByText('TEST_NEW_SOLDIER')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Verify it's in the DB
    const { data } = await getSupabaseClient('stallion')
      .from('NominalRoll')
      .select('*')
      .eq('name', 'TEST_NEW_SOLDIER')
    expect(data).toHaveLength(1)
  })

  it('deletes a soldier and removes them from list and DB', async () => {
    render(<NominalRoll company="stallion" />)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })

    // Find the delete button for TEST_SOLDIER_TWO
    const row = screen.getByText('TEST_SOLDIER_TWO').closest('tr')!
    const deleteBtn = row.querySelector('button[title="Remove"]')!
    await userEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.queryByText('TEST_SOLDIER_TWO')).not.toBeInTheDocument()
    }, { timeout: 10000 })

    // Verify removed from DB
    const { data } = await getSupabaseClient('stallion')
      .from('NominalRoll')
      .select('*')
      .eq('name', 'TEST_SOLDIER_TWO')
    expect(data).toHaveLength(0)
  })
})
