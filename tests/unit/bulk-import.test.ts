import { describe, it, expect } from 'vitest'
import { parseCSV, validateAndTransform } from '@/lib/bulk-import'
import type { Soldier } from '@/lib/supabase'

const existing: Soldier[] = [
  { rank: 'CPL', name: 'EXISTING_SOLDIER', platoon: '1' },
]

describe('parseCSV', () => {
  it('splits header and rows', () => {
    const result = parseCSV('4D,Rank,Name,Platoon\n1234,CPL,TAN AH KOW,1')
    expect(result).toEqual([['4D', 'Rank', 'Name', 'Platoon'], ['1234', 'CPL', 'TAN AH KOW', '1']])
  })

  it('strips UTF-8 BOM', () => {
    const result = parseCSV('﻿4D,Rank,Name,Platoon\n,PTE,LEE,2')
    expect(result[0][0]).toBe('4D')
  })

  it('handles CRLF line endings', () => {
    const result = parseCSV('4D,Rank,Name,Platoon\r\n,PTE,LEE,2')
    expect(result).toHaveLength(2)
  })

  it('skips empty lines', () => {
    const result = parseCSV('4D,Rank,Name,Platoon\n\n,PTE,LEE,2\n')
    expect(result).toHaveLength(2)
  })
})

describe('validateAndTransform', () => {
  it('returns error when a required column is missing', () => {
    const rows = parseCSV('Rank,Name,Platoon\nCPL,TAN,1')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(valid).toHaveLength(0)
    expect(errors[0].message).toMatch(/missing columns/i)
    expect(errors[0].message).toMatch(/4d/i)
  })

  it('accepts columns in any order', () => {
    const rows = parseCSV('Name,Platoon,Rank,4D\nTAN AH KOW,1,CPL,1234')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors).toHaveLength(0)
    expect(valid[0]).toMatchObject({ rank: 'CPL', name: 'TAN AH KOW', platoon: '1', fourD: '1234' })
  })

  it('uppercases name', () => {
    const rows = parseCSV('4D,Rank,Name,Platoon\n,CPL,tan ah kow,1')
    const { valid } = validateAndTransform(rows, existing)
    expect(valid[0].name).toBe('TAN AH KOW')
  })

  it('flags invalid rank', () => {
    const rows = parseCSV('4D,Rank,Name,Platoon\n,SGT,TAN,1')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/"SGT" is not a valid rank/)
  })

  it('flags invalid platoon', () => {
    const rows = parseCSV('4D,Rank,Name,Platoon\n,CPL,TAN,5')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/not a valid platoon/)
  })

  it('flags malformed 4D', () => {
    const rows = parseCSV('4D,Rank,Name,Platoon\n123,CPL,TAN,1')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/4D/)
  })

  it('allows blank 4D', () => {
    const rows = parseCSV('4D,Rank,Name,Platoon\n,CPL,TAN,1')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors).toHaveLength(0)
    expect(valid[0].fourD).toBeNull()
  })

  it('flags empty name', () => {
    const rows = parseCSV('4D,Rank,Name,Platoon\n,CPL,,1')
    const { errors } = validateAndTransform(rows, existing)
    expect(errors[0].message).toMatch(/name is empty/i)
  })

  it('flags intra-CSV duplicate and continues with other rows', () => {
    const rows = parseCSV('4D,Rank,Name,Platoon\n,CPL,TAN,1\n,CPL,TAN,2\n,PTE,LEE,1')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/duplicate name/i)
    expect(valid).toHaveLength(2) // TAN (first) + LEE
  })

  it('marks DB-existing name as overwrite, not error', () => {
    const rows2 = parseCSV('4D,Rank,Name,Platoon\n,CPL,EXISTING_SOLDIER,1')
    const { valid, errors } = validateAndTransform(rows2, existing)
    expect(errors).toHaveLength(0)
    expect(valid[0].isOverwrite).toBe(true)
  })

  it('shows all row errors at once', () => {
    const rows = parseCSV('4D,Rank,Name,Platoon\n,BAD,,9\n,CPL,TAN,1')
    const { valid, errors } = validateAndTransform(rows, existing)
    expect(errors.length).toBeGreaterThan(1) // rank + platoon + name
    expect(valid).toHaveLength(1) // TAN is clean
  })
})
