export const RANKS_BY_TYPE = {
  Officer: ['2LT', 'LTA', 'CPT', 'CPT(DR)', 'MAJ', 'LTC', 'SLTC', 'COL', 'BG', 'MG', 'LG', 'ME4', 'ME5', 'ME6', 'ME7', 'ME8'],
  WOSPEC: ['3SG', '2SG', '1SG', 'SSG', 'MSG', 'ME1', 'ME2', 'ME3', '3WO', '2WO', '1WO', 'MWO', 'SWO', 'CWO'],
  Enlistee: ['REC', 'PTE', 'LCP', 'CPL', 'CFC'],
}

export const VALID_RANKS = new Set(Object.values(RANKS_BY_TYPE).flat())

export const ALL_RANKS = Object.entries(RANKS_BY_TYPE).flatMap(([type, ranks]) =>
  ranks.map((rank) => ({ rank, type })),
)

export const RANK_ORDER = [
  'REC','PTE','LCP','CPL','CFC',
  '3SG','2SG','1SG','SSG','MSG','3WO','2WO','1WO','MWO','SWO','CWO',
  '2LT','LTA','CPT','MAJ','LTC','SLTC','COL','BG','MG','LG',
]

export const DEFAULT_RANK_RULES: Record<string, { from: string; to: string }> = {
  CDO:  { from: '2LT', to: 'LTA' },
  CDS:  { from: '2SG', to: '1SG' },
  COS:  { from: 'PTE', to: '3SG' },
  PDS1: { from: '3SG', to: '1SG' },
  PDS2: { from: '3SG', to: '1SG' },
  PDS3: { from: '3SG', to: '1SG' },
  PDS4: { from: '3SG', to: '1SG' },
  'Duty Clerk': { from: 'REC', to: 'CFC' },
}

export const GUARD_DUTY_ROLES = ['CDOS', 'Guard Comd', 'Guard 2IC', 'Regimental Guard'] as const

export const DEFAULT_GUARD_DUTY_RANK_RULES: Record<string, { from: string; to: string }> = {
  CDOS: { from: '3SG', to: '2SG' },
  'Guard Comd': { from: '3SG', to: '2SG' },
  'Guard 2IC': { from: '3SG', to: '2SG' },
  'Regimental Guard': { from: 'PTE', to: '2SG' },
}

export const RANK_TYPES = ['Officer', 'WOSPEC', 'Enlistee'] as const

/** Officer, WOSPEC or Enlistee for a rank. */
export function getRankType(rank: string): 'Officer' | 'WOSPEC' | 'Enlistee' {
  if (RANKS_BY_TYPE.Officer.some((p) => rank.startsWith(p))) return 'Officer'
  if (RANKS_BY_TYPE.WOSPEC.includes(rank)) return 'WOSPEC'
  return 'Enlistee'
}

// ponytail: eligibility hardcoded per spec; rules change with policy, not data
export const DUTY_ELIGIBILITY: Record<string, (rank: string) => boolean> = {
  CDO:  r => getRankType(r) === 'Officer',
  CDS:  r => ['2SG','1SG','SSG','MSG','ME1','ME2','ME3','3WO','2WO','1WO','MWO','SWO','CWO'].includes(r),
  COS:  r => r !== 'REC',
  PDS1: r => getRankType(r) === 'WOSPEC',
  PDS2: r => getRankType(r) === 'WOSPEC',
  PDS3: r => getRankType(r) === 'WOSPEC',
  PDS4: r => getRankType(r) === 'WOSPEC',
  'Duty Clerk': r => ['REC', 'PTE', 'LCP', 'CPL', 'CFC'].includes(r),
}

export const DUTY_ELIGIBILITY_DESC: Record<string, string> = {
  CDO:  '2LT & above',
  CDS:  '2SG & above',
  COS:  'PTE & above',
  PDS1: '3SG & above',
  PDS2: '3SG & above',
  PDS3: '3SG & above',
  PDS4: '3SG & above',
  'Duty Clerk': 'REC - CFC',
}
