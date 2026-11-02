import type { Conduct, ConductDecision, DutyEntry, Exception, Soldier } from '@/shared/types'
import type { OverviewMark } from '@/backend/data/repositories/OverviewMarkRepository'
import { NO_REASON, buildBunks } from '@/backend/domain/overview/bunks'
import { RANK_INDEX, isCommander } from '@/shared/ranks'
import { isOnStrength } from '@/backend/domain/exceptions/active'
import { ddmmyy, pad2 } from '@/shared/dates'

/**
 * Conduct tracking, adapted from 40SAR_Archer: who takes part in a training
 * conduct and who falls out. Calls are stored (ConductDecisions): the Overview
 * snapshot taken at creation, then hand calls.
 */

/** Last day — a missing end_date means the conduct is within its start day. */
export const conductEnd = (c: Conduct): string => c.end_date ?? c.date

/**
 * The day a conduct is classified against: today while it runs (day 2 of an
 * outfield reflects day 2's MCs), else its first day before it starts and its
 * last day after it ends.
 */
export function conductDay(c: Conduct, todayISO: string): string {
  if (todayISO < c.date) return c.date
  const end = conductEnd(c)
  return todayISO > end ? end : todayISO
}

/** Formats "HH:MM[:SS]" as "HHMM"; empty when null. */
const hhmm = (time: string | null) => (time ? time.slice(0, 5).replace(':', '') : '')

/** "220926" or "220926 - 240926". */
export function conductDateRange(c: Conduct): string {
  const end = conductEnd(c)
  return end === c.date ? ddmmyy(c.date) : `${ddmmyy(c.date)} - ${ddmmyy(end)}`
}

/** "0800 - 1000" / "FROM 0800" / "UNTIL 1800", or null when no timing was issued. */
export function conductTimeRange(c: Conduct): string | null {
  const from = hhmm(c.start_time)
  const to = hhmm(c.end_time)
  if (from && to) return `${from} - ${to}`
  if (from) return `FROM ${from}`
  return to ? `UNTIL ${to}` : null
}

/** A Date at `time` on `dateISO`, or at the fallback hour/minute when time is null. */
function atTime(dateISO: string, time: string | null, fallback: [number, number]): Date {
  const [y, m, d] = dateISO.split('-').map(Number)
  const [hh, mi] = time ? time.split(':').map(Number) : fallback
  return new Date(y, m - 1, d, hh, mi)
}

/**
 * The conduct to open by default: whatever is running now, else whichever is
 * nearest in time. Ties go to the later start.
 */
export function nearestConduct(list: Conduct[], now: Date): Conduct | null {
  let best: Conduct | null = null
  let bestGap = Infinity
  const t = now.getTime()
  for (const c of list) {
    const start = atTime(c.date, c.start_time, [0, 0]).getTime()
    const end = atTime(conductEnd(c), c.end_time, [23, 59]).getTime()
    const gap = t < start ? start - t : t > end ? t - end : 0
    if (gap < bestGap || (gap === bestGap && best && start > atTime(best.date, best.start_time, [0, 0]).getTime())) {
      best = c
      bestGap = gap
    }
  }
  return best
}

export type ParticipationKind =
  /** Present on the Overview, or called in by hand. */
  | 'in'
  /** Taking part until a reason was given by hand. */
  | 'fall-out'
  /** Absent on the Overview when the conduct was created. */
  | 'out-of-camp'

export interface Participation {
  soldier: Soldier
  kind: ParticipationKind
  /** Why he's out (null while participating). */
  reason: string | null
}

/** False for someone out of camp: outside the strength. */
export const inCamp = (p: Participation): boolean => p.kind !== 'out-of-camp'

/** Orders soldiers most senior first, then by 4D, then name. */
function compareSoldiers(a: Soldier, b: Soldier): number {
  return (
    (RANK_INDEX[b.rank] ?? -1) - (RANK_INDEX[a.rank] ?? -1) ||
    (a.four_d ?? '').localeCompare(b.four_d ?? '', undefined, { numeric: true }) ||
    a.name.localeCompare(b.name)
  )
}

