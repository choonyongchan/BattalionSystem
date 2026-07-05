import type { Exception, Soldier } from './supabase'

export const EXCEPTION_SCOPES = ['Att C', 'Status', 'Off/Leave', 'Guard Duty', 'Report Sick', 'MA', 'Others'] as const
export type ExceptionScope = (typeof EXCEPTION_SCOPES)[number]

export const SINGLE_DATE_SCOPES: ExceptionScope[] = ['Report Sick', 'MA', 'Guard Duty']

export type ExForm = { name: string; scope: ExceptionScope; reason: string; start: string; end: string; counts_as_absence: boolean; time: string }
export type StatusRow = { start: string; end: string; reason: string }

export function isValidTime(t: string): boolean {
  if (!t) return true
  const m = t.match(/^(\d{2}):(\d{2})$/)
  return !!m && +m[1] <= 23 && +m[2] <= 59
}

export function buildReason(mainReason: string, medCenterVal: string, scope: ExceptionScope): string | null {
  const r = mainReason.trim()
  if (scope !== 'MA') return r || null
  const mc = medCenterVal.trim()
  if (mc && r) return `${mc}: ${r}`
  return mc || r || null
}

export function isExceptionValid(exForm: ExForm, statusRows: StatusRow[]): boolean {
  if (!exForm.name) return false
  if (exForm.scope === 'Status') {
    const reasons = statusRows.map((r) => r.reason.trim().toLowerCase()).filter((r) => r)
    return new Set(reasons).size === reasons.length
  }
  return isValidTime(exForm.time)
}

export function validateAddEx(exForm: ExForm): Record<string, boolean> {
  const errors: Record<string, boolean> = {}
  if (!exForm.name) errors.name = true
  if (exForm.scope === 'MA' && !isValidTime(exForm.time)) errors.time = true
  return errors
}

export function isEditExceptionValid(editEx: Exception | null): boolean {
  if (!editEx) return false
  if (!editEx.name) return false
  if (editEx.scope === 'MA' && !isValidTime(editEx.time ?? '')) return false
  return true
}

export function validateEditEx(editEx: Exception | null): Record<string, boolean> {
  if (!editEx) return { name: true }
  const errors: Record<string, boolean> = {}
  if (!editEx.name) errors.name = true
  if (editEx.scope === 'MA' && !isValidTime(editEx.time ?? '')) errors.time = true
  return errors
}

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

export function strWarn(
  platoon: string, rt: string,
  strOverrides: Record<string, Record<string, string>>,
  computedStrength: Record<string, Record<string, number>>,
): string | null {
  const raw = strOverrides[platoon]?.[rt]
  if (!raw && raw !== '0') return null
  const override = Number(raw)
  if (isNaN(override)) return null
  const computed = computedStrength[platoon]?.[rt] ?? 0
  if (override !== computed) return `Nominal roll has ${computed} – override is ${override}`
  return null
}

export function anyMismatch(
  platoons: readonly string[], rankTypes: readonly string[],
  strOverrides: Record<string, Record<string, string>>,
  computedStrength: Record<string, Record<string, number>>,
): boolean {
  return platoons.some((p) => rankTypes.some((rt) => strWarn(p, rt, strOverrides, computedStrength) !== null))
}
