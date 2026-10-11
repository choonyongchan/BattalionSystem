export const COMPANIES = ['archer', 'braves', 'cougar', 'stallion', 'hercules', 'test'] as const
export type Company = (typeof COMPANIES)[number]

export const DISABLED_COMPANIES = new Set<Company>(['archer', 'braves', 'cougar'])
export const HIDDEN_COMPANIES = new Set<Company>(['test'])

/** Capitalised company name, e.g. "hercules" -> "Hercules". */
export function companyLabel(company: Company) {
  return company[0].toUpperCase() + company.slice(1)
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

/** Builds platoon blocks from [label, PDS label, key?] tuples; key defaults to 1-based index. */
function platoons(entries: [label: string, pdsLabel: string, key?: string][]): PlatoonBlock[] {
  return entries.map(([label, pdsLabel, key], i) => ({ key: key ?? (i + 1).toString(), label, pdsLabel: `PDS ${pdsLabel}` }))
}

const COMPANY_PLATOONS: Record<Company, PlatoonBlock[]> = {
  archer:   platoons([['PL 1', '1'], ['PL 2', '2'], ['PL 3', '3']]),
  braves:   platoons([['PL 4', '4'], ['PL 5', '5'], ['PL 6', '6']]),
  cougar:   platoons([['PL 7', '7'], ['PL 8', '8'], ['PL 9', '9']]),
  stallion: platoons([['PNR', 'PNR'], ['SCR', 'SCR'], ['MTR', 'MTR'], ['SIG', 'SIG']]),
  hercules: platoons([['SIG', 'SIG', 'SIG'], ['OPR+ASA', 'OPR+ASA', 'OPR+ASA'], ['MED', 'MED', 'MED']]),
  test:     platoons([['PL 1', '1'], ['PL 2', '2'], ['PL 3', '3']]),
}

export const PARADE_CONFIG: Record<Company, ParadeStateConfig> = Object.fromEntries(
  COMPANIES.map((c) => [c, {
    companyName: c.toUpperCase(),
    visibleDutyTypes: ['CDO', 'CDS', 'COS', ...COMPANY_PLATOONS[c].map((_, i) => `PDS${i + 1}`)],
    platoons: COMPANY_PLATOONS[c],
  }]),
) as Record<Company, ParadeStateConfig>

/** Duty types that earn points: the company's duties, Hercules' (brigade) Duty Clerk, then Guard Duty (kept in Exceptions). */
export function pointsDutyTypes(company: Company): string[] {
  const base = PARADE_CONFIG[company].visibleDutyTypes.length > 0 ? PARADE_CONFIG[company].visibleDutyTypes : ALL_DUTY_TYPES
  return [...base, ...(company === 'hercules' ? ['Duty Clerk'] : []), 'Guard Duty']
}

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

/** Tailwind class set for one company's accent colour. */
export type CompanyTheme = (typeof COMPANY_THEMES)[Company]
