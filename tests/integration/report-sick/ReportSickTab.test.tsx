import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReportSickTab from '@/frontend/components/report-sick/ReportSickTab'
import { MedicalReviewRepository } from '@/backend/data/repositories/MedicalReviewRepository'
import { ExceptionRepository } from '@/backend/data/repositories/ExceptionRepository'
import { supabase } from '@/backend/data/client'
import { todaySGDate } from '@/shared/dates'
import { resetTestDb } from '@/tests/fixtures/db'

const today = todaySGDate()

beforeAll(resetTestDb, 30000)
afterAll(async () => {
  await resetTestDb()
  await supabase.auth.signOut()
}, 30000)

/** Renders the tab and waits for the roll to load. */
async function renderTab() {
  render(<QueryClientProvider client={new QueryClient()}><ReportSickTab company="test" companyLabel="Test" /></QueryClientProvider>)
  await waitFor(() => expect(screen.getByPlaceholderText('Search soldier...')).toBeInTheDocument(), { timeout: 10000 })
}

/** Picks a soldier in the search dropdown. */
async function pick(name: string) {
  await userEvent.type(screen.getByPlaceholderText('Search soldier...'), name)
  await userEvent.click(await screen.findByText(name))
}

describe('ReportSickTab', () => {
  it('keys an RSI at KHMC as a URTI exception and prints it under URTI', async () => {
    await renderTab()
    expect(screen.getByLabelText('Location')).toHaveValue('KHMC')
    await pick('CHONG KAH WAI')
    await userEvent.type(screen.getByPlaceholderText(/^Reason/), 'Flu and phlegm')
    expect(screen.getByRole('checkbox', { name: 'URTI' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Add RSI' }))

    await waitFor(() => expect(screen.getByText(/REASON: Flu and phlegm/)).toBeInTheDocument(), { timeout: 10000 })
    expect(screen.getByText(/REASON: Flu and phlegm/).textContent).toMatch(/\nURTI\nS\/N: 01\nR\/N: .*CHONG KAH WAI\nREASON: Flu and phlegm$/)

    const { data } = await supabase.from('Test_Exceptions').select('scope, type, in_out, location, start, end, soldier_id').eq('reason', 'Flu and phlegm')
    expect(data).toEqual([expect.objectContaining({ scope: 'Report Sick', type: 'URTI', in_out: 'IN', location: 'KHMC', start: today, end: today })])
    expect(data![0].soldier_id).not.toBeNull()
  })

  it('keys an RSO with no default location and no message', async () => {
    await renderTab()
    await userEvent.click(screen.getByRole('radio', { name: 'RSO' }))
    expect(screen.getByLabelText('Location')).toHaveValue('')
    await pick('GOH RONG HAO')
    await userEvent.type(screen.getByPlaceholderText(/^Reason/), 'Sprained ankle')
    await userEvent.click(screen.getByRole('button', { name: 'Add RSO' }))

    await waitFor(() => expect(screen.getByText(/Sprained ankle/)).toBeInTheDocument(), { timeout: 10000 })
    expect(screen.queryByText(/message$/)).not.toBeInTheDocument()
    const { data } = await supabase.from('Test_Exceptions').select('in_out, location, counts_as_absence').eq('reason', 'Sprained ankle')
    expect(data).toEqual([{ in_out: 'OUT', location: null, counts_as_absence: true }])
  })

  it('keys a medical review and prints it in the medical review message', async () => {
    await renderTab()
    await userEvent.click(screen.getByRole('radio', { name: 'Medical Review' }))
    await pick('WONG KAH MENG')
    expect(screen.getByLabelText('Coy')).toHaveValue('TEST')
    await userEvent.type(screen.getByLabelText('NRIC'), 's0000000a')
    await userEvent.type(screen.getByLabelText('Diagnosis/Issue'), 'Revoke FLEGS Status')
    await userEvent.click(screen.getByRole('radio', { name: 'Yes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add medical review' }))

    const msg = await screen.findByText(/\*MEDICAL REVIEW\*/, {}, { timeout: 10000 })
    await waitFor(() => expect(msg.textContent).toContain('NRIC: S0000000A'))
    expect(msg.textContent).toMatch(/Rank \+ Name: \S+ WONG KAH MENG\nCoy: TEST\nNRIC: S0000000A\nDiagnosis\/Issue: Revoke FLEGS Status\nDate of most recent Medical Appointment: - NIL\nDate of Next MA: - NIL\nMemo \(Yes\/No\): Yes\nRemarks\/Requests: NIL/)
  })
})

describe('MedicalReviewRepository', () => {
  it('deleting the review exception deletes its details', async () => {
    const repo = new MedicalReviewRepository('test')
    const { error } = await repo.add(
      { name: 'NG BOON SENG', scope: 'Report Sick', type: 'Medical Review', reason: 'Cascade check', start: today, end: today, counts_as_absence: false },
      { nric: 'S0000000A', coy: 'TEST', last_ma: '2026-01-10', next_ma: null, memo: false, remarks: null },
    )
    expect(error).toBeNull()
    const exceptions = new ExceptionRepository('test')
    const row = (await exceptions.list('Report Sick')).data.find((e) => e.reason === 'Cascade check')!
    expect((await repo.list()).data).toContainEqual(expect.objectContaining({ exception_id: row.id, last_ma: '2026-01-10' }))

    await exceptions.remove(row.id)
    expect((await repo.list()).data.some((r) => r.exception_id === row.id)).toBe(false)
  })
})
