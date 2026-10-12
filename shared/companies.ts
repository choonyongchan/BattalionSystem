export const COMPANIES = ['archer', 'braves', 'cougar', 'stallion', 'hercules', 'test'] as const
export type Company = (typeof COMPANIES)[number]

/** The company served at the site root; the only one live for now. */
export const PRIMARY_COMPANY: Company = 'hercules'

// Other companies keep their tables and code so they can be switched back on here
export const DISABLED_COMPANIES = new Set<Company>(['archer', 'braves', 'cougar', 'stallion'])
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



/** Site path for a company page: the primary company lives at the root, e.g. companyHref('test', 'settings') -> '/test/settings/'. */
export function companyHref(company: Company, page = ''): string {
  const base = company === PRIMARY_COMPANY ? '/' : `/${company}/`
  return page ? `${base}${page}/` : base
}
