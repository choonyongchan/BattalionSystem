import type { DutyEntry, Exception, Soldier } from '@/shared/types'
import { exceptionType, isOnStrength, soldierKeyOf, buildActiveMap } from '@/backend/domain/exceptions/active'
import { splitDutyNames } from '@/shared/names'
import { ddmmyy } from '@/shared/dates'
import { isCommander } from '@/shared/ranks'

/**
 * Bunk strength: who is in each bunk tonight. A soldier's bunk is the Bunk field on the
 * roll, else read off the 4D (1203 = PLT 1 BUNK 2). Soldiers with neither are not counted.
 */

/** Marks someone out of the bunk with no reason keyed yet. */
export const NO_REASON = '❌️'

/** The soldier's bunk label, e.g. "PLT 1 BUNK 2" or "ASA + MEDIC BUNK"; null when unknown. */
export function bunkOf(s: Soldier): string | null {
  const own = s.bunk?.trim()
  if (own) return own.toUpperCase()
  // ponytail: one 4D layout (platoon, bunk, two digits); make it a setting if a company differs
  const m = s.four_d?.match(/^(\d)(\d)\d\d$/)
  return m ? `PLT ${m[1]} BUNK ${m[2]}` : null
}

/** Duties done in camp: the trooper still counts in the bunk. */
const IN_CAMP_DUTIES = ['COS', 'Duty Clerk']

/** The platoon a bunk belongs to ("PLT 1"), or null for a standalone bunk. */
const platoonOfBunk = (bunk: string): string | null => bunk.match(/^(PLT \S+)/)?.[1] ?? null


/** One trooper's place in the count. */
export interface BunkMember {
  soldier: Soldier
  /** Why they are out; empty when in. NO_REASON when marked out by hand. */
  reasons: string[]
  /** Reasons the soldier should be out but was marked present anyway; undefined otherwise. */
  flagged?: string[]
}

/** A bunk and its troopers, by 4D. */
export interface Bunk {
  label: string
  members: BunkMember[]
}

/** One platoon's bunks. */
export interface BunkGroup {
  /** "PLT 1", or null for bunks outside any platoon. */
  platoon: string | null
  bunks: Bunk[]
}

/** True when the member is in the bunk. */
const isIn = (m: BunkMember) => m.reasons.length === 0
/** "present/total" for some members. */
export const strength = (members: BunkMember[]) => `${members.filter(isIn).length}/${members.length}`

/** Sorts by 4D, then name. */
const byFourD = (a: Soldier, b: Soldier) =>
  (a.four_d ?? '').localeCompare(b.four_d ?? '', undefined, { numeric: true }) || a.name.localeCompare(b.name)
/** Natural order, so "BUNK 10" follows "BUNK 9". */
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

/**
 * Groups on-strength troopers by platoon and bunk with their reasons for being out on `date`.
 * Out of the bunk: an absence, an exception in `outScopes` (Settings > Overview), or a duty that day other than COS and Duty Clerk.
 * Reasons show the exception's category (exceptionType), e.g. RSO rather than its free-text reason.
 * `markedOut` holds soldier keys unticked by hand; `markedPresent` holds keys ticked in despite a reason (flagged).
 */
export function buildBunks(
  soldiers: Soldier[], exceptions: Exception[], duties: DutyEntry[], date: string, markedOut: Set<string>, outScopes: string[],
  markedPresent: Set<string> = new Set(),
): BunkGroup[] {
  const people = soldiers.filter((s) => isOnStrength(s) && !isCommander(s))
  const keepsOut = (e: Exception) => e.counts_as_absence || outScopes.includes(e.scope)
  const active = buildActiveMap(exceptions, people, date)
  const onDuty = new Map<string, string[]>()
  for (const d of duties.filter((d) => d.date === date && !IN_CAMP_DUTIES.includes(d.duty_type))) {
    for (const name of splitDutyNames(d.name)) onDuty.set(name, [...(onDuty.get(name) ?? []), d.duty_type])
  }

  const bunks = new Map<string, BunkMember[]>()
  for (const soldier of people.sort(byFourD)) {
    const label = bunkOf(soldier)
    if (!label) continue
    const key = soldierKeyOf(soldier)
    const reasons = [
      ...(active.get(key) ?? []).filter(keepsOut).map(exceptionType),
      ...(onDuty.get(soldier.name) ?? []),
    ]
    if (!reasons.length && markedOut.has(key)) reasons.push(NO_REASON)
    const unique = [...new Set(reasons)]
    const member: BunkMember = markedPresent.has(key) && unique.length
      ? { soldier, reasons: [], flagged: unique }
      : { soldier, reasons: unique }
    bunks.set(label, [...(bunks.get(label) ?? []), member])
  }

  const groups = new Map<string | null, Bunk[]>()
  for (const label of [...bunks.keys()].sort(natural)) {
    const p = platoonOfBunk(label)
    groups.set(p, [...(groups.get(p) ?? []), { label, members: bunks.get(label)! }])
  }
  // Platoons in order, then the standalone bunks
  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : natural(a, b)))
    .map(([platoon, list]) => ({ platoon, bunks: list }))
}

/** "> 1101 PTE KAI YANG - Stay Out", a quote line in chat apps. */
const absenteeLine = ({ soldier: s, reasons }: BunkMember) =>
  `> ${[s.four_d, s.rank, s.name].filter(Boolean).join(' ')} - ${reasons.join(', ')}`

/** WhatsApp message: per bunk its strength, then only the people who are out and why. `title` is Settings > Overview. */
export function generateBunkMessage(title: string, date: string, time: string, groups: BunkGroup[]): string {
  const lines = [`*${title.toUpperCase()} ${ddmmyy(date)} ${time.replace(':', '')}HRS*`]
  for (const g of groups) {
    if (g.platoon) lines.push('', `*${g.platoon}: ${strength(g.bunks.flatMap((b) => b.members))}*`)
    for (const b of g.bunks) {
      lines.push('', `*${b.label} (${strength(b.members)})*`, ...b.members.filter((m) => !isIn(m)).map(absenteeLine))
    }
  }
  const flagged = groups.flatMap((g) => g.bunks.flatMap((b) => b.members.filter((m) => m.flagged)))
  if (flagged.length) {
    lines.push('', '*⚠️ PRESENT DESPITE REASON*', ...flagged.map((m) => absenteeLine({ ...m, reasons: m.flagged! })))
  }
  return lines.join('\n')
}
