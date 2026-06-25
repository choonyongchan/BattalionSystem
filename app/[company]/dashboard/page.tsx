import { notFound } from 'next/navigation'
import { COMPANIES, DISABLED_COMPANIES, companyLabel } from '@/lib/companies'
import DutyDashboard from '@/components/DutyDashboard'
import ComingSoon from '@/components/ComingSoon'

export function generateStaticParams() {
  return COMPANIES.map((company) => ({ company }))
}

export default async function DashboardPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: companyParam } = await params
  if (!(COMPANIES as readonly string[]).includes(companyParam)) notFound()
  const company = companyParam as (typeof COMPANIES)[number]

  if (DISABLED_COMPANIES.has(company)) return <ComingSoon company={company} />

  return <DutyDashboard company={company} label={companyLabel(company)} />
}
