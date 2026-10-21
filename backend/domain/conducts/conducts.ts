import type { Conduct, ConductDecision, DutyEntry, Exception, Soldier } from '@/shared/types'
import type { OverviewMark } from '@/backend/data/repositories/OverviewMarkRepository'
import { NO_REASON, buildBunks } from '@/backend/domain/overview/bunks'
import { RANK_INDEX, isCommander } from '@/shared/ranks'
import { wordsRegex } from '@/shared/names'
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

export type ParticipationKind =
  /** No active exception. */
  | 'in'
  /** A non-blocking exception (FLEGS, guard duty, ...) — to confirm until a commander calls it. */
  | 'in-excused'
  /** Ticked in on the Overview despite a reason — to confirm. */
  | 'to-confirm'
  /** Pinged, and a commander confirmed he CAN take part. */
  | 'in-confirmed'
  /** Report sick (RSI/RSO) — falls out automatically; a commander may still let him take part. */
  | 'out-auto'
  /** MC, Att C, MA, course or any other absence — not in camp, so outside the strength. Can be overridden to take part. */
  | 'not-in-camp'
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


/**
 * True for a report sick (RSI or RSO), which always falls the soldier out.
 * By scope, as it is typed URTI or Report Sick; a medical review is only a note.
 */
const isReportSick = (e: Exception) => e.scope === 'Report Sick' && exceptionType(e) !== 'Medical Review'

/** The reason to print for an exception, else its type. */
function describe(e: Exception): string {
  if (isReportSick(e)) return e.reason ? `Report Sick — ${e.reason}` : 'Report Sick'
  return e.reason || exceptionType(e)
}

/** True when an exception rules a soldier out regardless of any call. */
const isHard = (e: Exception) => e.counts_as_absence || exceptionType(e) === 'MC' || isReportSick(e)

/** An MC reads first, then a report sick, then whatever keeps him out of camp. */
function hardOutReason(active: Exception[]): Exception | undefined {
  return (
    active.find((e) => exceptionType(e) === 'MC') ??
    active.find(isReportSick) ??
    active.find((e) => e.counts_as_absence)
  )
}

/** False for someone not in camp: outside the strength and the message. */
export const inCamp = (p: Participation): boolean => p.kind !== 'not-in-camp'

/** True for someone waiting on a commander's call: an excuse, an LD / RMJ or a flagged Overview tick. */
export const isToConfirm = (p: Participation): boolean => p.kind === 'in-excused' || p.kind === 'out-default' || p.kind === 'to-confirm'

/** Orders soldiers most senior first, then by 4D, then name. */
function compareSoldiers(a: Soldier, b: Soldier): number {
  return (
    (RANK_INDEX[b.rank] ?? -1) - (RANK_INDEX[a.rank] ?? -1) ||
    (a.four_d ?? '').localeCompare(b.four_d ?? '', undefined, { numeric: true }) ||
    a.name.localeCompare(b.name)
  )
}

/**
 * Sorts every on-strength soldier into taking part / falling out. Per soldier,
 * the first match wins: a hard exception; a stored decision; a needs-call type,
 * by type or named in the reason (out pending a call); any other exception
 * (in, with a note); else in.
 * @param needsCallTypes Settings > Conducts, e.g. ['LD', 'RMJ'].
 */
