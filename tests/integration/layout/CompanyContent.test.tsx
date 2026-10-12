import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CompanyContent from '@/frontend/components/layout/CompanyContent'
import { supabase } from '@/backend/data/client'
import { resetTestDb } from '@/tests/fixtures/db'

function renderApp() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CompanyContent company="test" label="Test" />
    </QueryClientProvider>,
  )
}

describe('CompanyContent signed out', () => {
  beforeAll(() => supabase.auth.signOut())

  it('shows the landing hero with the commander sign-in', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Test Company' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled() // until a password is typed
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})

describe('CompanyContent signed in', () => {
  beforeAll(resetTestDb, 30000)
  afterAll(() => supabase.auth.signOut())

  it('groups the seven tabs and opens the tab named in ?tab=', async () => {
    window.history.replaceState(null, '', '/test/?tab=report-sick')
    renderApp()
    const rsi = await screen.findByRole('tab', { name: 'Report Sick' }, { timeout: 10000 })
    await waitFor(() => expect(rsi).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(
      ['Overview', 'Parade State', 'Report Sick', 'Nominal Roll', 'Off/Leave', 'Duty Dashboard', 'Conducts'],
    )
  })

  it('records the chosen tab in the URL and supports arrow keys', async () => {
    window.history.replaceState(null, '', '/test/')
    renderApp()
    await userEvent.click(await screen.findByRole('tab', { name: 'Conducts' }, { timeout: 10000 }))
    expect(window.location.search).toBe('?tab=conducts')

    await userEvent.keyboard('{ArrowRight}') // wraps from the last tab to the first
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus()
  })

  it('falls back to the Overview for an unknown ?tab=', async () => {
    window.history.replaceState(null, '', '/test/?tab=nope')
    renderApp()
    const tab = await screen.findByRole('tab', { name: 'Overview' }, { timeout: 10000 })
    expect(tab).toHaveAttribute('aria-selected', 'true')
  })
})
