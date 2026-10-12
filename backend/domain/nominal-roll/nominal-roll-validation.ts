import type { Soldier } from '@/shared/types'
import { ALL_RANKS, RANK_ORDER as CANONICAL_RANK_ORDER } from '@/shared/ranks'

export const RANK_ORDER = Object.fromEntries(CANONICAL_RANK_ORDER.map((r, i) => [r, i]))

export interface EditRow {
  originalName: string
  rank: string
  name: string
  platoon: string
  four_d: string
  /** Bunk label when the 4D does not give it. */
  bunk?: string
}

/** Field errors for an edited nominal roll row. */
export function validateEdit(editRow: EditRow | null): Record<string, boolean> {
  if (!editRow) return { name: true }
  const errors: Record<string, boolean> = {}
  if (!editRow.name.trim()) errors.name = true
  if (!editRow.platoon) errors.platoon = true
  if (!ALL_RANKS.some((r) => r.rank === editRow.rank)) errors.rank = true
  return errors
}

/** The value a soldier sorts by for a table column. */
export function sortValue(s: Soldier, key: 'four_d' | 'platoon' | 'rank' | 'name'): string | number {
  switch (key) {
    case 'four_d': return (s.four_d ?? '').toLowerCase()
    case 'platoon': return (s.platoon ?? '').toLowerCase()
    case 'rank': return RANK_ORDER[s.rank] ?? 99
    case 'name': return s.name.toLowerCase()
  }
}
