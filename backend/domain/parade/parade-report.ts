import type { Soldier, Exception, DutyEntry } from '@/shared/types'
import { displayDutyName } from '@/shared/names'
import type { ParadeStateConfig, Company } from '@/shared/companies'
import { getRankType, RANK_TYPES, RANK_ORDER } from '@/shared/ranks'
import { STD_SCOPES } from '@/shared/companies'
import { SINGLE_DATE_SCOPES, IN_OUT_SCOPES, LOCATION_PRINT_SCOPES } from '@/backend/domain/exceptions/exception-validation'
import { exceptionSoldierKey, isOnStrength, isRevoked, mergeRuns, soldierIndex, soldierKeyOf, soldierOf, type SoldierIndex } from '@/backend/domain/exceptions/active'

/** Compares ISO dates, nulls first. */
function compareOptionalDate(a: string | null, b: string | null): number {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  return new Date(a).getTime() - new Date(b).getTime()
}

/** Orders by end date, then start date (nulls first), then seniority, then name. */
function sortExceptions(exceptions: Exception[], idx: SoldierIndex): Exception[] {
  return [...exceptions].sort((a, b) => {
    const endDiff = compareOptionalDate(a.end, b.end)
    if (endDiff !== 0) return endDiff
    const startDiff = compareOptionalDate(a.start, b.start)
    if (startDiff !== 0) return startDiff
    const rankA = soldierOf(a, idx)?.rank ?? ''
    const rankB = soldierOf(b, idx)?.rank ?? ''
    const rankDiff = RANK_ORDER.indexOf(rankB) - RANK_ORDER.indexOf(rankA)
    if (rankDiff !== 0) return rankDiff
    return a.name.localeCompare(b.name)
  })
}

export interface ParadeReportInput {
  date: string
  companyLabel: string
  soldiers: Soldier[]
  activeExceptions: Exception[]
  paradeTimeStr: string
  duties: DutyEntry[]
  strengthOverrides?: Record<string, Record<string, number>>
  generatedAt?: Date
  allExceptions?: Exception[]
  paradeType?: 'First Parade' | 'Last Parade'
}

const SECTION_SEP = '================================'
const BLOCK_SEP   = '--------------------------------'

const RANK_LABELS: Record<string, string> = { Officer: 'OFFICER', WOSPEC: 'WOSPEC', Enlistee: 'ENLISTEE' }

/** Formats an ISO date as DDMMYY. */
function toDDMMYY(iso: string) {
  const d = new Date(iso)
  return (
    d.getDate().toString().padStart(2, '0') +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    d.getFullYear().toString().slice(2)
  )
}


/** A platoon's strength for one rank type: the override if set, else the roll count. */
function platTotal(soldiers: Soldier[], plt: string, rt: string, overrides: Record<string, Record<string, number>>) {
  return overrides[plt]?.[rt] ?? soldiers.filter((s) => s.platoon === plt && getRankType(s.rank) === rt).length
}

/** A platoon's present count for one rank type: strength minus absentees. */
function platPresent(
  soldiers: Soldier[], plt: string, rt: string,
  absentKeys: Set<string>, overrides: Record<string, Record<string, number>>,
) {
  const total  = platTotal(soldiers, plt, rt, overrides)
  const absent = soldiers.filter((s) => s.platoon === plt && getRankType(s.rank) === rt && absentKeys.has(soldierKeyOf(s))).length
  return total - absent
}

/** Company total and present counts per rank type, with overrides applied. */
function computeStrength(soldiers: Soldier[], absentKeys: Set<string>, overrides: Record<string, Record<string, number>>) {
  const compTotal: Record<string, number> = {}
  const compPresent: Record<string, number> = {}
  for (const rt of RANK_TYPES) {
    compTotal[rt]   = overrides['Total']?.[rt] ?? soldiers.filter((s) => getRankType(s.rank) === rt).length
    const absent    = soldiers.filter((s) => absentKeys.has(soldierKeyOf(s)) && getRankType(s.rank) === rt).length
    compPresent[rt] = compTotal[rt] - absent
  }
  const total   = RANK_TYPES.reduce((s, rt) => s + compTotal[rt], 0)
  const present = RANK_TYPES.reduce((s, rt) => s + compPresent[rt], 0)
  return { compTotal, compPresent, total, present }
}

