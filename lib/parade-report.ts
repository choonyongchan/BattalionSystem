import type { Soldier, Exception, DutyEntry } from './supabase'
import { displayName } from './supabase'
import type { ParadeStateConfig, Company } from './companies'
import { getRankType, RANK_TYPES } from './companies'

const PLATOON_ORDER: Record<string, number> = { HQ: 0, '1': 1, '2': 2, '3': 3, '4': 4 }
const RANK_TYPE_ORDER: Record<string, number> = { Officer: 0, WOSPEC: 1, Enlistee: 2 }

function sortExceptions(exceptions: Exception[], soldiers: Soldier[]): Exception[] {
  return [...exceptions].sort((a, b) => {
    const pltA = soldierPlatoon(soldiers, a.name)
    const pltB = soldierPlatoon(soldiers, b.name)
    const pltDiff = (PLATOON_ORDER[pltA] ?? 99) - (PLATOON_ORDER[pltB] ?? 99)
    if (pltDiff !== 0) return pltDiff
    const rankA = soldiers.find((s) => s.name === a.name)?.rank ?? ''
    const rankB = soldiers.find((s) => s.name === b.name)?.rank ?? ''
    const rankDiff = RANK_TYPE_ORDER[getRankType(rankA)] - RANK_TYPE_ORDER[getRankType(rankB)]
    if (rankDiff !== 0) return rankDiff
    return a.name.localeCompare(b.name)
  })
}

function toSGDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: '2-digit' })
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

const SEP = '───'
const sep = (n: number) => '-'.repeat(n)

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

const PLATOON_KEYS = ['HQ', '1', '2', '3', '4']

function platoonsWithLabels(labelFor: (key: string) => string): { key: string; label: string }[] {
  return PLATOON_KEYS.map((key) => ({ key, label: labelFor(key) }))
}

function computePlatoonTotals(
  soldiers: Soldier[], plt: string, absentSet: Set<string>, overrides: Record<string, Record<string, number>>,
) {
  const pltTotal   = RANK_TYPES.reduce((s, rt) => s + platTotal(soldiers, plt, rt, overrides), 0)
  const pltPresent = RANK_TYPES.reduce((s, rt) => s + platPresent(soldiers, plt, rt, absentSet, overrides), 0)
  return { pltTotal, pltPresent }
}

// ── Hercules ──────────────────────────────────────────────────────────────────

function generateHerculesReport(input: ParadeReportInput, config: ParadeStateConfig): string {
  const { date, soldiers, activeExceptions, paradeTimeStr, duties } = input
  const overrides   = input.strengthOverrides ?? {}
  const dateCompact = toDDMMYY(date)
  const absentNames = new Set(activeExceptions.filter((e) => e.counts_as_absence).map((e) => e.name))

  const compTotal: Record<string, number> = {}
  for (const rt of RANK_TYPES) compTotal[rt] = overrides['Total']?.[rt] ?? soldiers.filter((s) => getRankType(s.rank) === rt).length
  const total = RANK_TYPES.reduce((sum, rt) => sum + compTotal[rt], 0)
  const absentByRt: Record<string, number> = {}
  for (const rt of RANK_TYPES) absentByRt[rt] = soldiers.filter((s) => absentNames.has(s.name) && getRankType(s.rank) === rt).length
  const present     = total - absentNames.size
  const presentByRt = (rt: string) => compTotal[rt] - (absentByRt[rt] ?? 0)

  const lines: string[] = [config.header[0], ...config.header.slice(1)]
  if (paradeTimeStr) {
    const time = paradeTimeStr.replace(':', '')
    lines.push(`${(input.paradeType ?? '').toUpperCase()} ${dateCompact}, ${time} HRS`)
  } else {
    lines.push(dateCompact)
  }

  lines.push(SEP)
  config.visibleDutyTypes
    .map((type) => duties.find((du) => du.duty_type === type))
    .filter((du): du is DutyEntry => du !== undefined)
    .forEach((du) => lines.push(`${du.duty_type}: ${du.name ? displayName(du.name, soldiers) : 'TBC'}`))

  lines.push(SEP)
  lines.push(`Total Str: ${total}`)
  lines.push(`Current Str: ${present}`)
  lines.push('')
  lines.push(`[Officer]: ${presentByRt('Officer')}/${compTotal['Officer']}`)
  lines.push(`[WOSpec]: ${presentByRt('WOSPEC')}/${compTotal['WOSPEC']}`)
  lines.push(`[Men]: ${presentByRt('Enlistee')}/${compTotal['Enlistee']}`)

  for (const { key, label } of config.scopeConfigs) {
    const group = activeExceptions.filter((e) => e.scope === key)
    lines.push(SEP)
    lines.push(`${label}: ${group.length.toString().padStart(2, '0')}`)
    for (const e of group) {
      let line = `• ${displayName(e.name, soldiers)}`
      if (e.reason) line += `: ${e.reason}`
      if (e.end) line += ` until ${toDDMMYY(e.end)}`
      lines.push(line)
    }
  }

  return lines.join('\n')
}

