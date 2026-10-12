import { describe, it, expect } from 'vitest'
import { filterSoldiers, groupByRankType, sortSoldiers } from '@/backend/domain/nominal-roll/roster'
import { FIXTURE_SOLDIERS } from '@/tests/fixtures/soldiers'

describe('nominal roll roster', () => {
  it('filters on rank, name or platoon', () => {
    expect(filterSoldiers(FIXTURE_SOLDIERS, 'lta').map((s) => s.name)).toEqual(['LEE JUN WEI', 'CHEN MING ZHI'])
    expect(filterSoldiers(FIXTURE_SOLDIERS, '')).toHaveLength(13)
  })

  it('default order is platoon, then senior first', () => {
    const names = sortSoldiers(FIXTURE_SOLDIERS, null, 'asc').map((s) => s.name)
    expect(names.slice(0, 3)).toEqual(['LEE JUN WEI', 'NG BOON SENG', 'LIM ZHEN HAO'])
  })

  it('column sort can flip direction', () => {
    const asc = sortSoldiers(FIXTURE_SOLDIERS, 'name', 'asc').map((s) => s.name)
    expect(asc[0]).toBe('CHEN MING ZHI')
    expect(sortSoldiers(FIXTURE_SOLDIERS, 'name', 'desc')[0].name).toBe(asc[asc.length - 1])
  })

  it('groups into officer / WOSPEC / enlistee sections', () => {
    const g = groupByRankType(FIXTURE_SOLDIERS)
    expect([g.Officer.length, g.WOSPEC.length, g.Enlistee.length]).toEqual([3, 4, 6])
  })
})
