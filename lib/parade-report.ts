import type { Soldier, Exception, DutyEntry, Configuration } from './supabase'
import type { ParadeStateConfig } from './companies'

const RANK_TYPES = ['Officer', 'WOSPEC', 'Enlistee'] as const
const OFFICER_PREFIXES = ['2LT', 'LTA', 'CPT', 'MAJ', 'LTC', 'SLTC', 'COL', 'ME4', 'ME5', 'ME6', 'ME7', 'ME8']
const WOSPEC_RANKS    = ['3SG', '2SG', '1SG', 'SSG', 'MSG', 'ME1', 'ME2', 'ME3', '3WO', '2WO', '1WO', 'MWO', 'SWO', 'CWO']
function getRankType(rank: string): 'Officer' | 'WOSPEC' | 'Enlistee' {
  if (OFFICER_PREFIXES.some((p) => rank.startsWith(p))) return 'Officer'
  if (WOSPEC_RANKS.includes(rank)) return 'WOSPEC'
  return 'Enlistee'
}

const EXCEPTION_SCOPES = ['Att C', 'Status', 'Off/Leave', 'Guard Duty', 'Report Sick', 'MA', 'Others'] as const

function toSGDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

export interface ParadeReportInput {
  date: string
  companyLabel: string
  soldiers: Soldier[]
  activeExceptions: Exception[]
  configs: Configuration[]
  duties: DutyEntry[]
  strengthOverrides?: Record<string, Record<string, number>>
  generatedAt?: Date
}

const SEP = '───'

const HERCULES_SCOPES: Array<{ key: string; label: string }> = [
  { key: 'Off/Leave',   label: 'Off/Leave' },
  { key: 'MA',          label: 'MA' },
  { key: 'Report Sick', label: 'Reporting sick' },
  { key: 'Att C',       label: 'Att C' },
  { key: 'Status',      label: 'Status' },
  { key: 'Others',      label: 'Others' },
  { key: 'Guard Duty',  label: 'Guard Duty' },
]

function toDDMMYY(iso: string) {
  const d = new Date(iso)
  return (
    d.getDate().toString().padStart(2, '0') +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    d.getFullYear().toString().slice(2)
  )
}

function generateHerculesReport(input: ParadeReportInput, config: ParadeStateConfig): string {
  const { date, soldiers, activeExceptions, configs, duties } = input
  const overrides = input.strengthOverrides ?? {}

  const d = new Date(date)
  const dateCompact = toDDMMYY(date)

  const absentNames = new Set(activeExceptions.map((e) => e.name))

  const computed: Record<string, number> = {}
  for (const rt of RANK_TYPES) {
    computed[rt] = soldiers.filter((s) => getRankType(s.rank) === rt).length
  }
  const totalByRt = (rt: string) => overrides['Total']?.[rt] ?? computed[rt]
  const total = RANK_TYPES.reduce((sum, rt) => sum + totalByRt(rt), 0)
  const present = total - absentNames.size

  const absentByRt: Record<string, number> = {}
  for (const rt of RANK_TYPES) {
    absentByRt[rt] = soldiers.filter((s) => absentNames.has(s.name) && getRankType(s.rank) === rt).length
  }
  const presentByRt = (rt: string) => totalByRt(rt) - (absentByRt[rt] ?? 0)

  const paradeLabel = configs.length > 0
    ? configs[0].parade_type.toUpperCase() + ' STATE'
    : config.header[0]
  const lines: string[] = [paradeLabel, ...config.header.slice(1)]

  if (configs.length > 0) {
    const c = configs[0]
    const time = c.time.substring(0, 5).replace(':', '')
    lines.push(`${c.parade_type.toUpperCase()} ${dateCompact}, ${time} HRS`)
  } else {
    lines.push(dateCompact)
  }

  lines.push(SEP)

  const visibleDuties = config.visibleDutyTypes
    .map((type) => duties.find((du) => du.duty_type === type))
    .filter((du): du is DutyEntry => du !== undefined)
  visibleDuties.forEach((du) => lines.push(`${du.duty_type}: ${du.name ?? 'TBC'}`))

  lines.push(SEP)
  lines.push(`Total Str: ${total}`)
  lines.push(`Current Str: ${present}`)
  lines.push('')
  lines.push(`[Officer]: ${presentByRt('Officer')}/${totalByRt('Officer')}`)
  lines.push(`[WOSpec]: ${presentByRt('WOSPEC')}/${totalByRt('WOSPEC')}`)
  lines.push(`[Men]: ${presentByRt('Enlistee')}/${totalByRt('Enlistee')}`)

  for (const { key, label } of HERCULES_SCOPES) {
    const group = activeExceptions.filter((e) => e.scope === key)
    lines.push(SEP)
    lines.push(`${label}: ${group.length.toString().padStart(2, '0')}`)
    for (const e of group) {
      let line = `• ${e.name}`
      if (e.reason) line += `: ${e.reason}`
      if (e.end) line += ` until ${toDDMMYY(e.end)}`
      lines.push(line)
    }
  }

  return lines.join('\n')
}