// ── Stallion ──────────────────────────────────────────────────────────────────

function generateStallionReport(input: ParadeReportInput, config: ParadeStateConfig): string {
  const { date, soldiers, activeExceptions, paradeTimeStr, duties } = input
  const overrides   = input.strengthOverrides ?? {}
  const dateCompact = toDDMMYY(date)
  const absentNames = new Set(activeExceptions.filter((e) => e.counts_as_absence).map((e) => e.name))
  const { compTotal, compPresent, total, present } = computeStrength(soldiers, absentNames, overrides)
  const dutyMap = Object.fromEntries(duties.map((d) => [d.duty_type, d.name ?? '']))
  const scopes  = config.scopeConfigs

  const lines: string[] = []
  lines.push(`PARADE STATE FOR ${dateCompact}`)
  lines.push('')

  if (paradeTimeStr) {
    const time = paradeTimeStr.replace(':', '')
    lines.push(`${config.header[0]} CAA ${time}`)
  } else {
    lines.push(config.header[0])
  }
  lines.push('')

  const mainDuties = ['CDO', 'CDS', 'COS'].filter((t) => config.visibleDutyTypes.includes(t))
  const pdsDuties  = ['PDS1', 'PDS2', 'PDS3', 'PDS4'].filter((t) => config.visibleDutyTypes.includes(t))
  mainDuties.forEach((t) => lines.push(`${t}: ${dutyMap[t] ?? ''}`))
  if (pdsDuties.length > 0) {
    lines.push('')
    pdsDuties.forEach((t, i) => lines.push(`PDS ${i + 1}: ${dutyMap[t] ?? ''}`))
  }
  lines.push('')

  lines.push(`TOTAL COY STR: ${total}`)
  lines.push(`CURRENT COY STR: ${present}/${total}`)
  lines.push(`OFFICER: ${compPresent['Officer']}/${compTotal['Officer']}`)
  lines.push(`WOSPEC: ${compPresent['WOSPEC']}/${compTotal['WOSPEC']}`)

  const exByPlt  = groupByPlatoon(activeExceptions, soldiers)
  const platoons = platoonsWithLabels((key) => (key === 'HQ' ? 'HQ' : `PL ${key}`))

  for (const { key: plt, label: pltLabel } of platoons) {
    lines.push(sep(50))
    const pltAbsent  = new Set((exByPlt[plt] ?? []).filter((e) => e.counts_as_absence).map((e) => e.name))
    const { pltTotal, pltPresent } = computePlatoonTotals(soldiers, plt, pltAbsent, overrides)

    lines.push(`${pltLabel}: ${pltPresent}/${pltTotal}`)
    lines.push(`OFFICER: ${platPresent(soldiers, plt, 'Officer', pltAbsent, overrides)}/${platTotal(soldiers, plt, 'Officer', overrides)}`)
    lines.push(`WOSPEC: ${platPresent(soldiers, plt, 'WOSPEC', pltAbsent, overrides)}/${platTotal(soldiers, plt, 'WOSPEC', overrides)}`)
    lines.push(`TROOPERS: ${platPresent(soldiers, plt, 'Enlistee', pltAbsent, overrides)}/${platTotal(soldiers, plt, 'Enlistee', overrides)}`)
    lines.push('')

    for (const { key, label } of scopes) {
      const group = (exByPlt[plt] ?? []).filter((e) => e.scope === key)
      lines.push(`${label}:`)
      for (const e of group) {
        const dn    = displayName(e.name, soldiers)
        const dates = e.start && e.end ? ` (${toDDMMYY(e.start)} - ${toDDMMYY(e.end)})` : ''
        if (key === 'Att C' || key === 'Status') {
          lines.push(`${e.reason ? `[${e.reason}] ` : ''}${dn}${dates}`)
        } else {
          lines.push(`${dn}${dates}`)
        }
      }
    }
  }

  lines.push(sep(50))
  lines.push('UPCOMING MA:')
  const allEx = input.allExceptions ?? activeExceptions
  allEx
    .filter((e): e is Exception & { end: string } => e.scope === 'MA' && !!e.end && new Date(e.end) >= new Date(date))
    .forEach((e) => {
      const dn = displayName(e.name, soldiers)
      const dateStr = toDDMMYY(e.end)
      if (e.time) {
        const timeStr = e.time.replace(':', '')
        lines.push(`${dn} (${dateStr} ${timeStr}HRS)`)
      } else {
        lines.push(`${dn} (${dateStr})`)
      }
    })
  lines.push(sep(50))

  return lines.join('\n')
}

