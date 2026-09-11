import type { OffLeave, Soldier } from '../supabase'
import { RANK_ORDER } from '../nominal-roll/nominal-roll-validation'

// Positive and in half-day steps (0.5, 1, 1.5, ...).
export function isValidAmount(n: number): boolean {
  return Number.isFinite(n) && n > 0 && Number.isInteger(n * 2)
}

// Most senior rank first, then name. Soldiers not on the nominal roll (or with an unranked
// rank) sort to the bottom.
export function sortOffLeaveByRank(rows: OffLeave[], soldiers: Soldier[]): OffLeave[] {
  const rankOf = new Map(soldiers.map((s) => [s.name, s.rank]))
  const order = (name: string) => RANK_ORDER[rankOf.get(name) ?? ''] ?? -1
  return [...rows].sort((a, b) => order(b.name) - order(a.name) || a.name.localeCompare(b.name))
}
