import { notFound } from 'next/navigation'
import { COMPANIES, COMPANY_LABELS } from '@/lib/companies'
import CompanyContent from '@/components/CompanyContent'

export function generateStaticParams() {
  return COMPANIES.map((company) => ({ company }))
}

export default function CompanyPage({ params }: { params: { company: string } }) {
  if (!(COMPANIES as readonly string[]).includes(params.company)) notFound()
  const company = params.company as (typeof COMPANIES)[number]
  return (
    <CompanyContent
      company={company}
      label={COMPANY_LABELS[company]}
    />
  )
}