/** Groups exceptions by their soldier's platoon; unmatched soldiers go under HQ. */
function groupByPlatoon(exceptions: Exception[], idx: SoldierIndex): Record<string, Exception[]> {
  const result: Record<string, Exception[]> = { HQ: [], '1': [], '2': [], '3': [], '4': [] }
  for (const e of exceptions) {
    // An exception whose soldier can't be found still prints, under COY HQ
    const plt = soldierOf(e, idx)?.platoon ?? 'HQ'
    ;(result[plt] ?? (result[plt] = [])).push(e)
  }
  return result
}

/** Present / total per platoon. */
function computePlatoonTotals(
  soldiers: Soldier[], plt: string, absentSet: Set<string>, overrides: Record<string, Record<string, number>>,
) {
  const pltTotal   = RANK_TYPES.reduce((s, rt) => s + platTotal(soldiers, plt, rt, overrides), 0)
  const pltPresent = RANK_TYPES.reduce((s, rt) => s + platPresent(soldiers, plt, rt, absentSet, overrides), 0)
  return { pltTotal, pltPresent }
}

// ── Exception line formatting ────────────────────────────────────────────

/** Date suffix, e.g. "(010326-030326)", "(SINCE 010326)", or one date (plus MA time) for single-day scopes. */
function formatDates(e: Exception): string {
  if (SINGLE_DATE_SCOPES.includes(e.scope as (typeof SINGLE_DATE_SCOPES)[number])) {
    const d = e.end ?? e.start
    if (!d) return ''
    let s = toDDMMYY(d)
    if (e.scope === 'MA' && e.time) s += ` ${e.time.replace(':', '')}`
    return `(${s})`
  }
  if (e.start && !e.end) return `(SINCE ${toDDMMYY(e.start)})`
  if (e.start && e.end) return `(${toDDMMYY(e.start)}-${toDDMMYY(e.end)})`
  if (e.end) return `(${toDDMMYY(e.end)})`
  return ''
}

/** Reason text; MA prints as "MA (reason)". */
function formatDescription(e: Exception): string {
  const reason = e.reason ?? ''
  if (e.scope === 'MA') return reason ? `MA (${reason})` : 'MA'
  return reason
}

/** One numbered line: 4D, rank, name, description, dates, then in/out and location where printed. */
function formatExceptionLine(e: Exception, n: number, idx: SoldierIndex): string {
  // The soldier's current name and rank, so a rename on the roll shows through
  const soldier = soldierOf(e, idx)
  const fourD = soldier?.four_d ?? ''
  const identity = soldier ? `${soldier.rank} ${soldier.name}` : e.name
  const parts = [formatDescription(e), formatDates(e)].filter(Boolean).join(' ')
  let line = `${n + 1}. ${fourD ? `${fourD} ` : ''}${identity} - ${parts}`
  if (IN_OUT_SCOPES.includes(e.scope as (typeof IN_OUT_SCOPES)[number]) && e.in_out) line += ` ${e.in_out}`
  if (LOCATION_PRINT_SCOPES.includes(e.scope as (typeof LOCATION_PRINT_SCOPES)[number]) && e.location) line += ` @ ${e.location}`
  return line
}

// ── Unified renderer ─────────────────────────────────────────────────────

