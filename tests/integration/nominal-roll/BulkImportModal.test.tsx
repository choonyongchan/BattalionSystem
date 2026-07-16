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

async function waitForLoad() {
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
}

const HINTS_ROW = '(Optional e.g. 1234),(Compulsory e.g. REC PTE),(Compulsory),(Compulsory i.e. HQ 1 2 3 or 4)'

function makeCSVFile(content: string) {
  return new File([content], 'import.csv', { type: 'text/csv' })
}

function makeTemplateCSV(rows: string) {
  return makeCSVFile(`${HINTS_ROW}\n4D,RANK,NAME,PLATOON\n${rows}`)
}

describe('Bulk Import', () => {
  it('shows Bulk Import button', async () => {
    render(<NominalRoll company="test" />)
    await waitForLoad()
    expect(screen.getByRole('button', { name: /bulk import/i })).toBeInTheDocument()
  })

  it('opens modal on click', async () => {
    render(<NominalRoll company="test" />)
    await waitForLoad()
    await userEvent.click(screen.getByRole('button', { name: /bulk import/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Download Template')).toBeInTheDocument()
  })

  it('shows validation errors for bad CSV', async () => {
    render(<NominalRoll company="test" />)
    await waitForLoad()
    await userEvent.click(screen.getByRole('button', { name: /bulk import/i }))

    const input = screen.getByTestId('csv-upload')
    const csv = makeTemplateCSV(',BRANK,TEST_BAD,9')
    await userEvent.upload(input, csv)

    await waitFor(() => {
      expect(screen.getByText(/errors found/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/not a valid rank/i)).toBeInTheDocument()
    expect(screen.getByText(/not a valid platoon/i)).toBeInTheDocument()
  })

  it('shows preview with valid rows, marking existing soldier as overwrite', async () => {
    render(<NominalRoll company="test" />)
    await waitForLoad()
    await userEvent.click(screen.getByRole('button', { name: /bulk import/i }))

    const input = screen.getByTestId('csv-upload')
    // TAN WEI LIANG already exists in the seeded DB (CPT in HQ)
    const csv = makeTemplateCSV(',CPT,TAN WEI LIANG,HQ\n1234,PTE,TEST_BULK_NEW,2')
    await userEvent.upload(input, csv)

    await waitFor(() => {
      expect(screen.getAllByText('TAN WEI LIANG').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('TEST_BULK_NEW')).toBeInTheDocument()
    })
    expect(screen.getByText('overwrite')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /import 2 soldiers \(1 overwrite\)/i })).toBeInTheDocument()
  })

  it('imports soldiers and closes the modal on success', async () => {
    render(<NominalRoll company="test" />)
    await waitForLoad()
    await userEvent.click(screen.getByRole('button', { name: /bulk import/i }))

    const input = screen.getByTestId('csv-upload')
    const csv = makeTemplateCSV(',PTE,TEST_BULK_IMPORT_A,3\n,CPL,TEST_BULK_IMPORT_B,HQ')
    await userEvent.upload(input, csv)

    await waitFor(() => expect(screen.getByText('TEST_BULK_IMPORT_A')).toBeInTheDocument(), { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: /import 2 soldiers/i }))

    // After successful import: modal closes (onImported calls setShowImport(false))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    }, { timeout: 15000 })

    // Verify soldiers are in the DB
    const { data } = await supabase
      .from('Test_NominalRoll')
      .select('*')
      .in('name', ['TEST_BULK_IMPORT_A', 'TEST_BULK_IMPORT_B'])
    expect(data).toHaveLength(2)
  }, 30000)

  it('blocks entire import when any row has an error (all-or-nothing)', async () => {
    render(<NominalRoll company="test" />)
    await waitForLoad()
    await userEvent.click(screen.getByRole('button', { name: /bulk import/i }))

    const input = screen.getByTestId('csv-upload')
    const csv = makeTemplateCSV(',CPL,TEST_BULK_DUP,1\n,CPL,TEST_BULK_DUP,2\n,PTE,TEST_BULK_UNIQUE,1')
    await userEvent.upload(input, csv)

    await waitFor(() => expect(screen.getByText(/error.*found/i)).toBeInTheDocument(), { timeout: 10000 })
    expect(screen.getByText(/duplicate name/i)).toBeInTheDocument()
    // all-or-nothing: no preview, no import button
    expect(screen.queryByText('TEST_BULK_DUP')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^import \d/i })).not.toBeInTheDocument()
  }, 30000)
})
