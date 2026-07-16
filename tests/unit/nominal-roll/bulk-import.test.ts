import { describe, it, expect } from 'vitest'
import { parseCSV, validateAndTransform } from '@/lib/nominal-roll/bulk-import'
import type { Soldier } from '@/lib/supabase'

const existing: Soldier[] = [
  { rank: 'CPL', name: 'EXISTING_SOLDIER', platoon: '1' },
]

// Wrap data rows in the 2-row header format matching the Google Sheets template
const HINTS = '(Optional e.g. 1234),(Compulsory e.g. REC PTE),(Compulsory),(Compulsory i.e. HQ 1 2 3 or 4)'
const tv = (dataRows: string) => parseCSV(`${HINTS}\n4D,Rank,Name,Platoon\n${dataRows}`)

describe('parseCSV', () => {
  it('splits hints, header, and data rows', () => {
    const result = parseCSV(`${HINTS}\n4D,Rank,Name,Platoon\n1234,CPL,TAN AH KOW,1`)
    expect(result).toHaveLength(3)
    expect(result[1]).toEqual(['4D', 'Rank', 'Name', 'Platoon'])
    expect(result[2]).toEqual(['1234', 'CPL', 'TAN AH KOW', '1'])
  })

  it('strips UTF-8 BOM', () => {
    const result = parseCSV(`﻿${HINTS}\n4D,Rank,Name,Platoon\n,PTE,LEE,2`)
    expect(result[1][0]).toBe('4D')
  })

  it('handles CRLF line endings', () => {
    const result = parseCSV(`${HINTS}\r\n4D,Rank,Name,Platoon\r\n,PTE,LEE,2`)
    expect(result).toHaveLength(3)
  })

  it('skips empty lines', () => {
    const result = parseCSV(`${HINTS}\n4D,Rank,Name,Platoon\n\n,PTE,LEE,2\n`)
    expect(result).toHaveLength(3)
  })

  it('handles quoted field with an embedded comma', () => {
    const result = parseCSV(`${HINTS}\n4D,Rank,Name,Platoon\n,PTE,"TAN, AH KOW",2`)
    expect(result[2][2]).toBe('TAN, AH KOW')
  })

  it('handles escaped quotes inside a quoted field', () => {
    const result = parseCSV(`${HINTS}\n4D,Rank,Name,Platoon\n,PTE,"TAN ""AK"" KOW",2`)
    expect(result[2][2]).toBe('TAN "AK" KOW')
  })
})

describe('validateAndTransform', () => {
  it('returns error when a required column is missing from the header row', () => {
    const rows = parseCSV(`${HINTS}\nRank,Name,Platoon\nCPL,TAN,1`)
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(valid).toHaveLength(0)
    expect(errors[0].message).toMatch(/missing columns/i)
    expect(errors[0].message).toMatch(/4d/i)
  })

  it('accepts columns in any order', () => {
    const rows = parseCSV(`${HINTS}\nName,Platoon,Rank,4D\nTAN AH KOW,1,CPL,1234`)
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors).toHaveLength(0)
    expect(valid[0]).toMatchObject({ rank: 'CPL', name: 'TAN AH KOW', platoon: '1', fourD: '1234' })
  })

  it('ignores extra columns beyond 4D/Rank/Name/Platoon', () => {
    const rows = parseCSV(`${HINTS}\n4D,Rank,Name,Platoon,SAVE AS CSV\n,CPL,TAN,1,some note`)
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors).toHaveLength(0)
    expect(valid[0]).toMatchObject({ rank: 'CPL', name: 'TAN', platoon: '1' })
  })

  it('uppercases name', () => {
    const rows = tv(',CPL,tan ah kow,1')
    const { valid } = validateAndTransform(rows, existing)
    expect(valid[0].name).toBe('TAN AH KOW')
  })

  it('flags invalid rank', () => {
    const rows = tv(',SGT,TAN,1')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/"SGT" is not a valid rank/)
  })

  it('flags invalid platoon', () => {
    const rows = tv(',CPL,TAN,5')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/not a valid platoon/)
  })

  it('flags malformed 4D', () => {
    const rows = tv('123,CPL,TAN,1')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/4D/)
  })

  it('allows blank 4D', () => {
    const rows = tv(',CPL,TAN,1')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors).toHaveLength(0)
    expect(valid[0].fourD).toBeNull()
  })

  it('flags empty name', () => {
    const rows = tv(',CPL,,1')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/name is empty/i)
  })

  it('marks DB-existing name as overwrite, not error', () => {
    const rows = tv(',CPL,EXISTING_SOLDIER,1')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors).toHaveLength(0)
    expect(valid[0].isOverwrite).toBe(true)
  })

  it('all-or-nothing: one error blocks entire import', () => {
    const rows = tv(',BAD,,9\n,CPL,TAN,1')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors.length).toBeGreaterThan(1) // rank + platoon + name
    expect(valid).toHaveLength(0) // all-or-nothing: TAN not returned when errors exist
  })

  it('all-or-nothing: intra-CSV duplicate blocks entire import', () => {
    const rows = tv(',CPL,TAN,1\n,CPL,TAN,2\n,PTE,LEE,1')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/duplicate name/i)
    expect(valid).toHaveLength(0)
  })

  // ── 4D boundary cases ───────────────────────────────────────────────────────

  it('4D exactly 4 digits is valid', () => {
    const rows = tv('1234,CPL,TAN,1')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors).toHaveLength(0)
    expect(valid[0].fourD).toBe('1234')
  })

  it('4D 3 digits is invalid (one below valid length)', () => {
    const rows = tv('123,CPL,TAN,1')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/4D/)
  })

  it('4D 5 digits is invalid (one above valid length)', () => {
    const rows = tv('12345,CPL,TAN,1')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/4D/)
  })

  it('4D with non-numeric characters is invalid', () => {
    const rows = tv('A123,CPL,TAN,1')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/4D/)
  })

  // ── Name edge cases ─────────────────────────────────────────────────────────

  it('name that is all spaces fails name-is-empty check', () => {
    const rows = tv(',CPL,   ,1')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/name is empty/i)
  })

  // ── Empty / header-only CSVs ────────────────────────────────────────────────

  it('CSV with zero data rows returns valid=[], errors=[]', () => {
    const rows = parseCSV(`${HINTS}\n4D,Rank,Name,Platoon`)
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(valid).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  // ── All-or-nothing with mixed valid/invalid ─────────────────────────────────

  it('one bad platoon among otherwise valid rows blocks all', () => {
    const rows = tv(',CPL,TAN,9\n,PTE,LEE,1\n,LTA,KIM,HQ')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors.length).toBeGreaterThan(0)
    expect(valid).toHaveLength(0)
  })

  it('large valid CSV (50 rows) returns all 50 in valid', () => {
    const dataRows = Array.from({ length: 50 }, (_, i) =>
      `,CPL,SOLDIER_${String(i).padStart(2, '0')},1`,
    ).join('\n')
    const rows = tv(dataRows)
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors).toHaveLength(0)
    expect(valid).toHaveLength(50)
  })

  it('DB-existing name followed by CSV duplicate of that name: existing is overwrite, duplicate is error', () => {
    // EXISTING_SOLDIER is in the DB. If it appears again in the same CSV, second occurrence is a duplicate error.
    const rows = tv(',CPL,EXISTING_SOLDIER,1\n,PTE,EXISTING_SOLDIER,2')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/duplicate name/i)
    expect(valid).toHaveLength(0) // all-or-nothing
  })
})