// ── Archer ────────────────────────────────────────────────────────────────────

function generateArcherReport(input: ParadeReportInput, config: ParadeStateConfig): string {
  const { date, soldiers, activeExceptions, paradeTimeStr, duties } = input
  const overrides   = input.strengthOverrides ?? {}
  const dateCompact = toDDMMYY(date)
  const absentNames = new Set(activeExceptions.filter((e) => e.counts_as_absence).map((e) => e.name))
  const { compTotal, compPresent, total, present } = computeStrength(soldiers, absentNames, overrides)
  const dutyMap = Object.fromEntries(duties.map((d) => [d.duty_type, d.name ?? '']))
  const scopes  = config.scopeConfigs

  const lines: string[] = []
  lines.push(config.header[0])
  if (paradeTimeStr) {
    const time = paradeTimeStr.replace(':', '')
    lines.push(`CAA: ${dateCompact} ${time}`)
  } else {
    lines.push(`CAA: ${dateCompact}`)
  }
  lines.push('')
  lines.push(SEP)
  lines.push('')

  const mainDuties = ['CDO', 'CDS', 'COS'].filter((t) => config.visibleDutyTypes.includes(t))
  const pdsDuties  = ['PDS1', 'PDS2', 'PDS3', 'PDS4'].filter((t) => config.visibleDutyTypes.includes(t))
  mainDuties.forEach((t) => lines.push(`${t}: ${dutyMap[t] ?? ''}`))
  if (pdsDuties.length > 0) {
    lines.push('')
    pdsDuties.forEach((t, i) => lines.push(`PDS ${i + 1}: ${dutyMap[t] ?? ''}`))
  }
  lines.push('')

  lines.push(`Total Strength: ${present}/${total}`)
  lines.push(`Officer: ${compPresent['Officer']}/${compTotal['Officer']}`)
  lines.push(`WOSPEC: ${compPresent['WOSPEC']}/${compTotal['WOSPEC']}`)
  lines.push(`Enlistees: ${compPresent['Enlistee']}/${compTotal['Enlistee']}`)

  const exByPlt  = groupByPlatoon(activeExceptions, soldiers)
  const platoons = platoonsWithLabels((key) => (key === 'HQ' ? 'HQ' : `PLT ${key}`))

  for (const { key: plt, label: pltLabel } of platoons) {
    lines.push('')
    lines.push('______')
    lines.push('')
    const pltAbsent  = new Set((exByPlt[plt] ?? []).filter((e) => e.counts_as_absence).map((e) => e.name))
    const { pltTotal, pltPresent } = computePlatoonTotals(soldiers, plt, pltAbsent, overrides)

    lines.push(`${pltLabel}: ${pltPresent}/${pltTotal}`)
    lines.push(`Officer: ${platPresent(soldiers, plt, 'Officer', pltAbsent, overrides)}/${platTotal(soldiers, plt, 'Officer', overrides)}`)
    lines.push(`WOSPEC: ${platPresent(soldiers, plt, 'WOSPEC', pltAbsent, overrides)}/${platTotal(soldiers, plt, 'WOSPEC', overrides)}`)
    lines.push(`Enlistee: ${platPresent(soldiers, plt, 'Enlistee', pltAbsent, overrides)}/${platTotal(soldiers, plt, 'Enlistee', overrides)}`)

    for (const { key, label } of scopes) {
      const group = (exByPlt[plt] ?? []).filter((e) => e.scope === key)
      lines.push(`${label}: ${group.length.toString().padStart(2, '0')}`)
      group.forEach((e, idx) => {
        const dn    = displayName(e.name, soldiers)
        const fourD = soldierFourD(soldiers, e.name)
        lines.push(`S/N: ${(idx + 1).toString().padStart(2, '0')}`)
        lines.push(`R&N: ${dn}`)
        if (fourD) lines.push(`4D: ${fourD}`)
        if (key === 'Att C' || key === 'Status') {
          if (e.reason) lines.push(`STATUS: ${e.reason}`)
          if (e.start && e.end) lines.push(`DATE: (${toDDMMYY(e.start)} - ${toDDMMYY(e.end)})`)
        } else if (key === 'Guard Duty') {
          if (e.reason) lines.push(`REASON: ${e.reason}`)
          if (e.start && e.end) lines.push(`DATE & TIME: ${toDDMMYY(e.start)} - ${toDDMMYY(e.end)}`)
        } else {
          if (e.reason) lines.push(`REASON: ${e.reason}`)
          if (e.end) lines.push(`DATE: ${toDDMMYY(e.end)}`)
        }
      })
    }

    lines.push(SEP)
  }

  return lines.join('\n')
}

