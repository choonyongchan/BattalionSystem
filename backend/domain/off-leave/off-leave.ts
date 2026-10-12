import type { OffLeave, Soldier } from '@/shared/types'
import { RANK_INDEX } from '@/shared/ranks'

/** True for a positive amount in half-day steps (0.5, 1, 1.5, ...). */
export function isValidAmount(n: number): boolean {
  return Number.isFinite(n) && n > 0 && Number.isInteger(n * 2)
}

/**
 * Sorts balance rows most senior first, then by name. Soldiers not on the nominal roll
 * (or with an unknown rank) sort to the bottom.
 */
export function sortOffLeaveByRank(rows: OffLeave[], soldiers: Soldier[]): OffLeave[] {
  const rankOf = new Map(soldiers.map((s) => [s.name, s.rank]))
  /** Seniority of a name's soldier; -1 when not on the roll. */
  const order = (name: string) => RANK_INDEX[rankOf.get(name) ?? ''] ?? -1
  return [...rows].sort((a, b) => order(b.name) - order(a.name) || a.name.localeCompare(b.name))
}
