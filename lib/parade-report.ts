import type { Soldier, Exception, DutyEntry, Configuration } from './supabase'

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
  generatedAt?: Date
}

export function generateParadeReport(input: ParadeReportInput): string {
  const { date, companyLabel, soldiers, activeExceptions, configs, duties } = input
  const generatedAt = input.generatedAt ?? new Date()

  const d = new Date(date)
  const dateStr = d
    .toLocaleDateString('en-SG', { weekday: 'long', day: '2-digit', month: 'short', year: '2-digit' })
    .toUpperCase()

  const absentNames = new Set(activeExceptions.map((e) => e.name))
  const total = soldiers.length
  const absent = absentNames.size
  const present = total - absent

  const lines: string[] = [
    `${companyLabel.toUpperCase()} COY PARADE STATE`,
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
  lines.push(`PRESENT        : ${present}`)
  lines.push(`ABSENT         : ${absent}`)

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

  if (duties.length > 0) {
    lines.push('')
    lines.push('DUTIES:')
    duties.forEach((du) => {
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
