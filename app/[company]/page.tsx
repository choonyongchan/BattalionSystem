import { DISABLED_COMPANIES, PRIMARY_COMPANY, companyHref, companyLabel } from '@/shared/companies'
import CompanyContent from '@/frontend/components/layout/CompanyContent'
import ComingSoon from '@/frontend/components/shared/ComingSoon'
import Redirect from '@/frontend/components/shared/Redirect'
import { companyFromParams } from './company-param'

export { generateStaticParams } from './company-param'

/** A non-primary company's workspace; the primary company moved to the site root. */
export default async function CompanyPage({ params }: { params: Promise<{ company: string }> }) {
  const company = await companyFromParams(params)
  if (company === PRIMARY_COMPANY) return <Redirect to={companyHref(company)} />
  if (DISABLED_COMPANIES.has(company)) return <ComingSoon company={company} />
  return <CompanyContent company={company} label={companyLabel(company)} />
}
