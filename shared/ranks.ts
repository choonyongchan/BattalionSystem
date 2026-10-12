/** Every accepted rank, by rank type. getRankType reads Officer and WOSPEC; the rest are Enlistee. */
export const RANKS_BY_TYPE = {
  Officer: ['2LT', 'LTA', 'CPT', 'CPT(DR)', 'MAJ', 'LTC', 'SLTC', 'COL', 'BG', 'MG', 'LG', 'ME4', 'ME5', 'ME6', 'ME7', 'ME8'],
  WOSPEC: ['3SG', '2SG', '1SG', 'SSG', 'MSG', 'ME1', 'ME2', 'ME3', '3WO', '2WO', '1WO', 'MWO', 'SWO', 'CWO'],
  Enlistee: ['REC', 'PTE', 'LCP', 'CPL', 'CFC'],
}

/** Ranks a nominal roll row may hold. */
export const VALID_RANKS = new Set(Object.values(RANKS_BY_TYPE).flat())

/** Every rank paired with its rank type, for rank pickers. */
export const ALL_RANKS = Object.entries(RANKS_BY_TYPE).flatMap(([type, ranks]) =>
  ranks.map((rank) => ({ rank, type })),
)

/** Every valid rank, most junior first; ME ranks sit beside their equivalents. */
export const RANK_ORDER = [
  'REC', 'PTE', 'LCP', 'CPL', 'CFC',
  '3SG', 'ME1', '2SG', '1SG', 'ME2', 'SSG', 'MSG', '3WO', '2WO', 'ME3', '1WO', 'MWO', 'SWO', 'CWO',
  '2LT', 'LTA', 'ME4', 'CPT', 'CPT(DR)', 'ME5', 'MAJ', 'ME6', 'LTC', 'ME7', 'SLTC', 'ME8', 'COL', 'BG', 'MG', 'LG',
]

/** Seniority of a rank (index in RANK_ORDER); undefined for an unknown rank. */
export const RANK_INDEX: Record<string, number> = Object.fromEntries(RANK_ORDER.map((r, i) => [r, i]))

/** An inclusive rank range, junior end first. */
export type RankRule = { from: string; to: string }

/** Every rank: the rule for a duty type with no default and no override, e.g. one added in Settings. */
export const ANY_RANK: RankRule = { from: RANK_ORDER[0], to: RANK_ORDER[RANK_ORDER.length - 1] }

/** Default rank range per duty type; a company overrides these in Settings > Duty Eligibility. */
export const DEFAULT_RANK_RULES: Record<string, RankRule> = {
  CDO:  { from: '2LT', to: 'LTA' },
  CDS:  { from: '2SG', to: '1SG' },
  COS:  { from: 'PTE', to: '3SG' },
  PDS1: { from: '3SG', to: '1SG' },
  PDS2: { from: '3SG', to: '1SG' },
  PDS3: { from: '3SG', to: '1SG' },
  PDS4: { from: '3SG', to: '1SG' },
  'Duty Clerk': { from: 'REC', to: 'CFC' },
}

/** The guard duty roles; a soldier fitting any role's range may do guard duty. */
export const GUARD_DUTY_ROLES = ['CDOS', 'Guard Comd', 'Guard 2IC', 'Regimental Guard'] as const

/** Default rank range per guard duty role; overridden in Settings > Guard Duty Roles. */
export const DEFAULT_GUARD_DUTY_RANK_RULES: Record<string, RankRule> = {
  CDOS: { from: '3SG', to: '2SG' },
  'Guard Comd': { from: '3SG', to: '2SG' },
  'Guard 2IC': { from: '3SG', to: '2SG' },
  'Regimental Guard': { from: 'PTE', to: '2SG' },
}

/** Rank types in display order. */
export const RANK_TYPES = ['Officer', 'WOSPEC', 'Enlistee'] as const

/** Officer, WOSPEC or Enlistee for a rank. */
export function getRankType(rank: string): 'Officer' | 'WOSPEC' | 'Enlistee' {
  if (RANKS_BY_TYPE.Officer.some((p) => rank.startsWith(p))) return 'Officer'
  if (RANKS_BY_TYPE.WOSPEC.includes(rank)) return 'WOSPEC'
  return 'Enlistee'
}

/** Officers and WOSPECs: everyone who isn't an enlistee. */
export const isCommander = (s: { rank: string }): boolean => getRankType(s.rank) !== 'Enlistee'
