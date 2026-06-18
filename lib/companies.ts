export const COMPANIES = ['archer', 'braves', 'cougar', 'stallion', 'hercules'] as const
export type Company = (typeof COMPANIES)[number]

export const COMPANY_LABELS: Record<Company, string> = {
  archer: 'Archer',
  braves: 'Braves',
  cougar: 'Cougar',
  stallion: 'Stallion',
  hercules: 'Hercules',
}

export function isValidCompany(slug: string): slug is Company {
  return (COMPANIES as readonly string[]).includes(slug)
}
