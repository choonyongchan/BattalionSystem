import { describe, it, expect } from 'vitest'
import { computeStrength, strengthInputsFromRows, strengthInputsToNumbers } from '@/backend/domain/parade/strength'
import { FIXTURE_SOLDIERS } from '@/tests/fixtures/soldiers'

describe('parade strength', () => {
  it('counts the fixture roll by platoon and rank type', () => {
    const s = computeStrength(FIXTURE_SOLDIERS, ['Total', 'HQ', '1'])
    expect(s.Total).toEqual({ Officer: 3, WOSPEC: 4, Enlistee: 6 })
    expect(s.HQ).toEqual({ Officer: 1, WOSPEC: 1, Enlistee: 0 })
    expect(s['1']).toEqual({ Officer: 1, WOSPEC: 1, Enlistee: 2 })
  })

  it('round-trips stored overrides through the editable grid, dropping blanks', () => {
    const inputs = strengthInputsFromRows([{ platoon: 'HQ', rank_type: 'Officer', value: 2 }])
    expect(inputs).toEqual({ HQ: { Officer: '2' } })
    expect(strengthInputsToNumbers({ HQ: { Officer: '2', WOSPEC: '' } })).toEqual({ HQ: { Officer: 2 } })
  })
})
