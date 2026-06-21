import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NominalRoll from '@/components/NominalRoll'
import { getSupabaseClient } from '@/lib/supabase'
import { truncateTestDb, seedTestDb } from '../fixtures/db'

beforeAll(async () => {
  const supabase = getSupabaseClient('test')
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_SUPABASE_EMAIL!,
    password: process.env.TEST_SUPABASE_PASSWORD!,
  })
  if (error) throw new Error(`Test setup sign-in failed: ${error.message}`)
  await truncateTestDb()
  await seedTestDb()
}, 30000)

afterAll(async () => {
  await getSupabaseClient('test').auth.signOut()
})

async function waitForLoad() {
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument(), { timeout: 10000 })
}

function makeCSVFile(content: string) {
  return new File([content], 'import.csv', { type: 'text/csv' })
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
    const csv = makeCSVFile('4D,Rank,Name,Platoon\n,BRANK,TEST_BAD,9')
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
    // TEST_SOLDIER_ONE already exists in the seeded DB
    const csv = makeCSVFile('4D,Rank,Name,Platoon\n,CPL,TEST_SOLDIER_ONE,1\n1234,PTE,TEST_BULK_NEW,2')
    await userEvent.upload(input, csv)

    await waitFor(() => {
      expect(screen.getByText('TEST_SOLDIER_ONE')).toBeInTheDocument()
      expect(screen.getByText('TEST_BULK_NEW')).toBeInTheDocument()
    })
    expect(screen.getByText('overwrite')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /import 2 soldiers \(1 overwrite\)/i })).toBeInTheDocument()
  })

  it('imports soldiers and shows success result', async () => {
    render(<NominalRoll company="test" />)
    await waitForLoad()
    await userEvent.click(screen.getByRole('button', { name: /bulk import/i }))

    const input = screen.getByTestId('csv-upload')
    const csv = makeCSVFile('4D,Rank,Name,Platoon\n,PTE,TEST_BULK_IMPORT_A,3\n,CPL,TEST_BULK_IMPORT_B,HQ')
    await userEvent.upload(input, csv)

    await waitFor(() => expect(screen.getByText('TEST_BULK_IMPORT_A')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /import 2 soldiers/i }))

    await waitFor(() => {
      expect(screen.getByText(/2 added/i)).toBeInTheDocument()
    }, { timeout: 10000 })

    const { data } = await getSupabaseClient('test')
      .from('Test_NominalRoll')
      .select('*')
      .in('name', ['TEST_BULK_IMPORT_A', 'TEST_BULK_IMPORT_B'])
    expect(data).toHaveLength(2)
  })

  it('skips intra-CSV duplicates and still imports unique rows', async () => {
    render(<NominalRoll company="test" />)
    await waitForLoad()
    await userEvent.click(screen.getByRole('button', { name: /bulk import/i }))

    const input = screen.getByTestId('csv-upload')
    const csv = makeCSVFile(
      '4D,Rank,Name,Platoon\n,CPL,TEST_BULK_DUP,1\n,CPL,TEST_BULK_DUP,2\n,PTE,TEST_BULK_UNIQUE,1'
    )
    await userEvent.upload(input, csv)

    await waitFor(() => expect(screen.getByText(/errors found/i)).toBeInTheDocument())
    expect(screen.getByText(/duplicate name/i)).toBeInTheDocument()
    // preview shows the two valid rows (first occurrence of dup + unique)
    expect(screen.getByText('TEST_BULK_DUP')).toBeInTheDocument()
    expect(screen.getByText('TEST_BULK_UNIQUE')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /import 2 soldiers/i })).toBeInTheDocument()
  })
})