/**
 * Sorts every on-strength soldier: no call -> participating; a stored call decides
 * otherwise (seeded out of camp, a hand fall-out with a reason, or called back in).
 */
export function classifyConduct(conduct: Conduct, soldiers: Soldier[], decisions: ConductDecision[]): Participation[] {
  const decisionFor = new Map(decisions.filter((d) => d.conduct_id === conduct.id).map((d) => [d.soldier_id, d]))
  return soldiers.filter(isOnStrength).sort(compareSoldiers).map((soldier): Participation => {
    const d = soldier.id ? decisionFor.get(soldier.id) : undefined
    // ponytail: legacy 'to-confirm' rows count as participating
    if (!d || d.participating || d.group_kind === 'to-confirm') return { soldier, kind: 'in', reason: null }
    if (d.group_kind === 'out-of-camp') return { soldier, kind: 'out-of-camp', reason: d.reason }
    return { soldier, kind: 'fall-out', reason: d.reason || 'Fall out' }
  })
}

/** The roll a conduct is classified over: troopers only, less COY HQ when it sits out. */
export const conductSoldiers = (soldiers: Soldier[], includeHQ: boolean): Soldier[] =>
  soldiers.filter((s) => !isCommander(s) && (includeHQ || s.platoon !== 'HQ'))

/** Title, date and time lines for a conduct state. */
function headerLines(label: string, c: Conduct): string[] {
  const lines = [`${label} CONDUCT STATE`, `CONDUCT: ${c.name.toUpperCase()}`, `DATE: ${conductDateRange(c)}`]
  const time = conductTimeRange(c)
  if (time) lines.push(`TIME: ${time}HRS`)
  return lines
}

/** Numbered lines with each reason. */
function reasonLines(parts: Participation[]): string[] {
  return parts.map((p, i) => `${i + 1}. ${p.soldier.four_d ? `${p.soldier.four_d} ` : ''}${p.soldier.rank} ${p.soldier.name}${p.reason ? ` — ${p.reason.toUpperCase()}` : ''}`)
}

/** The company's conduct state: strength (in camp), who takes part, who falls out. */
export function generateConductState(companyLabel: string, c: Conduct, parts: Participation[]): string {
  const camp = parts.filter(inCamp)
  const taking = camp.filter((p) => p.kind === 'in')
  const out = camp.filter((p) => p.kind === 'fall-out')
  return [
    ...headerLines(`${companyLabel.toUpperCase()} COY`, c), '',
    `STRENGTH: ${pad2(camp.length)}`,
    '', `PARTICIPATING: ${pad2(taking.length)}`, ...reasonLines(taking),
    '', `FALL OUT: ${pad2(out.length)}`, ...reasonLines(out),
  ].join('\n')
}

/**
 * The calls to store when a conduct is created, read off the Overview for the conduct day:
 * everyone absent (a reason or unticked) -> out of camp. Everyone present takes part.
 */
export function seedDecisions(
  conduct: Conduct, soldiers: Soldier[], exceptions: Exception[], duties: DutyEntry[], marks: OverviewMark[], outScopes: string[], todayISO: string,
): Omit<ConductDecision, 'id' | 'conduct_id'>[] {
  const keys = (kind: OverviewMark['kind']) => new Set(marks.filter((m) => m.kind === kind).map((m) => m.key))
  const groups = buildBunks(soldiers, exceptions, duties, conductDay(conduct, todayISO), keys('out'), outScopes, keys('present'))
  return groups.flatMap((g) => g.bunks.flatMap((b) => b.members)).flatMap(({ soldier, reasons, flagged }) =>
    soldier.id && !flagged && reasons.length
      ? [{ soldier_id: soldier.id, participating: false, group_kind: 'out-of-camp' as const, reason: reasons.filter((r) => r !== NO_REASON).join(', ') || null }]
      : [])
}