// ── Braves ────────────────────────────────────────────────────────────────────

function generateBravesReport(input: ParadeReportInput, config: ParadeStateConfig): string {
  const { date, soldiers, activeExceptions, paradeTimeStr } = input
  const overrides   = input.strengthOverrides ?? {}
  const dateCompact = toDDMMYY(date)
  const absentNames = new Set(activeExceptions.filter((e) => e.counts_as_absence).map((e) => e.name))
  const { compTotal, compPresent, total, present } = computeStrength(soldiers, absentNames, overrides)
  const scopes  = config.scopeConfigs
  const datedScopes = new Set(['Att C', 'Status', 'Off/Leave'])

  function renderEntries(group: Exception[]): string[] {
    return group.map((e, idx) => {
      const dn    = displayName(e.name, soldiers)
      const fourD = soldierFourD(soldiers, e.name)
      let line    = `${idx + 1}. ${dn}${fourD ? ' ' + fourD : ''}`
      if (e.reason) line += ` - ${e.reason}`
      if (datedScopes.has(e.scope) && e.start && e.end) line += ` (${toDDMMYY(e.start)}-${toDDMMYY(e.end)})`
      return line
    })
  }

  const lines: string[] = []
  lines.push(config.header[0])
  if (paradeTimeStr) {
    const time = paradeTimeStr.replace(':', '')
    lines.push(`${dateCompact} FP ${time}`)
  } else {
    lines.push(`${dateCompact} FP`)
  }
  lines.push('')
  lines.push(`TOTAL STRENGTH: ${total}`)
  lines.push(`CURRENT STRENGTH: ${present}`)
  lines.push('')
  lines.push(`[OFFICER]: ${compPresent['Officer'].toString().padStart(2, '0')}/${compTotal['Officer'].toString().padStart(2, '0')}`)
  lines.push(`[WOSPEC]: ${compPresent['WOSPEC'].toString().padStart(2, '0')}/${compTotal['WOSPEC'].toString().padStart(2, '0')}`)
  lines.push(`[ENLISTEE]: ${compPresent['Enlistee'].toString().padStart(2, '0')}/${compTotal['Enlistee'].toString().padStart(2, '0')}`)

  for (const { key, label } of scopes) {
    lines.push(sep(80))
    const group = activeExceptions.filter((e) => e.scope === key)
    lines.push(`${label}: ${group.length.toString().padStart(2, '0')}`)
    if (group.length > 0) {
      lines.push('')
      renderEntries(group).forEach((l) => lines.push(l))
    }
  }

  const exByPlt  = groupByPlatoon(activeExceptions, soldiers)
  const platoons = platoonsWithLabels((key) => (key === 'HQ' ? 'BRAVES HQ' : `PLATOON ${key}`))

  for (const { key: plt, label: pltLabel } of platoons) {
    lines.push('')
    lines.push('==============================')
    lines.push('')
    lines.push(`${dateCompact} FP`)
    lines.push(pltLabel)
    lines.push('')

    const pltAbsent  = new Set((exByPlt[plt] ?? []).filter((e) => e.counts_as_absence).map((e) => e.name))
    const { pltTotal, pltPresent } = computePlatoonTotals(soldiers, plt, pltAbsent, overrides)

    lines.push(`TOTAL STRENGTH: ${pltTotal}`)
    lines.push(`CURRENT STRENGTH: ${pltPresent}`)
    lines.push('')
    for (const rt of RANK_TYPES) {
      const lbl = rt === 'Enlistee' ? 'ENLISTEE' : rt.toUpperCase()
      const pT  = platTotal(soldiers, plt, rt, overrides)
      const pP  = platPresent(soldiers, plt, rt, pltAbsent, overrides)
      if (pT > 0) lines.push(`[${lbl}]: ${pP}/${pT}`)
    }

    for (const { key, label } of scopes) {
      lines.push(sep(30))
      const group = (exByPlt[plt] ?? []).filter((e) => e.scope === key)
      lines.push(`${label}: ${group.length.toString().padStart(2, '0')}`)
      if (group.length > 0) {
        lines.push('')
        renderEntries(group).forEach((l) => lines.push(l))
      }
    }
  }

  return lines.join('\n')
}

