import type { Conduct, ConductDecision, Exception, Soldier } from '@/shared/types'
import type { Company, PlatoonBlock } from '@/shared/companies'
import { RANK_ORDER, getRankType } from '@/shared/ranks'
import { buildActiveMap, exceptionType, isOnStrength, soldierKeyOf } from '@/backend/domain/exceptions/active'
import { ddmmyy, pad2 } from '@/shared/dates'

/**
 * Conduct tracking, adapted from 40SAR_Archer: who takes part in a training
 * conduct and who falls out. Only manual calls are stored (ConductDecisions);
 * automatic fall-outs are read live off Exceptions, so an MC keyed late
 * updates the conduct with no double entry.
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

/** Officers and WOSPECs — everyone who isn't an enlistee. */
export const isCommander = (s: Soldier): boolean => getRankType(s.rank) !== 'Enlistee'

export type ParticipationKind =
  /** No active exception. */
  | 'in'
  /** A non-blocking exception (FLEGS, guard duty, ...) — shown as a note. */
  | 'in-excused'
  /** Pinged, and a commander confirmed he CAN take part. */
  | 'in-confirmed'
  /** MC, report sick, or out of camp — always out, not overridable. */
  | 'out-auto'
  /** LD / RMJ with no call yet — out until someone decides. */
  | 'out-default'
  /** Pinged, and a commander confirmed he cannot. */
  | 'out-confirmed'
  /** Nothing blocking, but fallen out by hand with a reason. */
  | 'out-manual'

export interface Participation {
  soldier: Soldier
  kind: ParticipationKind
  participating: boolean
  /** Why he's out (null while participating). */
  reason: string | null
  /** An exception shown while he's participating. */
  note: string | null
  decision: ConductDecision | null
}

/** Types that need a commander's call before they count either way. */
const CONFIRM_TYPES = new Set(['LD', 'RMJ'])
const RMJ_RE = /\bRMJ\b/i

/**
 * True for a report sick.
 * By scope, not type: a report sick is typed URTI or Report Sick (non-URTI)
 */
const isReportSick = (e: Exception) => e.scope === 'Report Sick'

/** The reason to print for an exception, else its type. */
function describe(e: Exception): string {
  if (isReportSick(e)) return e.reason ? `Report Sick — ${e.reason}` : 'Report Sick'
  return e.reason || exceptionType(e)
}

/** True when an exception rules a soldier out regardless of any call. */
const isHard = (e: Exception) => e.counts_as_absence || exceptionType(e) === 'MC' || isReportSick(e)

/** An MC reads first, then a report sick, then whatever keeps him out of camp. */
function hardOutReason(active: Exception[]): string | null {
  const pick =
    active.find((e) => exceptionType(e) === 'MC') ??
    active.find(isReportSick) ??
    active.find((e) => e.counts_as_absence)
  return pick ? describe(pick) : null
}

/** Orders soldiers most senior first, then by 4D, then name. */
function compareSoldiers(a: Soldier, b: Soldier): number {
  return (
    RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank) ||
    (a.four_d ?? '').localeCompare(b.four_d ?? '', undefined, { numeric: true }) ||
    a.name.localeCompare(b.name)
  )
}

/**
 * Sorts every on-strength soldier into taking part / falling out. Per soldier,
 * the first match wins: a hard exception; a stored decision; an LD/RMJ (out
 * pending a call); any other exception (in, with a note); else in.
 */
export function classifyConduct(
  conduct: Conduct,
  soldiers: Soldier[],
  exceptions: Exception[],
  decisions: ConductDecision[],
  todayISO: string,
): Participation[] {
  const people = soldiers.filter(isOnStrength).sort(compareSoldiers)
  const active = buildActiveMap(exceptions, people, conductDay(conduct, todayISO))
  const decisionFor = new Map(decisions.filter((d) => d.conduct_id === conduct.id).map((d) => [d.soldier_id, d]))

  return people.map((soldier): Participation => {
    const mine = active.get(soldierKeyOf(soldier)) ?? []
    const hard = hardOutReason(mine)
    if (hard) return { soldier, kind: 'out-auto', participating: false, reason: hard, note: null, decision: null }

    const soft = mine.filter((e) => !isHard(e))
    const softReason = soft.map(describe).join(', ') || null
    const decision = (soldier.id && decisionFor.get(soldier.id)) || null
    if (decision) {
      if (decision.participating) return { soldier, kind: 'in-confirmed', participating: true, reason: null, note: softReason, decision }
      return {
        soldier,
        kind: soft.length ? 'out-confirmed' : 'out-manual',
        participating: false,
        reason: decision.reason || softReason || 'Fall out',
        note: null,
        decision,
      }
    }

    if (soft.some((e) => CONFIRM_TYPES.has(exceptionType(e)) || RMJ_RE.test(e.reason ?? '')))
      return { soldier, kind: 'out-default', participating: false, reason: softReason, note: null, decision: null }
    if (soft.length) return { soldier, kind: 'in-excused', participating: true, reason: null, note: softReason, decision: null }
    return { soldier, kind: 'in', participating: true, reason: null, note: null, decision: null }
  })
}

