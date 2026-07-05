import { describe, it, expect } from 'vitest'
import { computePoints, computeDutyCounts, getEligibleForDuty, sortByPoints } from '@/lib/duty-dashboard'
import { FIXTURE_SOLDIERS } from '../fixtures/soldiers'
import { FIXTURE_DUTIES } from '../fixtures/duties'
import type { DutyEntry } from '@/lib/supabase'

describe('computePoints', () => {
  it('defaults each duty to weight 1 when no weights given', () => {
    expect(computePoints(FIXTURE_DUTIES, {})).toEqual({
      'LEE JUN WEI': 1, 'WONG KAH MENG': 1, 'YEO JIA HENG': 1, 'HO KAI XIANG': 1,
    })
  })

  it('applies a custom weight per duty type', () => {
    expect(computePoints(FIXTURE_DUTIES, { CDO: 3 })['LEE JUN WEI']).toBe(3)
  })

  it('sums multiple duties for the same soldier', () => {
    const duties: DutyEntry[] = [...FIXTURE_DUTIES, { duty_type: 'PDS1', date: '2026-01-16', name: 'LEE JUN WEI' }]
    expect(computePoints(duties, {})['LEE JUN WEI']).toBe(2)
  })

  it('filtering by dutyType only totals that duty (used for COS points)', () => {
    expect(computePoints(FIXTURE_DUTIES, {}, 'COS')).toEqual({ 'YEO JIA HENG': 1 })
  })

  it('a soldier with no duties is absent from the result', () => {
    expect(computePoints(FIXTURE_DUTIES, {})['ONG JUN SHENG']).toBeUndefined()
  })
})

describe('computeDutyCounts', () => {
  it('tallies per-duty-type counts, including a soldier with 2 duty types', () => {
    const duties: DutyEntry[] = [...FIXTURE_DUTIES, { duty_type: 'PDS1', date: '2026-01-16', name: 'LEE JUN WEI' }]
    expect(computeDutyCounts(duties)['LEE JUN WEI']).toEqual({ CDO: 1, PDS1: 1 })
  })
})

describe('getEligibleForDuty', () => {
  it('unions eligibility across duty types', () => {
    const result = getEligibleForDuty(['CDO', 'COS'], FIXTURE_SOLDIERS, {}, {})
    const names = result.map(s => s.name)
    expect(names).toContain('LEE JUN WEI') // CDO only
    expect(names).toContain('GOH RONG HAO') // COS only
  })

  it('respects a name-based eligibility override', () => {
    const result = getEligibleForDuty(['CDO'], FIXTURE_SOLDIERS, { CDO: ['ONG JUN SHENG'] }, {})
    expect(result.map(s => s.name)).toEqual(['ONG JUN SHENG'])
  })

  it('respects a rank-rule override', () => {
    const result = getEligibleForDuty(['CDO'], FIXTURE_SOLDIERS, {}, { CDO: { from: 'REC', to: 'REC' } })
    expect(result.map(s => s.name)).toEqual(['ONG JUN SHENG'])
  })
})

describe('sortByPoints', () => {
  it('sorts ascending by point value', () => {
    const points = { A: 5, B: 1, C: 3 }
    const soldiers = [{ rank: 'PTE', name: 'A', platoon: '1' }, { rank: 'PTE', name: 'B', platoon: '1' }, { rank: 'PTE', name: 'C', platoon: '1' }]
    expect(sortByPoints(soldiers, points).map(s => s.name)).toEqual(['B', 'C', 'A'])
  })

  it('handles an empty list', () => {
    expect(sortByPoints([], {})).toEqual([])
  })

  it('handles a single-soldier list', () => {
    const soldiers = [{ rank: 'PTE', name: 'A', platoon: '1' }]
    expect(sortByPoints(soldiers, { A: 5 })).toEqual(soldiers)
  })
})