export function classifyConduct(
  conduct: Conduct,
  soldiers: Soldier[],
  exceptions: Exception[],
  decisions: ConductDecision[],
  todayISO: string,
  needsCallTypes: string[],
): Participation[] {
  const people = soldiers.filter(isOnStrength).sort(compareSoldiers)
  const callTypes = new Set(needsCallTypes)
  const callRe = wordsRegex(needsCallTypes)
  const active = buildActiveMap(exceptions, people, conductDay(conduct, todayISO))
  const decisionFor = new Map(decisions.filter((d) => d.conduct_id === conduct.id).map((d) => [d.soldier_id, d]))

  return people.map((soldier): Participation => {
    const mine = active.get(soldierKeyOf(soldier)) ?? []
    const hard = hardOutReason(mine)
    const decision = (soldier.id && decisionFor.get(soldier.id)) || null
    // Groups seeded from the Overview when the conduct was created
    if (decision?.group_kind === 'out-of-camp')
      return { soldier, kind: 'not-in-camp', participating: false, reason: decision.reason, note: null, decision }
    if (decision?.group_kind === 'to-confirm')
      return { soldier, kind: 'to-confirm', participating: false, reason: decision.reason, note: null, decision }
    // A commander's "participate" overrides even a hard absence
    if (hard && !decision?.participating) {
      const kind = isReportSick(hard) ? 'out-auto' : 'not-in-camp'
      return { soldier, kind, participating: false, reason: describe(hard), note: null, decision }
    }

    const soft = mine.filter((e) => !isHard(e))
    const softReason = [...(hard ? [hard] : []), ...soft].map(describe).join(', ') || null
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

    if (soft.some((e) => callTypes.has(exceptionType(e)) || callRe.test(e.reason ?? '')))
      return { soldier, kind: 'out-default', participating: false, reason: softReason, note: null, decision: null }
    if (soft.length) return { soldier, kind: 'in-excused', participating: false, reason: softReason, note: null, decision: null }
    return { soldier, kind: 'in', participating: true, reason: null, note: null, decision: null }
  })
}

/** The "needs a call" pile: pinged and not yet decided. */
export const needsDecision = (parts: Participation[]): Participation[] => parts.filter((p) => p.kind === 'out-default')

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

/** Participating / in camp, then the fall-out and to-confirm counts, zero-padded. Not in camp is ignored. */
function strengthLines(parts: Participation[]): string[] {
  const camp = parts.filter(inCamp)
  const toConfirm = camp.filter(isToConfirm).length
  const out = camp.filter((p) => !p.participating).length - toConfirm
  return [
    `OVERALL: ${pad2(camp.length - out - toConfirm)}/${pad2(camp.length)}`,
    `FALL OUT: ${pad2(out)}`,
    ...(toConfirm ? [`TO CONFIRM: ${pad2(toConfirm)}`] : []),
  ]
}

/** Numbered lines with each reason. */
function reasonLines(parts: Participation[]): string[] {
  return parts.map((p, i) => `${i + 1}. ${p.soldier.four_d ? `${p.soldier.four_d} ` : ''}${p.soldier.rank} ${p.soldier.name} — ${(p.reason ?? '').toUpperCase()}`)
}

/** The company's conduct state: strength, then who falls out and who is to confirm. */
export function generateConductState(companyLabel: string, c: Conduct, parts: Participation[]): string {
  const camp = parts.filter(inCamp)
  const out = reasonLines(camp.filter((p) => !p.participating && !isToConfirm(p)))
  const confirm = reasonLines(camp.filter(isToConfirm))
  return [
    ...headerLines(`${companyLabel.toUpperCase()} COY`, c), '', ...strengthLines(parts),
    ...(out.length ? ['', 'FALL OUT:', ...out] : []),
    ...(confirm.length ? ['', 'TO CONFIRM:', ...confirm] : []),
  ].join('\n')
}

/**
 * The calls to store when a conduct is created, read off the Overview for the conduct day:
 * out for a reason -> out of camp; unticked with no reason -> fall out; ticked in despite a
 * reason -> to confirm. Everyone else is left to classifyConduct (an exception -> to confirm).
 */
export function seedDecisions(
  conduct: Conduct, soldiers: Soldier[], exceptions: Exception[], duties: DutyEntry[], marks: OverviewMark[], outScopes: string[], todayISO: string,
): Omit<ConductDecision, 'id' | 'conduct_id'>[] {
  const keys = (kind: OverviewMark['kind']) => new Set(marks.filter((m) => m.kind === kind).map((m) => m.key))
  const groups = buildBunks(soldiers, exceptions, duties, conductDay(conduct, todayISO), keys('out'), outScopes, keys('present'))
  return groups.flatMap((g) => g.bunks.flatMap((b) => b.members)).flatMap(({ soldier, reasons, flagged }) => {
    const call = (participating: boolean, group_kind: ConductDecision['group_kind'], why: string[]) =>
      soldier.id ? [{ soldier_id: soldier.id, participating, group_kind, reason: why.join(', ') || null }] : []
    if (flagged) return call(false, 'to-confirm', flagged)
    if (reasons[0] === NO_REASON) return call(false, null, [])
    return reasons.length ? call(false, 'out-of-camp', reasons) : []
  })
}
