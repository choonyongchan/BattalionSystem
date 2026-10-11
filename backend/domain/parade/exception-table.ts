import type { Exception, Soldier } from '@/shared/types'
import { compareExceptionOrder, exceptionSortValue, groupExceptionsByPerson } from '@/backend/domain/exceptions/exception-validation'

/** Column sort applied to the parade-state exceptions table; null = default order. */
export type ExceptionSort = { column: 'start' | 'end'; dir: 'asc' | 'desc' } | null

const STAY_IN = /stay[\s-]?in/i

/** Sorts exceptions by scope, then name, then end date (open-ended first). */
export function sortExceptions(exceptions: Exception[]): Exception[] {
  return [...exceptions].sort((a, b) =>
    (a.scope ?? '').toLowerCase().localeCompare((b.scope ?? '').toLowerCase())
    || a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    || compareExceptionOrder(a, b))
}

/** True when the search text appears in the exception's name, reason, scope or the soldier's 4D. */
export function matchesExceptionQuery(e: Exception, query: string, soldiers: Soldier[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const fourD = soldiers.find((s) => s.name === e.name)?.four_d ?? ''
  return [e.name, e.reason, e.scope, fourD].some((v) => (v ?? '').toLowerCase().includes(q))
}

/**
 * Groups rows (already sorted by sortExceptions) into one group per scope and person,
 * then orders the groups by the chosen column using each group's first row.
 */
export function buildExceptionGroups(rows: Exception[], sort: ExceptionSort, soldiers: Soldier[]): Exception[][] {
  const groups: Exception[][] = []
  let chunk: Exception[] = []
  for (const e of rows) {
    if (chunk.length && chunk[0].scope !== e.scope) {
      groups.push(...groupExceptionsByPerson(chunk))
      chunk = []
    }
    chunk.push(e)
  }
  if (chunk.length) groups.push(...groupExceptionsByPerson(chunk))
  if (sort) {
    groups.sort((a, b) => {
      const av = exceptionSortValue(a[0], sort.column, soldiers) as number
      const bv = exceptionSortValue(b[0], sort.column, soldiers) as number
      return sort.dir === 'asc' ? av - bv : bv - av
    })
  }
  return groups
}

/** When excluding stay-in personnel, marks their "stay in" STATUS rows as absences. */
export function applyExcludeStayIn(exceptions: Exception[], exclude: boolean): Exception[] {
  if (!exclude) return exceptions
  return exceptions.map((e) => (e.scope === 'Status' && STAY_IN.test(e.reason ?? '') ? { ...e, counts_as_absence: true } : e))
}
