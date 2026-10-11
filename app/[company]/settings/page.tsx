import { notFound } from 'next/navigation'
import { COMPANIES, DISABLED_COMPANIES, companyLabel } from '@/shared/companies'
import SettingsPage from '@/frontend/components/settings/SettingsPage'
import ComingSoon from '@/frontend/components/shared/ComingSoon'

/** Pre-renders one settings page per company for the static export. */
export function generateStaticParams() {
  return COMPANIES.map((company) => ({ company }))
}

/** A company's settings page; 404 for unknown companies. */
export default async function CompanySettingsPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: companyParam } = await params
  if (!(COMPANIES as readonly string[]).includes(companyParam)) notFound()
  const company = companyParam as (typeof COMPANIES)[number]

  if (DISABLED_COMPANIES.has(company)) return <ComingSoon company={company} />

  return <SettingsPage company={company} label={companyLabel(company)} />
}
