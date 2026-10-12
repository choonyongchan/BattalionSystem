import { describe, it, expect } from 'vitest'
import { displayDutyName, EXTERNAL_DUTY_PERSON, splitDutyNames } from '@/shared/names'
import { FIXTURE_SOLDIERS } from '@/tests/fixtures/soldiers'

describe('duty names', () => {
  it('splitDutyNames splits a two-person duty and drops blanks', () => {
    expect(splitDutyNames('LEE JUN WEI / CHEN MING ZHI')).toEqual(['LEE JUN WEI', 'CHEN MING ZHI'])
    expect(splitDutyNames('')).toEqual([])
  })

  it('displayDutyName prefixes ranks and hides an external partner', () => {
    expect(displayDutyName(`YEO JIA HENG / ${EXTERNAL_DUTY_PERSON}`, FIXTURE_SOLDIERS)).toBe('CPL YEO JIA HENG')
    expect(displayDutyName('YEO JIA HENG / LIM WEI JIAN', FIXTURE_SOLDIERS)).toBe('CPL YEO JIA HENG / PTE LIM WEI JIAN')
  })
})
