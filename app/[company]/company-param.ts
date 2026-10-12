import { notFound } from 'next/navigation'
import { COMPANIES, type Company } from '@/shared/companies'

/** Pre-renders one page per company for the static export. */
export function generateStaticParams() {
  return COMPANIES.map((company) => ({ company }))
}

/** Resolves the [company] route param, or 404s for an unknown company. */
export async function companyFromParams(params: Promise<{ company: string }>): Promise<Company> {
  const { company } = await params
  if (!(COMPANIES as readonly string[]).includes(company)) notFound()
  return company as Company
}
