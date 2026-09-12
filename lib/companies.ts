export const COMPANIES = ['archer', 'braves', 'cougar', 'stallion', 'hercules', 'test'] as const
export type Company = (typeof COMPANIES)[number]

export const DISABLED_COMPANIES = new Set<Company>(['archer', 'braves', 'cougar'])
export const HIDDEN_COMPANIES = new Set<Company>(['test'])

export function companyLabel(company: Company) {
  return company[0].toUpperCase() + company.slice(1)
}

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

export interface ScopeConfig {
  key: string
  label: string
}

// The six parade-state exception sections, fixed order, never renamed/merged/split.
export const STD_SCOPES: ScopeConfig[] = [
  { key: 'Att C',       label: 'ATT C' },
  { key: 'Status',      label: 'STATUS' },
  { key: 'Report Sick', label: 'REPORT SICK' },
  { key: 'MA',          label: 'MA' },
  { key: 'Off/Leave',   label: 'OFF/LEAVE' },
  { key: 'Others',      label: 'OTHERS' },
]

export interface PlatoonBlock {
  key: string
  label: string
  pdsLabel: string
}

export interface ParadeStateConfig {
  companyName: string
  visibleDutyTypes: string[]
  platoons: PlatoonBlock[]
}

export const ALL_DUTY_TYPES = ['CDO', 'CDS', 'COS', 'PDS1', 'PDS2', 'PDS3', 'PDS4']

// Duty types that allow two names to be assigned, splitting points and joining names with a slash.
export const MULTI_NAME_DUTY_TYPES = ['COS', 'Duty Clerk']

function platoons(labels: string[]): PlatoonBlock[] {
  return labels.map((label, i) => ({ key: (i + 1).toString(), label, pdsLabel: `PDS ${i + 1}` }))
}

const COMPANY_PLATOONS: Record<Company, PlatoonBlock[]> = {
  archer:   platoons(['PL 1', 'PL 2', 'PL 3']),
  braves:   platoons(['PL 4', 'PL 5', 'PL 6']),
  cougar:   platoons(['PL 7', 'PL 8', 'PL 9']),
  stallion: platoons(['PNR', 'SCT', 'MTR', 'SIG']),
  hercules: platoons(['OPR+ASA', 'SIG', 'MED']),
  test:     platoons(['PL 1', 'PL 2', 'PL 3']),
}

export const PARADE_CONFIG: Record<Company, ParadeStateConfig> = Object.fromEntries(
  COMPANIES.map((c) => [c, {
    companyName: c.toUpperCase(),
    visibleDutyTypes: ['CDO', 'CDS', 'COS', ...COMPANY_PLATOONS[c].map((_, i) => `PDS${i + 1}`)],
    platoons: COMPANY_PLATOONS[c],
  }]),
) as Record<Company, ParadeStateConfig>

export const COMPANY_THEMES: Record<Company, {
  cardBorder: string
  cardHoverBg: string
  cardText: string
  activeBorder: string
  activeText: string
  buttonBg: string
  buttonHoverBg: string
  focusRing: string
  badgeBg: string
  badgeText: string
}> = {
  archer: {
    cardBorder: 'border-yellow-400',
    cardHoverBg: 'hover:bg-yellow-400',
    cardText: 'text-yellow-900',
    activeBorder: 'border-yellow-500',
    activeText: 'text-yellow-700',
    buttonBg: 'bg-yellow-500',
    buttonHoverBg: 'hover:bg-yellow-600',
    focusRing: 'focus:ring-yellow-400',
    badgeBg: 'bg-yellow-100',
    badgeText: 'text-yellow-800',
  },
  braves: {
    cardBorder: 'border-red-400',
    cardHoverBg: 'hover:bg-red-400',
    cardText: 'text-red-900',
    activeBorder: 'border-red-500',
    activeText: 'text-red-700',
    buttonBg: 'bg-red-500',
    buttonHoverBg: 'hover:bg-red-600',
    focusRing: 'focus:ring-red-400',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-800',
  },
  cougar: {
    cardBorder: 'border-green-400',
    cardHoverBg: 'hover:bg-green-400',
    cardText: 'text-green-900',
    activeBorder: 'border-green-600',
    activeText: 'text-green-700',
    buttonBg: 'bg-green-600',
    buttonHoverBg: 'hover:bg-green-700',
    focusRing: 'focus:ring-green-500',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-800',
  },
  stallion: {
    cardBorder: 'border-blue-400',
    cardHoverBg: 'hover:bg-blue-400',
    cardText: 'text-blue-900',
    activeBorder: 'border-blue-600',
    activeText: 'text-blue-700',
    buttonBg: 'bg-blue-600',
    buttonHoverBg: 'hover:bg-blue-700',
    focusRing: 'focus:ring-blue-500',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
  },
  hercules: {
    cardBorder: 'border-gray-800',
    cardHoverBg: 'hover:bg-gray-900',
    cardText: 'text-gray-900',
    activeBorder: 'border-gray-800',
    activeText: 'text-gray-900',
    buttonBg: 'bg-gray-900',
    buttonHoverBg: 'hover:bg-black',
    focusRing: 'focus:ring-gray-800',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-900',
  },
  test: {
    cardBorder: 'border-gray-400',
    cardHoverBg: 'hover:bg-gray-400',
    cardText: 'text-gray-700',
    activeBorder: 'border-gray-500',
    activeText: 'text-gray-600',
    buttonBg: 'bg-gray-500',
    buttonHoverBg: 'hover:bg-gray-600',
    focusRing: 'focus:ring-gray-400',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-700',
  },
}
