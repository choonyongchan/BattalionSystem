import type { DutyEntry, Exception, Soldier } from '@/shared/types'
import { exceptionType, isOnStrength, soldierKeyOf, buildActiveMap } from '@/backend/domain/exceptions/active'
import { splitDutyNames } from '@/shared/names'
import { ddmmyy } from '@/shared/dates'

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
  const m = s.four_d?.match(/^(\d)(\d)\d\d$/)
  return m ? `PLT ${m[1]} BUNK ${m[2]}` : null
}

/** The platoon a bunk belongs to ("PLT 1"), or null for a standalone bunk. */
export const platoonOfBunk = (bunk: string): string | null => bunk.match(/^(PLT \S+)/)?.[1] ?? null

/** True when an exception keeps the soldier out of the bunk: absences, Others (stay out...) and guard duty. */
const keepsOut = (e: Exception) => e.counts_as_absence || e.scope === 'Others' || e.scope === 'Guard Duty'

/** One soldier's place in the count. */
export interface BunkMember {
  soldier: Soldier
  /** Why they are out; empty when in. NO_REASON when marked out by hand. */
  reasons: string[]
}

export interface Bunk {
  label: string
  members: BunkMember[]
}

export interface BunkGroup {
  /** "PLT 1", or null for bunks outside any platoon. */
  platoon: string | null
  bunks: Bunk[]
}

const isIn = (m: BunkMember) => m.reasons.length === 0
/** "present/total" for some members. */
export const strength = (members: BunkMember[]) => `${members.filter(isIn).length}/${members.length}`

/** Sorts by 4D, then name. */
const byFourD = (a: Soldier, b: Soldier) =>
  (a.four_d ?? '').localeCompare(b.four_d ?? '', undefined, { numeric: true }) || a.name.localeCompare(b.name)
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

/**
 * Groups on-strength soldiers by platoon and bunk with their reasons for being out on `date`.
 * `markedOut` holds soldier keys unticked by hand.
 */
export function buildBunks(
  soldiers: Soldier[], exceptions: Exception[], duties: DutyEntry[], date: string, markedOut: Set<string>,
): BunkGroup[] {
  const people = soldiers.filter(isOnStrength)
  const active = buildActiveMap(exceptions, people, date)
  const onDuty = new Map<string, string[]>()
  for (const d of duties.filter((d) => d.date === date)) {
    for (const name of splitDutyNames(d.name)) onDuty.set(name, [...(onDuty.get(name) ?? []), d.duty_type])
  }

  const bunks = new Map<string, BunkMember[]>()
  for (const soldier of people.sort(byFourD)) {
    const label = bunkOf(soldier)
    if (!label) continue
    const key = soldierKeyOf(soldier)
    const reasons = [
      ...(active.get(key) ?? []).filter(keepsOut).map((e) => e.reason?.trim() || exceptionType(e)),
      ...(onDuty.get(soldier.name) ?? []),
    ]
    if (!reasons.length && markedOut.has(key)) reasons.push(NO_REASON)
    bunks.set(label, [...(bunks.get(label) ?? []), { soldier, reasons: [...new Set(reasons)] }])
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

/** "1101 PTE KAI YANG - Stay Out" */
const absenteeLine = ({ soldier: s, reasons }: BunkMember) =>
  `${[s.four_d, s.rank, s.name].filter(Boolean).join(' ')} - ${reasons.join(', ')}`

/** WhatsApp message: per bunk its strength, then only the people who are out and why. */
export function generateBunkMessage(parade: string, date: string, time: string, groups: BunkGroup[]): string {
  const lines = [`*${parade.toUpperCase()} STRENGTH CAA ${ddmmyy(date)} ${time.replace(':', '')}HRS*`]
  for (const g of groups) {
    if (g.platoon) lines.push('', `*${g.platoon}: ${strength(g.bunks.flatMap((b) => b.members))}*`)
    for (const b of g.bunks) {
      lines.push('', `*${b.label} (${strength(b.members)})*`, ...b.members.filter((m) => !isIn(m)).map(absenteeLine))
    }
  }
  return lines.join('\n')
}