/** The "needs a call" pile: pinged and not yet decided. */
export const needsDecision = (parts: Participation[]): Participation[] => parts.filter((p) => p.kind === 'out-default')

/** Companies whose COY HQ sits out of conducts entirely: not counted, not listed. */
const HQ_EXCLUDED = new Set<Company>(['hercules'])
/** Whether COY HQ takes part in conducts for this company. */
export const conductIncludesHQ = (company: Company): boolean => !HQ_EXCLUDED.has(company)

/** The roll a conduct is classified over — the whole company, less COY HQ where it sits out. */
export const conductSoldiers = (company: Company, soldiers: Soldier[]): Soldier[] =>
  conductIncludesHQ(company) ? soldiers : soldiers.filter((s) => s.platoon !== 'HQ')

/** COY HQ first (unless it sits out), then the company's platoons — the same blocks as the parade state. */
export function conductBlocks(platoons: PlatoonBlock[], includeHQ = true): { key: string; label: string }[] {
  const blocks = platoons.map((p) => ({ key: p.key, label: p.label }))
  return includeHQ ? [{ key: 'HQ', label: 'COY HQ' }, ...blocks] : blocks
}


/** Title, date and time lines for a conduct state. */
function headerLines(label: string, c: Conduct): string[] {
  const lines = [`${label} CONDUCT STATE`, `CONDUCT: ${c.name.toUpperCase()}`, `DATE: ${conductDateRange(c)}`]
  const time = conductTimeRange(c)
  if (time) lines.push(`TIME: ${time}HRS`)
  return lines
}

/** Commander, trooper and overall in/total counts, plus the fall-out count. */
function strengthLines(parts: Participation[]): string[] {
  /** "in/total" for a group, zero-padded. */
  const inOf = (g: Participation[]) => `${pad2(g.filter((p) => p.participating).length)}/${pad2(g.length)}`
  const cdrs = parts.filter((p) => isCommander(p.soldier))
  const troopers = parts.filter((p) => !isCommander(p.soldier))
  return [
    `COMMANDERS: ${inOf(cdrs)}`,
    `TROOPERS: ${inOf(troopers)}`,
    `OVERALL: ${inOf(parts)}`,
    `FALL OUT: ${pad2(parts.filter((p) => !p.participating).length)}`,
  ]
}

/** Numbered fall-out lines with each reason. */
function fallOutLines(parts: Participation[]): string[] {
  return parts
    .filter((p) => !p.participating)
    .map((p, i) => `${i + 1}. ${p.soldier.four_d ? `${p.soldier.four_d} ` : ''}${p.soldier.rank} ${p.soldier.name} — ${(p.reason ?? '').toUpperCase()}`)
}

/** The whole company's conduct state: strength, trooper fall-outs per block, commander fall-outs last. */
export function generateConductState(companyLabel: string, c: Conduct, parts: Participation[], platoons: PlatoonBlock[], includeHQ = true): string {
  const lines = [...headerLines(`${companyLabel.toUpperCase()} COY`, c), '', ...strengthLines(parts)]
  for (const block of conductBlocks(platoons, includeHQ)) {
    const out = fallOutLines(parts.filter((p) => p.soldier.platoon === block.key && !isCommander(p.soldier)))
    lines.push('', `${block.label}: ${pad2(out.length)}`, ...out)
  }
  const cdrOut = fallOutLines(parts.filter((p) => isCommander(p.soldier)))
  lines.push('', `COMMANDERS: ${pad2(cdrOut.length)}`, ...cdrOut)
  return lines.join('\n')
}

/** One block's conduct state — what each PDS sends up before it's collated. */
export function generatePlatoonConductState(c: Conduct, parts: Participation[], block: { key: string; label: string }): string {
  const mine = parts.filter((p) => p.soldier.platoon === block.key)
  const lines = [...headerLines(block.label, c), '', ...strengthLines(mine)]
  const out = fallOutLines(mine.filter((p) => !isCommander(p.soldier)))
  if (out.length) lines.push('', ...out)
  const cdrOut = fallOutLines(mine.filter((p) => isCommander(p.soldier)))
  if (cdrOut.length) lines.push('', `COMMANDERS: ${pad2(cdrOut.length)}`, ...cdrOut)
  return lines.join('\n')
}
