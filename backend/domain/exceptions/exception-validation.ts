import type { Exception, Soldier } from '@/shared/types'

export const EXCEPTION_SCOPES = ['Att C', 'Status', 'Off/Leave', 'Guard Duty', 'Report Sick', 'MA', 'Others'] as const
export type ExceptionScope = (typeof EXCEPTION_SCOPES)[number]

export const SINGLE_DATE_SCOPES: ExceptionScope[] = ['Report Sick', 'MA', 'Guard Duty']

// Scopes that carry an optional IN/OUT (of camp) marker in the new parade-state format.
export const IN_OUT_SCOPES: ExceptionScope[] = ['Att C', 'Report Sick', 'MA', 'Others']

// Scopes that print an optional "@ <location>" suffix in the new parade-state format.
export const LOCATION_PRINT_SCOPES: ExceptionScope[] = ['MA', 'Others']

export type ExForm = { name: string; scope: ExceptionScope; reason: string; start: string; end: string; counts_as_absence: boolean; time: string; location: string; in_out: '' | 'IN' | 'OUT' }
export type StatusRow = { start: string; end: string; reason: string }

/** True for an empty or "HH:MM" time. */
export function isValidTime(t: string): boolean {
  if (!t) return true
  const m = t.match(/^(\d{2}):(\d{2})$/)
  return !!m && +m[1] <= 23 && +m[2] <= 59
}

/** True when the add form can be submitted: soldier picked, STATUS reasons unique, time valid. */
export function isExceptionValid(exForm: ExForm, statusRows: StatusRow[]): boolean {
  if (!exForm.name) return false
  if (exForm.scope === 'Status') {
    const reasons = statusRows.map((r) => r.reason.trim().toLowerCase()).filter((r) => r)
    return new Set(reasons).size === reasons.length
  }
  return isValidTime(exForm.time)
}

/** Field errors for the add-exception form. */
export function validateAddEx(exForm: ExForm): Record<string, boolean> {
  const errors: Record<string, boolean> = {}
  if (!exForm.name) errors.name = true
  if (exForm.scope === 'MA' && !isValidTime(exForm.time)) errors.time = true
  return errors
}

/** True when the edited exception can be saved. */
export function isEditExceptionValid(editEx: Exception | null): boolean {
  if (!editEx) return false
  if (!editEx.name) return false
  if (editEx.scope === 'MA' && !isValidTime(editEx.time ?? '')) return false
  return true
}

/** Field errors for an edited exception. */
export function validateEditEx(editEx: Exception | null): Record<string, boolean> {
  if (!editEx) return { name: true }
  const errors: Record<string, boolean> = {}
  if (!editEx.name) errors.name = true
  if (editEx.scope === 'MA' && !isValidTime(editEx.time ?? '')) errors.time = true
  return errors
}

/** The value an exception sorts by for a table column. */
export function exceptionSortValue(
  e: Exception, key: 'four_d' | 'name' | 'scope' | 'reason' | 'start' | 'end', soldiers: Soldier[],
): string | number {
  switch (key) {
    case 'four_d': return (soldiers.find((s) => s.name === e.name)?.four_d ?? '').toLowerCase()
    case 'name': return e.name.toLowerCase()
    case 'scope': return (e.scope ?? '').toLowerCase()
    case 'reason': return (e.reason ?? '').toLowerCase()
    case 'start': return new Date(e.start ?? 0).getTime()
    case 'end': return new Date(e.end ?? 0).getTime()
  }
}

/** Orders by end date, open-ended first. */
export function compareExceptionOrder(a: Exception, b: Exception): number {
  if (!a.end && !b.end) return 0
  if (!a.end) return -1
  if (!b.end) return 1
  return new Date(a.end).getTime() - new Date(b.end).getTime()
}

/** Groups entries by soldier name in first-seen order, each group sorted by end date. */
export function groupExceptionsByPerson(entries: Exception[]): Exception[][] {
  const order: string[] = []
  const byName = new Map<string, Exception[]>()
  for (const e of entries) {
    if (!byName.has(e.name)) { byName.set(e.name, []); order.push(e.name) }
    byName.get(e.name)!.push(e)
  }
  return order.map((name) => [...byName.get(name)!].sort(compareExceptionOrder))
}
