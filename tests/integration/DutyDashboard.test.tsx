import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DutyDashboard from '@/components/DutyDashboard'
import { supabase } from '@/lib/supabase'
import { truncateTestDb, seedTestDb } from '../fixtures/db'
import { FIXTURE_WEIGHT_OVERRIDES } from '../fixtures/config'

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
  await supabase.from('Test_Configuration').delete().like('parade_type', 'weight_%')
  await supabase.auth.signOut()
})

async function loaded() {
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
}

function pointsFor(name: string) {
  const row = screen.getByText(name).closest('tr')!
  return row.querySelectorAll('td')[3].textContent
}

describe('DutyDashboard', () => {
  it('leaderboard reflects seeded duty points and excludes soldiers ineligible for every duty', async () => {
    render(<DutyDashboard company="test" label="Test" embedded />)
    await loaded()

    expect(pointsFor('LEE JUN WEI')).toBe('1')   // CDO duty
    expect(pointsFor('WONG KAH MENG')).toBe('1') // CDS duty
    expect(pointsFor('YEO JIA HENG')).toBe('1')  // COS duty
    expect(pointsFor('HO KAI XIANG')).toBe('1')  // PDS1 duty
    // ONG JUN SHENG (REC) is ineligible for every duty type — excluded entirely
    expect(screen.queryByText('ONG JUN SHENG')).not.toBeInTheDocument()
  })

  it('filter pill narrows the leaderboard to soldiers eligible for that duty type', async () => {
    render(<DutyDashboard company="test" label="Test" embedded />)
    await loaded()

    await userEvent.click(screen.getByRole('button', { name: 'CDO' }))

    expect(screen.getByText('LEE JUN WEI')).toBeInTheDocument()   // LTA — CDO-eligible
    // WONG KAH MENG (1SG) is not CDO-eligible (Officers only)
    expect(screen.queryByText('WONG KAH MENG')).not.toBeInTheDocument()
  })

  it('saving a duty weight persists and is reflected in recomputed points', async () => {
    render(<DutyDashboard company="test" label="Test" embedded />)
    await loaded()

    await userEvent.click(screen.getByTitle('Edit Duty Weights'))
    const panel = screen.getByText('Points awarded per duty type.').closest('div')!
    const cdoInput = within(panel).getByText('CDO').nextElementSibling as HTMLInputElement
    await userEvent.clear(cdoInput)
    await userEvent.type(cdoInput, '3')
    await userEvent.click(screen.getByRole('button', { name: 'Save Weights' }))

    await waitFor(() => expect(pointsFor('LEE JUN WEI')).toBe('3'))

    const { data } = await supabase.from('Test_Configuration').select('*').eq('parade_type', 'weight_CDO')
    expect(data![0].time).toBe('3')
  })
})
