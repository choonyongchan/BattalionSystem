import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RsiTab from '@/components/rsi/RsiTab'
import { supabase } from '@/lib/supabase'
import { todaySGDate } from '@/lib/utils'
import { truncateTestDb, seedTestDb } from '../../fixtures/db'

const today = todaySGDate()

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

describe('RsiTab', () => {
  it('keys a report sick as a URTI exception and prints it under URTI', async () => {
    render(<QueryClientProvider client={new QueryClient()}><RsiTab company="test" /></QueryClientProvider>)
    await waitFor(() => expect(screen.getByPlaceholderText('Search soldier...')).toBeInTheDocument(), { timeout: 10000 })

    await userEvent.type(screen.getByPlaceholderText('Search soldier...'), 'CHONG KAH WAI')
    await userEvent.click(await screen.findByText('CHONG KAH WAI'))
    await userEvent.type(screen.getByPlaceholderText(/^Reason/), 'Flu and phlegm')
    expect(screen.getByRole('checkbox', { name: 'URTI' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Add report sick' }))

    await waitFor(() => expect(screen.getByText(/REASON: Flu and phlegm/)).toBeInTheDocument(), { timeout: 10000 })
    expect(screen.getByText(/REASON: Flu and phlegm/).textContent).toMatch(/\nURTI\nS\/N: 01\nR\/N: .*CHONG KAH WAI\nREASON: Flu and phlegm\n\nNON-URTI\nNIL$/)

    const { data } = await supabase.from('Test_Exceptions').select('scope, type, reason, start, end, soldier_id').eq('reason', 'Flu and phlegm')
    expect(data).toEqual([expect.objectContaining({ scope: 'Report Sick', type: 'URTI', start: today, end: today })])
    expect(data![0].soldier_id).not.toBeNull()
  })
})
