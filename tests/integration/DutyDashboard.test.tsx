import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DutyDashboard from '@/components/DutyDashboard'
import { supabase } from '@/lib/supabase'
import { truncateTestDb, seedTestDb } from '../fixtures/db'
import { DEFAULT_SETTINGS } from '@/lib/settings'

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
  await supabase.from('Test_Settings').update(DEFAULT_SETTINGS).eq('id', 1)
  await supabase.auth.signOut()
})

function renderDashboard() {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <DutyDashboard company="test" label="Test" embedded />
    </QueryClientProvider>,
  )
}

async function loaded() {
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
}

function pointsFor(name: string) {
  const row = screen.getByText(name).closest('tr')!
  return row.querySelectorAll('td')[3].textContent
}

describe('DutyDashboard', () => {
  it('leaderboard reflects seeded duty points and excludes soldiers ineligible for every duty', async () => {
    renderDashboard()
    await loaded()

    expect(pointsFor('LEE JUN WEI')).toBe('1')   // CDO duty
    expect(pointsFor('WONG KAH MENG')).toBe('1') // CDS duty
    expect(pointsFor('YEO JIA HENG')).toBe('1')  // COS duty
    expect(pointsFor('HO KAI XIANG')).toBe('1')  // PDS1 duty
    // ONG JUN SHENG (REC) is ineligible for every duty type — excluded entirely
    expect(screen.queryByText('ONG JUN SHENG')).not.toBeInTheDocument()
  })

  it('filter pill narrows the leaderboard to soldiers eligible for that duty type', async () => {
    renderDashboard()
    await loaded()

    await userEvent.click(screen.getByRole('button', { name: 'CDO' }))

    expect(screen.getByText('LEE JUN WEI')).toBeInTheDocument()   // LTA — CDO-eligible
    // WONG KAH MENG (1SG) is not CDO-eligible (Officers only)
    expect(screen.queryByText('WONG KAH MENG')).not.toBeInTheDocument()
  })

  it('a custom duty_base_weights value from Settings is reflected in the leaderboard', async () => {
    await supabase.from('Test_Settings').update({
      duty_base_weights: { ...DEFAULT_SETTINGS.duty_base_weights, CDO: 3 },
    }).eq('id', 1)

    renderDashboard()
    await loaded()

    await waitFor(() => expect(pointsFor('LEE JUN WEI')).toBe('3'))

    await supabase.from('Test_Settings').update(DEFAULT_SETTINGS).eq('id', 1)
  })
})
