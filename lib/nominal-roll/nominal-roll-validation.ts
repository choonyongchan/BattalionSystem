import type { Soldier } from '../supabase'
import { ALL_RANKS, RANKS_BY_TYPE } from '../companies'

export const RANK_ORDER = Object.fromEntries(Object.values(RANKS_BY_TYPE).flat().map((r, i) => [r, i]))

export interface EditRow {
  originalName: string
  rank: string
  name: string
  platoon: string
  four_d: string
}

export function validateEdit(editRow: EditRow | null): Record<string, boolean> {
  if (!editRow) return { name: true }
  const errors: Record<string, boolean> = {}
  if (!editRow.name.trim()) errors.name = true
  if (!editRow.platoon) errors.platoon = true
  if (!ALL_RANKS.some((r) => r.rank === editRow.rank)) errors.rank = true
  return errors
}

export function sortValue(s: Soldier, key: 'four_d' | 'platoon' | 'rank' | 'name'): string | number {
  switch (key) {
    case 'four_d': return (s.four_d ?? '').toLowerCase()
    case 'platoon': return (s.platoon ?? '').toLowerCase()
    case 'rank': return RANK_ORDER[s.rank] ?? 99
    case 'name': return s.name.toLowerCase()
  }
}