// ── Cougar ────────────────────────────────────────────────────────────────────

function generateCougarReport(input: ParadeReportInput, config: ParadeStateConfig): string {
  const { date, soldiers, activeExceptions, paradeTimeStr } = input
  const overrides   = input.strengthOverrides ?? {}
  const dateCompact = toDDMMYY(date)
  const absentNames = new Set(activeExceptions.filter((e) => e.counts_as_absence).map((e) => e.name))
  const { compTotal, compPresent, total, present } = computeStrength(soldiers, absentNames, overrides)
  const scopes  = config.scopeConfigs

  const lines: string[] = []
  lines.push(...config.header)
  if (paradeTimeStr) {
    const time = paradeTimeStr.replace(':', '')
    lines.push(`DATE: ${dateCompact} @ ${time} Hrs`)
  } else {
    lines.push(`DATE: ${dateCompact}`)
  }
  lines.push('')
  lines.push(sep(64))
  lines.push('')
  lines.push(`TOTAL STRENGTH: ${total}`)
  lines.push(`CURRENT STRENGTH: ${present}`)

  const cougarPlatoons = [
    { key: '1',  label: 'PLATOON 1' },
    { key: '4',  label: 'PLATOON 4' },
    { key: 'HQ', label: 'COMMANDERS' },
  ]
  for (const { key: plt, label: pltLabel } of cougarPlatoons) {
    const pltAbsent  = new Set(activeExceptions.filter((e) => e.counts_as_absence && soldierPlatoon(soldiers, e.name) === plt).map((e) => e.name))
    const { pltTotal, pltPresent } = computePlatoonTotals(soldiers, plt, pltAbsent, overrides)
    if (pltTotal > 0) lines.push(`${pltLabel}: ${pltPresent}/${pltTotal}`)
  }

  for (const { key, label } of scopes) {
    lines.push('')
    lines.push(sep(64))
    lines.push('')
    const group = activeExceptions.filter((e) => e.scope === key)
    lines.push(`${label}: ${group.length.toString().padStart(2, '0')}`)

    group.forEach((e, idx) => {
      const dn    = displayName(e.name, soldiers)
      const fourD = soldierFourD(soldiers, e.name)
      lines.push('')
      lines.push(`S/N: ${(idx + 1).toString().padStart(2, '0')}`)
      lines.push(`R/N: ${dn}${fourD ? ' ' + fourD : ''}`)
      if (e.reason) lines.push(`Reason: ${e.reason}`)
      if (key === 'Att C' || key === 'Status') {
        if (e.start && e.end) lines.push(`Duration: ${toDDMMYY(e.start)} - ${toDDMMYY(e.end)}`)
      } else if (key === 'MA') {
        if (e.end) lines.push(`Date: ${toDDMMYY(e.end)}`)
      } else {
        if (e.start && e.end) lines.push(`Duration: ${toDDMMYY(e.start)} - ${toDDMMYY(e.end)}`)
      }
    })
  }

  lines.push('')
  lines.push(sep(64))

  return lines.join('\n')
}

