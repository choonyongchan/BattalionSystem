import { describe, it, expect } from 'vitest'
import { isValidAmount, sortOffLeaveByRank } from '@/backend/domain/off-leave/off-leave'
import type { Soldier } from '@/shared/types'

describe('isValidAmount', () => {
  it('accepts positive half-day steps', () => {
    expect(isValidAmount(0.5)).toBe(true)
    expect(isValidAmount(1)).toBe(true)
    expect(isValidAmount(1.5)).toBe(true)
  })

  it('rejects zero, negatives, non-half steps and NaN', () => {
    expect(isValidAmount(0)).toBe(false)
    expect(isValidAmount(-1)).toBe(false)
    expect(isValidAmount(0.3)).toBe(false)
    expect(isValidAmount(NaN)).toBe(false)
  })
})

describe('sortOffLeaveByRank', () => {
  const soldiers: Soldier[] = [
    { rank: 'PTE', name: 'ALPHA', platoon: '1' },
    { rank: 'CPT', name: 'BRAVO', platoon: 'HQ' },
    { rank: '3SG', name: 'DELTA', platoon: '1' },
    { rank: '3SG', name: 'CHARLIE', platoon: '2' },
  ]
  const row = (name: string) => ({ name, off: 1, leave: 0 })

  it('sorts most senior rank first, then by name', () => {
    const sorted = sortOffLeaveByRank(['ALPHA', 'DELTA', 'BRAVO', 'CHARLIE'].map(row), soldiers)
    expect(sorted.map((r) => r.name)).toEqual(['BRAVO', 'CHARLIE', 'DELTA', 'ALPHA'])
  })

  it('puts soldiers missing from the nominal roll last', () => {
    const sorted = sortOffLeaveByRank([row('GHOST'), row('ALPHA')], soldiers)
    expect(sorted.map((r) => r.name)).toEqual(['ALPHA', 'GHOST'])
  })

  it('does not mutate the input', () => {
    const rows = [row('ALPHA'), row('BRAVO')]
    sortOffLeaveByRank(rows, soldiers)
    expect(rows.map((r) => r.name)).toEqual(['ALPHA', 'BRAVO'])
  })
})
