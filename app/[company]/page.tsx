import { notFound } from 'next/navigation'
import { COMPANIES, DISABLED_COMPANIES, companyLabel } from '@/shared/companies'
import CompanyContent from '@/frontend/components/layout/CompanyContent'
import ComingSoon from '@/frontend/components/shared/ComingSoon'

/** Pre-renders one page per company for the static export. */
export function generateStaticParams() {
  return COMPANIES.map((company) => ({ company }))
}

/** A company's main page with its tabs; 404 for unknown companies. */
export default async function CompanyPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: companyParam } = await params
  if (!(COMPANIES as readonly string[]).includes(companyParam)) notFound()
  const company = companyParam as (typeof COMPANIES)[number]

  if (DISABLED_COMPANIES.has(company)) return <ComingSoon company={company} />

  return (
    <CompanyContent
      company={company}
      label={companyLabel(company)}
    />
  )
}
