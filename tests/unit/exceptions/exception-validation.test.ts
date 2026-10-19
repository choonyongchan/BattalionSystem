import { describe, it, expect } from 'vitest'
import {
  isValidTime, isExceptionValid, validateAddEx,
  isEditExceptionValid, validateEditEx, exceptionSortValue,
  compareExceptionOrder, groupExceptionsByPerson,
} from '@/backend/domain/exceptions/exception-validation'
import type { ExForm } from '@/backend/domain/exceptions/exception-validation'
import type { Exception, Soldier } from '@/shared/types'

describe('isValidTime', () => {
  it('accepts empty string', () => expect(isValidTime('')).toBe(true))
  it('accepts a valid HH:MM', () => expect(isValidTime('23:59')).toBe(true))
  it('rejects hour > 23', () => expect(isValidTime('24:00')).toBe(false))
  it('rejects minute > 59', () => expect(isValidTime('12:60')).toBe(false))
  it('rejects malformed input', () => expect(isValidTime('noon')).toBe(false))
})

const baseExForm: ExForm = { name: 'TAN AH KOW', scope: 'Off/Leave', reason: '', start: '2026-01-01', end: '2026-01-01', counts_as_absence: true, time: '', location: '' }

describe('isExceptionValid', () => {
  it('false when name is empty', () => {
    expect(isExceptionValid({ ...baseExForm, name: '' }, [])).toBe(false)
  })
  it('Status scope requires unique reasons across rows', () => {
    const rows = [{ start: '', end: '', reason: 'A' }, { start: '', end: '', reason: 'B' }]
    expect(isExceptionValid({ ...baseExForm, scope: 'Status' }, rows)).toBe(true)
  })
  it('Status scope rejects duplicate reasons across rows', () => {
    const rows = [{ start: '', end: '', reason: 'A' }, { start: '', end: '', reason: 'A' }]
    expect(isExceptionValid({ ...baseExForm, scope: 'Status' }, rows)).toBe(false)
  })
  it('non-Status scope defers to isValidTime', () => {
    expect(isExceptionValid({ ...baseExForm, scope: 'MA', time: '99:99' }, [])).toBe(false)
    expect(isExceptionValid({ ...baseExForm, scope: 'MA', time: '09:30' }, [])).toBe(true)
  })
})

describe('validateAddEx', () => {
  it('flags missing name', () => {
    expect(validateAddEx({ ...baseExForm, name: '' })).toEqual({ name: true })
  })
  it('flags invalid time only for MA scope', () => {
    expect(validateAddEx({ ...baseExForm, scope: 'MA', time: 'bad' })).toEqual({ time: true })
    expect(validateAddEx({ ...baseExForm, scope: 'Off/Leave', time: 'bad' })).toEqual({})
  })
  it('returns empty object when valid', () => {
    expect(validateAddEx(baseExForm)).toEqual({})
  })
})

const baseException: Exception = { id: 1, name: 'TAN AH KOW', scope: 'Off/Leave', reason: null, start: null, end: null, counts_as_absence: true }

describe('isEditExceptionValid / validateEditEx', () => {
  it('null editEx is invalid', () => {
    expect(isEditExceptionValid(null)).toBe(false)
    expect(validateEditEx(null)).toEqual({ name: true })
  })
  it('missing name is invalid', () => {
    expect(isEditExceptionValid({ ...baseException, name: '' })).toBe(false)
    expect(validateEditEx({ ...baseException, name: '' })).toEqual({ name: true })
  })
  it('MA scope requires a valid time', () => {
    expect(isEditExceptionValid({ ...baseException, scope: 'MA', time: 'bad' })).toBe(false)
    expect(validateEditEx({ ...baseException, scope: 'MA', time: 'bad' })).toEqual({ time: true })
  })
  it('valid exception passes', () => {
    expect(isEditExceptionValid(baseException)).toBe(true)
    expect(validateEditEx(baseException)).toEqual({})
  })
})

const soldiers: Soldier[] = [{ rank: 'CPL', name: 'TAN AH KOW', platoon: '1', four_d: '1234' }]

describe('exceptionSortValue', () => {
  it('resolves four_d from the soldier lookup', () => {
    expect(exceptionSortValue(baseException, 'four_d', soldiers)).toBe('1234')
  })
  it('lowercases name/scope/reason', () => {
    const e = { ...baseException, name: 'ABC', scope: 'MA', reason: 'FLU' }
    expect(exceptionSortValue(e, 'name', soldiers)).toBe('abc')
    expect(exceptionSortValue(e, 'scope', soldiers)).toBe('ma')
    expect(exceptionSortValue(e, 'reason', soldiers)).toBe('flu')
  })
  it('parses start/end as timestamps', () => {
    const e = { ...baseException, start: '2026-01-01', end: '2026-01-02' }
    expect(exceptionSortValue(e, 'start', soldiers)).toBe(new Date('2026-01-01').getTime())
    expect(exceptionSortValue(e, 'end', soldiers)).toBe(new Date('2026-01-02').getTime())
  })
})

describe('compareExceptionOrder', () => {
  it('treats two no-end-date exceptions as equal', () => {
    expect(compareExceptionOrder({ ...baseException, end: null }, { ...baseException, end: null })).toBe(0)
  })
  it('sorts no-end-date before dated', () => {
    expect(compareExceptionOrder({ ...baseException, end: null }, { ...baseException, end: '2026-01-01' })).toBeLessThan(0)
    expect(compareExceptionOrder({ ...baseException, end: '2026-01-01' }, { ...baseException, end: null })).toBeGreaterThan(0)
  })
  it('sorts dated exceptions by end date ascending', () => {
    expect(compareExceptionOrder({ ...baseException, end: '2026-01-01' }, { ...baseException, end: '2026-03-01' })).toBeLessThan(0)
    expect(compareExceptionOrder({ ...baseException, end: '2026-03-01' }, { ...baseException, end: '2026-01-01' })).toBeGreaterThan(0)
  })
})

describe('groupExceptionsByPerson', () => {
  it('consolidates multiple entries for the same person into one group', () => {
    const entries: Exception[] = [
      { ...baseException, id: 1, name: 'BRIAN TAN', reason: 'Excuse RMJ', end: '2026-01-12' },
      { ...baseException, id: 2, name: 'BRIAN TAN', reason: 'Excuse Live Firing', end: '2026-03-12' },
      { ...baseException, id: 3, name: 'BRIAN TAN', reason: 'Perm Excuse Flags', end: null },
    ]
    const groups = groupExceptionsByPerson(entries)
    expect(groups).toHaveLength(1)
    expect(groups[0].map((e) => e.reason)).toEqual(['Perm Excuse Flags', 'Excuse RMJ', 'Excuse Live Firing'])
  })
  it('keeps different people in separate groups, ordered by first appearance', () => {
    const entries: Exception[] = [
      { ...baseException, id: 1, name: 'BRIAN TAN' },
      { ...baseException, id: 2, name: 'AMOS LEE' },
      { ...baseException, id: 3, name: 'BRIAN TAN' },
    ]
    const groups = groupExceptionsByPerson(entries)
    expect(groups.map((g) => g[0].name)).toEqual(['BRIAN TAN', 'AMOS LEE'])
    expect(groups[0]).toHaveLength(2)
    expect(groups[1]).toHaveLength(1)
  })
  it('single-entry groups are unaffected', () => {
    const entries: Exception[] = [{ ...baseException, id: 1, name: 'AMOS LEE' }]
    expect(groupExceptionsByPerson(entries)).toEqual([entries])
  })
})
