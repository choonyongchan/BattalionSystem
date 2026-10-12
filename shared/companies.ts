/** Every company with tables in the database. */
export const COMPANIES = ['archer', 'braves', 'cougar', 'stallion', 'hercules', 'test'] as const
export type Company = (typeof COMPANIES)[number]

/** The company served at the site root; the only one live for now. */
export const PRIMARY_COMPANY: Company = 'hercules'

/** Companies showing "coming soon"; their tables and code stay so they can be switched back on here. */
export const DISABLED_COMPANIES = new Set<Company>(['archer', 'braves', 'cougar', 'stallion'])

/** Capitalised company name, e.g. "hercules" -> "Hercules". */
export function companyLabel(company: Company) {
  return company[0].toUpperCase() + company.slice(1)
}

/** The six parade-state exception sections in print order: never renamed, merged or split. */
export const STD_SCOPES: { key: string; label: string }[] = [
  { key: 'Att C',       label: 'ATT C' },
  { key: 'Status',      label: 'STATUS' },
  { key: 'Report Sick', label: 'REPORT SICK' },
  { key: 'MA',          label: 'MA' },
  { key: 'Off/Leave',   label: 'OFF/LEAVE' },
  { key: 'Others',      label: 'OTHERS' },
]

/** A parade-state block below COY HQ. `key` is what Soldier.platoon stores. */
export interface PlatoonBlock {
  key: string
  label: string
  pdsLabel: string
}

/** Site path for a company page: the primary company lives at the root, e.g. companyHref('test', 'settings') -> '/test/settings/'. */
export function companyHref(company: Company, page = ''): string {
  const base = company === PRIMARY_COMPANY ? '/' : `/${company}/`
  return page ? `${base}${page}/` : base
}
