import { describe, it, expect } from 'vitest'
import type { Exception } from '@/shared/types'
import { applyExcludeStayIn, buildExceptionGroups, matchesExceptionQuery, sortExceptions } from '@/backend/domain/parade/exception-table'
import { FIXTURE_SOLDIERS } from '@/tests/fixtures/soldiers'

const ex = (id: number, name: string, scope: string, start: string | null, end: string | null, reason = ''): Exception =>
  ({ id, name, scope, reason, start, end, counts_as_absence: false })

const rows = [
  ex(1, 'TAN WEI LIANG', 'Status', '2026-01-01', '2026-01-10', 'Excuse Stay-In'),
  ex(2, 'GOH RONG HAO', 'Att C', '2026-01-01', '2026-01-03'),
  ex(3, 'TAN WEI LIANG', 'Status', '2026-01-05', null, 'Excuse RMJ'),
]

describe('parade exceptions table', () => {
  it('sorts by scope, then name, then end date with open-ended first', () => {
    expect(sortExceptions(rows).map((e) => e.id)).toEqual([2, 3, 1])
  })

  it('searches name, reason, scope and 4D, case-insensitively', () => {
    const soldiers = FIXTURE_SOLDIERS.map((s) => (s.name === 'GOH RONG HAO' ? { ...s, four_d: '4321' } : s))
    expect(matchesExceptionQuery(rows[1], '4321', soldiers)).toBe(true)
    expect(matchesExceptionQuery(rows[0], 'stay-in', soldiers)).toBe(true)
    expect(matchesExceptionQuery(rows[1], 'leave', soldiers)).toBe(false)
    expect(matchesExceptionQuery(rows[1], '  ', soldiers)).toBe(true)
  })

  it('groups one soldier\'s rows within a scope and sorts groups by a column', () => {
    const groups = buildExceptionGroups(sortExceptions(rows), null, FIXTURE_SOLDIERS)
    expect(groups.map((g) => g.map((e) => e.id))).toEqual([[2], [3, 1]])
    const byStartDesc = buildExceptionGroups(sortExceptions(rows), { column: 'start', dir: 'desc' }, FIXTURE_SOLDIERS)
    expect(byStartDesc[0][0].id).toBe(3)
  })

  it('excluding stay-in marks only stay-in STATUS rows absent', () => {
    const out = applyExcludeStayIn(rows, true)
    expect(out.map((e) => e.counts_as_absence)).toEqual([true, false, false])
    expect(applyExcludeStayIn(rows, false)).toBe(rows)
  })
})