export function generateParadeReport(input: ParadeReportInput, config: ParadeStateConfig): string {
  if (config.format === 'hercules') return generateHerculesReport(input, config)
  const { date, companyLabel, soldiers, activeExceptions, configs, duties } = input
  const overrides = input.strengthOverrides ?? {}
  const generatedAt = input.generatedAt ?? new Date()

  const d = new Date(date)
  const dateStr = d
    .toLocaleDateString('en-SG', { weekday: 'long', day: '2-digit', month: 'short', year: '2-digit' })
    .toUpperCase()

  const absentNames = new Set(activeExceptions.map((e) => e.name))

  // Compute strength per rank type from nominal roll
  const computed: Record<string, number> = {}
  for (const rt of RANK_TYPES) {
    computed[rt] = soldiers.filter((s) => getRankType(s.rank) === rt).length
  }
  const totalByRt = (rt: string) => overrides['Total']?.[rt] ?? computed[rt]
  const total = RANK_TYPES.reduce((sum, rt) => sum + totalByRt(rt), 0)
  const absent = absentNames.size
  const present = total - absent

  const lines: string[] = [
    ...config.header,
    `DATE: ${dateStr}`,
    '',
  ]

  if (configs.length > 0) {
    configs.forEach((c) => {
      const t = c.time.substring(0, 5).replace(':', '')
      lines.push(`${c.parade_type.toUpperCase()} — ${t}H`)
    })
    lines.push('')
  }

  lines.push(`TOTAL STRENGTH : ${total}`)
  lines.push(`  OFFICER  : ${totalByRt('Officer')}`)
  lines.push(`  WOSPEC   : ${totalByRt('WOSPEC')}`)
  lines.push(`  ENLISTEE : ${totalByRt('Enlistee')}`)
  lines.push(`PRESENT        : ${present}`)
  lines.push(`ABSENT         : ${absent}`)

  // Per-platoon block only if at least one platoon override is set
  const platoons = ['HQ', '1', '2', '3', '4']
  const hasPlatoonOverride = platoons.some((p) => overrides[p] && Object.keys(overrides[p]).length > 0)
  if (hasPlatoonOverride) {
    lines.push('')
    lines.push('PLATOON STRENGTH:')
    for (const p of platoons) {
      const label = p === 'HQ' ? 'HQ  ' : `PLT ${p}`
      const o = overrides[p]?.['Officer']  ?? soldiers.filter((s) => s.platoon === p && getRankType(s.rank) === 'Officer').length
      const w = overrides[p]?.['WOSPEC']   ?? soldiers.filter((s) => s.platoon === p && getRankType(s.rank) === 'WOSPEC').length
      const e = overrides[p]?.['Enlistee'] ?? soldiers.filter((s) => s.platoon === p && getRankType(s.rank) === 'Enlistee').length
      lines.push(`  ${label}: O:${o} / W:${w} / E:${e}`)
    }
  }

  if (activeExceptions.length > 0) {
    lines.push('')
    lines.push('EXCEPTIONS:')

    EXCEPTION_SCOPES.forEach((scope) => {
      const group = activeExceptions.filter((e) => e.scope === scope)
      if (group.length === 0) return
      lines.push(`  ${scope.toUpperCase()}:`)
      group.forEach((e) => {
        let line = `    - ${e.name}`
        if (e.start && e.end) line += ` (${toSGDate(e.start)} - ${toSGDate(e.end)})`
        if (e.reason) line += ` — ${e.reason}`
        lines.push(line)
      })
    })

    const other = activeExceptions.filter(
      (e) => !e.scope || !(EXCEPTION_SCOPES as readonly string[]).includes(e.scope),
    )
    if (other.length > 0) {
      lines.push('  OTHERS:')
      other.forEach((e) => {
        let line = `    - ${e.name}`
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
    visibleDuties.forEach((du) => {
      lines.push(`  ${du.duty_type}: ${du.name ?? 'TBC'}`)
    })
  }

  lines.push('')
  lines.push(
    `Generated: ${generatedAt.toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`,
  )

  return lines.join('\n')
}
