import { notFound } from 'next/navigation'
import { COMPANIES, DISABLED_COMPANIES, companyLabel } from '@/lib/companies'
import DutyDashboard from '@/components/DutyDashboard'

export function generateStaticParams() {
  return COMPANIES.map((company) => ({ company }))
}

export default async function DashboardPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: companyParam } = await params
  if (!(COMPANIES as readonly string[]).includes(companyParam)) notFound()
  const company = companyParam as (typeof COMPANIES)[number]

  if (DISABLED_COMPANIES.has(company)) {
    return (
      <main className="min-h-screen bg-amber-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800 mb-1">Coming Soon</p>
          <p className="text-sm text-gray-400">{companyLabel(company)} Company is not yet available.</p>
        </div>
      </main>
    )
  }

  return <DutyDashboard company={company} label={companyLabel(company)} />
}
