import type { Soldier, Exception, DutyEntry } from '../supabase'
import { displayName, displayDutyName } from '../supabase'
import type { ParadeStateConfig, Company } from '../companies'
import { getRankType, RANK_TYPES, RANK_ORDER, STD_SCOPES } from '../companies'
import { SINGLE_DATE_SCOPES, IN_OUT_SCOPES, LOCATION_PRINT_SCOPES } from '../exceptions/exception-validation'

function compareOptionalDate(a: string | null, b: string | null): number {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  return new Date(a).getTime() - new Date(b).getTime()
}

function sortExceptions(exceptions: Exception[], soldiers: Soldier[]): Exception[] {
  return [...exceptions].sort((a, b) => {
    const endDiff = compareOptionalDate(a.end, b.end)
    if (endDiff !== 0) return endDiff
    const startDiff = compareOptionalDate(a.start, b.start)
    if (startDiff !== 0) return startDiff
    const rankA = soldiers.find((s) => s.name === a.name)?.rank ?? ''
    const rankB = soldiers.find((s) => s.name === b.name)?.rank ?? ''
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

function toDDMMYY(iso: string) {
  const d = new Date(iso)
  return (
    d.getDate().toString().padStart(2, '0') +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    d.getFullYear().toString().slice(2)
  )
}

function soldierFourD(soldiers: Soldier[], name: string) {
  return soldiers.find((s) => s.name === name)?.four_d ?? ''
}

function soldierPlatoon(soldiers: Soldier[], name: string) {
  return soldiers.find((s) => s.name === name)?.platoon ?? 'HQ'
}

function platTotal(soldiers: Soldier[], plt: string, rt: string, overrides: Record<string, Record<string, number>>) {
  return overrides[plt]?.[rt] ?? soldiers.filter((s) => s.platoon === plt && getRankType(s.rank) === rt).length
}

function platPresent(
  soldiers: Soldier[], plt: string, rt: string,
  absentNames: Set<string>, overrides: Record<string, Record<string, number>>,
) {
  const total  = platTotal(soldiers, plt, rt, overrides)
  const absent = soldiers.filter((s) => s.platoon === plt && getRankType(s.rank) === rt && absentNames.has(s.name)).length
  return total - absent
}

function computeStrength(soldiers: Soldier[], absentNames: Set<string>, overrides: Record<string, Record<string, number>>) {
  const compTotal: Record<string, number> = {}
  const compPresent: Record<string, number> = {}
  for (const rt of RANK_TYPES) {
    compTotal[rt]   = overrides['Total']?.[rt] ?? soldiers.filter((s) => getRankType(s.rank) === rt).length
    const absent    = soldiers.filter((s) => absentNames.has(s.name) && getRankType(s.rank) === rt).length
    compPresent[rt] = compTotal[rt] - absent
  }
  const total   = RANK_TYPES.reduce((s, rt) => s + compTotal[rt], 0)
  const present = RANK_TYPES.reduce((s, rt) => s + compPresent[rt], 0)
  return { compTotal, compPresent, total, present }
}

function groupByPlatoon(exceptions: Exception[], soldiers: Soldier[]): Record<string, Exception[]> {
  const result: Record<string, Exception[]> = { HQ: [], '1': [], '2': [], '3': [], '4': [] }
  for (const e of exceptions) {
    const plt = soldierPlatoon(soldiers, e.name)
    ;(result[plt] ?? (result[plt] = [])).push(e)
  }
  return result
}

function computePlatoonTotals(
  soldiers: Soldier[], plt: string, absentSet: Set<string>, overrides: Record<string, Record<string, number>>,
) {
  const pltTotal   = RANK_TYPES.reduce((s, rt) => s + platTotal(soldiers, plt, rt, overrides), 0)
  const pltPresent = RANK_TYPES.reduce((s, rt) => s + platPresent(soldiers, plt, rt, absentSet, overrides), 0)
  return { pltTotal, pltPresent }
}

// ── Exception line formatting ────────────────────────────────────────────

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

function formatDescription(e: Exception): string {
  const reason = e.reason ?? ''
  if (e.scope === 'MA') return reason ? `MA (${reason})` : 'MA'
  return reason
}

function formatExceptionLine(e: Exception, idx: number, soldiers: Soldier[]): string {
  const fourD = soldierFourD(soldiers, e.name)
  const identity = displayName(e.name, soldiers)
  const parts = [formatDescription(e), formatDates(e)].filter(Boolean).join(' ')
  let line = `${idx + 1}. ${fourD ? `${fourD} ` : ''}${identity} - ${parts}`
  if (IN_OUT_SCOPES.includes(e.scope as (typeof IN_OUT_SCOPES)[number]) && e.in_out) line += ` ${e.in_out}`
  if (LOCATION_PRINT_SCOPES.includes(e.scope as (typeof LOCATION_PRINT_SCOPES)[number]) && e.location) line += ` @ ${e.location}`
  return line
}

// ── Unified renderer ─────────────────────────────────────────────────────

function generateReport(input: ParadeReportInput, config: ParadeStateConfig): string {
  const { date, soldiers, activeExceptions, paradeTimeStr, duties } = input
  const overrides   = input.strengthOverrides ?? {}
  const dateCompact = toDDMMYY(date)
  const absentNames = new Set(activeExceptions.filter((e) => e.counts_as_absence).map((e) => e.name))
  const { compTotal, compPresent, total, present } = computeStrength(soldiers, absentNames, overrides)
  const dutyMap = Object.fromEntries(duties.map((d) => [d.duty_type, d.name ?? '']))
  const exByPlt = groupByPlatoon(activeExceptions, soldiers)

  const lines: string[] = []
  lines.push(`40 SAR ${config.companyName} COMPANY`)
  lines.push(`${(input.paradeType ?? 'First Parade').toUpperCase()} STATE`)
  lines.push(`DATE: ${dateCompact} TIME: ${paradeTimeStr ? paradeTimeStr.replace(':', '') : ''}`)

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

  function renderBlock(pltKey: string, label: string) {
    const group      = exByPlt[pltKey] ?? []
    const pltAbsent  = new Set(group.filter((e) => e.counts_as_absence).map((e) => e.name))
    const { pltTotal, pltPresent } = computePlatoonTotals(soldiers, pltKey, pltAbsent, overrides)

    lines.push(`${label}: ${pltPresent}/${pltTotal}`)
    for (const rt of RANK_TYPES) {
      lines.push(`${RANK_LABELS[rt]}: ${platPresent(soldiers, pltKey, rt, pltAbsent, overrides)}/${platTotal(soldiers, pltKey, rt, overrides)}`)
    }
    for (const { key, label: scopeLabel } of STD_SCOPES) {
      const scopeGroup = group.filter((e) => e.scope === key)
      lines.push(`${scopeLabel}: ${scopeGroup.length}`)
      scopeGroup.forEach((e, idx) => lines.push(formatExceptionLine(e, idx, soldiers)))
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
  const sorted: ParadeReportInput = {
    ...input,
    activeExceptions: sortExceptions(input.activeExceptions, input.soldiers),
    allExceptions: input.allExceptions ? sortExceptions(input.allExceptions, input.soldiers) : undefined,
  }
  return generateReport(sorted, config)
}
