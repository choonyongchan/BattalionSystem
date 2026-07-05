import { describe, it, expect } from 'vitest'
import {
  isValidTime, buildReason, isExceptionValid, validateAddEx,
  isEditExceptionValid, validateEditEx, exceptionSortValue, strWarn, anyMismatch,
} from '@/lib/exception-validation'
import type { ExForm } from '@/lib/exception-validation'
import type { Exception, Soldier } from '@/lib/supabase'

describe('isValidTime', () => {
  it('accepts empty string', () => expect(isValidTime('')).toBe(true))
  it('accepts a valid HH:MM', () => expect(isValidTime('23:59')).toBe(true))
  it('rejects hour > 23', () => expect(isValidTime('24:00')).toBe(false))
  it('rejects minute > 59', () => expect(isValidTime('12:60')).toBe(false))
  it('rejects malformed input', () => expect(isValidTime('noon')).toBe(false))
})

describe('buildReason', () => {
  it('non-MA scope returns trimmed reason or null', () => {
    expect(buildReason('  Flu  ', '', 'Att C')).toBe('Flu')
    expect(buildReason('  ', '', 'Att C')).toBeNull()
  })
  it('MA scope with both med center and reason joins them', () => {
    expect(buildReason('Skin Appt', 'IMH', 'MA')).toBe('IMH: Skin Appt')
  })
  it('MA scope with only med center or only reason returns whichever is set', () => {
    expect(buildReason('', 'IMH', 'MA')).toBe('IMH')
    expect(buildReason('Skin Appt', '', 'MA')).toBe('Skin Appt')
  })
  it('MA scope with neither returns null', () => {
    expect(buildReason('', '', 'MA')).toBeNull()
  })
})

const baseExForm: ExForm = { name: 'TAN AH KOW', scope: 'Off/Leave', reason: '', start: '2026-01-01', end: '2026-01-01', counts_as_absence: true, time: '' }

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

describe('strWarn / anyMismatch', () => {
  const computedStrength = { HQ: { Officer: 2 }, '1': { Officer: 1 } }

  it('no override means no warning', () => {
    expect(strWarn('HQ', 'Officer', {}, computedStrength)).toBeNull()
  })
  it('override matching computed strength means no warning', () => {
    expect(strWarn('HQ', 'Officer', { HQ: { Officer: '2' } }, computedStrength)).toBeNull()
  })
  it('override mismatching computed strength warns', () => {
    expect(strWarn('HQ', 'Officer', { HQ: { Officer: '5' } }, computedStrength)).toContain('has 2')
  })
  it('anyMismatch is true if any platoon/rank pair mismatches', () => {
    const overrides = { HQ: { Officer: '2' }, '1': { Officer: '99' } }
    expect(anyMismatch(['HQ', '1'], ['Officer'], overrides, computedStrength)).toBe(true)
    expect(anyMismatch(['HQ'], ['Officer'], overrides, computedStrength)).toBe(false)
  })
})
