import type { OffLeave, Soldier } from '@/shared/types'
import { RANK_ORDER } from '@/backend/domain/nominal-roll/nominal-roll-validation'

/**
 * True for a positive amount in whole or half days (0.5 steps).
 * Positive and in half-day steps (0.5, 1, 1.5, ...).
 */
export function isValidAmount(n: number): boolean {
  return Number.isFinite(n) && n > 0 && Number.isInteger(n * 2)
}

/**
 * Sorts balance rows by the soldier's seniority, then name.
 * Most senior rank first, then name. Soldiers not on the nominal roll (or with an unranked
 * rank) sort to the bottom.
 */
export function sortOffLeaveByRank(rows: OffLeave[], soldiers: Soldier[]): OffLeave[] {
  const rankOf = new Map(soldiers.map((s) => [s.name, s.rank]))
  /** Rank order of a name's soldier; -1 when not on the roll. */
  const order = (name: string) => RANK_ORDER[rankOf.get(name) ?? ''] ?? -1
  return [...rows].sort((a, b) => order(b.name) - order(a.name) || a.name.localeCompare(b.name))
}
