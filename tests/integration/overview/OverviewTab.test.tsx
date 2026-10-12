import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OverviewTab from '@/frontend/components/overview/OverviewTab'
import { SoldierRepository } from '@/backend/data/repositories/SoldierRepository'
import { supabase } from '@/backend/data/client'
import { resetTestDb } from '@/tests/fixtures/db'
import { FIXTURE_DATE } from '@/tests/fixtures/exceptions'

// Fixture soldiers have no 4D, so give three troopers a bunk on the roll (commanders are never counted)
beforeAll(async () => {
  await resetTestDb()
  const roll = new SoldierRepository('test')
  for (const name of ['LIM ZHEN HAO', 'YEO JIA HENG', 'GOH RONG HAO']) await roll.update(name, { bunk: 'trooper bunk' })
}, 30000)
afterAll(async () => {
  await resetTestDb()
  await supabase.auth.signOut()
}, 30000)

describe('OverviewTab', () => {
  it('counts the bunk from an absence and a duty, and marks an untick as ❌️', async () => {
    render(<QueryClientProvider client={new QueryClient()}><OverviewTab company="test" /></QueryClientProvider>)
    fireEvent.change(await screen.findByLabelText('Date', {}, { timeout: 10000 }), { target: { value: FIXTURE_DATE } })

    const msg = await screen.findByText(/STRENGTH CAA 150126/, {}, { timeout: 10000 })
    await waitFor(() => expect(msg.textContent).toContain('*TROOPER BUNK (1/3)*'))
    expect(msg.textContent).toMatch(/LIM ZHEN HAO - Skin Appt/)
    expect(msg.textContent).toMatch(/YEO JIA HENG - COS/)

    await userEvent.click(screen.getByRole('checkbox', { name: /GOH RONG HAO/ }))
    await waitFor(() => expect(msg.textContent).toContain('*TROOPER BUNK (0/3)*'))
    expect(msg.textContent).toMatch(/GOH RONG HAO - ❌️/)
  })
})
