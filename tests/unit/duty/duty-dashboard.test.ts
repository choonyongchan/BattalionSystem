import { describe, it, expect } from 'vitest'
import { computePoints, computePointsByDutyType, getEligibleForDuty, sortByPoints } from '@/lib/duty/duty-dashboard'
import type { WeightSettings } from '@/lib/duty/duty-dashboard'
import { FIXTURE_SOLDIERS } from '../../fixtures/soldiers'
import { FIXTURE_DUTIES } from '../../fixtures/duties'
import type { DutyEntry } from '@/lib/supabase'

const NO_HOLIDAYS = new Set<string>()

function weights(overrides: Partial<WeightSettings> = {}): WeightSettings {
  return {
    baseWeights: {},
    dayMultipliers: {} as Record<'MonThurs' | 'Friday' | 'Saturday' | 'Sunday' | 'PublicHoliday', number>,
    exceptions: {},
    ...overrides,
  }
}

describe('computePoints', () => {
  it('defaults to weight 1 when settings are empty (FIXTURE_DATE is a Thursday â†’ MonThurs)', () => {
    expect(computePoints(FIXTURE_DUTIES, weights(), NO_HOLIDAYS)).toEqual({
      'LEE JUN WEI': 1, 'WONG KAH MENG': 1, 'YEO JIA HENG': 1, 'HO KAI XIANG': 1,
    })
  })

  it('applies a custom base weight per duty type', () => {
    const w = weights({ baseWeights: { CDO: 3 } })
    expect(computePoints(FIXTURE_DUTIES, w, NO_HOLIDAYS)['LEE JUN WEI']).toBe(3)
  })

  it('applies the Friday multiplier for a duty dated on a Friday', () => {
    const fridayDuty: DutyEntry[] = [{ duty_type: 'CDO', date: '2026-01-16', name: 'LEE JUN WEI' }]
    const w = weights({ baseWeights: { CDO: 2 }, dayMultipliers: { MonThurs: 1, Friday: 0.5, Saturday: 2, Sunday: 1.5, PublicHoliday: 2 } })
    expect(computePoints(fridayDuty, w, NO_HOLIDAYS)['LEE JUN WEI']).toBe(1) // 2 * 0.5
  })

  it('applies the PublicHoliday multiplier when the date is in the holiday set', () => {
    const holidayDuty: DutyEntry[] = [{ duty_type: 'CDO', date: '2026-01-15', name: 'LEE JUN WEI' }]
    const w = weights({ baseWeights: { CDO: 2 }, dayMultipliers: { MonThurs: 1, Friday: 0.5, Saturday: 2, Sunday: 1.5, PublicHoliday: 2 } })
    const holidays = new Set(['2026-01-15'])
    expect(computePoints(holidayDuty, w, holidays)['LEE JUN WEI']).toBe(4) // 2 * 2
  })

  it('an exact override wins over the baseÃ—multiplier formula', () => {
    const holidayDuty: DutyEntry[] = [{ duty_type: 'COS', date: '2026-01-15', name: 'YEO JIA HENG' }]
    const w = weights({
      baseWeights: { COS: 1 },
      dayMultipliers: { MonThurs: 1, Friday: 0.5, Saturday: 2, Sunday: 1.5, PublicHoliday: 2 },
      exceptions: { 'COS:PublicHoliday': 5 },
    })
    const holidays = new Set(['2026-01-15'])
    expect(computePoints(holidayDuty, w, holidays)['YEO JIA HENG']).toBe(5)
  })

  it('an exception key for a different day type does not apply', () => {
    const normalDuty: DutyEntry[] = [{ duty_type: 'COS', date: '2026-01-15', name: 'YEO JIA HENG' }]
    const w = weights({
      baseWeights: { COS: 1 },
      exceptions: { 'COS:PublicHoliday': 5 },
    })
    expect(computePoints(normalDuty, w, NO_HOLIDAYS)['YEO JIA HENG']).toBe(1) // formula, not the override
  })

  it('unknown duty type falls back to base weight 1', () => {
    const unknownDuty: DutyEntry[] = [{ duty_type: 'ZZZ', date: '2026-01-15', name: 'GHOST' }]
    expect(computePoints(unknownDuty, weights(), NO_HOLIDAYS)['GHOST']).toBe(1)
  })

  it('sums multiple duties for the same soldier', () => {
    const duties: DutyEntry[] = [...FIXTURE_DUTIES, { duty_type: 'PDS1', date: '2026-01-16', name: 'LEE JUN WEI' }]
    // second duty is on a Friday with default (emptyâ†’1) multiplier since none was configured
    expect(computePoints(duties, weights(), NO_HOLIDAYS)['LEE JUN WEI']).toBe(2)
  })

  it('filtering by dutyType only totals that duty (used for COS points)', () => {
    expect(computePoints(FIXTURE_DUTIES, weights(), NO_HOLIDAYS, 'COS')).toEqual({ 'YEO JIA HENG': 1 })
  })

  it('a soldier with no duties is absent from the result', () => {
    expect(computePoints(FIXTURE_DUTIES, weights(), NO_HOLIDAYS)['ONG JUN SHENG']).toBeUndefined()
  })
})

describe('computePointsByDutyType', () => {
  it('tallies per-duty-type weighted points, including a soldier with 2 duty types', () => {
    const duties: DutyEntry[] = [...FIXTURE_DUTIES, { duty_type: 'PDS1', date: '2026-01-16', name: 'LEE JUN WEI' }]
    const w = weights({ baseWeights: { CDO: 3, PDS1: 2 } })
    expect(computePointsByDutyType(duties, w, NO_HOLIDAYS)['LEE JUN WEI']).toEqual({ CDO: 3, PDS1: 2 })
  })

  it('sums multiple duties of the same type for one soldier', () => {
    const duties: DutyEntry[] = [
      { duty_type: 'CDO', date: '2026-01-15', name: 'LEE JUN WEI' },
      { duty_type: 'CDO', date: '2026-01-16', name: 'LEE JUN WEI' },
    ]
    const w = weights({ baseWeights: { CDO: 2 } })
    expect(computePointsByDutyType(duties, w, NO_HOLIDAYS)['LEE JUN WEI']).toEqual({ CDO: 4 })
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
