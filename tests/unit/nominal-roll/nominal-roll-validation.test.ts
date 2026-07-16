import { describe, it, expect } from 'vitest'
import { validateEdit, sortValue } from '@/lib/nominal-roll/nominal-roll-validation'
import type { EditRow } from '@/lib/nominal-roll/nominal-roll-validation'
import type { Soldier } from '@/lib/supabase'

const baseRow: EditRow = { originalName: 'TAN AH KOW', rank: 'CPL', name: 'TAN AH KOW', platoon: '1', four_d: '1234' }

describe('validateEdit', () => {
  it('null editRow is invalid', () => {
    expect(validateEdit(null)).toEqual({ name: true })
  })
  it('flags empty name', () => {
    expect(validateEdit({ ...baseRow, name: '  ' })).toEqual({ name: true })
  })
  it('flags empty platoon', () => {
    expect(validateEdit({ ...baseRow, platoon: '' })).toEqual({ platoon: true })
  })
  it('flags unknown rank', () => {
    expect(validateEdit({ ...baseRow, rank: 'NOTARANK' })).toEqual({ rank: true })
  })
  it('valid row returns no errors', () => {
    expect(validateEdit(baseRow)).toEqual({})
  })
})

const soldier = (over: Partial<Soldier>): Soldier => ({ rank: 'CPL', name: 'A', platoon: '1', four_d: null, ...over })

describe('sortValue', () => {
  it('four_d lowercases and defaults to empty string', () => {
    expect(sortValue(soldier({ four_d: 'AB12' }), 'four_d')).toBe('ab12')
    expect(sortValue(soldier({ four_d: null }), 'four_d')).toBe('')
  })
  it('platoon lowercases', () => {
    expect(sortValue(soldier({ platoon: 'HQ' }), 'platoon')).toBe('hq')
  })
  it('rank resolves to its RANK_ORDER index, unknown ranks sort last', () => {
    expect(sortValue(soldier({ rank: 'CPL' }), 'rank')).toBeGreaterThanOrEqual(0)
    expect(sortValue(soldier({ rank: 'NOTARANK' }), 'rank')).toBe(99)
  })
  it('name lowercases', () => {
    expect(sortValue(soldier({ name: 'TAN AH KOW' }), 'name')).toBe('tan ah kow')
  })
})
