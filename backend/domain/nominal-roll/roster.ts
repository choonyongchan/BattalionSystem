import type { Soldier } from '@/shared/types'
import { getRankType, RANKS_BY_TYPE } from '@/shared/ranks'
import { RANK_ORDER, sortValue } from './nominal-roll-validation'

export type SoldierSortKey = 'four_d' | 'platoon' | 'rank' | 'name'
export type SortDir = 'asc' | 'desc'
export type RankType = keyof typeof RANKS_BY_TYPE

/** Rank-type sections in display order: Officer, WOSPEC, Enlistee. */
export const RANK_SECTIONS = Object.keys(RANKS_BY_TYPE) as RankType[]

/** Keeps soldiers whose rank, name, platoon or 4D contains the query (case-insensitive). */
export function filterSoldiers(soldiers: Soldier[], query: string): Soldier[] {
  const q = query.toLowerCase()
  if (!q) return soldiers
  return soldiers.filter((s) => [s.rank, s.name, s.platoon, s.four_d].some((v) => v?.toLowerCase().includes(q)))
}

/**
 * Sorts by the chosen column, or by default 4D, platoon, seniority (senior first), then name.
 * @param key Column to sort by; null for the default order.
 */
export function sortSoldiers(soldiers: Soldier[], key: SoldierSortKey | null, dir: SortDir): Soldier[] {
  return [...soldiers].sort((a, b) => {
    if (!key) {
      return (a.four_d ?? '').localeCompare(b.four_d ?? '')
        || (a.platoon ?? '').localeCompare(b.platoon ?? '')
        || ((RANK_ORDER[b.rank] ?? 99) - (RANK_ORDER[a.rank] ?? 99))
        || a.name.localeCompare(b.name)
    }
    const va = sortValue(a, key)
    const vb = sortValue(b, key)
    const cmp = typeof va === 'number' ? va - (vb as number) : va.localeCompare(vb as string)
    return dir === 'asc' ? cmp : -cmp
  })
}

/** Splits soldiers into Officer / WOSPEC / Enlistee lists, keeping their order. */
export function groupByRankType(soldiers: Soldier[]): Record<RankType, Soldier[]> {
  return Object.fromEntries(RANK_SECTIONS.map((t) => [t, soldiers.filter((s) => getRankType(s.rank) === t)])) as Record<RankType, Soldier[]>
}