// ── Standard (fallback) ───────────────────────────────────────────────────────

function generateStandardReport(input: ParadeReportInput, config: ParadeStateConfig): string {
  const { date, soldiers, activeExceptions, paradeTimeStr, duties } = input
  const overrides   = input.strengthOverrides ?? {}
  const generatedAt = input.generatedAt ?? new Date()

  const dateStr = new Date(date)
    .toLocaleDateString('en-SG', { weekday: 'long', day: '2-digit', month: 'short', year: '2-digit' })
    .toUpperCase()

  const absentNames = new Set(activeExceptions.filter((e) => e.counts_as_absence).map((e) => e.name))
  const compTotal: Record<string, number> = {}
  for (const rt of RANK_TYPES) compTotal[rt] = overrides['Total']?.[rt] ?? soldiers.filter((s) => getRankType(s.rank) === rt).length
  const total   = RANK_TYPES.reduce((sum, rt) => sum + compTotal[rt], 0)
  const absent  = absentNames.size
  const present = total - absent

  const lines: string[] = [...config.header, `DATE: ${dateStr}`, '']

  if (paradeTimeStr) {
    const label = input.paradeType ? input.paradeType.toUpperCase() : 'PARADE TIME'
    const t = paradeTimeStr.replace(':', '')
    lines.push(`${label} — ${t}H`)
    lines.push('')
  }

  lines.push(`TOTAL STRENGTH : ${total}`)
  lines.push(`  OFFICER  : ${compTotal['Officer']}`)
  lines.push(`  WOSPEC   : ${compTotal['WOSPEC']}`)
  lines.push(`  ENLISTEE : ${compTotal['Enlistee']}`)
  lines.push(`PRESENT        : ${present}`)
  lines.push(`ABSENT         : ${absent}`)

  const platoons = ['HQ', '1', '2', '3', '4']
  const hasPlatoonOverride = platoons.some((p) => overrides[p] && Object.keys(overrides[p]).length > 0)
  if (hasPlatoonOverride) {
    lines.push('')
    lines.push('PLATOON STRENGTH:')
    for (const p of platoons) {
      const lbl = p === 'HQ' ? 'HQ  ' : `PLT ${p}`
      const o   = overrides[p]?.['Officer']  ?? soldiers.filter((s) => s.platoon === p && getRankType(s.rank) === 'Officer').length
      const w   = overrides[p]?.['WOSPEC']   ?? soldiers.filter((s) => s.platoon === p && getRankType(s.rank) === 'WOSPEC').length
      const e   = overrides[p]?.['Enlistee'] ?? soldiers.filter((s) => s.platoon === p && getRankType(s.rank) === 'Enlistee').length
      lines.push(`  ${lbl}: O:${o} / W:${w} / E:${e}`)
    }
  }

  const scopes = config.scopeConfigs
  if (activeExceptions.length > 0) {
    lines.push('')
    lines.push('EXCEPTIONS:')
    const knownKeys = new Set(scopes.map((s) => s.key))
    for (const { key, label } of scopes) {
      const group = activeExceptions.filter((e) => e.scope === key)
      if (group.length === 0) continue
      lines.push(`  ${label}:`)
      group.forEach((e) => {
        let line = `    - ${displayName(e.name, soldiers)}`
        if (e.start && e.end) line += ` (${toSGDate(e.start)} - ${toSGDate(e.end)})`
        if (e.reason) line += ` — ${e.reason}`
        lines.push(line)
      })
    }
    const other = activeExceptions.filter((e) => !knownKeys.has(e.scope))
    if (other.length > 0) {
      lines.push('  OTHERS:')
      other.forEach((e) => {
        let line = `    - ${displayName(e.name, soldiers)}`
        if (e.reason) line += ` — ${e.reason}`
        lines.push(line)
      })
    }
  }

  const visibleDuties = config.visibleDutyTypes
    .map((type) => duties.find((d) => d.duty_type === type))
    .filter((d): d is DutyEntry => d !== undefined)
  if (visibleDuties.length > 0) {
    lines.push('')
    lines.push('DUTIES:')
    visibleDuties.forEach((du) => lines.push(`  ${du.duty_type}: ${du.name ? displayName(du.name, soldiers) : 'TBC'}`))
  }

  lines.push('')
  lines.push(
    `Generated: ${generatedAt.toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })}`,
  )

  return lines.join('\n')
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

/**
 * Renders the parade-state text report for a company.
 *
 * Note: when `input.paradeType` is 'Last Parade', every occurrence of the
 * literal string 'FIRST' in `config.header` is replaced with 'LAST' before
 * rendering — this mutates the effective header text, not just a label field.
 *
 * @param input - Report data (soldiers, exceptions, duties, strength overrides).
 * @param config - Per-company parade-state config (headers, scopes, duty types).
 * @param company - Company key selecting which renderer to dispatch to; falls back to the standard renderer if omitted/unrecognized.
 * @returns The fully formatted report as a newline-joined string.
 */
export function generateParadeReport(input: ParadeReportInput, config: ParadeStateConfig, company?: Company): string {
  const sorted: ParadeReportInput = {
    ...input,
    activeExceptions: sortExceptions(input.activeExceptions, input.soldiers),
    allExceptions: input.allExceptions ? sortExceptions(input.allExceptions, input.soldiers) : undefined,
  }
  const resolvedConfig: ParadeStateConfig = input.paradeType === 'Last Parade'
    ? { ...config, header: config.header.map((h) => h.replace('FIRST', 'LAST')) }
    : config
  switch (company) {
    case 'hercules': return generateHerculesReport(sorted, resolvedConfig)
    case 'stallion': return generateStallionReport(sorted, resolvedConfig)
    case 'archer':   return generateArcherReport(sorted, resolvedConfig)
    case 'braves':   return generateBravesReport(sorted, resolvedConfig)
    case 'cougar':   return generateCougarReport(sorted, resolvedConfig)
    default:         return generateStandardReport(sorted, resolvedConfig)
  }
}
