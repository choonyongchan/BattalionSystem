import { notFound } from 'next/navigation'
import { COMPANIES, COMPANY_LABELS, isValidCompany } from '@/lib/companies'
import CompanyContent from '@/components/CompanyContent'

export function generateStaticParams() {
  return COMPANIES.map((company) => ({ company }))
}

export default function CompanyPage({ params }: { params: { company: string } }) {
  if (!isValidCompany(params.company)) notFound()
  return (
    <CompanyContent
      company={params.company}
      label={COMPANY_LABELS[params.company]}
    />
  )
}
