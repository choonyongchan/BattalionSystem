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

  // One conduct, with TAN seeded out of camp as creating it from the Overview would
  const { data: roll } = await supabase.from('NominalRoll').select('id, name').eq('company', 'test').in('name', ['TAN RONG XIAN', 'GOH RONG HAO'])
  const idOf = (name: string) => roll!.find((r) => r.name === name)!.id
  const { data: conduct, error: cErr } = await supabase.from('Conducts').insert({ company: 'test', name: 'IPPT TEST', date: today }).select('id').single()
  if (cErr) throw new Error(cErr.message)
  const { error: dErr } = await supabase.from('ConductDecisions').insert({
    company: 'test', conduct_id: conduct!.id, soldier_id: idOf('TAN RONG XIAN'), participating: false, reason: 'MC', group_kind: 'out-of-camp',
  })
  if (dErr) throw new Error(dErr.message)
}, 30000)

afterAll(async () => {
  await supabase.auth.signOut()
})

describe('ConductsTab', () => {
  it('seeded out of camp, the rest participate; fall out with a reason, then call back in', async () => {
    renderWithQuery(<ConductsTab company="test" companyLabel="Test" />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'IPPT TEST' })).toBeInTheDocument(), { timeout: 10000 })
    const section = (re: RegExp) => within(screen.getByText(re).closest('section')!)

    expect(section(/^Out of camp –/).getByText(/TAN RONG XIAN/)).toBeInTheDocument()
    expect(section(/^Fall out –/).queryByText(/GOH RONG HAO/)).not.toBeInTheDocument()
    const goh = within(section(/^Participating –/).getByText(/GOH RONG HAO/).closest('li')!)

    await userEvent.click(goh.getByRole('button', { name: 'Fall out…' }))
    await userEvent.type(goh.getByLabelText('Fall-out reason'), 'Duty')
    await userEvent.click(goh.getByRole('button', { name: 'Fall out' }))
    await waitFor(() => expect(section(/^Fall out –/).getByText('Duty')).toBeInTheDocument(), { timeout: 10000 })
    expect(screen.getByText(/TEST COY CONDUCT STATE/)).toBeInTheDocument()
    expect(screen.getByText(/GOH RONG HAO — DUTY/)).toBeInTheDocument()

    await userEvent.click(section(/^Fall out –/).getByRole('button', { name: '✓ Participate' }))
    await waitFor(() => expect(section(/^Fall out –/).queryByText(/GOH RONG HAO/)).not.toBeInTheDocument(), { timeout: 10000 })

    // Out of camp is left out of the message; troopers only
    expect(screen.queryByText(/TAN RONG XIAN — MC/)).not.toBeInTheDocument()
    expect(screen.queryByText(/CHONG KAH WAI/)).not.toBeInTheDocument()
  })
})
