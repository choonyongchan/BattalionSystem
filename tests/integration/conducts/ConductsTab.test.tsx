import { renderWithQuery } from '@/tests/fixtures/render'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConductsTab from '@/frontend/components/conducts/ConductsTab'
import { supabase } from '@/backend/data/client'
import { todaySGDate } from '@/shared/dates'
import { truncateTestDb, seedTestDb } from '@/tests/fixtures/db'

const today = todaySGDate()

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_SUPABASE_EMAIL!,
    password: process.env.TEST_SUPABASE_PASSWORD!,
  })
  if (error) throw new Error(`Test setup sign-in failed: ${error.message}`)

  await truncateTestDb()
  await seedTestDb()

  // Fixture exceptions are dated in the past — add two running today, linked by soldier_id
  const { data: roll } = await supabase.from('Test_NominalRoll').select('id, name').in('name', ['TAN RONG XIAN', 'GOH RONG HAO'])
  const idOf = (name: string) => roll!.find((r) => r.name === name)!.id
  const { error: exErr } = await supabase.from('Test_Exceptions').insert([
    { name: 'TAN RONG XIAN', soldier_id: idOf('TAN RONG XIAN'), scope: 'Att C', type: 'MC', reason: 'CONDUCT TEST MC', start: today, end: today, counts_as_absence: true },
    { name: 'GOH RONG HAO', soldier_id: idOf('GOH RONG HAO'), scope: 'Status', type: 'LD', reason: 'CONDUCT TEST LD', start: today, end: today, counts_as_absence: false },
  ])
  if (exErr) throw new Error(exErr.message)
  const { error: cErr } = await supabase.from('Test_Conducts').insert({ name: 'IPPT TEST', date: today })
  if (cErr) throw new Error(cErr.message)
}, 30000)

afterAll(async () => {
  await supabase.auth.signOut()
})

describe('ConductsTab', () => {
  it('puts the MC not in camp and the LD in fall out, which ✓ Participate settles', async () => {
    renderWithQuery(<ConductsTab company="test" companyLabel="Test" />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'IPPT TEST' })).toBeInTheDocument(), { timeout: 10000 })

    const away = screen.getByText(/^Not in camp –/).closest('section')!
    expect(within(away).getByText(/TAN RONG XIAN/)).toBeInTheDocument()
    expect(within(away).getByText('CONDUCT TEST MC')).toBeInTheDocument()

    const outSection = screen.getByText(/^Fall out –/).closest('section')!
    expect(within(outSection).getByText(/GOH RONG HAO/)).toBeInTheDocument()
    await userEvent.click(within(outSection).getByRole('button', { name: '✓ Participate' }))

    await waitFor(() => expect(within(screen.getByText(/^Fall out –/).closest('section')!).queryByText(/GOH RONG HAO/)).not.toBeInTheDocument(), { timeout: 10000 })
    const taking = screen.getByText(/^Taking part –/).closest('section')!
    expect(within(taking).getByText('CONDUCT TEST LD · confirmed can')).toBeInTheDocument()

    const { data } = await supabase.from('Test_ConductDecisions').select('participating')
    expect(data).toEqual([{ participating: true }])

    expect(screen.getByText(/TEST COY CONDUCT STATE/)).toBeInTheDocument()
    // Not in camp is left out of the message
    expect(screen.queryByText(/TAN RONG XIAN — CONDUCT TEST MC/)).not.toBeInTheDocument()
    // Troopers only: commanders are not listed anywhere
    expect(screen.queryByText(/CHONG KAH WAI/)).not.toBeInTheDocument()
  })
})
