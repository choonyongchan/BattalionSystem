import type { Soldier, Exception, DutyEntry } from '@/shared/types'
import { displayDutyName } from '@/shared/names'
import { STD_SCOPES, type PlatoonBlock } from '@/shared/companies'
import { getRankType, RANK_TYPES, RANK_INDEX } from '@/shared/ranks'
import { SINGLE_DATE_SCOPES, LOCATION_PRINT_SCOPES, type ExceptionScope } from '@/backend/domain/exceptions/exception-validation'
import { exceptionSoldierKey, isOnStrength, isRevoked, mergeRuns, soldierIndex, soldierKeyOf, soldierOf, type SoldierIndex } from '@/backend/domain/exceptions/active'
import { BASE_DUTY_TYPES } from '@/backend/domain/settings/settings'
import { ddmmyy } from '@/shared/dates'

/** What the report prints for a company: its name and the platoon blocks under COY HQ. */
export interface ParadeConfig {
  companyName: string
  platoons: PlatoonBlock[]
  /** Scopes whose lines end IN or OUT, from counts_as_absence. */
  inOutScopes: string[]
}

/** The data one parade state is built from. */
export interface ParadeReportInput {
  /** ISO date of the parade. */
  date: string
  /** The whole roll, posted-out included, so their exceptions can be dropped too. */
  soldiers: Soldier[]
  /** Exceptions active on `date`. */
  activeExceptions: Exception[]
  /** "HH:MM", or '' when unset. */
  paradeTimeStr: string
  /** That day's duty roster. */
  duties: DutyEntry[]
  paradeType?: 'First Parade' | 'Last Parade'
}

const SECTION_SEP = '================================'
const BLOCK_SEP   = '--------------------------------'

/** Orders by rank (senior first), then 4D (missing last), then name. */
function sortExceptions(exceptions: Exception[], idx: SoldierIndex): Exception[] {
  /** Seniority of an exception's soldier; -1 when unknown. */
  const seniority = (e: Exception) => RANK_INDEX[soldierOf(e, idx)?.rank ?? ''] ?? -1
  const fourD = (e: Exception) => soldierOf(e, idx)?.four_d || '￿'
  return [...exceptions].sort((a, b) =>
    seniority(b) - seniority(a)
    || fourD(a).localeCompare(fourD(b), undefined, { numeric: true })
    || a.name.localeCompare(b.name))
}

/** "present/total" overall and per rank type for some soldiers. */
function strength(soldiers: Soldier[], absentKeys: Set<string>) {
  /** Present and total among `group`. */
  const count = (group: Soldier[]) => {
    const absent = group.filter((s) => absentKeys.has(soldierKeyOf(s))).length
    return `${group.length - absent}/${group.length}`
  }
  return { all: count(soldiers), byType: RANK_TYPES.map((rt) => [rt, count(soldiers.filter((s) => getRankType(s.rank) === rt))] as const) }
}

/** Date suffix, e.g. "(010326-030326)", "(SINCE 010326)", or one date (plus MA time) for single-day scopes. */
function formatDates(e: Exception): string {
  if (SINGLE_DATE_SCOPES.includes(e.scope as ExceptionScope)) {
    const d = e.end ?? e.start
    if (!d) return ''
    let s = ddmmyy(d)
    if (e.scope === 'MA' && e.time) s += ` ${e.time.replace(':', '')}`
    return `(${s})`
  }
  if (e.start && !e.end) return `(SINCE ${ddmmyy(e.start)})`
  if (e.start && e.end) return `(${ddmmyy(e.start)}-${ddmmyy(e.end)})`
  if (e.end) return `(${ddmmyy(e.end)})`
  return ''
}

/** Reason text; MA prints as "MA (reason)". */
function formatDescription(e: Exception): string {
  const reason = e.reason ?? ''
  if (e.scope === 'MA') return reason ? `MA (${reason})` : 'MA'
  return reason
}

/** One numbered line: 4D, rank, name, description, dates, then in/out and location where printed. */
function formatExceptionLine(e: Exception, n: number, idx: SoldierIndex, inOutScopes: string[]): string {
  // The soldier's current name and rank, so a rename on the roll shows through
  const soldier = soldierOf(e, idx)
  const fourD = soldier?.four_d ?? ''
  const identity = soldier ? `${soldier.rank} ${soldier.name}` : e.name
  const parts = [formatDescription(e), formatDates(e)].filter(Boolean).join(' ')
  let line = `${n + 1}. ${fourD ? `${fourD} ` : ''}${identity} - ${parts}`
  if (inOutScopes.includes(e.scope)) line += e.counts_as_absence ? ' OUT' : ' IN'
  if (LOCATION_PRINT_SCOPES.includes(e.scope as ExceptionScope) && e.location) line += ` @ ${e.location}`
  return line
}

/**
 * Renders the parade-state text in the battalion-wide format (see docs/parade-state-template.md):
 * header, duties, company strength, then COY HQ and each platoon block with its exceptions.
 * Posted-out soldiers and their exceptions drop out; revoked rows drop and back-to-back runs merge.
 */
export function generateParadeReport(input: ParadeReportInput, config: ParadeConfig): string {
  const allIdx = soldierIndex(input.soldiers)
  const soldiers = input.soldiers.filter(isOnStrength)
  const idx = soldierIndex(soldiers)
  const active = sortExceptions(mergeRuns(input.activeExceptions.filter((e) => {
    if (isRevoked(e)) return false
    const s = soldierOf(e, allIdx)
    return !s || isOnStrength(s)
  })), idx)
  const absentKeys = new Set(active.filter((e) => e.counts_as_absence).map((e) => exceptionSoldierKey(e, idx)))
  const dutyMap = Object.fromEntries(input.duties.map((d) => [d.duty_type, d.name ?? '']))
  /** Display name of today's holder of a duty, or '-'. */
  const dutyName = (type: string) => displayDutyName(dutyMap[type] ?? '', soldiers) || '-'

  const company = strength(soldiers, absentKeys)
  const lines = [
    `40 SAR ${config.companyName} COMPANY`,
    `${(input.paradeType ?? 'First Parade').toUpperCase()} STATE`,
    `DATE: ${ddmmyy(input.date)} TIME: ${input.paradeTimeStr.replace(':', '')}`,
    ...BASE_DUTY_TYPES.map((t) => `${t}: ${dutyName(t)}`),
    ...config.platoons.map((p, i) => `${p.pdsLabel}: ${dutyName(`PDS${i + 1}`)}`),
    SECTION_SEP,
    `COMPANY: ${company.all}`,
    ...company.byType.map(([rt, s]) => `${rt.toUpperCase()}: ${s}`),
    SECTION_SEP,
  ]

  const blocks = [{ key: 'HQ', label: 'COY HQ' }, ...config.platoons]
  blocks.forEach(({ key, label }, i) => {
    if (i > 0) lines.push(BLOCK_SEP)
    // An exception whose soldier can't be found still prints, under COY HQ
    const group = active.filter((e) => (soldierOf(e, idx)?.platoon ?? 'HQ') === key)
    const block = strength(soldiers.filter((s) => s.platoon === key), absentKeys)
    lines.push(`${label}: ${block.all}`, ...block.byType.map(([rt, s]) => `${rt.toUpperCase()}: ${s}`))
    for (const { key: scope, label: scopeLabel } of STD_SCOPES) {
      const scoped = group.filter((e) => e.scope === scope)
      lines.push(`${scopeLabel}: ${scoped.length}`, ...scoped.map((e, n) => formatExceptionLine(e, n, idx, config.inOutScopes)))
    }
  })
  return lines.join('\n')
}
