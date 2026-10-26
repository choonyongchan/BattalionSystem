import type { Exception, Soldier } from '@/shared/types'
import type { ExceptionScope } from './exception-validation'
import { daysBetween, offsetDate } from '@/shared/dates'

/**
 * The fine-grained kinds within each parade section. `scope` decides where a
 * row prints; `type` says what it actually is — an MC and a hospitalisation
 * both print under ATT C, but only the type tells an LD from an Excuse inside
 * STATUS (which conducts and the MC+1/LD+1 windows need).
 */
export const SCOPE_TYPES: Record<ExceptionScope, readonly string[]> = {
  'Att C': ['MC'],
  Status: ['LD', 'RMJ', 'Excuse'],
  // URTI is split out for the RSI report; 'Report Sick' is the non-URTI rest
  'Report Sick': ['Report Sick', 'URTI', 'Medical Review'],
  MA: ['MA'],
  'Off/Leave': ['Leave', 'Off'],
  Others: ['Others', 'Course'],
}

/**
 * Stored type, else a guess from scope and reason (the old one-off DB backfill's rule)
 * — rows written by the pre-type app still arrive without one.
 */
export function exceptionType(e: Exception): string {
  if (e.type) return e.type
  const reason = e.reason ?? ''
  switch (e.scope) {
    case 'Att C': return 'MC'
    case 'Status':
      if (/\bLD\b|light\s*duty/i.test(reason)) return 'LD'
      if (/\bRMJ\b/i.test(reason)) return 'RMJ'
      return 'Excuse'
    case 'Off/Leave': return /leave/i.test(reason) ? 'Leave' : 'Off'
    default: return e.scope
  }
}

/**
 * The soldier link and fine-grained type every exception write carries, so rows stay tied
 * to the soldier through a rename. Keeps `currentType` when it is still valid for `scope`.
 */
export function exceptionLinkFields(
  soldiers: Soldier[], name: string, scope: string, reason: string | null, currentType?: string | null,
): { soldier_id: string | null; type: string } {
  const soldier = soldiers.find((s) => s.name === name)
  const keepType = currentType && SCOPE_TYPES[scope as ExceptionScope]?.includes(currentType)
  return {
    soldier_id: soldier?.id ?? null,
    type: keepType ? currentType : exceptionType({ scope, reason } as Exception),
  }
}

/** True when the exception was revoked. */
export const isRevoked = (e: Exception): boolean => !!e.revoked_at

/** The one "does this count on that day" check. Missing start/end = open on that side; revoked = never. */
export function isActiveOn(e: Exception, dateISO: string): boolean {
  if (isRevoked(e)) return false
  if (e.start && dateISO < e.start) return false
  if (e.end && dateISO > e.end) return false
  return true
}

/** Only an explicit false posts a soldier out — older rows and fixtures stay on strength. */
export const isOnStrength = (s: Soldier): boolean => s.on_strength !== false

/** A soldier's key: the uuid, or `name:<NAME>` for rows that predate it. */
export const soldierKeyOf = (s: Soldier): string => s.id ?? `name:${s.name}`

export interface SoldierIndex {
  byKey: Map<string, Soldier>
  byName: Map<string, Soldier>
}

/** Indexes soldiers by id and by name for exception lookups. */
export function soldierIndex(soldiers: Soldier[]): SoldierIndex {
  return {
    byKey: new Map(soldiers.map((s) => [soldierKeyOf(s), s])),
    byName: new Map(soldiers.map((s) => [s.name, s])),
  }
}

/**
 * Which soldier an exception belongs to. soldier_id is the truth; rows without
 * one (old app, or unlinked when the roll was cleared and re-imported) match by
 * name, and a name nobody has keys to itself so it is still shown somewhere.
 */
export function exceptionSoldierKey(e: Exception, idx: SoldierIndex): string {
  if (e.soldier_id) return e.soldier_id
  const s = idx.byName.get(e.name)
  return s ? soldierKeyOf(s) : `name:${e.name}`
}

/** The soldier an exception belongs to, by id then by name. */
export function soldierOf(e: Exception, idx: SoldierIndex): Soldier | undefined {
  return idx.byKey.get(exceptionSoldierKey(e, idx))
}

/** Soldier key → that soldier's exceptions active on dateISO. */
export function buildActiveMap(exceptions: Exception[], soldiers: Soldier[], dateISO: string): Map<string, Exception[]> {
  const idx = soldierIndex(soldiers)
  const map = new Map<string, Exception[]>()
  for (const e of exceptions) {
    if (!isActiveOn(e, dateISO)) continue
    const key = exceptionSoldierKey(e, idx)
    const list = map.get(key)
    if (list) list.push(e)
    else map.set(key, [e])
  }
  return map
}

/** Events, not stretches: two report sicks back to back are two, not one long one. */
const NEVER_MERGED = new Set(['Report Sick', 'URTI'])

/** "3D MC" → "MC": the day count is one row's length, not the exception's identity. */
const DAYS_PREFIX = /^\s*\d+\s*D\s+/i

/** Rows with the same key belong to one run: same soldier, scope, absence and reason. */
function runKey(e: Exception): string {
  const reason = (e.reason ?? '').replace(DAYS_PREFIX, '').trim().toUpperCase()
  return `${e.soldier_id ?? `name:${e.name}`}|${exceptionType(e)}|${reason}|${e.counts_as_absence}`
}

/**
 * Folds a soldier's back-to-back rows of the same exception into one, so an MC
 * extended by another MC prints once over the whole stretch. Rows continue a
 * run when they overlap, touch or sit a day apart; presence (counts_as_absence)
 * must agree or the merge would count him absent on days he was here. Revoked
 * rows are dropped first, so a revoked leg can't bridge two separate runs.
 */
export function mergeRuns(exceptions: Exception[]): Exception[] {
  const out: Exception[] = []
  const groups = new Map<string, Exception[]>()
  for (const e of exceptions) {
    if (isRevoked(e)) continue
    if (NEVER_MERGED.has(exceptionType(e)) || !e.start) {
      out.push(e)
      continue
    }
    const key = runKey(e)
    const g = groups.get(key)
    if (g) g.push(e)
    else groups.set(key, [e])
  }

  for (const group of groups.values()) {
    // '9' sorts after any date: open ends last within a start
    const sorted = [...group].sort((a, b) => a.start!.localeCompare(b.start!) || (a.end ?? '9').localeCompare(b.end ?? '9'))
    let run: Exception[] = [sorted[0]]
    let end = sorted[0].end
    /** Emits the current run as one merged row. */
    const flush = () => out.push(foldRun(run, end))
    for (const e of sorted.slice(1)) {
      // An open-ended run swallows everything after it
      if (end === null || e.start! <= offsetDate(end, 1)) {
        run.push(e)
        if (end !== null && (e.end === null || e.end > end)) end = e.end
      } else {
        flush()
        run = [e]
        end = e.end
      }
    }
    flush()
  }
  return out
}

/** Merges a run of back-to-back rows into one row ending at `end`. */
function foldRun(rows: Exception[], end: string | null): Exception {
  const base = rows[0]
  if (rows.length === 1) return base
  const reason =
    base.reason && end && DAYS_PREFIX.test(base.reason)
      ? base.reason.replace(DAYS_PREFIX, `${daysBetween(base.start!, end) + 1}D `)
      : base.reason
  return { ...base, end, reason }
}
