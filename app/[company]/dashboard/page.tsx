import { notFound } from 'next/navigation'
import { COMPANIES, DISABLED_COMPANIES, companyLabel } from '@/shared/companies'
import DutyDashboard from '@/frontend/components/dashboard/DutyDashboard'
import ComingSoon from '@/frontend/components/shared/ComingSoon'

/** Pre-renders one dashboard page per company for the static export. */
export function generateStaticParams() {
  return COMPANIES.map((company) => ({ company }))
}

/** Standalone duty dashboard route for a company. */
export default async function DashboardPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: companyParam } = await params
  if (!(COMPANIES as readonly string[]).includes(companyParam)) notFound()
  const company = companyParam as (typeof COMPANIES)[number]

  if (DISABLED_COMPANIES.has(company)) return <ComingSoon company={company} />

  return <DutyDashboard company={company} label={companyLabel(company)} />
}