/** Renders the parade state text: header, duties, strength, then each platoon block. */
function generateReport(input: ParadeReportInput, config: ParadeStateConfig): string {
  const { date, soldiers, activeExceptions, paradeTimeStr, duties } = input
  const overrides   = input.strengthOverrides ?? {}
  const dateCompact = toDDMMYY(date)
  const idx         = soldierIndex(soldiers)
  const absentKeys  = new Set(activeExceptions.filter((e) => e.counts_as_absence).map((e) => exceptionSoldierKey(e, idx)))
  const { compTotal, compPresent, total, present } = computeStrength(soldiers, absentKeys, overrides)
  const dutyMap = Object.fromEntries(duties.map((d) => [d.duty_type, d.name ?? '']))
  const exByPlt = groupByPlatoon(activeExceptions, idx)

  const lines: string[] = []
  lines.push(`40 SAR ${config.companyName} COMPANY`)
  lines.push(`${(input.paradeType ?? 'First Parade').toUpperCase()} STATE`)
  lines.push(`DATE: ${dateCompact} TIME: ${paradeTimeStr ? paradeTimeStr.replace(':', '') : ''}`)

  /** Display name of today's holder of a duty, or '-'. */
  const dutyName = (type: string) => displayDutyName(dutyMap[type] ?? '', soldiers) || '-'
  ;['CDO', 'CDS', 'COS'].filter((t) => config.visibleDutyTypes.includes(t)).forEach((t) => lines.push(`${t}: ${dutyName(t)}`))
  config.platoons.forEach((p, i) => {
    const type = `PDS${i + 1}`
    if (!config.visibleDutyTypes.includes(type)) return
    lines.push(`${p.pdsLabel}: ${dutyName(type)}`)
  })

  lines.push(SECTION_SEP)
  lines.push(`COMPANY: ${present}/${total}`)
  for (const rt of RANK_TYPES) lines.push(`${RANK_LABELS[rt]}: ${compPresent[rt]}/${compTotal[rt]}`)
  lines.push(SECTION_SEP)

  /** Appends one platoon block's strength and exception sections. */
  function renderBlock(pltKey: string, label: string) {
    const group      = exByPlt[pltKey] ?? []
    const pltAbsent  = new Set(group.filter((e) => e.counts_as_absence).map((e) => exceptionSoldierKey(e, idx)))
    const { pltTotal, pltPresent } = computePlatoonTotals(soldiers, pltKey, pltAbsent, overrides)

    lines.push(`${label}: ${pltPresent}/${pltTotal}`)
    for (const rt of RANK_TYPES) {
      lines.push(`${RANK_LABELS[rt]}: ${platPresent(soldiers, pltKey, rt, pltAbsent, overrides)}/${platTotal(soldiers, pltKey, rt, overrides)}`)
    }
    for (const { key, label: scopeLabel } of STD_SCOPES) {
      const scopeGroup = group.filter((e) => e.scope === key)
      lines.push(`${scopeLabel}: ${scopeGroup.length}`)
      scopeGroup.forEach((e, n) => lines.push(formatExceptionLine(e, n, idx)))
    }
  }

  renderBlock('HQ', 'COY HQ')
  config.platoons.forEach((p) => {
    lines.push(BLOCK_SEP)
    renderBlock(p.key, p.label)
  })

  return lines.join('\n')
}

// ── Dispatch ──────────────────────────────────────────────────────────────

/**
 * Renders the parade-state text report for a company, using the single
 * battalion-wide format shared by every company (see parade_state_template_new.md).
 *
 * @param input - Report data (soldiers, exceptions, duties, strength overrides).
 * @param config - Per-company parade-state config (company name, platoon blocks, visible duty types).
 * @param _company - Unused; kept for call-site compatibility.
 * @returns The fully formatted report as a newline-joined string.
 */
export function generateParadeReport(input: ParadeReportInput, config: ParadeStateConfig, _company?: Company): string {
  // Posted-out soldiers drop out of strength, and so do their exceptions
  const allIdx = soldierIndex(input.soldiers)
  const soldiers = input.soldiers.filter(isOnStrength)
  const idx = soldierIndex(soldiers)
  /** Drops revoked rows and merges back-to-back ones. */
  const live = (list: Exception[]) => {
    const kept = list.filter((e) => {
      if (isRevoked(e)) return false
      const s = soldierOf(e, allIdx)
      return !s || isOnStrength(s)
    })
    return sortExceptions(mergeRuns(kept), idx)
  }
  const sorted: ParadeReportInput = {
    ...input,
    soldiers,
    activeExceptions: live(input.activeExceptions),
    allExceptions: input.allExceptions ? live(input.allExceptions) : undefined,
  }
  return generateReport(sorted, config)
}
